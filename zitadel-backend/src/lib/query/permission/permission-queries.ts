/**
 * Permission queries for Zitadel query layer
 * Handles authorization permission checking by aggregating from multiple sources
 */

import { DatabasePool } from '../../database';
import {
  Permission,
  PermissionCheckResult,
  PermissionContext,
  UserPermissions,
  PermissionCondition,
  ConditionType,
  RolePermissionMapping,
  ZITADEL_ROLES,
} from './permission-types';

export class PermissionQueries {
  private permissionCache: Map<string, UserPermissions> = new Map();
  private cacheTTL: number = 300000; // 5 minutes
  private cacheTimers: Set<NodeJS.Timeout> = new Set();

  constructor(private readonly database: DatabasePool) {}

  /**
   * Check if user has specific permissions
   * 
   * @param context - Permission context with user and resource info
   * @param requiredPermissions - Permissions to check
   * @returns Permission check result
   */
  async checkUserPermissions(
    context: PermissionContext,
    requiredPermissions: Permission[]
  ): Promise<PermissionCheckResult> {
    // Get all user permissions
    const userPerms = await this.getMyPermissions(context);

    // Check each required permission
    const matchedPermissions: Permission[] = [];
    
    for (const required of requiredPermissions) {
      const hasPermission = userPerms.permissions.some(perm =>
        this.permissionMatches(perm, required, context)
      );
      
      if (hasPermission) {
        matchedPermissions.push(required);
      }
    }

    const hasAll = matchedPermissions.length === requiredPermissions.length;

    return {
      hasPermission: hasAll,
      matchedPermissions,
      reason: hasAll ? undefined : 'Missing required permissions',
    };
  }

  /**
   * Get current user's permissions aggregated from all sources
   * 
   * @param context - Permission context
   * @returns User permissions
   */
  async getMyPermissions(context: PermissionContext): Promise<UserPermissions> {
    const cacheKey = `${context.userID}:${context.instanceID}:${context.orgID || ''}:${context.projectID || ''}`;
    
    // Check cache
    const cached = this.permissionCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Aggregate permissions from all sources
    const fromUserGrants = await this.getPermissionsFromUserGrants(context);
    const fromMembers = await this.getPermissionsFromMembers(context);
    const fromProjectGrants = await this.getPermissionsFromProjectGrants(context);

    // Get all roles
    const roles = this.extractRoles(fromUserGrants, fromMembers, fromProjectGrants);

    // Combine and deduplicate permissions
    const allPermissions = [
      ...fromUserGrants,
      ...fromMembers,
      ...fromProjectGrants,
    ];
    
    const permissions = this.deduplicatePermissions(allPermissions);

    const userPermissions: UserPermissions = {
      userID: context.userID,
      instanceID: context.instanceID,
      permissions,
      roles,
      fromUserGrants,
      fromMembers,
      fromProjectGrants,
    };

    // Cache result
    this.permissionCache.set(cacheKey, userPermissions);
    
    // Clear cache after TTL
    const timer = setTimeout(() => {
      this.permissionCache.delete(cacheKey);
      this.cacheTimers.delete(timer);
    }, this.cacheTTL);
    this.cacheTimers.add(timer);

    return userPermissions;
  }

  /**
   * Get global permissions (instance-level)
   * 
   * @param userID - User ID
   * @param instanceID - Instance ID
   * @returns Global permissions
   */
  async getGlobalPermissions(
    userID: string,
    instanceID: string
  ): Promise<Permission[]> {
    // Check if user is instance member
    const instanceMember = await this.database.queryOne(
      `SELECT roles FROM projections.instance_members
       WHERE instance_id = $1 AND user_id = $2`,
      [instanceID, userID]
    );

    if (!instanceMember) {
      return [];
    }

    const roles = instanceMember.roles || [];
    return this.mapRolesToPermissions(roles, 'instance');
  }

