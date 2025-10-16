/**
 * Projection Registry
 * 
 * Manages all projections in the system.
 * Handles registration, lifecycle, and health monitoring.
 */

import { Projection } from './projection';
import { ProjectionHandler } from './projection-handler';
import { ProjectionConfig, applyProjectionDefaults } from './projection-config';
import { CurrentStateTracker } from './current-state';
import { FailedEventHandler } from './failed-events';
import { Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database/pool';

/**
 * Projection registry configuration
 */
export interface ProjectionRegistryConfig {
  eventstore: Eventstore;
  database: DatabasePool;
}

/**
 * Projection health information
 */
export interface ProjectionHealth {
  name: string;
  healthy: boolean;
  currentPosition: number;
  lag: number;
  lastProcessed: Date | null;
  errorCount: number;
  state: string;
}

/**
 * Projection registry
 */
export class ProjectionRegistry {
  private readonly eventstore: Eventstore;
  private readonly database: DatabasePool;
  private readonly stateTracker: CurrentStateTracker;
  private readonly failedEventHandler: FailedEventHandler;
  
  private readonly handlers = new Map<string, ProjectionHandler>();
  private initialized: boolean = false;

  constructor(config: ProjectionRegistryConfig) {
    this.eventstore = config.eventstore;
    this.database = config.database;
    this.stateTracker = new CurrentStateTracker(config.database);
    this.failedEventHandler = new FailedEventHandler(config.database);
  }

  /**
   * Initialize the registry
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize state tracking tables
    await this.stateTracker.init();
    await this.failedEventHandler.init();
    await this.initLockTable();

    this.initialized = true;
  }

  /**
   * Register a projection
   * 
   * @param config - Projection configuration
   * @param projection - Projection instance
   */
  register(config: ProjectionConfig, projection: Projection): void {
    if (this.handlers.has(config.name)) {
      throw new Error(`Projection ${config.name} is already registered`);
    }

    // Validate that projection name matches config
    if (projection.name !== config.name) {
      throw new Error(`Projection name mismatch: projection.name="${projection.name}" but config.name="${config.name}"`);
    }

    // Apply defaults to config
    const handlerConfig = applyProjectionDefaults(config);

    // Create handler
    const handler = new ProjectionHandler(
      projection,
      handlerConfig,
      this.eventstore,
      this.database
    );

    this.handlers.set(config.name, handler);
  }

  /**
   * Unregister a projection
   */
  async unregister(projectionName: string): Promise<void> {
    const handler = this.handlers.get(projectionName);
    if (!handler) {
      return;
    }

    // Stop the handler if running
    if (handler.isRunning()) {
      await handler.stop();
    }

    this.handlers.delete(projectionName);
  }

  /**
   * Get a projection handler
   */
  get(projectionName: string): ProjectionHandler | undefined {
    return this.handlers.get(projectionName);
  }

  /**
   * Get all projection handlers
   */
  getAll(): ProjectionHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Get all projection names
   */
  getNames(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Start a specific projection
   */
  async start(projectionName: string): Promise<void> {
    const handler = this.handlers.get(projectionName);
    if (!handler) {
      throw new Error(`Projection ${projectionName} not found`);
    }

    await handler.start();
  }

  /**
   * Stop a specific projection
   */
  async stop(projectionName: string): Promise<void> {
    const handler = this.handlers.get(projectionName);
    if (!handler) {
      throw new Error(`Projection ${projectionName} not found`);
    }

    await handler.stop();
  }

  /**
   * Start all projections
   */
  async startAll(): Promise<void> {
    // Ensure registry is initialized
    if (!this.initialized) {
      await this.init();
    }

    // Start all handlers
    const startPromises: Promise<void>[] = [];
    
    for (const handler of this.handlers.values()) {
      if (!handler.isRunning()) {
        startPromises.push(handler.start());
      }
    }

    await Promise.all(startPromises);
  }

  /**
   * Stop all projections
   */
  async stopAll(): Promise<void> {
    const stopPromises: Promise<void>[] = [];
    
    for (const handler of this.handlers.values()) {
      if (handler.isRunning()) {
        stopPromises.push(handler.stop());
      }
    }

    await Promise.all(stopPromises);
  }

  /**
   * Reset a projection (delete data and restart from beginning)
   */
  async reset(projectionName: string): Promise<void> {
    const handler = this.handlers.get(projectionName);
    if (!handler) {
      throw new Error(`Projection ${projectionName} not found`);
    }

    // Stop the handler
    if (handler.isRunning()) {
      await handler.stop();
    }

    // TODO: Get projection from handler and call reset
    // This requires storing projection reference in handler
    
    // Restart the handler
    await handler.start();
  }

  /**
   * Reset all projections
   */
  async resetAll(): Promise<void> {
    for (const name of this.getNames()) {
      await this.reset(name);
    }
  }

  /**
   * Get health status for all projections
   */
  async getHealth(): Promise<ProjectionHealth[]> {
    const healthPromises = this.getNames().map(async (name) => {
      return this.getProjectionHealth(name);
    });

    return Promise.all(healthPromises);
  }

  /**
   * Get health status for a specific projection
   */
  async getProjectionHealth(projectionName: string): Promise<ProjectionHealth> {
    const handler = this.handlers.get(projectionName);
    if (!handler) {
      return {
        name: projectionName,
        healthy: false,
        currentPosition: 0,
        lag: 0,
        lastProcessed: null,
        errorCount: 0,
        state: 'not_found',
      };
    }

    // Get current state
    const state = await this.stateTracker.getCurrentState(projectionName);
    
    // Get latest event position from eventstore
    const latestPosition = await this.getLatestEventPosition();
    
    // Calculate lag
    const lag = state ? latestPosition - state.position : latestPosition;

    return {
      name: projectionName,
      healthy: handler.isRunning() && handler.getErrorCount() < 5 && lag < 1000,
      currentPosition: typeof state?.position === 'string' ? parseFloat(state.position) : (state?.position || 0),
      lag,
      lastProcessed: state?.lastUpdated || null,
      errorCount: handler.getErrorCount(),
      state: handler.getState(),
    };
  }

  /**
   * Get latest event position from eventstore
   */
  private async getLatestEventPosition(): Promise<number> {
    try {
      // Query the latest event position
      const result = await this.database.query(
        'SELECT MAX(position) as max_position FROM events'
      );
      
      if (result.rows.length > 0 && result.rows[0].max_position !== null) {
        return parseFloat(result.rows[0].max_position);
      }
      
      return 0;
    } catch (error) {
      console.error('Error getting latest event position:', error);
      return 0;
    }
  }

  /**
   * Get failed events for a projection
   */
  async getFailedEvents(projectionName: string) {
    return this.failedEventHandler.getFailedEvents(projectionName);
  }

  /**
   * Get failed event statistics
   */
  async getFailedEventStats() {
    return this.failedEventHandler.getFailedEventStats();
  }

  /**
   * Clear failed events for a projection
   */
  async clearFailedEvents(projectionName: string): Promise<void> {
    await this.failedEventHandler.clearFailedEvents(projectionName);
  }

  /**
   * Get current states for all projections
   */
  async getAllStates() {
    return this.stateTracker.getAllStates();
  }

  /**
   * Initialize lock table
   */
  private async initLockTable(): Promise<void> {
    // Try to create the table
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS projection_locks (
        projection_name TEXT PRIMARY KEY,
        instance_id TEXT,
        acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      )
    `);

    // Create index on expires_at for cleanup
    await this.database.query(`
      CREATE INDEX IF NOT EXISTS idx_projection_locks_expires_at 
      ON projection_locks (expires_at)
    `);

    // Clean up expired locks
    await this.database.query(`
      DELETE FROM projection_locks WHERE expires_at < NOW()
    `);
  }

  /**
   * Clean up expired locks (can be called periodically)
   */
  async cleanupExpiredLocks(): Promise<void> {
    await this.database.query(`
      DELETE FROM projection_locks WHERE expires_at < NOW()
    `);
  }
}
