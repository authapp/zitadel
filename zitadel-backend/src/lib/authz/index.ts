/**
 * Authorization module for Zitadel
 * 
 * Provides:
 * - Permission checking and enforcement
 * - Role-based access control (RBAC)
 * - Authorization context management
 * - Permission middleware
 */

export * from './types';
export * from './permissions';
export * from './permission-checker';
export * from './role-manager';
export * from './context-builder';
export * from './middleware';

// Re-export commonly used types
export type {
  Permission,
  Role,
  Subject,
  AuthContext,
  PermissionCheckResult,
  PermissionChecker,
  RoleManager,
} from './types';

export {
  ResourceType,
  ActionType,
  SystemRole,
  RoleScope,
  AuthorizationError,
  PermissionDeniedError,
  RoleNotFoundError,
} from './types';

export {
  PermissionBuilder,
  SystemRoleDefinitions,
  matchesPermission,
  getRolePermissions,
} from './permissions';

export {
  DefaultPermissionChecker,
  createPermissionChecker,
} from './permission-checker';

export {
  InMemoryRoleManager,
  QueryRoleManager,
  createRoleManager,
} from './role-manager';

export {
  AuthContextBuilder,
  buildContextFromToken,
  buildSystemContext,
} from './context-builder';

export {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
  Authorize,
} from './middleware';
