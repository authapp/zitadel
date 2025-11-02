/**
 * Projection Wait Helper
 * 
 * Provides utilities for waiting for projections to process events
 * after command execution. Replaces setTimeout hacks with proper
 * position-based synchronization.
 */

import { Eventstore } from '../../lib/eventstore/types';
import { CurrentStateTracker } from '../../lib/query/projection/current-state';
import { DatabasePool } from '../../lib/database/pool';

/**
 * Helper for waiting for projections to catch up after commands
 */
export class ProjectionWaitHelper {
  private readonly stateTracker: CurrentStateTracker;
  private readonly database: DatabasePool;

  constructor(
    _eventstore: Eventstore, // Reserved for future use
    database: DatabasePool
  ) {
    this.database = database;
    this.stateTracker = new CurrentStateTracker(database);
  }

  /**
   * Wait for a single projection to catch up to latest events
   * 
   * @param projectionName - Name of projection to wait for
   * @param timeout - Maximum time to wait in ms (default: 2000)
   * @throws Error if timeout is reached
   */
  async waitForProjection(
    projectionName: string,
    timeout = 2000
  ): Promise<void> {
    // Get latest event position from eventstore
    const latestPosition = await this.getLatestPosition();
    
    // Wait for projection to catch up
    await this.stateTracker.waitForPosition(projectionName, latestPosition, timeout);
  }

  /**
   * Wait for multiple projections to catch up to latest events
   * 
   * @param projectionNames - Array of projection names to wait for
   * @param timeout - Maximum time to wait in ms (default: 2000)
   * @throws Error if any projection times out
   */
  async waitForProjections(
    projectionNames: string[],
    timeout = 2000
  ): Promise<void> {
    // Get latest event position
    const latestPosition = await this.getLatestPosition();
    
    // Wait for all projections in parallel
    await Promise.all(
      projectionNames.map(name =>
        this.stateTracker.waitForPosition(name, latestPosition, timeout)
      )
    );
  }

  /**
   * Get latest event position from eventstore
   * Returns 0 if no events exist yet
   */
  private async getLatestPosition(): Promise<number> {
    try {
      const result = await this.database.query(`
        SELECT MAX(position) as latest_position
        FROM public.events
      `);
      
      const position = Number(result.rows[0]?.latest_position ?? 0);
      return position;
    } catch (error) {
      // If table doesn't exist or query fails, return 0
      console.error('Error getting latest position:', error);
      return 0;
    }
  }

  /**
   * Check if projection is healthy and caught up
   * 
   * @param projectionName - Name of projection to check
   * @param maxLag - Maximum acceptable lag in ms (default: 1000)
   * @returns true if projection is healthy
   */
  async isProjectionHealthy(
    projectionName: string,
    maxLag = 1000
  ): Promise<boolean> {
    try {
      const latestPosition = await this.getLatestPosition();
      const lag = await this.stateTracker.getProjectionLag(projectionName, latestPosition);
      
      return lag <= maxLag;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Create a projection wait helper instance
 * 
 * @param eventstore - Eventstore instance
 * @param database - Database pool
 * @returns ProjectionWaitHelper instance
 */
export function createProjectionWaitHelper(
  eventstore: Eventstore,
  database: DatabasePool
): ProjectionWaitHelper {
  return new ProjectionWaitHelper(eventstore, database);
}
