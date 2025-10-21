/**
 * Member Roles Queries
 * Provides role catalog and role information for member management
 * Based on Zitadel Go internal/query/member_roles.go
 */

import {
  MemberRole,
  MemberRoleScope,
  ZITADEL_ROLES,
  ROLE_DISPLAY_NAMES,
  RoleGroup,
} from './member-roles-types';

export class MemberRolesQueries {
  /**
   * Get all available member roles across all scopes
   * 
   * @returns All member roles
   */
  getMemberRoles(): MemberRole[] {
    return [
      ...this.getInstanceMemberRoles(),
      ...this.getOrgMemberRoles(),
      ...this.getProjectMemberRoles(),
      ...this.getProjectGrantMemberRoles(),
    ];
  }

  /**
   * Get global (instance-level) member roles
   * Also known as IAM roles
   * 
   * @returns Instance member roles
   */
  getGlobalMemberRoles(): MemberRole[] {
    return this.getInstanceMemberRoles();
  }

  /**
   * Get instance-level member roles (IAM roles)
   * 
   * @returns Instance member roles
   */
  getInstanceMemberRoles(): MemberRole[] {
    return [
      {
        key: ZITADEL_ROLES.IAM_OWNER,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.IAM_OWNER],
        group: RoleGroup.INSTANCE,
        scope: MemberRoleScope.INSTANCE,
      },
      {
        key: ZITADEL_ROLES.IAM_OWNER_VIEWER,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.IAM_OWNER_VIEWER],
        group: RoleGroup.INSTANCE,
        scope: MemberRoleScope.INSTANCE,
      },
      {
        key: ZITADEL_ROLES.IAM_ADMIN,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.IAM_ADMIN],
        group: RoleGroup.INSTANCE,
        scope: MemberRoleScope.INSTANCE,
      },
      {
        key: ZITADEL_ROLES.IAM_USER,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.IAM_USER],
        group: RoleGroup.INSTANCE,
        scope: MemberRoleScope.INSTANCE,
      },
    ];
  }

  /**
   * Get organization-level member roles
   * 
   * @returns Organization member roles
   */
  getOrgMemberRoles(): MemberRole[] {
    return [
      {
        key: ZITADEL_ROLES.ORG_OWNER,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.ORG_OWNER],
        group: RoleGroup.ORG,
        scope: MemberRoleScope.ORG,
      },
      {
        key: ZITADEL_ROLES.ORG_OWNER_VIEWER,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.ORG_OWNER_VIEWER],
        group: RoleGroup.ORG,
        scope: MemberRoleScope.ORG,
      },
      {
        key: ZITADEL_ROLES.ORG_ADMIN,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.ORG_ADMIN],
        group: RoleGroup.ORG,
        scope: MemberRoleScope.ORG,
      },
      {
        key: ZITADEL_ROLES.ORG_USER_PERMISSION_EDITOR,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.ORG_USER_PERMISSION_EDITOR],
        group: RoleGroup.ORG,
        scope: MemberRoleScope.ORG,
      },
      {
        key: ZITADEL_ROLES.ORG_PROJECT_PERMISSION_EDITOR,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.ORG_PROJECT_PERMISSION_EDITOR],
        group: RoleGroup.ORG,
        scope: MemberRoleScope.ORG,
      },
      {
        key: ZITADEL_ROLES.ORG_PROJECT_CREATOR,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.ORG_PROJECT_CREATOR],
        group: RoleGroup.ORG,
        scope: MemberRoleScope.ORG,
      },
      {
        key: ZITADEL_ROLES.ORG_USER_MANAGER,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.ORG_USER_MANAGER],
        group: RoleGroup.ORG,
        scope: MemberRoleScope.ORG,
      },
    ];
  }

  /**
   * Get project-level member roles
   * 
   * @returns Project member roles
   */
  getProjectMemberRoles(): MemberRole[] {
    return [
      {
        key: ZITADEL_ROLES.PROJECT_OWNER,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.PROJECT_OWNER],
        group: RoleGroup.PROJECT,
        scope: MemberRoleScope.PROJECT,
      },
      {
        key: ZITADEL_ROLES.PROJECT_OWNER_VIEWER,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.PROJECT_OWNER_VIEWER],
        group: RoleGroup.PROJECT,
        scope: MemberRoleScope.PROJECT,
      },
      {
        key: ZITADEL_ROLES.PROJECT_ADMIN,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.PROJECT_ADMIN],
        group: RoleGroup.PROJECT,
        scope: MemberRoleScope.PROJECT,
      },
      {
        key: ZITADEL_ROLES.PROJECT_USER_MANAGER,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.PROJECT_USER_MANAGER],
        group: RoleGroup.PROJECT,
        scope: MemberRoleScope.PROJECT,
      },
      {
        key: ZITADEL_ROLES.PROJECT_GRANT_OWNER,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.PROJECT_GRANT_OWNER],
        group: RoleGroup.PROJECT,
        scope: MemberRoleScope.PROJECT,
      },
    ];
  }

  /**
   * Get project grant member roles
   * 
   * @returns Project grant member roles
   */
  getProjectGrantMemberRoles(): MemberRole[] {
    return [
      {
        key: ZITADEL_ROLES.PROJECT_GRANT_MEMBER_MANAGER,
        displayName: ROLE_DISPLAY_NAMES[ZITADEL_ROLES.PROJECT_GRANT_MEMBER_MANAGER],
        group: RoleGroup.PROJECT_GRANT,
        scope: MemberRoleScope.PROJECT_GRANT,
      },
    ];
  }

  /**
   * Get role by key
   * 
   * @param roleKey - Role key to look up
   * @returns Role or undefined
   */
  getRoleByKey(roleKey: string): MemberRole | undefined {
    return this.getMemberRoles().find(role => role.key === roleKey);
  }

  /**
   * Get roles by scope
   * 
   * @param scope - Role scope to filter by
   * @returns Roles for the specified scope
   */
  getRolesByScope(scope: MemberRoleScope): MemberRole[] {
    return this.getMemberRoles().filter(role => role.scope === scope);
  }

  /**
   * Check if role exists
   * 
   * @param roleKey - Role key to check
   * @returns True if role exists
   */
  hasRole(roleKey: string): boolean {
    return this.getRoleByKey(roleKey) !== undefined;
  }

  /**
   * Validate roles for a specific scope
   * 
   * @param roleKeys - Role keys to validate
   * @param scope - Scope to validate against
   * @returns Array of invalid role keys
   */
  validateRolesForScope(roleKeys: string[], scope: MemberRoleScope): string[] {
    const validRoleKeys = this.getRolesByScope(scope).map(r => r.key);
    return roleKeys.filter(key => !validRoleKeys.includes(key));
  }
}
