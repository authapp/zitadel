/**
 * Permission Checking
 * 
 * Simple RBAC permission checking for commands
 */

import { Context } from './context';
import { throwPermissionDenied } from '@/zerrors/errors';

/**
 * Permission definition
 */
export interface Permission {
  resource: string;  // e.g., 'user', 'org', 'project'
  action: string;    // e.g., 'create', 'read', 'update', 'delete'
  scope?: string;    // e.g., 'own', 'org', 'instance'
}

/**
 * Permission checker interface
 */
export interface PermissionChecker {
  check(ctx: Context, permission: Permission): Promise<boolean>;
}

/**
 * Simple permission checker (for now, always allows)
 * TODO: Implement proper RBAC with role-based checks
 */
export class SimplePermissionChecker implements PermissionChecker {
  async check(ctx: Context, _permission: Permission): Promise<boolean> {
    // System user always has permission
    if (ctx.userID === 'system') {
      return true;
    }
    
    // Check if user has SYSTEM role
    if (ctx.roles?.includes('SYSTEM') || ctx.roles?.includes('IAM_OWNER')) {
      return true;
    }
    
    // For now, allow all authenticated requests
    // TODO: Implement proper role-based permission checking
    return ctx.userID !== undefined;
  }
}

/**
 * Helper to check permission or throw
 */
export async function checkPermission(
  checker: PermissionChecker,
  ctx: Context,
  resource: string,
  action: string,
  scope?: string
): Promise<void> {
  const permission: Permission = { resource, action, scope };
  const allowed = await checker.check(ctx, permission);
  
  if (!allowed) {
    throwPermissionDenied(
      `Permission denied: ${action} ${resource}`,
      'COMMAND-Perm1'
    );
  }
}

/**
 * Permission builder for fluent API
 */
export function permission(resource: string, action: string, scope?: string): Permission {
  return { resource, action, scope };
}
