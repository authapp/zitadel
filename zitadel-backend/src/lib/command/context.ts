/**
 * Command Context
 * 
 * Carries execution context for commands including:
 * - User identity
 * - Organization/tenant scope
 * - Request tracing
 */

export interface Context {
  /** Instance ID for multi-tenant isolation */
  instanceID: string;
  
  /** Organization ID (resource owner) */
  orgID: string;
  
  /** User executing the command (optional for system commands) */
  userID?: string;
  
  /** User roles for permission checks */
  roles?: string[];
  
  /** Request ID for tracing */
  requestID?: string;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
  
  /** Timestamp */
  timestamp?: Date;
}

/**
 * Create context from HTTP request headers
 */
export function contextFromHeaders(headers: Record<string, string | undefined>): Context {
  return {
    instanceID: headers['x-zitadel-instance'] || headers['x-instance-id'] || 'default',
    orgID: headers['x-zitadel-orgid'] || headers['x-org-id'] || '',
    userID: headers['x-zitadel-userid'] || headers['x-user-id'],
    requestID: headers['x-request-id'] || headers['x-trace-id'],
    timestamp: new Date(),
  };
}

/**
 * Create system context (for setup, migrations, etc.)
 */
export function systemContext(instanceID: string = 'default'): Context {
  return {
    instanceID,
    orgID: instanceID, // System org
    userID: 'system',
    roles: ['SYSTEM'],
    requestID: `system-${Date.now()}`,
    timestamp: new Date(),
  };
}

/**
 * Validate context has required fields
 */
export function validateContext(ctx: Context): void {
  if (!ctx.instanceID) {
    throw new Error('Context.instanceID is required');
  }
  if (!ctx.orgID) {
    throw new Error('Context.orgID is required');
  }
}
