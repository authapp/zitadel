/**
 * Projection Handler
 * 
 * Manages the lifecycle and event processing for a single projection.
 * Based on Zitadel Go internal/eventstore/handler/v2/handler.go
 */

import { Projection } from './projection';
import { ProjectionHandlerConfig } from './projection-config';
import { FailedEventHandler } from './failed-events';
import { Event, Eventstore, EventFilter } from '../../eventstore/types';
import { DatabasePool } from '../../database/pool';

/**
 * Projection handler state
 */
enum HandlerState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  CATCH_UP = 'catch_up',
  LIVE = 'live',
  STOPPING = 'stopping',
  ERROR = 'error',
}

/**
 * Projection handler manages event processing for a projection
 */
export class ProjectionHandler {
  private readonly projection: Projection;
  private readonly config: ProjectionHandlerConfig;
  private readonly eventstore: Eventstore;
  private readonly database: DatabasePool;
  private readonly failedEventHandler: FailedEventHandler;
  
  private state: HandlerState = HandlerState.STOPPED;
  private running: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  private lockAcquired: boolean = false;
  private errorCount: number = 0;
  private processingPromise: Promise<void> | null = null;

  constructor(
    projection: Projection,
    config: ProjectionHandlerConfig,
    eventstore: Eventstore,
    database: DatabasePool
  ) {
    this.projection = projection;
    this.config = config;
    this.eventstore = eventstore;
    this.database = database;
    this.failedEventHandler = new FailedEventHandler(database);
  }

  /**
   * Start the projection handler
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error(`Projection handler ${this.config.name} is already running`);
    }

    this.state = HandlerState.STARTING;
    this.running = true;

    try {
      // Initialize projection
      await this.projection.init();

      // Start projection
      await this.projection.start();

      // Rebuild if requested
      if (this.config.rebuildOnStart) {
        await this.projection.reset();
      }

      // Acquire lock if enabled
      if (this.config.enableLocking) {
        this.lockAcquired = await this.acquireLock();
        if (!this.lockAcquired) {
          throw new Error(`Could not acquire lock for projection ${this.config.name}`);
        }
      }

      // Start processing loop
      this.startProcessingLoop();

      this.state = HandlerState.CATCH_UP;
    } catch (error) {
      this.state = HandlerState.ERROR;
      this.running = false;
      throw error;
    }
  }

  /**
   * Stop the projection handler
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.state = HandlerState.STOPPING;
    this.running = false;

    // Stop processing loop
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    // Wait for any in-flight processing to complete
    if (this.processingPromise) {
      try {
        await this.processingPromise;
      } catch (error) {
        // Ignore errors during shutdown
      }
    }

    // Release lock
    if (this.lockAcquired) {
      await this.releaseLock();
      this.lockAcquired = false;
    }

    // Stop projection
    await this.projection.stop();

    this.state = HandlerState.STOPPED;
  }

  /**
   * Get current state
   */
  getState(): string {
    return this.state;
  }

  /**
   * Get error count
   */
  getErrorCount(): number {
    return this.errorCount;
  }

  /**
   * Check if handler is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Start the event processing loop
   */
  private startProcessingLoop(): void {
    this.processingInterval = setInterval(async () => {
      if (!this.running) {
        return;
      }

      // Skip if already processing
      if (this.processingPromise) {
        return;
      }

      try {
        // Track the processing promise so stop() can wait for it
        this.processingPromise = this.processEvents();
        await this.processingPromise;
        this.processingPromise = null;
      } catch (error) {
        this.processingPromise = null;
        this.errorCount++;
        console.error(`Error processing events for ${this.config.name}:`, error);
        
        // If too many errors, stop the handler
        if (this.errorCount >= 10) {
          console.error(`Too many errors for ${this.config.name}, stopping handler`);
          await this.stop();
        }
      }
    }, this.config.interval);
  }

  /**
   * Process a batch of events
   */
  private async processEvents(): Promise<void> {
    // Get current position
    const currentPosition = await this.projection.getCurrentPosition();

    // Get events from eventstore
    const events = await this.fetchEvents(currentPosition);

    if (events.length === 0) {
      // No new events, switch to live mode
      if (this.state === HandlerState.CATCH_UP) {
        this.state = HandlerState.LIVE;
      }
      return;
    }

    // Process events in batch
    for (const event of events) {
      await this.handleEvent(event);
    }
  }

  /**
   * Fetch events from eventstore
   */
  private async fetchEvents(fromPosition: number): Promise<Event[]> {
    try {
      // Create event filter
      const filter: EventFilter = {
        aggregateTypes: this.config.aggregateTypes.length > 0 ? this.config.aggregateTypes : undefined,
        eventTypes: this.config.eventTypes.length > 0 ? this.config.eventTypes : undefined,
        instanceID: this.config.instanceID,
        limit: this.config.batchSize,
      };

      // Query events using eventstore querier
      const result = await this.eventstore.query(filter);
      
      // Filter events that are after fromPosition
      return result.filter((e: Event) => e.position.position > fromPosition);
    } catch (error) {
      console.error(`Error fetching events for ${this.config.name}:`, error);
      return [];
    }
  }

