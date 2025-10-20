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
   * Offset within the same position (for multiple events in same transaction)
   * Required for exact deduplication - Zitadel Go v2 pattern
   */
  positionOffset: number;

  /**
   * Last update timestamp
   */
  lastUpdated: Date;

  /**
   * Timestamp of last processed event (optional - for enhanced tracking)
   */
  eventTimestamp?: Date | null;

  /**
   * Instance ID that owns the lock (optional - for multi-instance tracking)
   */
  instanceID?: string | null;

  /**
   * Last processed aggregate type (optional - for exact deduplication)
   */
  aggregateType?: string | null;

  /**
   * Last processed aggregate ID (optional - for exact deduplication)
   */
  aggregateID?: string | null;

  /**
   * Last processed sequence number (optional - for exact deduplication)
   */
  sequence?: number | null;
}

/**
 * Current state tracker for projections
 */
export class CurrentStateTracker {
  private readonly database: DatabasePool;
  private readonly tableName = 'projection_states';

  constructor(database: DatabasePool) {
    this.database = database;
  }

  /**
   * Get current state for a projection
   */
  async getCurrentState(projectionName: string): Promise<CurrentState | null> {
    const result = await this.database.query(
      `SELECT 
        name as "projectionName",
        position,
        position_offset as "positionOffset",
        event_timestamp as "eventTimestamp",
        updated_at as "lastUpdated",
        instance_id as "instanceID",
        aggregate_type as "aggregateType",
        aggregate_id as "aggregateID",
        sequence
      FROM ${this.tableName}
      WHERE name = $1`,
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
    positionOffset: number,
    eventTimestamp?: Date | null,
    instanceID?: string | null,
    aggregateType?: string | null,
    aggregateID?: string | null,
    sequence?: number | null
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO ${this.tableName} (
        name,
        position,
        position_offset,
        event_timestamp,
        updated_at,
        instance_id,
        aggregate_type,
        aggregate_id,
        sequence
      ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8)
      ON CONFLICT (name)
      DO UPDATE SET
        position = EXCLUDED.position,
        position_offset = EXCLUDED.position_offset,
        event_timestamp = COALESCE(EXCLUDED.event_timestamp, ${this.tableName}.event_timestamp),
        updated_at = NOW(),
        instance_id = COALESCE(EXCLUDED.instance_id, ${this.tableName}.instance_id),
        aggregate_type = COALESCE(EXCLUDED.aggregate_type, ${this.tableName}.aggregate_type),
        aggregate_id = COALESCE(EXCLUDED.aggregate_id, ${this.tableName}.aggregate_id),
        sequence = COALESCE(EXCLUDED.sequence, ${this.tableName}.sequence)`,
      [
        projectionName,
        position,
        positionOffset,
        eventTimestamp ?? null,
        instanceID ?? null,
        aggregateType ?? null,
        aggregateID ?? null,
        sequence ?? null,
      ]
    );
  }

  /**
   * Get last event timestamp for a projection
   */
  async getLastEventTimestamp(projectionName: string): Promise<Date | null> {
    const result = await this.database.query(
      `SELECT event_timestamp FROM ${this.tableName} WHERE name = $1`,
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
  async getAllProjectionStates(): Promise<CurrentState[]> {
    const result = await this.database.query(
      `SELECT 
        name as "projectionName",
        position,
        event_timestamp as "eventTimestamp",
        updated_at as "lastUpdated",
        instance_id as "instanceID",
        aggregate_type as "aggregateType",
        aggregate_id as "aggregateID",
        sequence
      FROM ${this.tableName}
      ORDER BY name`
    );

    return result.rows as CurrentState[];
  }

  /**
   * Alias for getAllProjectionStates for backwards compatibility
   */
  async getAllStates(): Promise<CurrentState[]> {
    return this.getAllProjectionStates();
  }

  /**
   * Delete projection state (for rebuild)
   */
  async deleteState(projectionName: string): Promise<void> {
    await this.database.query(
      `DELETE FROM ${this.tableName} WHERE name = $1`,
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
   * Note: The table is created by migrations (002_01, 002_50, 002_51)
   * This method now only ensures the monitoring index exists
   */
  async init(): Promise<void> {
    // Index is created by migration 002_51 - no action needed
    // Just ensure table exists (already created by migration 002_01)
  }
}
