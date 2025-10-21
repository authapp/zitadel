/**
 * Permission types for Zitadel query layer
 * Handles authorization permission checking and aggregation
 * 
 * Permissions are computed from:
 * - User Grants (direct project access with roles)
 * - Member Roles (instance/org/project/grant membership)
 * - Project Grants (cross-org access)
 */

/**
 * Permission represents an allowed action on a resource
 */
export interface Permission {
  resource: string;
  action: string;
  conditions?: PermissionCondition[];
}

/**
 * Permission condition that must be met
 */
export interface PermissionCondition {
  type: ConditionType;
  value: string;
}

/**
 * Condition types for permission evaluation
 */
export enum ConditionType {
  ORGANIZATION = 'org',
  PROJECT = 'project',
  RESOURCE_OWNER = 'resource_owner',
  INSTANCE = 'instance',
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  hasPermission: boolean;
  matchedPermissions: Permission[];
  reason?: string;
}

/**
 * Permission context for evaluation
 */
export interface PermissionContext {
  userID: string;
  instanceID: string;
  orgID?: string;
  projectID?: string;
  resourceOwner?: string;
}

/**
 * User permissions aggregated from all sources
 */
export interface UserPermissions {
  userID: string;
  instanceID: string;
  permissions: Permission[];
  roles: string[];
  
  // Source tracking
  fromUserGrants: Permission[];
  fromMembers: Permission[];
  fromProjectGrants: Permission[];
}

/**
 * Zitadel system permissions (platform management)
 */
export interface ZitadelPermission {
  resource: ZitadelResource;
  action: ZitadelAction;
}

/**
 * Zitadel resource types
 */
export enum ZitadelResource {
  // Instance resources
  INSTANCE = 'zitadel.instance',
  INSTANCE_MEMBER = 'zitadel.instance.member',
  
  // Organization resources
  ORG = 'zitadel.org',
  ORG_MEMBER = 'zitadel.org.member',
  
  // Project resources
  PROJECT = 'zitadel.project',
  PROJECT_MEMBER = 'zitadel.project.member',
  PROJECT_GRANT = 'zitadel.project.grant',
  PROJECT_GRANT_MEMBER = 'zitadel.project.grant.member',
  
  // User resources
  USER = 'zitadel.user',
  USER_GRANT = 'zitadel.user.grant',
  
  // Application resources
  APP = 'zitadel.app',
  
  // Policy resources
  POLICY = 'zitadel.policy',
}

/**
 * Zitadel action types
 */
export enum ZitadelAction {
  // Read actions
  READ = 'read',
  LIST = 'list',
  SEARCH = 'search',
  
  // Write actions
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  
  // Member actions
  ADD_MEMBER = 'add_member',
  CHANGE_MEMBER = 'change_member',
  REMOVE_MEMBER = 'remove_member',
  
  // Grant actions
  ADD_GRANT = 'add_grant',
  CHANGE_GRANT = 'change_grant',
  REMOVE_GRANT = 'remove_grant',
  
  // Special actions
  MANAGE = 'manage',
  ADMIN = 'admin',
}

/**
 * Permission cache entry
 */
export interface PermissionCacheEntry {
  key: string;
  permissions: UserPermissions;
  expiresAt: Date;
}

/**
 * Role-to-permission mapping
 * Defines what permissions each role grants
 */
export interface RolePermissionMapping {
  role: string;
  permissions: Permission[];
  scope: 'instance' | 'org' | 'project' | 'project_grant';
}

/**
 * Common Zitadel role definitions
 */
export const ZITADEL_ROLES = {
  // Instance roles
  IAM_OWNER: 'IAM_OWNER',
  IAM_ADMIN: 'IAM_ADMIN',
  IAM_USER: 'IAM_USER',
  
  // Org roles
  ORG_OWNER: 'ORG_OWNER',
  ORG_ADMIN: 'ORG_ADMIN',
  ORG_USER: 'ORG_USER',
  ORG_USER_MANAGER: 'ORG_USER_MANAGER',
  ORG_PROJECT_PERMISSION_OWNER: 'ORG_PROJECT_PERMISSION_OWNER',
  
  // Project roles
  PROJECT_OWNER: 'PROJECT_OWNER',
  PROJECT_ADMIN: 'PROJECT_ADMIN',
  PROJECT_USER_MANAGER: 'PROJECT_USER_MANAGER',
  
  // Project grant roles
  PROJECT_GRANT_OWNER: 'PROJECT_GRANT_OWNER',
  PROJECT_GRANT_ADMIN: 'PROJECT_GRANT_ADMIN',
} as const;
