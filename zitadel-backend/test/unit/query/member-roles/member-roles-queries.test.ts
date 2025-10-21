/**
 * Unit tests for Member Roles Queries
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MemberRolesQueries } from '../../../../src/lib/query/member-roles/member-roles-queries';
import { MemberRoleScope, ZITADEL_ROLES } from '../../../../src/lib/query/member-roles/member-roles-types';

describe('MemberRolesQueries', () => {
  let queries: MemberRolesQueries;

  beforeEach(() => {
    queries = new MemberRolesQueries();
  });

  describe('getMemberRoles', () => {
    it('should return all roles from all scopes', () => {
      const roles = queries.getMemberRoles();

      expect(roles.length).toBeGreaterThan(0);
      expect(roles.some(r => r.scope === MemberRoleScope.INSTANCE)).toBe(true);
      expect(roles.some(r => r.scope === MemberRoleScope.ORG)).toBe(true);
      expect(roles.some(r => r.scope === MemberRoleScope.PROJECT)).toBe(true);
      expect(roles.some(r => r.scope === MemberRoleScope.PROJECT_GRANT)).toBe(true);
    });

    it('should return roles with all required fields', () => {
      const roles = queries.getMemberRoles();

      roles.forEach(role => {
        expect(role.key).toBeDefined();
        expect(role.displayName).toBeDefined();
        expect(role.group).toBeDefined();
        expect(role.scope).toBeDefined();
      });
    });
  });

  describe('getGlobalMemberRoles', () => {
    it('should return instance-level roles', () => {
      const roles = queries.getGlobalMemberRoles();

      expect(roles.length).toBeGreaterThan(0);
      expect(roles.every(r => r.scope === MemberRoleScope.INSTANCE)).toBe(true);
    });

    it('should return same roles as getInstanceMemberRoles', () => {
      const globalRoles = queries.getGlobalMemberRoles();
      const instanceRoles = queries.getInstanceMemberRoles();

      expect(globalRoles).toEqual(instanceRoles);
    });
  });

  describe('getInstanceMemberRoles', () => {
    it('should return IAM roles', () => {
      const roles = queries.getInstanceMemberRoles();

      expect(roles.length).toBe(4);
      expect(roles.some(r => r.key === ZITADEL_ROLES.IAM_OWNER)).toBe(true);
      expect(roles.some(r => r.key === ZITADEL_ROLES.IAM_ADMIN)).toBe(true);
      expect(roles.some(r => r.key === ZITADEL_ROLES.IAM_USER)).toBe(true);
      expect(roles.some(r => r.key === ZITADEL_ROLES.IAM_OWNER_VIEWER)).toBe(true);
    });

    it('should return roles with correct scope', () => {
      const roles = queries.getInstanceMemberRoles();

      expect(roles.every(r => r.scope === MemberRoleScope.INSTANCE)).toBe(true);
    });
  });

  describe('getOrgMemberRoles', () => {
    it('should return organization roles', () => {
      const roles = queries.getOrgMemberRoles();

      expect(roles.length).toBe(7);
      expect(roles.some(r => r.key === ZITADEL_ROLES.ORG_OWNER)).toBe(true);
      expect(roles.some(r => r.key === ZITADEL_ROLES.ORG_ADMIN)).toBe(true);
      expect(roles.some(r => r.key === ZITADEL_ROLES.ORG_USER_MANAGER)).toBe(true);
    });

    it('should return roles with correct scope', () => {
      const roles = queries.getOrgMemberRoles();

      expect(roles.every(r => r.scope === MemberRoleScope.ORG)).toBe(true);
    });
  });

  describe('getProjectMemberRoles', () => {
    it('should return project roles', () => {
      const roles = queries.getProjectMemberRoles();

      expect(roles.length).toBe(5);
      expect(roles.some(r => r.key === ZITADEL_ROLES.PROJECT_OWNER)).toBe(true);
      expect(roles.some(r => r.key === ZITADEL_ROLES.PROJECT_ADMIN)).toBe(true);
      expect(roles.some(r => r.key === ZITADEL_ROLES.PROJECT_USER_MANAGER)).toBe(true);
    });

    it('should return roles with correct scope', () => {
      const roles = queries.getProjectMemberRoles();

      expect(roles.every(r => r.scope === MemberRoleScope.PROJECT)).toBe(true);
    });
  });

  describe('getProjectGrantMemberRoles', () => {
    it('should return project grant roles', () => {
      const roles = queries.getProjectGrantMemberRoles();

      expect(roles.length).toBe(1);
      expect(roles[0].key).toBe(ZITADEL_ROLES.PROJECT_GRANT_MEMBER_MANAGER);
    });

    it('should return roles with correct scope', () => {
      const roles = queries.getProjectGrantMemberRoles();

      expect(roles.every(r => r.scope === MemberRoleScope.PROJECT_GRANT)).toBe(true);
    });
  });

  describe('getRoleByKey', () => {
    it('should return role for valid key', () => {
      const role = queries.getRoleByKey(ZITADEL_ROLES.IAM_OWNER);

      expect(role).toBeDefined();
      expect(role?.key).toBe(ZITADEL_ROLES.IAM_OWNER);
      expect(role?.displayName).toBe('IAM Owner');
    });

    it('should return undefined for invalid key', () => {
      const role = queries.getRoleByKey('INVALID_ROLE');

      expect(role).toBeUndefined();
    });
  });

  describe('getRolesByScope', () => {
    it('should return only instance roles for INSTANCE scope', () => {
      const roles = queries.getRolesByScope(MemberRoleScope.INSTANCE);

      expect(roles.length).toBe(4);
      expect(roles.every(r => r.scope === MemberRoleScope.INSTANCE)).toBe(true);
    });

    it('should return only org roles for ORG scope', () => {
      const roles = queries.getRolesByScope(MemberRoleScope.ORG);

      expect(roles.length).toBe(7);
      expect(roles.every(r => r.scope === MemberRoleScope.ORG)).toBe(true);
    });

    it('should return only project roles for PROJECT scope', () => {
      const roles = queries.getRolesByScope(MemberRoleScope.PROJECT);

      expect(roles.length).toBe(5);
      expect(roles.every(r => r.scope === MemberRoleScope.PROJECT)).toBe(true);
    });

    it('should return only project grant roles for PROJECT_GRANT scope', () => {
      const roles = queries.getRolesByScope(MemberRoleScope.PROJECT_GRANT);

      expect(roles.length).toBe(1);
      expect(roles.every(r => r.scope === MemberRoleScope.PROJECT_GRANT)).toBe(true);
    });
  });

  describe('hasRole', () => {
    it('should return true for valid role key', () => {
      expect(queries.hasRole(ZITADEL_ROLES.IAM_OWNER)).toBe(true);
      expect(queries.hasRole(ZITADEL_ROLES.ORG_OWNER)).toBe(true);
      expect(queries.hasRole(ZITADEL_ROLES.PROJECT_OWNER)).toBe(true);
    });

    it('should return false for invalid role key', () => {
      expect(queries.hasRole('INVALID_ROLE')).toBe(false);
      expect(queries.hasRole('')).toBe(false);
    });
  });

  describe('validateRolesForScope', () => {
    it('should return empty array for valid instance roles', () => {
      const invalid = queries.validateRolesForScope(
        [ZITADEL_ROLES.IAM_OWNER, ZITADEL_ROLES.IAM_ADMIN],
        MemberRoleScope.INSTANCE
      );

      expect(invalid).toEqual([]);
    });

    it('should return invalid roles for wrong scope', () => {
      const invalid = queries.validateRolesForScope(
        [ZITADEL_ROLES.IAM_OWNER, ZITADEL_ROLES.ORG_OWNER],
        MemberRoleScope.INSTANCE
      );

      expect(invalid).toEqual([ZITADEL_ROLES.ORG_OWNER]);
    });

    it('should return all invalid roles', () => {
      const invalid = queries.validateRolesForScope(
        ['INVALID_1', 'INVALID_2'],
        MemberRoleScope.ORG
      );

      expect(invalid).toEqual(['INVALID_1', 'INVALID_2']);
    });

    it('should return empty array when all roles valid for org scope', () => {
      const invalid = queries.validateRolesForScope(
        [ZITADEL_ROLES.ORG_OWNER, ZITADEL_ROLES.ORG_ADMIN],
        MemberRoleScope.ORG
      );

      expect(invalid).toEqual([]);
    });
  });

  describe('Role Completeness', () => {
    it('should have all standard IAM roles', () => {
      const roles = queries.getInstanceMemberRoles();
      const roleKeys = roles.map(r => r.key);

      expect(roleKeys).toContain(ZITADEL_ROLES.IAM_OWNER);
      expect(roleKeys).toContain(ZITADEL_ROLES.IAM_OWNER_VIEWER);
      expect(roleKeys).toContain(ZITADEL_ROLES.IAM_ADMIN);
      expect(roleKeys).toContain(ZITADEL_ROLES.IAM_USER);
    });

    it('should have all standard org roles', () => {
      const roles = queries.getOrgMemberRoles();
      const roleKeys = roles.map(r => r.key);

      expect(roleKeys).toContain(ZITADEL_ROLES.ORG_OWNER);
      expect(roleKeys).toContain(ZITADEL_ROLES.ORG_ADMIN);
      expect(roleKeys).toContain(ZITADEL_ROLES.ORG_USER_MANAGER);
      expect(roleKeys).toContain(ZITADEL_ROLES.ORG_PROJECT_CREATOR);
    });

    it('should have all standard project roles', () => {
      const roles = queries.getProjectMemberRoles();
      const roleKeys = roles.map(r => r.key);

      expect(roleKeys).toContain(ZITADEL_ROLES.PROJECT_OWNER);
      expect(roleKeys).toContain(ZITADEL_ROLES.PROJECT_ADMIN);
      expect(roleKeys).toContain(ZITADEL_ROLES.PROJECT_USER_MANAGER);
      expect(roleKeys).toContain(ZITADEL_ROLES.PROJECT_GRANT_OWNER);
    });
  });
});
