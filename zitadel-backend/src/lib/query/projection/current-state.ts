/**
 * Current State Tracker
 * 
 * Tracks the current position and state of projections.
 * Based on Zitadel Go internal/eventstore/handler/v2/current_state.go
 */

import { DatabasePool } from '../../database/pool';

/**
 * Current state of a projection
 */
export interface CurrentState {
  /**
   * Projection name
   */
  projectionName: string;

  /**
   * Current event position
   */
  position: number;

  /**
   * Timestamp of last processed event
   */
  eventTimestamp: Date;

  /**
   * Last update timestamp
   */
  lastUpdated: Date;

  /**
   * Instance ID that owns the lock
   */
  instanceID: string;

  /**
   * Last processed aggregate type
   */
  aggregateType: string;

  /**
   * Last processed aggregate ID
   */
  aggregateID: string;

  /**
   * Last processed sequence number
   */
  sequence: number;
}

/**
 * Current state tracker for projections
 */
export class CurrentStateTracker {
  private readonly database: DatabasePool;
  private readonly tableName = 'projections.current_states';

  constructor(database: DatabasePool) {
    this.database = database;
  }

  /**
   * Get current state for a projection
   */
  async getCurrentState(projectionName: string): Promise<CurrentState | null> {
    const result = await this.database.query(
      `SELECT 
        projection_name as "projectionName",
        position,
        event_timestamp as "eventTimestamp",
        last_updated as "lastUpdated",
        instance_id as "instanceID",
        aggregate_type as "aggregateType",
        aggregate_id as "aggregateID",
        sequence
      FROM ${this.tableName}
      WHERE projection_name = $1`,
      [projectionName]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as CurrentState;
  }

  /**
   * Update projection state
   */
  async updatePosition(
    projectionName: string,
    position: number,
    eventTimestamp: Date,
    instanceID: string | undefined,
    aggregateType: string,
    aggregateID: string,
    sequence: number
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO ${this.tableName} (
        projection_name,
        position,
        event_timestamp,
        last_updated,
        instance_id,
        aggregate_type,
        aggregate_id,
        sequence
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7)
      ON CONFLICT (projection_name)
      DO UPDATE SET
        position = EXCLUDED.position,
        event_timestamp = EXCLUDED.event_timestamp,
        last_updated = NOW(),
        instance_id = EXCLUDED.instance_id,
        aggregate_type = EXCLUDED.aggregate_type,
        aggregate_id = EXCLUDED.aggregate_id,
        sequence = EXCLUDED.sequence`,
      [
        projectionName,
        position,
        eventTimestamp,
        instanceID,
        aggregateType,
        aggregateID,
        sequence,
      ]
    );
  }

  /**
   * Get last event timestamp for a projection
   */
  async getLastEventTimestamp(projectionName: string): Promise<Date | null> {
    const result = await this.database.query(
      `SELECT event_timestamp FROM ${this.tableName} WHERE projection_name = $1`,
      [projectionName]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].event_timestamp;
  }

  /**
   * Get all projection states
   */
  async getAllStates(): Promise<CurrentState[]> {
    const result = await this.database.query(
      `SELECT 
        projection_name as "projectionName",
        position,
        event_timestamp as "eventTimestamp",
        last_updated as "lastUpdated",
        instance_id as "instanceID",
        aggregate_type as "aggregateType",
        aggregate_id as "aggregateID",
        sequence
      FROM ${this.tableName}
      ORDER BY projection_name`
    );

    return result.rows as CurrentState[];
  }

  /**
   * Delete projection state (for rebuild)
   */
  async deleteState(projectionName: string): Promise<void> {
    await this.database.query(
      `DELETE FROM ${this.tableName} WHERE projection_name = $1`,
      [projectionName]
    );
  }

  /**
   * Get projection lag (difference between latest event and projection position)
   */
  async getProjectionLag(
    projectionName: string,
    latestPosition: number
  ): Promise<number> {
    const state = await this.getCurrentState(projectionName);
    if (!state) {
      return latestPosition;
    }

    return latestPosition - state.position;
  }

  /**
   * Initialize state table if not exists
   */
  async init(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        projection_name TEXT PRIMARY KEY,
        position DECIMAL NOT NULL DEFAULT 0,
        event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        instance_id TEXT,
        aggregate_type TEXT NOT NULL DEFAULT '',
        aggregate_id TEXT NOT NULL DEFAULT '',
        sequence BIGINT NOT NULL DEFAULT 0
      )
    `);

    // Create index on last_updated for monitoring
    await this.database.query(`
      CREATE INDEX IF NOT EXISTS idx_current_states_last_updated 
      ON ${this.tableName} (last_updated DESC)
    `);
  }
}
