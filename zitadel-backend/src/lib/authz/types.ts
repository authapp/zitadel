/**
 * Authorization types and interfaces for Zitadel
 */

/**
 * Permission represents a specific action on a resource
 */
export interface Permission {
  resource: string;
  action: string;
  resourceId?: string;
  orgId?: string;
}

/**
 * Role represents a collection of permissions
 */
export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  scope: RoleScope;
  orgId?: string;
}

/**
 * Role scope determines where the role applies
 */
export enum RoleScope {
  SYSTEM = 'system',      // System-wide role
  ORG = 'org',           // Organization-scoped role
  PROJECT = 'project',   // Project-scoped role
}

/**
 * Token type determines the authentication method
 */
export enum TokenType {
  USER = 'user',                    // Regular user token (human)
  SERVICE_ACCOUNT = 'service',     // Service account / machine user
  SYSTEM = 'system',               // System-level API token
}

/**
 * Subject represents an entity that can have permissions
 */
export interface Subject {
  userId: string;
  orgId?: string;
  roles: string[];
  permissions?: Permission[];
  tokenType?: TokenType;
  serviceAccount?: boolean;        // True if this is a machine user
}

/**
 * Instance metadata for authorization
 */
export interface InstanceMetadata {
  id: string;
  name?: string;
  features?: Record<string, boolean>;
  quotas?: Record<string, number>;
}

/**
 * Organization metadata for authorization
 */
export interface OrgMetadata {
  id: string;
  name?: string;
  domain?: string;
  state?: number;
}

/**
 * Project metadata for authorization
 */
export interface ProjectMetadata {
  id: string;
  name?: string;
  orgId: string;
  state?: number;
}

/**
 * Authorization context for permission checking
 */
export interface AuthContext {
  subject: Subject;
  instanceId: string;
  orgId?: string;
  projectId?: string;
  
  // Enhanced metadata
  instanceMetadata?: InstanceMetadata;
  orgMetadata?: OrgMetadata;
  projectMetadata?: ProjectMetadata;
  
  // Token information
  tokenType: TokenType;
  isSystemToken: boolean;
  
  // Legacy metadata for backward compatibility
  metadata?: Record<string, any>;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  matchedRole?: string;
}

/**
 * Resource types in Zitadel
 */
export enum ResourceType {
  USER = 'user',
  ORG = 'org',
  PROJECT = 'project',
  APPLICATION = 'application',
  ROLE = 'role',
  ACTION = 'action',
  GRANT = 'grant',
  INSTANCE = 'instance',
}

/**
 * Action types for resources
 */
export enum ActionType {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  MANAGE = 'manage',
  EXECUTE = 'execute',
}

/**
 * Built-in system roles
 */
export enum SystemRole {
  SYSTEM_ADMIN = 'system_admin',
  ORG_OWNER = 'org_owner',
  ORG_ADMIN = 'org_admin',
  PROJECT_OWNER = 'project_owner',
  PROJECT_ADMIN = 'project_admin',
  USER = 'user',
}

/**
 * Permission checker interface
 */
export interface PermissionChecker {
  /**
   * Check if subject has permission
   */
  check(context: AuthContext, permission: Permission): Promise<PermissionCheckResult>;

  /**
   * Check if subject has any of the permissions
   */
  checkAny(context: AuthContext, permissions: Permission[]): Promise<PermissionCheckResult>;

  /**
   * Check if subject has all permissions
   */
  checkAll(context: AuthContext, permissions: Permission[]): Promise<PermissionCheckResult>;

  /**
   * Check if subject has role
   */
  hasRole(context: AuthContext, roleId: string): boolean;
}

/**
 * Role manager interface
 */
export interface RoleManager {
  /**
   * Get role by ID
   */
  getRole(roleId: string): Promise<Role | null>;

  /**
   * Get roles for subject
   */
  getRolesForSubject(subject: Subject): Promise<Role[]>;

  /**
   * Assign role to subject
   */
  assignRole(userId: string, roleId: string, orgId?: string): Promise<void>;

  /**
   * Remove role from subject
   */
  removeRole(userId: string, roleId: string): Promise<void>;
}

/**
 * Authorization errors
 */
export class AuthorizationError extends Error {
  constructor(message: string, public code: string = 'AUTHORIZATION_ERROR') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class PermissionDeniedError extends AuthorizationError {
  constructor(permission: Permission) {
    super(
      `Permission denied: ${permission.action} on ${permission.resource}`,
      'PERMISSION_DENIED'
    );
    this.name = 'PermissionDeniedError';
  }
}

export class RoleNotFoundError extends AuthorizationError {
  constructor(roleId: string) {
    super(`Role not found: ${roleId}`, 'ROLE_NOT_FOUND');
    this.name = 'RoleNotFoundError';
  }
}
