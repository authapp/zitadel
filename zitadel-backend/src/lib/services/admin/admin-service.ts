/**
 * Admin service implementation
 */

import { AuthContext, SystemRole } from '../../authz';
import { PermissionChecker } from '../../authz/types';
import { Query } from '../../query/types';
import { Cache } from '../../cache/types';
import { Eventstore } from '../../eventstore/types';
import {
  AdminService,
  InstanceConfig,
  SystemStats,
  AuditLogEntry,
  UpdateInstanceConfigRequest,
  AuditLogQueryOptions,
  InsufficientPrivilegesError,
} from './types';

/**
 * Default admin service implementation
 */
export class DefaultAdminService implements AdminService {
  constructor(
    private query: Query,
    _permissionChecker: PermissionChecker, // Will be used for fine-grained permission checking in production
    private cache: Cache,
    private eventstore: Eventstore
  ) {}

  /**
   * Get instance configuration
   */
  async getInstanceConfig(context: AuthContext): Promise<InstanceConfig> {
    this.requireSystemAdmin(context);

    // In production, load from database
    const config: InstanceConfig = {
      id: context.instanceId,
      domain: 'zitadel.local',
      name: 'Zitadel Instance',
      settings: {
        allowRegistration: true,
        requireEmailVerification: true,
        requireMfa: false,
        sessionDuration: 86400,
        maxLoginAttempts: 5,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return config;
  }

  /**
   * Update instance configuration
   */
  async updateInstanceConfig(
    context: AuthContext,
    _request: UpdateInstanceConfigRequest
  ): Promise<InstanceConfig> {
    this.requireSystemAdmin(context);

    // In production, dispatch command to update config
    // await this.commandBus.execute({ type: 'instance.updateConfig', ... });

    return this.getInstanceConfig(context);
  }

  /**
   * Get system statistics
   */
  async getSystemStats(context: AuthContext): Promise<SystemStats> {
    this.requireSystemAdmin(context);

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Query statistics
    const userStats = await this.query.execute<any>(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN state = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN state = 'inactive' THEN 1 END) as inactive,
        COUNT(CASE WHEN created_at > $1 THEN 1 END) as created24h
       FROM users`,
      [yesterday]
    );

    const orgStats = await this.query.execute<any>(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN created_at > $1 THEN 1 END) as created24h
       FROM organizations`,
      [yesterday]
    );

    const projectStats = await this.query.execute<any>(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN created_at > $1 THEN 1 END) as created24h
       FROM projects`,
      [yesterday]
    );

    const stats: SystemStats = {
      users: {
        total: parseInt(userStats[0]?.total || '0'),
        active: parseInt(userStats[0]?.active || '0'),
        inactive: parseInt(userStats[0]?.inactive || '0'),
        created24h: parseInt(userStats[0]?.created24h || '0'),
      },
      organizations: {
        total: parseInt(orgStats[0]?.total || '0'),
        created24h: parseInt(orgStats[0]?.created24h || '0'),
      },
      projects: {
        total: parseInt(projectStats[0]?.total || '0'),
        created24h: parseInt(projectStats[0]?.created24h || '0'),
      },
      sessions: {
        active: 0, // Would query cache
        total24h: 0,
      },
      events: {
        total: 0, // Would query eventstore
        last24h: 0,
      },
    };

    return stats;
  }

  /**
   * Query audit logs
   */
  async queryAuditLogs(
    context: AuthContext,
    options?: AuditLogQueryOptions
  ): Promise<AuditLogEntry[]> {
    this.requireSystemAdmin(context);

    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(options.userId);
      paramIndex++;
    }

    if (options?.action) {
      query += ` AND action = $${paramIndex}`;
      params.push(options.action);
      paramIndex++;
    }

    if (options?.resource) {
      query += ` AND resource = $${paramIndex}`;
      params.push(options.resource);
      paramIndex++;
    }

    if (options?.startDate) {
      query += ` AND timestamp >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }

    if (options?.endDate) {
      query += ` AND timestamp <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const logs = await this.query.execute<AuditLogEntry>(query, params);
    return logs;
  }

  /**
   * Perform system health check
   */
  async healthCheck(context: AuthContext): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
  }> {
    this.requireSystemAdmin(context);

    const checks: Record<string, boolean> = {
      database: false,
      cache: false,
      eventstore: false,
    };

    // Check database
    try {
      await this.query.health();
      checks.database = true;
    } catch {
      checks.database = false;
    }

    // Check cache
    try {
      await this.cache.set('health_check', 'ok', 1);
      checks.cache = true;
    } catch {
      checks.cache = false;
    }

    // Check eventstore
    try {
      await this.eventstore.query({});
      checks.eventstore = true;
    } catch {
      checks.eventstore = false;
    }

    // Determine overall status
    const allHealthy = Object.values(checks).every(v => v);
    const allUnhealthy = Object.values(checks).every(v => !v);

    return {
      status: allHealthy ? 'healthy' : allUnhealthy ? 'unhealthy' : 'degraded',
      checks,
    };
  }

  /**
   * Clear cache
   */
  async clearCache(context: AuthContext): Promise<void> {
    this.requireSystemAdmin(context);

    // Clear all cache keys
    const keys = await this.cache.keys('*');
    if (keys.length > 0) {
      await this.cache.mdel(keys);
    }
  }

  /**
   * Rebuild projections
   */
  async rebuildProjections(context: AuthContext): Promise<void> {
    this.requireSystemAdmin(context);

    // In production, trigger projection rebuild
    // This would involve:
    // 1. Clear all projection tables
    // 2. Replay all events from eventstore
    // 3. Rebuild read models
  }

  /**
   * Require system admin role
   */
  private requireSystemAdmin(context: AuthContext): void {
    if (!context.subject.roles.includes(SystemRole.SYSTEM_ADMIN)) {
      throw new InsufficientPrivilegesError();
    }
  }
}

/**
 * Create admin service
 */
export function createAdminService(
  query: Query,
  permissionChecker: PermissionChecker,
  cache: Cache,
  eventstore: Eventstore
): AdminService {
  return new DefaultAdminService(query, permissionChecker, cache, eventstore);
}
