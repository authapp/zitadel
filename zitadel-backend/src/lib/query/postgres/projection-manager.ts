/**
 * Projection manager for materializing events into read models
 */

import { Pool } from 'pg';
import { Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database';
import {
  ProjectionManager,
  ProjectionConfig,
  ProjectionState,
  ProjectionStatus,
  ProjectionError,
} from '../types';

/**
 * PostgreSQL projection manager implementation
 */
export class PostgresProjectionManager implements ProjectionManager {
  private projections = new Map<string, ProjectionConfig>();
  private running = new Map<string, boolean>();
  private intervals = new Map<string, NodeJS.Timeout>();
  private pool: Pool;

  constructor(
    poolOrDb: Pool | DatabasePool,
    private eventStore: Eventstore
  ) {
    // Support both Pool and DatabasePool
    this.pool = poolOrDb instanceof DatabasePool ? (poolOrDb as any).pool : poolOrDb;
  }

  /**
   * Register a projection
   */
  async register(config: ProjectionConfig): Promise<void> {
    // Validate configuration
    if (!config.name) {
      throw new ProjectionError('Projection name is required', '');
    }

    if (!config.table) {
      throw new ProjectionError('Projection table is required', config.name);
    }

    if (!config.handler) {
      throw new ProjectionError('Projection handler is required', config.name);
    }

    // Store configuration
    this.projections.set(config.name, {
      ...config,
      batchSize: config.batchSize ?? 100,
      parallelism: config.parallelism ?? 1,
      rebuildOnStart: config.rebuildOnStart ?? false,
    });

    // Initialize projection state in database
    await this.initializeState(config.name);

    // Rebuild if configured
    if (config.rebuildOnStart) {
      await this.rebuild(config.name);
    }
  }

  /**
   * Start a projection
   */
  async start(name: string): Promise<void> {
    const config = this.projections.get(name);
    if (!config) {
      throw new ProjectionError(`Projection ${name} not registered`, name);
    }

    if (this.running.get(name)) {
      return; // Already running
    }

    this.running.set(name, true);

    // Update state to running
    await this.updateState(name, { status: ProjectionStatus.RUNNING });

    // Start processing events
    await this.processEvents(name);

    // Set up interval for continuous processing
    const interval = setInterval(async () => {
      if (this.running.get(name)) {
        await this.processEvents(name);
      }
    }, 1000); // Process every second

    this.intervals.set(name, interval);
  }

  /**
   * Stop a projection
   */
  async stop(name: string): Promise<void> {
    this.running.set(name, false);

    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }

    await this.updateState(name, { status: ProjectionStatus.STOPPED });
  }

  /**
   * Rebuild a projection from scratch
   */
  async rebuild(name: string): Promise<void> {
    const config = this.projections.get(name);
    if (!config) {
      throw new ProjectionError(`Projection ${name} not registered`, name);
    }

    // Stop if running
    const wasRunning = this.running.get(name);
    if (wasRunning) {
      await this.stop(name);
    }

    try {
      // Update state to rebuilding
      await this.updateState(name, {
        status: ProjectionStatus.REBUILDING,
        position: 0n,
      });

      // Clear projection table with CASCADE to handle foreign keys
      await this.pool.query(`TRUNCATE TABLE ${config.table} CASCADE`);

      // Reset position to beginning
      await this.updateState(name, { position: 0n });

      // Process all events
      await this.processEvents(name);

      // Update state to stopped
      await this.updateState(name, { status: ProjectionStatus.STOPPED });

      // Restart if it was running
      if (wasRunning) {
        await this.start(name);
      }
    } catch (error) {
      await this.updateState(name, {
        status: ProjectionStatus.ERROR,
        lastError: String(error),
      });
      throw error;
    }
  }

  /**
   * Get projection status
   */
  async getStatus(name: string): Promise<ProjectionState | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM projection_states WHERE name = $1',
        [name]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        name: row.name,
        position: BigInt(row.position),
        status: row.status,
        errorCount: row.error_count,
        lastError: row.last_error,
        lastProcessedAt: row.last_processed_at,
      };
    } catch (error) {
      throw new ProjectionError(`Failed to get status: ${error}`, name);
    }
  }

  /**
   * List all projections
   */
  async list(): Promise<ProjectionState[]> {
    try {
      const result = await this.pool.query('SELECT * FROM projection_states ORDER BY name');
      return result.rows.map(row => ({
        name: row.name,
        position: BigInt(row.position),
        status: row.status,
        errorCount: row.error_count,
        lastError: row.last_error,
        lastProcessedAt: row.last_processed_at,
      }));
    } catch (error) {
      throw new ProjectionError(`Failed to list projections: ${error}`, 'list');
    }
  }

  /**
   * Close all projections
   */
  async close(): Promise<void> {
    // Stop all running projections
    for (const name of this.projections.keys()) {
      if (this.running.get(name)) {
        await this.stop(name);
      }
    }

    // Clear all data
    this.projections.clear();
    this.running.clear();
    this.intervals.clear();
  }

  /**
   * Initialize projection state
   */
  private async initializeState(name: string): Promise<void> {
    try {
      await this.pool.query(
        `
        INSERT INTO projection_states (name, position, status, error_count)
        VALUES ($1, 0, $2, 0)
        ON CONFLICT (name) DO NOTHING
        `,
        [name, ProjectionStatus.STOPPED]
      );
    } catch (error) {
      throw new ProjectionError(`Failed to initialize state: ${error}`, name);
    }
  }

  /**
   * Update projection state
   */
  private async updateState(
    name: string,
    updates: Partial<ProjectionState>
  ): Promise<void> {
    try {
      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.position !== undefined && updates.position !== null) {
        setParts.push(`position = $${paramIndex++}`);
        const posValue = typeof updates.position === 'bigint' ? updates.position.toString() : String(updates.position);
        values.push(posValue);
      }

      if (updates.status !== undefined) {
        setParts.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }

      if (updates.lastError !== undefined) {
        setParts.push(`last_error = $${paramIndex++}`);
        values.push(updates.lastError);
      }

      if (updates.errorCount !== undefined && updates.errorCount !== null) {
        setParts.push(`error_count = $${paramIndex++}`);
        values.push(Number(updates.errorCount) || 0);
      }

      setParts.push(`last_processed_at = $${paramIndex++}`);
      values.push(new Date());

      values.push(name);

      await this.pool.query(
        `UPDATE projection_states SET ${setParts.join(', ')} WHERE name = $${paramIndex}`,
        values
      );
    } catch (error) {
      throw new ProjectionError(`Failed to update state: ${error}`, name);
    }
  }

  /**
   * Process events for a projection
   */
  private async processEvents(name: string): Promise<void> {
    const config = this.projections.get(name);
    if (!config) {
      return;
    }

    try {
      // Get current position
      const state = await this.getStatus(name);
      if (!state) {
        return;
      }

      const position = state.position;

      // Query events from eventstore
      const events = await this.eventStore.query({
        eventTypes: config.eventTypes,
        position: { position: BigInt(position), inPositionOrder: 0 },
        limit: config.batchSize || 100,
      });

      if (events.length === 0) {
        return; // No new events
      }

      // Process each event
      for (const event of events) {
        try {
          await this.processEvent(config, event);
        } catch (error) {
          // Increment error count
          const errorCount = state.errorCount + 1;
          await this.updateState(name, {
            errorCount,
            lastError: String(error),
          });

          // Stop projection if too many errors
          if (errorCount >= 10) {
            await this.updateState(name, { status: ProjectionStatus.ERROR });
            this.running.set(name, false);
          }

          throw error;
        }
      }

      // Update position to last processed event
      const lastEvent = events[events.length - 1];
      await this.updateState(name, {
        position: lastEvent.position.position,
        errorCount: 0,
        lastError: undefined,
      });
    } catch (error) {
      throw new ProjectionError(`Failed to process events: ${error}`, name);
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(config: ProjectionConfig, event: any): Promise<void> {
    // Get current state from projection table
    const currentState = await this.getCurrentProjectionState(config.table, event.aggregateID);

    // Apply event handler
    // Handler can return:
    // - null: indicates handler managed the database write (or delete)
    // - object: state to be upserted by projection manager
    const newState = await config.handler(event, currentState);

    // If handler returns a state object, use generic upsert
    // If handler returns null, it has already handled the database operation
    if (newState !== null && newState !== undefined) {
      // Upsert the new state
      await this.upsertProjection(config.table, event.aggregateID, newState);
    }
  }

  /**
   * Get current projection state
   */
  private async getCurrentProjectionState(table: string, id: string): Promise<any | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM ${table} WHERE id = $1`,
        [id]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Upsert projection state
   */
  private async upsertProjection(table: string, _id: string, state: any): Promise<void> {
    const fields = Object.keys(state);
    const values = Object.values(state);
    const placeholders = fields.map((_, i) => `$${i + 1}`);

    const updateParts = fields
      .filter(f => f !== 'id')
      .map(f => `${f} = EXCLUDED.${f}`);

    const sql = `
      INSERT INTO ${table} (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (id) DO UPDATE SET ${updateParts.join(', ')}
    `;

    await this.pool.query(sql, values);
  }

  /**
   * Delete projection
   * Note: Currently unused as handlers manage deletes themselves,
   * but kept for generic projection support in the future
   */
  // @ts-ignore - kept for future use
  private async deleteProjection(table: string, id: string): Promise<void> {
    await this.pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  }
}
