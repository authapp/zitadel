/**
 * Admin service types
 */

import { AuthContext } from '../../authz/types';

/**
 * Instance configuration
 */
export interface InstanceConfig {
  id: string;
  domain: string;
  name: string;
  settings: {
    allowRegistration: boolean;
    requireEmailVerification: boolean;
    requireMfa: boolean;
    sessionDuration: number;
    maxLoginAttempts: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * System statistics
 */
export interface SystemStats {
  users: {
    total: number;
    active: number;
    inactive: number;
    created24h: number;
  };
  organizations: {
    total: number;
    created24h: number;
  };
  projects: {
    total: number;
    created24h: number;
  };
  sessions: {
    active: number;
    total24h: number;
  };
  events: {
    total: number;
    last24h: number;
  };
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Update instance config request
 */
export interface UpdateInstanceConfigRequest {
  name?: string;
  settings?: Partial<InstanceConfig['settings']>;
}

/**
 * Audit log query options
 */
export interface AuditLogQueryOptions {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Admin service interface
 */
export interface AdminService {
  /**
   * Get instance configuration
   */
  getInstanceConfig(context: AuthContext): Promise<InstanceConfig>;

  /**
   * Update instance configuration
   */
  updateInstanceConfig(
    context: AuthContext,
    request: UpdateInstanceConfigRequest
  ): Promise<InstanceConfig>;

  /**
   * Get system statistics
   */
  getSystemStats(context: AuthContext): Promise<SystemStats>;

  /**
   * Query audit logs
   */
  queryAuditLogs(context: AuthContext, options?: AuditLogQueryOptions): Promise<AuditLogEntry[]>;

  /**
   * Perform system health check
   */
  healthCheck(context: AuthContext): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
  }>;

  /**
   * Clear cache
   */
  clearCache(context: AuthContext): Promise<void>;

  /**
   * Rebuild projections
   */
  rebuildProjections(context: AuthContext): Promise<void>;
}

/**
 * Admin service errors
 */
export class AdminServiceError extends Error {
  constructor(message: string, public code: string = 'ADMIN_SERVICE_ERROR') {
    super(message);
    this.name = 'AdminServiceError';
  }
}

export class InsufficientPrivilegesError extends AdminServiceError {
  constructor() {
    super('Insufficient privileges for admin operation', 'INSUFFICIENT_PRIVILEGES');
    this.name = 'InsufficientPrivilegesError';
  }
}
