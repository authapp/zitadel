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
import { DatabasePool } from '../../database/pool';
import { CurrentStateTracker } from './current-state';

/**
 * Abstract projection base class
 * 
 * All projections must extend this class and implement the reduce method.
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

  constructor(eventstore: Eventstore, database: DatabasePool) {
    this.eventstore = eventstore;
    this.database = database;
    this.stateTracker = new CurrentStateTracker(database);
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
   * Start the projection
   * 
   * Called when the projection handler starts processing events.
   */
  async start(): Promise<void> {
    // Default implementation: no-op
    // Subclasses can override for custom start logic
  }

  /**
   * Stop the projection
   * 
   * Called when the projection handler stops processing events.
   */
  async stop(): Promise<void> {
    // Default implementation: no-op
    // Subclasses can override for custom stop logic
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
   */
  async setCurrentPosition(
    position: number,
    eventTimestamp: Date,
    instanceID: string,
    aggregateType: string,
    aggregateID: string,
    sequence: number
  ): Promise<void> {
    await this.stateTracker.updateState(
      this.name,
      position,
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
   */
  protected async transaction<T>(
    callback: (client: DatabasePool) => Promise<T>
  ): Promise<T> {
    const client = this.database;
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Execute a database query
   */
  protected async query(sql: string, params?: any[]): Promise<any> {
    return this.database.query(sql, params);
  }

  /**
   * Insert a record
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
   * Update a record
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
   * Delete a record
   */
  protected async delete(table: string, id: string): Promise<void> {
    await this.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  }

  /**
   * Check if a record exists
   */
  protected async exists(table: string, id: string): Promise<boolean> {
    const result = await this.query(
      `SELECT 1 FROM ${table} WHERE id = $1 LIMIT 1`,
      [id]
    );
    return result.rows.length > 0;
  }

  /**
   * Get a record by ID
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
