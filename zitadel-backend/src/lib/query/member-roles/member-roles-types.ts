/**
 * Member Roles Types
 * Defines role types and structures for member role management
 */

/**
 * Member role definition
 */
export interface MemberRole {
  key: string;
  displayName: string;
  group: string;
  scope: MemberRoleScope;
}

/**
 * Role scope levels
 */
export enum MemberRoleScope {
  INSTANCE = 'instance',
  ORG = 'org',
  PROJECT = 'project',
  PROJECT_GRANT = 'project_grant',
}

/**
 * Zitadel predefined roles
 */
export const ZITADEL_ROLES = {
  // Instance-level roles (IAM)
  IAM_OWNER: 'IAM_OWNER',
  IAM_OWNER_VIEWER: 'IAM_OWNER_VIEWER',
  IAM_ADMIN: 'IAM_ADMIN',
  IAM_USER: 'IAM_USER',
  
  // Organization-level roles
  ORG_OWNER: 'ORG_OWNER',
  ORG_OWNER_VIEWER: 'ORG_OWNER_VIEWER',
  ORG_ADMIN: 'ORG_ADMIN',
  ORG_USER_PERMISSION_EDITOR: 'ORG_USER_PERMISSION_EDITOR',
  ORG_PROJECT_PERMISSION_EDITOR: 'ORG_PROJECT_PERMISSION_EDITOR',
  ORG_PROJECT_CREATOR: 'ORG_PROJECT_CREATOR',
  ORG_USER_MANAGER: 'ORG_USER_MANAGER',
  
  // Project-level roles
  PROJECT_OWNER: 'PROJECT_OWNER',
  PROJECT_OWNER_VIEWER: 'PROJECT_OWNER_VIEWER',
  PROJECT_ADMIN: 'PROJECT_ADMIN',
  PROJECT_USER_MANAGER: 'PROJECT_USER_MANAGER',
  PROJECT_GRANT_OWNER: 'PROJECT_GRANT_OWNER',
  
  // Project Grant roles
  PROJECT_GRANT_MEMBER_MANAGER: 'PROJECT_GRANT_MEMBER_MANAGER',
} as const;

/**
 * Role display names
 */
export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  // Instance roles
  [ZITADEL_ROLES.IAM_OWNER]: 'IAM Owner',
  [ZITADEL_ROLES.IAM_OWNER_VIEWER]: 'IAM Owner Viewer',
  [ZITADEL_ROLES.IAM_ADMIN]: 'IAM Admin',
  [ZITADEL_ROLES.IAM_USER]: 'IAM User',
  
  // Organization roles
  [ZITADEL_ROLES.ORG_OWNER]: 'Organization Owner',
  [ZITADEL_ROLES.ORG_OWNER_VIEWER]: 'Organization Owner Viewer',
  [ZITADEL_ROLES.ORG_ADMIN]: 'Organization Admin',
  [ZITADEL_ROLES.ORG_USER_PERMISSION_EDITOR]: 'User Permission Editor',
  [ZITADEL_ROLES.ORG_PROJECT_PERMISSION_EDITOR]: 'Project Permission Editor',
  [ZITADEL_ROLES.ORG_PROJECT_CREATOR]: 'Project Creator',
  [ZITADEL_ROLES.ORG_USER_MANAGER]: 'User Manager',
  
  // Project roles
  [ZITADEL_ROLES.PROJECT_OWNER]: 'Project Owner',
  [ZITADEL_ROLES.PROJECT_OWNER_VIEWER]: 'Project Owner Viewer',
  [ZITADEL_ROLES.PROJECT_ADMIN]: 'Project Admin',
  [ZITADEL_ROLES.PROJECT_USER_MANAGER]: 'Project User Manager',
  [ZITADEL_ROLES.PROJECT_GRANT_OWNER]: 'Project Grant Owner',
  
  // Project Grant roles
  [ZITADEL_ROLES.PROJECT_GRANT_MEMBER_MANAGER]: 'Project Grant Member Manager',
};

/**
 * Role groups for UI organization
 */
export enum RoleGroup {
  INSTANCE = 'Instance Administration',
  ORG = 'Organization Management',
  PROJECT = 'Project Management',
  PROJECT_GRANT = 'Project Grant Management',
}
