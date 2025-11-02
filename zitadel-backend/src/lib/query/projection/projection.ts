/**
 * Projection Base Class
 * 
 * Abstract base class for all projections in the system.
 * Projections materialize events into read models.
 * 
 * Based on Zitadel Go internal/eventstore/handler/v2/projection.go
 */

import { Event } from '../../eventstore/types';
import { Eventstore } from '../../eventstore/types';
import { DatabasePool, QueryExecutor } from '../../database/pool';
import { CurrentStateTracker } from './current-state';
import { Subscription, globalSubscriptionManager } from '../../eventstore/subscription';

/**
 * Abstract projection base class
 * 
 * All projections must extend this class and implement the reduce method.
 * Configuration is managed separately via ProjectionConfig.
 */
export abstract class Projection {
  /**
   * Unique name of this projection
   */
  abstract readonly name: string;

  /**
   * Database tables used by this projection
   */
  abstract readonly tables: string[];

  protected readonly eventstore: Eventstore;
  protected readonly database: DatabasePool;
  protected readonly stateTracker: CurrentStateTracker;
  protected currentTx?: QueryExecutor;
  
  // Subscription management for real-time event processing
  private subscription?: Subscription;
  private isRunning = false;
  private catchUpInterval?: NodeJS.Timeout;

  constructor(eventstore: Eventstore, database: DatabasePool) {
    this.eventstore = eventstore;
    this.database = database;
    this.stateTracker = new CurrentStateTracker(database);
  }

  /**
   * Set the current transaction executor
   * Used internally by ProjectionHandler to enable transaction-aware reduce operations
   */
  setTransaction(tx: QueryExecutor | undefined): void {
    this.currentTx = tx;
  }

  /**
   * Reduce an event into the projection
   * 
   * This is the core method that each projection must implement.
   * It processes an event and updates the read model accordingly.
   * 
   * @param event - The event to process
   * @returns Promise that resolves when the event is processed
   */
  abstract reduce(event: Event): Promise<void>;

  /**
   * Initialize the projection
   * 
   * This method is called once when the projection is first registered.
   * Use it to create database tables, indexes, etc.
   */
  abstract init(): Promise<void>;
  
  /**
   * Get event types this projection handles
   * 
   * Required for event subscription filtering.
   * Return array of event type strings that this projection processes.
   * 
   * @example
   * getEventTypes(): string[] {
   *   return ['user.added', 'user.changed', 'user.removed'];
   * }
   */
  abstract getEventTypes(): string[];

  /**
   * Cleanup the projection
   * 
   * This method is called when the projection is stopped or removed.
   * Use it to close resources, remove listeners, etc.
   */
  async cleanup(): Promise<void> {
    // Default implementation: no-op
    // Subclasses can override if they need cleanup
  }

  /**
   * Start the projection with real-time event subscription
   * 
   * Called when the projection handler starts processing events.
   * Subscribes to relevant events and processes them in real-time.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    
    // Build aggregate type map for subscription
    const aggregateTypes = new Map<string, string[]>();
    for (const eventType of this.getEventTypes()) {
      const [aggregateType] = eventType.split('.');
      if (!aggregateTypes.has(aggregateType)) {
        aggregateTypes.set(aggregateType, []);
      }
      aggregateTypes.get(aggregateType)!.push(eventType);
    }
    
    // Subscribe to events
    this.subscription = globalSubscriptionManager.subscribeEventTypes(aggregateTypes);
    
    // Process events in background
    this.processSubscription();
    
    // Schedule periodic catch-up for reliability (every 30 seconds)
    this.scheduleCatchUp();
  }

  /**
   * Stop the projection
   * 
   * Called when the projection handler stops processing events.
   * Unsubscribes from events and stops background processing.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    // Unsubscribe from events
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    
    // Clear catch-up interval
    if (this.catchUpInterval) {
      clearInterval(this.catchUpInterval);
      this.catchUpInterval = undefined;
    }
  }
  
  /**
   * Process subscription events in background
   * Runs continuously while projection is running
   */
  private async processSubscription(): Promise<void> {
    if (!this.subscription) {
      return;
    }
    
    try {
      for await (const event of this.subscription) {
        if (!this.isRunning) {
          break;
        }
        
        try {
          await this.reduce(event);
        } catch (error) {
          console.error(`Projection ${this.name} error processing event ${event.eventType}:`, error);
          // Continue processing other events
        }
      }
    } catch (error) {
      console.error(`Projection ${this.name} subscription error:`, error);
      // Subscription ended, possibly restart it
      if (this.isRunning) {
        // Wait a bit and restart subscription
        setTimeout(() => {
          if (this.isRunning) {
            this.start();
          }
        }, 5000);
      }
    }
  }
  