  /**
   * Clear permission cache for a user
   */
  clearCache(userID: string, instanceID: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.permissionCache.keys()) {
      if (key.startsWith(`${userID}:${instanceID}:`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.permissionCache.delete(key));
  }

  /**
   * Cleanup method to clear all timers and cache
   * Call this in test cleanup to prevent Jest from hanging
   */
  cleanup(): void {
    // Clear all timers
    for (const timer of this.cacheTimers) {
      clearTimeout(timer);
    }
    this.cacheTimers.clear();
    
    // Clear cache
    this.permissionCache.clear();
  }

  /**
   * Get permissions from user grants
   */
  private async getPermissionsFromUserGrants(
    context: PermissionContext
  ): Promise<Permission[]> {
    const query = `
      SELECT ug.roles, ug.project_id, ug.resource_owner
      FROM projections.user_grants ug
      WHERE ug.user_id = $1 
        AND ug.instance_id = $2
        AND ug.state = 1
        ${context.projectID ? 'AND ug.project_id = $3' : ''}
    `;

    const params = context.projectID 
      ? [context.userID, context.instanceID, context.projectID]
      : [context.userID, context.instanceID];

    const result = await this.database.query(query, params);

    const permissions: Permission[] = [];
    for (const row of result.rows) {
      const roles = row.roles || [];
      const rolePerms = this.mapRolesToPermissions(roles, 'project');
      
      // Add project and resource owner conditions
      rolePerms.forEach(perm => {
        perm.conditions = [
          { type: ConditionType.PROJECT, value: row.project_id },
          { type: ConditionType.RESOURCE_OWNER, value: row.resource_owner },
        ];
      });
      
      permissions.push(...rolePerms);
    }

    return permissions;
  }

  /**
   * Get permissions from member roles
   */
  private async getPermissionsFromMembers(
    context: PermissionContext
  ): Promise<Permission[]> {
    const permissions: Permission[] = [];

    // Instance members
    const instanceMember = await this.database.queryOne(
      `SELECT roles FROM projections.instance_members
       WHERE instance_id = $1 AND user_id = $2`,
      [context.instanceID, context.userID]
    );
    
    if (instanceMember) {
      const roles = instanceMember.roles || [];
      permissions.push(...this.mapRolesToPermissions(roles, 'instance'));
    }

    // Org members
    if (context.orgID) {
      const orgMember = await this.database.queryOne(
        `SELECT roles, org_id FROM projections.org_members
         WHERE instance_id = $1 AND user_id = $2 AND org_id = $3`,
        [context.instanceID, context.userID, context.orgID]
      );
      
      if (orgMember) {
        const roles = orgMember.roles || [];
        const rolePerms = this.mapRolesToPermissions(roles, 'org');
        rolePerms.forEach(perm => {
          perm.conditions = [{ type: ConditionType.ORGANIZATION, value: orgMember.org_id }];
        });
        permissions.push(...rolePerms);
      }
    }

    // Project members
    if (context.projectID) {
      const projectMember = await this.database.queryOne(
        `SELECT roles, project_id FROM projections.project_members
         WHERE instance_id = $1 AND user_id = $2 AND project_id = $3`,
        [context.instanceID, context.userID, context.projectID]
      );
      
      if (projectMember) {
        const roles = projectMember.roles || [];
        const rolePerms = this.mapRolesToPermissions(roles, 'project');
        rolePerms.forEach(perm => {
          perm.conditions = [{ type: ConditionType.PROJECT, value: projectMember.project_id }];
        });
        permissions.push(...rolePerms);
      }
    }

    return permissions;
  }

  /**
   * Get permissions from project grants
   */
  private async getPermissionsFromProjectGrants(
    context: PermissionContext
  ): Promise<Permission[]> {
    if (!context.orgID) {
      return [];
    }

    // Find project grants where user's org is the granted org
    const query = `
      SELECT pg.granted_roles, pg.project_id
      FROM projections.project_grants pg
      WHERE pg.granted_org_id = $1 
        AND pg.instance_id = $2
        AND pg.state = 1
    `;

    const result = await this.database.query(query, [context.orgID, context.instanceID]);

    const permissions: Permission[] = [];
    for (const row of result.rows) {
      const roles = row.granted_roles || [];
      const rolePerms = this.mapRolesToPermissions(roles, 'project');
      
      rolePerms.forEach(perm => {
        perm.conditions = [
          { type: ConditionType.PROJECT, value: row.project_id },
          { type: ConditionType.ORGANIZATION, value: context.orgID! },
        ];
      });
      
      permissions.push(...rolePerms);
    }

    return permissions;
  }

  /**
   * Map roles to permissions
   */
  private mapRolesToPermissions(
    roles: string[],
    scope: 'instance' | 'org' | 'project' | 'project_grant'
  ): Permission[] {
    const permissions: Permission[] = [];

    for (const role of roles) {
      // Get permission mapping for this role
      const mapping = this.getRolePermissionMapping(role, scope);
      if (mapping) {
        permissions.push(...mapping.permissions);
      }
    }

    return permissions;
  }

  /**
   * Get role permission mapping
   * Defines what permissions each role grants
   */
  private getRolePermissionMapping(
    role: string,
    _scope: string
  ): RolePermissionMapping | null {
    // This is a simplified mapping - in production, this would come from database
    const mappings: Record<string, RolePermissionMapping> = {
      // Instance roles
      [ZITADEL_ROLES.IAM_OWNER]: {
        role: ZITADEL_ROLES.IAM_OWNER,
        scope: 'instance',
        permissions: [
          { resource: 'zitadel.instance', action: 'manage' },
          { resource: 'zitadel.org', action: 'manage' },
          { resource: 'zitadel.user', action: 'manage' },
        ],
      },
      [ZITADEL_ROLES.IAM_ADMIN]: {
        role: ZITADEL_ROLES.IAM_ADMIN,
        scope: 'instance',
        permissions: [
          { resource: 'zitadel.org', action: 'manage' },
          { resource: 'zitadel.user', action: 'manage' },
          { resource: 'zitadel.project', action: 'manage' },
        ],
      },
      [ZITADEL_ROLES.IAM_USER]: {
        role: ZITADEL_ROLES.IAM_USER,
        scope: 'instance',
        permissions: [
          { resource: 'zitadel.instance', action: 'read' },
          { resource: 'zitadel.org', action: 'read' },
        ],
      },
      
      // Org roles
      [ZITADEL_ROLES.ORG_OWNER]: {
        role: ZITADEL_ROLES.ORG_OWNER,
        scope: 'org',
        permissions: [
          { resource: 'zitadel.org', action: 'manage' },
          { resource: 'zitadel.project', action: 'manage' },
          { resource: 'zitadel.user', action: 'manage' },
        ],
      },
      [ZITADEL_ROLES.ORG_ADMIN]: {
        role: ZITADEL_ROLES.ORG_ADMIN,
        scope: 'org',
        permissions: [
          { resource: 'zitadel.org', action: 'read' },
          { resource: 'zitadel.project', action: 'manage' },
          { resource: 'zitadel.user', action: 'read' },
        ],
      },
      
      // Project roles
      [ZITADEL_ROLES.PROJECT_OWNER]: {
        role: ZITADEL_ROLES.PROJECT_OWNER,
        scope: 'project',
        permissions: [
          { resource: 'zitadel.project', action: 'manage' },
          { resource: 'zitadel.app', action: 'manage' },
          { resource: 'zitadel.user.grant', action: 'manage' },
        ],
      },
      [ZITADEL_ROLES.PROJECT_ADMIN]: {
        role: ZITADEL_ROLES.PROJECT_ADMIN,
        scope: 'project',
        permissions: [
          { resource: 'zitadel.project', action: 'read' },
          { resource: 'zitadel.app', action: 'manage' },
        ],
      },
      
      // Generic project user role (commonly used in grants)
      'PROJECT_USER': {
        role: 'PROJECT_USER',
        scope: 'project_grant',
        permissions: [
          { resource: 'zitadel.project', action: 'read' },
          { resource: 'zitadel.app', action: 'read' },
        ],
      },
    };

    return mappings[role] || null;
  }

  /**
   * Check if permission matches requirement
   */
  private permissionMatches(
    permission: Permission,
    required: Permission,
    _context: PermissionContext
  ): boolean {
    // Check resource and action
    if (permission.resource !== required.resource) {
      return false;
    }

    // Check if action matches (or permission has 'manage' which grants all actions)
    if (permission.action !== required.action && permission.action !== 'manage') {
      return false;
    }

    // Check conditions
    if (required.conditions) {
      for (const requiredCondition of required.conditions) {
        if (!this.conditionMatches(permission, requiredCondition)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if condition is satisfied
   */
  private conditionMatches(
    permission: Permission,
    condition: PermissionCondition
  ): boolean {
    if (!permission.conditions) {
      return true; // No conditions means applies to all
    }

    // Check if permission has matching condition
    return permission.conditions.some(
      pc => pc.type === condition.type && pc.value === condition.value
    );
  }

  /**
   * Extract unique roles from permissions
   */
  private extractRoles(..._permissionLists: Permission[][]): string[] {
    const roles = new Set<string>();
    
    // This is simplified - in production, roles would be tracked separately
    // Roles are implicit in permission sources (user grants, members, project grants)
    // For now, return empty array

    return Array.from(roles);
  }

  /**
   * Deduplicate permissions by resource+action
   */
  private deduplicatePermissions(permissions: Permission[]): Permission[] {
    const seen = new Map<string, Permission>();

    for (const perm of permissions) {
      const key = `${perm.resource}:${perm.action}`;
      
      if (!seen.has(key)) {
        seen.set(key, perm);
      } else {
        // Merge conditions if same resource+action
        const existing = seen.get(key)!;
        if (perm.conditions) {
          existing.conditions = [
            ...(existing.conditions || []),
            ...perm.conditions,
          ];
        }
      }
    }

    return Array.from(seen.values());
  }
}
