/**
 * Permission definitions and builders
 */

import { Permission, ResourceType, ActionType, Role, SystemRole, RoleScope } from './types';

/**
 * Permission builder for creating permissions
 */
export class PermissionBuilder {
  static create(resource: string, action: string, resourceId?: string, orgId?: string): Permission {
    return { resource, action, resourceId, orgId };
  }

  static user(action: ActionType, userId?: string, orgId?: string): Permission {
    return this.create(ResourceType.USER, action, userId, orgId);
  }

  static org(action: ActionType, orgId?: string): Permission {
    return this.create(ResourceType.ORG, action, orgId, orgId);
  }

  static project(action: ActionType, projectId?: string, orgId?: string): Permission {
    return this.create(ResourceType.PROJECT, action, projectId, orgId);
  }

  static application(action: ActionType, appId?: string, orgId?: string): Permission {
    return this.create(ResourceType.APPLICATION, action, appId, orgId);
  }

  static role(action: ActionType, roleId?: string, orgId?: string): Permission {
    return this.create(ResourceType.ROLE, action, roleId, orgId);
  }

  static grant(action: ActionType, grantId?: string, orgId?: string): Permission {
    return this.create(ResourceType.GRANT, action, grantId, orgId);
  }
}

/**
 * Default system role definitions
 */
export const SystemRoleDefinitions: Record<SystemRole, Role> = {
  [SystemRole.SYSTEM_ADMIN]: {
    id: SystemRole.SYSTEM_ADMIN,
    name: 'System Administrator',
    scope: RoleScope.SYSTEM,
    permissions: [
      // Full system access
      { resource: '*', action: '*' },
    ],
  },

  [SystemRole.ORG_OWNER]: {
    id: SystemRole.ORG_OWNER,
    name: 'Organization Owner',
    scope: RoleScope.ORG,
    permissions: [
      // Full org access
      PermissionBuilder.org(ActionType.MANAGE),
      PermissionBuilder.user(ActionType.MANAGE),
      PermissionBuilder.project(ActionType.MANAGE),
      PermissionBuilder.application(ActionType.MANAGE),
      PermissionBuilder.role(ActionType.MANAGE),
      PermissionBuilder.grant(ActionType.MANAGE),
    ],
  },

  [SystemRole.ORG_ADMIN]: {
    id: SystemRole.ORG_ADMIN,
    name: 'Organization Administrator',
    scope: RoleScope.ORG,
    permissions: [
      // Org management except deletion
      PermissionBuilder.org(ActionType.READ),
      PermissionBuilder.org(ActionType.UPDATE),
      PermissionBuilder.user(ActionType.MANAGE),
      PermissionBuilder.project(ActionType.MANAGE),
      PermissionBuilder.application(ActionType.READ),
      PermissionBuilder.role(ActionType.READ),
      PermissionBuilder.grant(ActionType.MANAGE),
    ],
  },

  [SystemRole.PROJECT_OWNER]: {
    id: SystemRole.PROJECT_OWNER,
    name: 'Project Owner',
    scope: RoleScope.PROJECT,
    permissions: [
      // Full project access
      PermissionBuilder.project(ActionType.MANAGE),
      PermissionBuilder.application(ActionType.MANAGE),
      PermissionBuilder.role(ActionType.MANAGE),
      PermissionBuilder.grant(ActionType.MANAGE),
    ],
  },

  [SystemRole.PROJECT_ADMIN]: {
    id: SystemRole.PROJECT_ADMIN,
    name: 'Project Administrator',
    scope: RoleScope.PROJECT,
    permissions: [
      // Project management except deletion
      PermissionBuilder.project(ActionType.READ),
      PermissionBuilder.project(ActionType.UPDATE),
      PermissionBuilder.application(ActionType.MANAGE),
      PermissionBuilder.grant(ActionType.READ),
    ],
  },

  [SystemRole.USER]: {
    id: SystemRole.USER,
    name: 'User',
    scope: RoleScope.SYSTEM,
    permissions: [
      // Self-management only
      PermissionBuilder.user(ActionType.READ),
      PermissionBuilder.user(ActionType.UPDATE),
    ],
  },
};

/**
 * Check if permission matches pattern
 */
export function matchesPermission(required: Permission, granted: Permission): boolean {
  // Check resource match (support wildcards)
  if (granted.resource !== '*' && granted.resource !== required.resource) {
    return false;
  }

  // Check action match (support wildcards and MANAGE implies CRUD)
  if (granted.action !== '*' && granted.action !== required.action) {
    // Check if granted action is 'manage' which implies all CRUD operations
    if (granted.action === 'manage') {
      const managedActions = ['create', 'read', 'update', 'delete', 'list', 'execute'];
      if (!managedActions.includes(required.action)) {
        return false;
      }
    } else {
      return false;
    }
  }

  // Check resource ID match (if specified in required)
  if (required.resourceId && granted.resourceId) {
    if (granted.resourceId !== '*' && granted.resourceId !== required.resourceId) {
      return false;
    }
  }

  // Check org ID match (if specified in required)
  if (required.orgId && granted.orgId) {
    if (granted.orgId !== '*' && granted.orgId !== required.orgId) {
      return false;
    }
  }

  return true;
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(roleId: string, orgId?: string): Permission[] {
  const role = SystemRoleDefinitions[roleId as SystemRole];
  if (!role) {
    return [];
  }

  // Apply org context to permissions if applicable
  if (orgId && role.scope === RoleScope.ORG) {
    return role.permissions.map(p => ({ ...p, orgId }));
  }

  return role.permissions;
}