  /**
   * Schedule periodic catch-up processing
   * Ensures projection doesn't fall behind even if subscriptions fail
   */
  private scheduleCatchUp(): void {
    this.catchUpInterval = setInterval(async () => {
      if (!this.isRunning) {
        return;
      }
      
      try {
        // Check if we need to catch up on events
        // This is a safety mechanism in case real-time subscription misses events
        const currentPosition = await this.getCurrentPosition();
        
        // Query eventstore for events we might have missed
        // Get aggregate types this projection handles
        const aggregateTypes = new Set<string>();
        for (const eventType of this.getEventTypes()) {
          const [aggregateType] = eventType.split('.');
          aggregateTypes.add(aggregateType);
        }
        
        // Query for recent events after current position
        // This catches any events missed by real-time subscription
        const filter = {
          aggregateTypes: Array.from(aggregateTypes),
          eventTypes: this.getEventTypes(),
          position: { position: currentPosition, inTxOrder: 0 },
          limit: 1000, // Limit to 1000 events per catch-up cycle
        };
        
        const missedEvents = await this.eventstore.query(filter);
        
        // Process any missed events
        if (missedEvents.length > 0) {
          console.log(`Projection ${this.name} catching up on ${missedEvents.length} missed events`);
          for (const event of missedEvents) {
            await this.reduce(event);
          }
        }
      } catch (error) {
        console.error(`Projection ${this.name} catch-up error:`, error);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Reset the projection
   * 
   * Deletes all projection data and resets the position.
   * The projection will rebuild from scratch.
   */
  async reset(): Promise<void> {
    // Delete projection data from all tables
    for (const table of this.tables) {
      await this.database.query(`TRUNCATE TABLE ${table} CASCADE`);
    }

    // Reset position
    await this.stateTracker.deleteState(this.name);
  }

  /**
   * Get current position of the projection
   */
  async getCurrentPosition(): Promise<number> {
    const state = await this.stateTracker.getCurrentState(this.name);
    return state?.position || 0;
  }

  /**
   * Set current position of the projection
   * 
   * @param position - The position to set
   * @param positionOffset - The offset within the position (default: 0)
   * @param eventTimestamp - Optional timestamp of the event
   * @param instanceID - Optional instance ID
   * @param aggregateType - Optional aggregate type (for exact deduplication)
   * @param aggregateID - Optional aggregate ID (for exact deduplication)
   * @param sequence - Optional sequence number (for exact deduplication)
   */
  async setCurrentPosition(
    position: number,
    positionOffset: number = 0,
    eventTimestamp?: Date | null,
    instanceID?: string | null,
    aggregateType?: string | null,
    aggregateID?: string | null,
    sequence?: number | null
  ): Promise<void> {
    await this.stateTracker.updatePosition(
      this.name,
      position,
      positionOffset,
      eventTimestamp,
      instanceID,
      aggregateType,
      aggregateID,
      sequence
    );
  }

  /**
   * Check if projection is healthy
   * 
   * A projection is considered healthy if:
   * - It has processed events recently
   * - It's not too far behind
   */
  async isHealthy(): Promise<boolean> {
    try {
      const state = await this.stateTracker.getCurrentState(this.name);
      
      if (!state) {
        // No state yet, consider healthy (just starting)
        return true;
      }

      // Check if last update was recent (within 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (state.lastUpdated < fiveMinutesAgo) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Execute a query within a transaction
   * 
   * Note: This is a convenience wrapper around DatabasePool.withTransaction()
   * Use this.database.withTransaction() directly for the same functionality.
   */
  protected async transaction<T>(
    callback: (tx: QueryExecutor) => Promise<T>
  ): Promise<T> {
    return this.database.withTransaction(callback);
  }

  /**
   * Execute a database query
   * Uses current transaction if set, otherwise uses database pool
   */
  protected async query(sql: string, params?: any[]): Promise<any> {
    if (this.currentTx) {
      return this.currentTx.query(sql, params);
    }
    return this.database.query(sql, params);
  }

  /**
   * Insert a record into any table
   * 
   * Note: For single-table projections, consider using BaseRepository pattern.
   * This method supports multi-table projections.
   */
  protected async insert(
    table: string,
    data: Record<string, any>
  ): Promise<void> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');

    await this.query(
      `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
      values
    );
  }

  /**
   * Update a record in any table
   * 
   * Note: For single-table projections, consider using BaseRepository pattern.
   * This method supports multi-table projections.
   */
  protected async update(
    table: string,
    id: string,
    data: Record<string, any>
  ): Promise<void> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const sets = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    await this.query(
      `UPDATE ${table} SET ${sets} WHERE id = $${values.length + 1}`,
      [...values, id]
    );
  }

  /**
   * Delete a record from any table
   */
  protected async delete(table: string, id: string): Promise<void> {
    await this.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  }

  /**
   * Check if a record exists in any table
   */
  protected async exists(table: string, id: string): Promise<boolean> {
    const result = await this.query(
      `SELECT 1 FROM ${table} WHERE id = $1 LIMIT 1`,
      [id]
    );
    return result.rows.length > 0;
  }

  /**
   * Get a record by ID from any table
   */
  protected async getByID<T>(table: string, id: string): Promise<T | null> {
    const result = await this.query(
      `SELECT * FROM ${table} WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0] as T;
  }

  /**
   * Helper method to safely extract event payload data
   */
  protected getPayload<T>(event: Event): T {
    return event.payload as T;
  }

  /**
   * Helper method to get event creator
   */
  protected getCreator(event: Event): string {
    return event.creator;
  }

  /**
   * Helper method to get event owner
   */
  protected getOwner(event: Event): string {
    return event.owner;
  }

  /**
   * Helper method to get aggregate ID
   */
  protected getAggregateID(event: Event): string {
    return event.aggregateID;
  }

  /**
   * Helper method to get aggregate type
   */
  protected getAggregateType(event: Event): string {
    return event.aggregateType;
  }

  /**
   * Helper method to get instance ID
   */
  protected getInstanceID(event: Event): string {
    return event.instanceID;
  }
}
