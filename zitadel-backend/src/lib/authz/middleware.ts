/**
 * Authorization middleware
 */

import { PermissionChecker, Permission, AuthContext, PermissionDeniedError } from './types';

/**
 * Require permission middleware
 */
export function requirePermission(
  checker: PermissionChecker,
  permission: Permission
) {
  return async (context: AuthContext, next: () => Promise<any>): Promise<any> => {
    const result = await checker.check(context, permission);
    
    if (!result.allowed) {
      throw new PermissionDeniedError(permission);
    }

    return next();
  };
}

/**
 * Require any of the permissions middleware
 */
export function requireAnyPermission(
  checker: PermissionChecker,
  permissions: Permission[]
) {
  return async (context: AuthContext, next: () => Promise<any>): Promise<any> => {
    const result = await checker.checkAny(context, permissions);
    
    if (!result.allowed) {
      throw new PermissionDeniedError(permissions[0]);
    }

    return next();
  };
}

/**
 * Require all permissions middleware
 */
export function requireAllPermissions(
  checker: PermissionChecker,
  permissions: Permission[]
) {
  return async (context: AuthContext, next: () => Promise<any>): Promise<any> => {
    const result = await checker.checkAll(context, permissions);
    
    if (!result.allowed) {
      throw new PermissionDeniedError(permissions[0]);
    }

    return next();
  };
}

/**
 * Require role middleware
 */
export function requireRole(checker: PermissionChecker, roleId: string) {
  return async (context: AuthContext, next: () => Promise<any>): Promise<any> => {
    if (!checker.hasRole(context, roleId)) {
      throw new PermissionDeniedError({
        resource: 'role',
        action: 'require',
        resourceId: roleId,
      });
    }

    return next();
  };
}

/**
 * Authorization decorator for methods
 */
export function Authorize(permission: Permission) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const context: AuthContext = args[0];
      const checker: PermissionChecker = this.permissionChecker;

      if (!checker) {
        throw new Error('PermissionChecker not found in service');
      }

      const result = await checker.check(context, permission);
      if (!result.allowed) {
        throw new PermissionDeniedError(permission);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
