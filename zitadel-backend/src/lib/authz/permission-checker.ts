/**
 * Permission checker implementation
 */

import {
  PermissionChecker,
  Permission,
  AuthContext,
  PermissionCheckResult,
  RoleManager,
} from './types';
import { matchesPermission } from './permissions';

/**
 * Default permission checker implementation
 */
export class DefaultPermissionChecker implements PermissionChecker {
  constructor(private roleManager: RoleManager) {}

  /**
   * Check if subject has permission
   */
  async check(context: AuthContext, permission: Permission): Promise<PermissionCheckResult> {
    // Get all roles for the subject
    const roles = await this.roleManager.getRolesForSubject(context.subject);

    // Check direct permissions first
    if (context.subject.permissions) {
      for (const grantedPermission of context.subject.permissions) {
        if (matchesPermission(permission, grantedPermission)) {
          return {
            allowed: true,
            reason: 'Direct permission granted',
          };
        }
      }
    }

    // Check role-based permissions
    for (const role of roles) {
      for (const rolePermission of role.permissions) {
        // Apply context-specific IDs to role permissions
        const contextualPermission = this.applyContext(rolePermission, context);
        
        if (matchesPermission(permission, contextualPermission)) {
          return {
            allowed: true,
            reason: `Permission granted via role: ${role.name}`,
            matchedRole: role.id,
          };
        }
      }
    }

    return {
      allowed: false,
      reason: `No matching permission found for ${permission.action} on ${permission.resource}`,
    };
  }

  /**
   * Check if subject has any of the permissions
   */
  async checkAny(context: AuthContext, permissions: Permission[]): Promise<PermissionCheckResult> {
    for (const permission of permissions) {
      const result = await this.check(context, permission);
      if (result.allowed) {
        return result;
      }
    }

    return {
      allowed: false,
      reason: 'None of the required permissions were found',
    };
  }

  /**
   * Check if subject has all permissions
   */
  async checkAll(context: AuthContext, permissions: Permission[]): Promise<PermissionCheckResult> {
    const results: PermissionCheckResult[] = [];

    for (const permission of permissions) {
      const result = await this.check(context, permission);
      results.push(result);
      
      if (!result.allowed) {
        return {
          allowed: false,
          reason: `Missing required permission: ${result.reason}`,
        };
      }
    }

    return {
      allowed: true,
      reason: 'All required permissions granted',
    };
  }

  /**
   * Check if subject has role
   */
  hasRole(context: AuthContext, roleId: string): boolean {
    return context.subject.roles.includes(roleId);
  }

  /**
   * Apply context to permission (add orgId, projectId, etc.)
   */
  private applyContext(permission: Permission, context: AuthContext): Permission {
    const contextual = { ...permission };

    // Apply org context if not already specified
    if (!contextual.orgId && context.orgId) {
      contextual.orgId = context.orgId;
    }

    return contextual;
  }
}

/**
 * Create permission checker instance
 */
export function createPermissionChecker(roleManager: RoleManager): PermissionChecker {
  return new DefaultPermissionChecker(roleManager);
}
