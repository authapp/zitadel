/**
 * Projection Health Dashboard API
 * 
 * Provides monitoring endpoints for projection health,
 * lag, and status information.
 */

import { Request, Response, NextFunction } from 'express';
import { DatabasePool } from '../../lib/database/pool';
import { CurrentStateTracker } from '../../lib/query/projection/current-state';
import { ProjectionRegistry } from '../../lib/query/projection/projection-registry';

export interface ProjectionHealthResponse {
  name: string;
  status: string;
  position: number;
  lag: number;
  lagMs: number;
  lastProcessedAt: Date | null;
  isHealthy: boolean;
  errorCount?: number;
  lastError?: string | null;
}

export interface ProjectionHealthSummary {
  totalProjections: number;
  healthyProjections: number;
  unhealthyProjections: number;
  averageLag: number;
  maxLag: number;
  projections: ProjectionHealthResponse[];
  timestamp: Date;
}

/**
 * Create projection health handlers
 */
export function createProjectionHealthHandlers(
  pool: DatabasePool,
  registry?: ProjectionRegistry
) {
  const stateTracker = new CurrentStateTracker(pool);

  /**
   * GET /api/v1/admin/projections/health
   * Get health status for all projections
   */
  async function getProjectionHealth(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      console.log('📊 Getting projection health...');
      // Get latest position from eventstore
      const latestPositionResult = await pool.query(`
        SELECT MAX(position) as latest_position
        FROM public.events
      `);
      const latestPosition = latestPositionResult.rows[0]?.latest_position ?? 0;

      // Get all projection states
      console.log('📊 Fetching all projection states...');
      const states = await stateTracker.getAllProjectionStates();
      console.log(`📊 Found ${states.length} projection states`);

      // Get registered projections from registry (if available)
      const registeredNames: string[] = registry ? registry.getNames() : [];
      console.log(`📊 Found ${registeredNames.length} registered projections`);

      // Create a map of states by name
      const stateMap = new Map(states.map(s => [s.projectionName, s]));

      // Merge registered projections with states
      const allProjectionNames = new Set([...registeredNames, ...states.map(s => s.projectionName)]);

      // Calculate health for each projection
      const projections: ProjectionHealthResponse[] = Array.from(allProjectionNames).map(name => {
        const state = stateMap.get(name);
        const position = Number(state?.position ?? 0); // Convert from DECIMAL to Number
        const lag = Number(latestPosition) - position;
        const lagMs = lag;
        // Healthy if no events yet (position 0) OR lag < 5 seconds
        const isHealthy = position === 0 || lag <= 5000;

        return {
          name,
          status: state ? 'running' : 'initialized',
          position,
          lag,
          lagMs,
          lastProcessedAt: state?.lastUpdated ?? null,
          isHealthy,
        };
      });

      // Calculate summary statistics
      const healthyCount = projections.filter(p => p.isHealthy).length;
      const totalLag = projections.reduce((sum, p) => sum + p.lag, 0);
      const avgLag = projections.length > 0 ? totalLag / projections.length : 0;
      const maxLag = Math.max(...projections.map(p => p.lag), 0);

      const summary: ProjectionHealthSummary = {
        totalProjections: projections.length,
        healthyProjections: healthyCount,
        unhealthyProjections: projections.length - healthyCount,
        averageLag: Math.round(avgLag),
        maxLag,
        projections,
        timestamp: new Date(),
      };

      console.log(`📊 Returning health summary: ${healthyCount}/${projections.length} healthy`);
      return res.json(summary);
    } catch (error: any) {
      console.error('❌ Error in getProjectionHealth:', error.message, error.stack);
      return next(error);
    }
  }

  /**
   * GET /api/v1/admin/projections/health/:name
   * Get health status for a specific projection
   */
  async function getProjectionHealthByName(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const { name } = req.params;

      // Get latest position from eventstore
      const latestPositionResult = await pool.query(`
        SELECT MAX(position) as latest_position
        FROM public.events
      `);
      const latestPosition = latestPositionResult.rows[0]?.latest_position ?? 0;

      // Get projection state
      const state = await stateTracker.getCurrentState(name);

      // Check if projection is registered (even if no state yet)
      const isRegistered = registry ? registry.getNames().includes(name) : false;

      if (!state && !isRegistered) {
        res.status(404).json({
          error: 'Not Found',
          message: `Projection '${name}' not found`,
        });
        return;
      }

      // Calculate health
      const position = Number(state?.position ?? 0); // Convert from DECIMAL to Number
      const lag = Number(latestPosition) - position;
      const lagMs = lag;
      const isHealthy = lag <= 5000 || position === 0; // Healthy if no events or low lag

      const health: ProjectionHealthResponse = {
        name,
        status: state ? 'running' : 'initialized',
        position,
        lag,
        lagMs,
        lastProcessedAt: state?.lastUpdated ?? null,
        isHealthy,
      };

      console.log(`📊 Returning health for ${name}: ${isHealthy ? 'healthy' : 'unhealthy'}`);
      return res.json(health);
    } catch (error: any) {
      console.error(`❌ Error getting health for ${req.params.name}:`, error.message);
      return next(error);
    }
  }

  /**
   * GET /api/v1/admin/projections/list
   * Get list of all registered projections
   */
  async function listProjections(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      if (!registry) {
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'Projection registry not available',
        });
        return;
      }

      const names = registry.getNames();
      const projections = names.map(name => {
        const handler = registry.get(name);
        return {
          name,
          isRunning: handler?.isRunning() ?? false,
        };
      });

      return res.json({
        total: projections.length,
        projections,
      });
    } catch (error: any) {
      console.error('❌ Error listing projections:', error.message);
      return next(error);
    }
  }

  return {
    getProjectionHealth,
    getProjectionHealthByName,
    listProjections,
  };
}