  /**
   * Handle a single event
   */
  async handleEvent(event: Event): Promise<void> {
    try {
      // Check if event matches filter
      if (!this.shouldProcessEvent(event)) {
        // Skip this event but update position
        await this.updatePosition(event);
        return;
      }

      // Process event through projection
      await this.projection.reduce(event);

      // Update position
      await this.updatePosition(event);

      // Remove from failed events if it was there (ignore errors)
      try {
        await this.failedEventHandler.removeFailedEventByPosition(
          this.config.name,
          event.position.position
        );
      } catch (err) {
        // Ignore errors from failed event handler
      }
    } catch (error) {
      await this.handleFailedEvent(event, error as Error);
    }
  }

  /**
   * Handle a failed event
   */
  private async handleFailedEvent(event: Event, error: Error): Promise<void> {
    // Record failed event (silently fail if table doesn't exist yet)
    try {
      await this.failedEventHandler.recordFailedEvent(
        this.config.name,
        event,
        error,
        this.config.instanceID
      );
    } catch (err) {
      // Ignore errors from failed event handler (table might not exist)
    }

    // Check if we should retry (silently fail if table doesn't exist)
    try {
      const failedEvent = await this.failedEventHandler.getFailedEvent(
        this.config.name,
        event.position.position
      );

      if (failedEvent && failedEvent.failureCount >= this.config.maxRetries) {
        console.error(
          `Event ${event.position} failed ${failedEvent.failureCount} times for ${this.config.name}, skipping`
        );
        return; // Stop processing this event
      }
    } catch (err) {
      // Ignore errors from failed event handler
    }

    // Otherwise, the event will be retried on next poll
    throw error;
  }

  /**
   * Check if event should be processed
   */
  private shouldProcessEvent(event: Event): boolean {
    // Check event types
    if (
      this.config.eventTypes.length > 0 &&
      !this.config.eventTypes.includes(event.eventType)
    ) {
      return false;
    }

    // Check aggregate types
    if (
      this.config.aggregateTypes.length > 0 &&
      !this.config.aggregateTypes.includes(event.aggregateType)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Update projection position
   */
  private async updatePosition(event: Event): Promise<void> {
    await this.projection.setCurrentPosition(
      event.position.position,
      event.createdAt,
      this.config.instanceID,
      event.aggregateType,
      event.aggregateID,
      Number(event.aggregateVersion)
    );
  }

  /**
   * Acquire projection lock
   */
  private async acquireLock(): Promise<boolean> {
    try {
      const result = await this.database.query(
        `INSERT INTO projection_locks (
          projection_name,
          instance_id,
          acquired_at,
          expires_at
        ) VALUES ($1, $2, NOW(), NOW() + INTERVAL '${this.config.lockTTL} seconds')
        ON CONFLICT (projection_name) DO UPDATE SET
          instance_id = EXCLUDED.instance_id,
          acquired_at = NOW(),
          expires_at = NOW() + INTERVAL '${this.config.lockTTL} seconds'
        WHERE projection_locks.expires_at < NOW()
        RETURNING instance_id`,
        [this.config.name, this.config.instanceID]
      );

      // Check if lock was acquired - handle both null and undefined for instanceID
      if (result.rows.length === 0) return false;
      
      const lockInstanceID = result.rows[0].instance_id;
      const configInstanceID = this.config.instanceID;
      
      // Both null/undefined or both equal
      return (lockInstanceID == null && configInstanceID == null) || lockInstanceID === configInstanceID;
    } catch (error) {
      console.error(`Error acquiring lock for ${this.config.name}:`, error);
      return false;
    }
  }

  /**
   * Release projection lock
   */
  private async releaseLock(): Promise<void> {
    try {
      const whereClause = this.config.instanceID
        ? 'WHERE projection_name = $1 AND instance_id = $2'
        : 'WHERE projection_name = $1 AND instance_id IS NULL';
      
      const params = this.config.instanceID
        ? [this.config.name, this.config.instanceID]
        : [this.config.name];
      
      await this.database.query(
        `DELETE FROM projection_locks ${whereClause}`,
        params
      );
    } catch (error) {
      console.error(`Error releasing lock for ${this.config.name}:`, error);
    }
  }

  /**
   * Renew projection lock (call periodically)
   * @internal - To be wired up to a timer in future enhancement
   */
  // @ts-expect-error - Reserved for future lock renewal timer
  private async renewLock(): Promise<boolean> {
    try {
      const whereClause = this.config.instanceID
        ? 'WHERE projection_name = $1 AND instance_id = $2'
        : 'WHERE projection_name = $1 AND instance_id IS NULL';
      
      const params = this.config.instanceID
        ? [this.config.name, this.config.instanceID]
        : [this.config.name];
      
      const result = await this.database.query(
        `UPDATE projection_locks SET
          expires_at = NOW() + INTERVAL '${this.config.lockTTL} seconds'
        ${whereClause}
        RETURNING instance_id`,
        params
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error(`Error renewing lock for ${this.config.name}:`, error);
      return false;
    }
  }
}
