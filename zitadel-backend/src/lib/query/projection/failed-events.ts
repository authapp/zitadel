/**
 * Failed Event Handler
 * 
 * Tracks and manages events that failed processing in projections.
 * Based on Zitadel Go internal/eventstore/handler/v2/failed_events.go
 */

import { DatabasePool } from '../../database/pool';
import { Event } from '../../eventstore/types';

/**
 * Failed event record
 */
export interface FailedEvent {
  /**
   * Unique ID for this failure
   */
  id: string;

  /**
   * Projection name
   */
  projectionName: string;

  /**
   * Failed event position
   */
  failedSequence: number;

  /**
   * Number of times this event has failed
   */
  failureCount: number;

  /**
   * Error message
   */
  error: string;

  /**
   * The event that failed
   */
  event: Event;

  /**
   * Last failure timestamp
   */
  lastFailed: Date;

  /**
   * Instance ID that encountered the failure
   */
  instanceID: string;
}

/**
 * Failed event statistics
 */
export interface FailedEventStats {
  totalFailed: number;
  failedByProjection: Map<string, number>;
  oldestFailure?: Date;
  newestFailure?: Date;
}

/**
 * Failed event handler
 */
export class FailedEventHandler {
  private readonly database: DatabasePool;
  private readonly tableName = 'projections.projection_failed_events';

  constructor(database: DatabasePool) {
    this.database = database;
  }

