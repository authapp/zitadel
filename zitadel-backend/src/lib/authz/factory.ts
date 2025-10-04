/**
 * Factory functions for creating authorization components
 */

import { Query } from '../query/types';
import { PermissionChecker, RoleManager } from './types';
import { createPermissionChecker } from './permission-checker';
import { createRoleManager, createInMemoryRoleManager } from './role-manager';

/**
 * Create authorization components
 */
export function createAuthzComponents(query: Query): {
  permissionChecker: PermissionChecker;
  roleManager: RoleManager;
} {
  const roleManager = createRoleManager(query);
  const permissionChecker = createPermissionChecker(roleManager);

  return {
    permissionChecker,
    roleManager,
  };
}

/**
 * Create in-memory authorization components for testing
 */
export function createInMemoryAuthzComponents(): {
  permissionChecker: PermissionChecker;
  roleManager: RoleManager;
} {
  const roleManager = createInMemoryRoleManager();
  const permissionChecker = createPermissionChecker(roleManager);

  return {
    permissionChecker,
    roleManager,
  };
}