  /**
   * Record a failed event
   */
  async recordFailedEvent(
    projectionName: string,
    event: Event,
    error: Error,
    instanceID?: string
  ): Promise<void> {
    // Check if this event has already failed before
    const existing = await this.getFailedEvent(projectionName, event.position.position);

    if (existing) {
      // Increment failure count
      await this.database.query(
        `UPDATE ${this.tableName} SET
          failure_count = failure_count + 1,
          error = $1,
          last_failed = NOW(),
          instance_id = $2
        WHERE projection_name = $3 AND failed_sequence = $4`,
        [error.message, instanceID, projectionName, event.position.position]
      );
    } else {
      // Insert new failed event
      await this.database.query(
        `INSERT INTO ${this.tableName} (
          id,
          projection_name,
          position,
          failure_count,
          error,
          event_payload,
          last_failed,
          instance_id
        ) VALUES ($1, $2, $3, 1, $4, $5, NOW(), $6)`,
        [
          this.generateFailedEventID(projectionName, event.position.position),
          projectionName,
          event.position.position,
          error.message,
          JSON.stringify(event, (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
          instanceID,
        ]
      );
    }
  }

  /**
   * Get a failed event
   */
  async getFailedEvent(
    projectionName: string,
    position: number
  ): Promise<FailedEvent | null> {
    const result = await this.database.query(
      `SELECT 
        id,
        projection_name as "projectionName",
        failed_sequence as "failedSequence",
        failure_count as "failureCount",
        error,
        event_data as "eventData",
        last_failed as "lastFailed",
        instance_id as "instanceID"
      FROM ${this.tableName}
      WHERE projection_name = $1 AND failed_sequence = $2`,
      [projectionName, position]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      projectionName: row.projectionName,
      failedSequence: row.failedSequence,
      failureCount: row.failureCount,
      error: row.error,
      event: typeof row.eventData === 'string' ? JSON.parse(row.eventData) : row.eventData,
      lastFailed: row.lastFailed,
      instanceID: row.instanceID,
    };
  }

  /**
   * Get all failed events for a projection
   */
  async getFailedEvents(projectionName: string): Promise<FailedEvent[]> {
    const result = await this.database.query(
      `SELECT 
        id,
        projection_name as "projectionName",
        failed_sequence as "failedSequence",
        failure_count as "failureCount",
        error,
        event_data as "eventData",
        last_failed as "lastFailed",
        instance_id as "instanceID"
      FROM ${this.tableName}
      WHERE projection_name = $1
      ORDER BY failed_sequence ASC`,
      [projectionName]
    );

    return result.rows.map(row => ({
      id: row.id,
      projectionName: row.projectionName,
      failedSequence: row.failedSequence,
      failureCount: row.failureCount,
      error: row.error,
      event: typeof row.eventData === 'string' ? JSON.parse(row.eventData) : row.eventData,
      lastFailed: row.lastFailed,
      instanceID: row.instanceID,
    }));
  }

  /**
   * Remove a failed event (after successful retry)
   */
  async removeFailedEvent(failedEventID: string): Promise<void> {
    await this.database.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [failedEventID]
    );
  }

  /**
   * Remove failed event by projection and position
   */
  async removeFailedEventByPosition(
    projectionName: string,
    position: number
  ): Promise<void> {
    await this.database.query(
      `DELETE FROM ${this.tableName} WHERE projection_name = $1 AND failed_sequence = $2`,
      [projectionName, position]
    );
  }

  /**
   * Get failed event statistics
   */
  async getFailedEventStats(): Promise<FailedEventStats> {
    const result = await this.database.query(`
      SELECT 
        COUNT(*) as total,
        MIN(last_failed) as oldest,
        MAX(last_failed) as newest
      FROM ${this.tableName}
    `);

    const byProjection = await this.database.query(`
      SELECT 
        projection_name,
        COUNT(*) as count
      FROM ${this.tableName}
      GROUP BY projection_name
    `);

    const stats: FailedEventStats = {
      totalFailed: parseInt(result.rows[0].total),
      failedByProjection: new Map(),
      oldestFailure: result.rows[0].oldest,
      newestFailure: result.rows[0].newest,
    };

    for (const row of byProjection.rows) {
      stats.failedByProjection.set(row.projection_name, parseInt(row.count));
    }

    return stats;
  }

  /**
   * Clear all failed events for a projection
   */
  async clearFailedEvents(projectionName: string): Promise<void> {
    await this.database.query(
      `DELETE FROM ${this.tableName} WHERE projection_name = $1`,
      [projectionName]
    );
  }

  /**
   * Get events that have failed more than max retries
   */
  async getPermanentlyFailedEvents(
    projectionName: string,
    maxRetries: number
  ): Promise<FailedEvent[]> {
    const result = await this.database.query(
      `SELECT 
        id,
        projection_name as "projectionName",
        failed_sequence as "failedSequence",
        failure_count as "failureCount",
        error,
        event_data as "eventData",
        last_failed as "lastFailed",
        instance_id as "instanceID"
      FROM ${this.tableName}
      WHERE projection_name = $1 AND failure_count >= $2
      ORDER BY failed_sequence ASC`,
      [projectionName, maxRetries]
    );

    return result.rows.map(row => ({
      id: row.id,
      projectionName: row.projectionName,
      failedSequence: row.failedSequence,
      failureCount: row.failureCount,
      error: row.error,
      event: typeof row.eventData === 'string' ? JSON.parse(row.eventData) : row.eventData,
      lastFailed: row.lastFailed,
      instanceID: row.instanceID,
    }));
  }

  /**
   * Generate failed event ID
   */
  private generateFailedEventID(projectionName: string, position: number): string {
    return `${projectionName}:${position}`;
  }

  /**
   * Initialize failed events table
   */
  async init(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        projection_name TEXT NOT NULL,
        failed_sequence DECIMAL NOT NULL,
        failure_count INT NOT NULL DEFAULT 1,
        error TEXT NOT NULL,
        event_data JSONB NOT NULL,
        last_failed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        instance_id TEXT NOT NULL,
        UNIQUE(projection_name, failed_sequence)
      )
    `);

    // Create indexes
    await this.database.query(`
      CREATE INDEX IF NOT EXISTS idx_failed_events_projection 
      ON ${this.tableName} (projection_name, failed_sequence)
    `);

    await this.database.query(`
      CREATE INDEX IF NOT EXISTS idx_failed_events_last_failed 
      ON ${this.tableName} (last_failed DESC)
    `);
  }
}
