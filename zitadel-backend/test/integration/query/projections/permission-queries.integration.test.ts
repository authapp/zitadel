/**
 * Integration tests for Permission queries
 * Tests authorization permission checking with real database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PermissionQueries } from '../../../../src/lib/query/permission/permission-queries';
import { SystemPermissionQueries } from '../../../../src/lib/query/permission/system-permission-queries';
import {
  PermissionContext,
  Permission,
  ConditionType,
  ZitadelResource,
  ZitadelAction,
} from '../../../../src/lib/query/permission/permission-types';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';

describe('Permission Queries Integration Tests', () => {
  let database: DatabasePool;
  let permissionQueries: PermissionQueries;
  let systemQueries: SystemPermissionQueries;

  const TEST_INSTANCE_ID = 'test-instance-permission-integration';
  const TEST_USER_ID = 'test-user-permission-integration';
  const TEST_ORG_ID = 'test-org-permission-integration';
  const TEST_PROJECT_ID = 'test-project-permission-integration';
  const TEST_PROJECT_GRANT_ID = 'test-pg-permission-integration';
  const TEST_GRANTED_ORG_ID = 'test-granted-org-permission';

  beforeAll(async () => {
    // Use proper test setup
    database = await createTestDatabase();

    // Create projections schema if it doesn't exist
    await database.query('CREATE SCHEMA IF NOT EXISTS projections');

    permissionQueries = new PermissionQueries(database);
    systemQueries = new SystemPermissionQueries(database);

    // Create projection tables
    await createTables();
  });

  afterAll(async () => {
    // Clear timers to prevent Jest hanging
    permissionQueries.cleanup();
    
    try {
      await cleanupTestData();
    } catch (error) {
      // Ignore cleanup errors
    }
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clear cache to prevent test interference
    permissionQueries.cleanup();
    
    await cleanupTestData();
  });

  async function createTables() {
    // User grants table
    await database.query(`
      CREATE TABLE IF NOT EXISTS projections.user_grants (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        resource_owner TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        state SMALLINT NOT NULL DEFAULT 1,
        roles TEXT[] NOT NULL DEFAULT '{}',
        creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sequence BIGINT NOT NULL DEFAULT 0
      )
    `);

    // Project grants table
    await database.query(`
      CREATE TABLE IF NOT EXISTS projections.project_grants (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        granted_org_id TEXT NOT NULL,
        resource_owner TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        state SMALLINT NOT NULL DEFAULT 1,
        granted_roles TEXT[] NOT NULL DEFAULT '{}',
        creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sequence BIGINT NOT NULL DEFAULT 0
      )
    `);

    // Instance members table
    await database.query(`
      CREATE TABLE IF NOT EXISTS projections.instance_members (
        user_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        roles TEXT[] NOT NULL DEFAULT '{}',
        creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sequence BIGINT NOT NULL DEFAULT 0,
        resource_owner TEXT NOT NULL,
        PRIMARY KEY (user_id, instance_id)
      )
    `);

    // Org members table
    await database.query(`
      CREATE TABLE IF NOT EXISTS projections.org_members (
        user_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        roles TEXT[] NOT NULL DEFAULT '{}',
        creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sequence BIGINT NOT NULL DEFAULT 0,
        resource_owner TEXT NOT NULL,
        PRIMARY KEY (user_id, org_id, instance_id)
      )
    `);

    // Project members table
    await database.query(`
      CREATE TABLE IF NOT EXISTS projections.project_members (
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        roles TEXT[] NOT NULL DEFAULT '{}',
        creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sequence BIGINT NOT NULL DEFAULT 0,
        resource_owner TEXT NOT NULL,
        PRIMARY KEY (user_id, project_id, instance_id)
      )
    `);
  }

  async function cleanupTestData() {
    await database.query(`DELETE FROM projections.user_grants WHERE instance_id = $1`, [TEST_INSTANCE_ID]);
    await database.query(`DELETE FROM projections.project_grants WHERE instance_id = $1`, [TEST_INSTANCE_ID]);
    await database.query(`DELETE FROM projections.instance_members WHERE instance_id = $1`, [TEST_INSTANCE_ID]);
    await database.query(`DELETE FROM projections.org_members WHERE instance_id = $1`, [TEST_INSTANCE_ID]);
    await database.query(`DELETE FROM projections.project_members WHERE instance_id = $1`, [TEST_INSTANCE_ID]);
  }

  describe('User Grant Permissions', () => {
    it('should get permissions from user grants', async () => {
      // Insert user grant
      await database.query(
        `INSERT INTO projections.user_grants 
         (id, user_id, project_id, resource_owner, instance_id, state, roles, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, $5, 1, $6, 1, NOW(), NOW())`,
        ['ug-1', TEST_USER_ID, TEST_PROJECT_ID, TEST_ORG_ID, TEST_INSTANCE_ID, ['PROJECT_OWNER']]
      );

      const context: PermissionContext = {
        userID: TEST_USER_ID,
        instanceID: TEST_INSTANCE_ID,
        projectID: TEST_PROJECT_ID,
      };

      const permissions = await permissionQueries.getMyPermissions(context);

      expect(permissions.userID).toBe(TEST_USER_ID);
      expect(permissions.fromUserGrants.length).toBeGreaterThan(0);
      expect(
        permissions.fromUserGrants.some(p => p.resource === 'zitadel.project')
      ).toBe(true);
    });

    it('should check user grant permissions', async () => {
      await database.query(
        `INSERT INTO projections.user_grants 
         (id, user_id, project_id, resource_owner, instance_id, state, roles, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, $5, 1, $6, 1, NOW(), NOW())`,
        ['ug-2', TEST_USER_ID, TEST_PROJECT_ID, TEST_ORG_ID, TEST_INSTANCE_ID, ['PROJECT_OWNER']]
      );

      const context: PermissionContext = {
        userID: TEST_USER_ID,
        instanceID: TEST_INSTANCE_ID,
        projectID: TEST_PROJECT_ID,
      };

      const requiredPermissions: Permission[] = [
        { resource: 'zitadel.project', action: 'manage' },
      ];

      const result = await permissionQueries.checkUserPermissions(context, requiredPermissions);

      expect(result.hasPermission).toBe(true);
      expect(result.matchedPermissions).toHaveLength(1);
    });
  });

  describe('Member Permissions', () => {
    it('should get permissions from instance membership', async () => {
      await database.query(
        `INSERT INTO projections.instance_members 
         (user_id, instance_id, roles, resource_owner, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, 1, NOW(), NOW())`,
        [TEST_USER_ID, TEST_INSTANCE_ID, ['IAM_OWNER'], TEST_INSTANCE_ID]
      );

      const permissions = await permissionQueries.getGlobalPermissions(
        TEST_USER_ID,
        TEST_INSTANCE_ID
      );

      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some(p => p.resource === 'zitadel.instance')).toBe(true);
    });

    it('should get permissions from org membership', async () => {
      await database.query(
        `INSERT INTO projections.org_members 
         (user_id, org_id, instance_id, roles, resource_owner, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW())`,
        [TEST_USER_ID, TEST_ORG_ID, TEST_INSTANCE_ID, ['ORG_OWNER'], TEST_ORG_ID]
      );

      const context: PermissionContext = {
        userID: TEST_USER_ID,
        instanceID: TEST_INSTANCE_ID,
        orgID: TEST_ORG_ID,
      };

      const permissions = await permissionQueries.getMyPermissions(context);

      expect(permissions.fromMembers.length).toBeGreaterThan(0);
      expect(permissions.fromMembers.some(p => p.resource === 'zitadel.org')).toBe(true);
    });

    it('should get permissions from project membership', async () => {
      await database.query(
        `INSERT INTO projections.project_members 
         (user_id, project_id, instance_id, roles, resource_owner, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW())`,
        [TEST_USER_ID, TEST_PROJECT_ID, TEST_INSTANCE_ID, ['PROJECT_OWNER'], TEST_ORG_ID]
      );

      const context: PermissionContext = {
        userID: TEST_USER_ID,
        instanceID: TEST_INSTANCE_ID,
        projectID: TEST_PROJECT_ID,
      };

      const permissions = await permissionQueries.getMyPermissions(context);

      expect(permissions.fromMembers.length).toBeGreaterThan(0);
      expect(permissions.fromMembers.some(p => p.resource === 'zitadel.project')).toBe(true);
    });
  });

  describe('Project Grant Permissions', () => {
    it('should get permissions from project grants', async () => {
      await database.query(
        `INSERT INTO projections.project_grants 
         (id, project_id, granted_org_id, resource_owner, instance_id, state, granted_roles, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, $5, 1, $6, 1, NOW(), NOW())`,
        [
          TEST_PROJECT_GRANT_ID,
          TEST_PROJECT_ID,
          TEST_GRANTED_ORG_ID,
          TEST_ORG_ID,
          TEST_INSTANCE_ID,
          ['PROJECT_USER'],
        ]
      );

      const context: PermissionContext = {
        userID: TEST_USER_ID,
        instanceID: TEST_INSTANCE_ID,
        orgID: TEST_GRANTED_ORG_ID,
      };

      const permissions = await permissionQueries.getMyPermissions(context);

      expect(permissions.fromProjectGrants.length).toBeGreaterThan(0);
    });
  });

  describe('Permission Aggregation', () => {
    it('should aggregate permissions from multiple sources', async () => {
      // Add instance membership
      await database.query(
        `INSERT INTO projections.instance_members 
         (user_id, instance_id, roles, resource_owner, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, 1, NOW(), NOW())`,
        [TEST_USER_ID, TEST_INSTANCE_ID, ['IAM_ADMIN'], TEST_INSTANCE_ID]
      );

      // Add org membership
      await database.query(
        `INSERT INTO projections.org_members 
         (user_id, org_id, instance_id, roles, resource_owner, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW())`,
        [TEST_USER_ID, TEST_ORG_ID, TEST_INSTANCE_ID, ['ORG_OWNER'], TEST_ORG_ID]
      );

      // Add user grant
      await database.query(
        `INSERT INTO projections.user_grants 
         (id, user_id, project_id, resource_owner, instance_id, state, roles, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, $5, 1, $6, 1, NOW(), NOW())`,
        ['ug-3', TEST_USER_ID, TEST_PROJECT_ID, TEST_ORG_ID, TEST_INSTANCE_ID, ['PROJECT_OWNER']]
      );

      const context: PermissionContext = {
        userID: TEST_USER_ID,
        instanceID: TEST_INSTANCE_ID,
        orgID: TEST_ORG_ID,
        projectID: TEST_PROJECT_ID,
      };

      const permissions = await permissionQueries.getMyPermissions(context);

      expect(permissions.fromUserGrants.length).toBeGreaterThan(0);
      expect(permissions.fromMembers.length).toBeGreaterThan(0);
      expect(permissions.permissions.length).toBeGreaterThan(0);
    });
  });

  describe('Permission Conditions', () => {
    it('should check project-specific permissions', async () => {
      await database.query(
        `INSERT INTO projections.user_grants 
         (id, user_id, project_id, resource_owner, instance_id, state, roles, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, $5, 1, $6, 1, NOW(), NOW())`,
        ['ug-4', TEST_USER_ID, TEST_PROJECT_ID, TEST_ORG_ID, TEST_INSTANCE_ID, ['PROJECT_OWNER']]
      );

      const context: PermissionContext = {
        userID: TEST_USER_ID,
        instanceID: TEST_INSTANCE_ID,
        projectID: TEST_PROJECT_ID,
      };

      const requiredPermissions: Permission[] = [
        {
          resource: 'zitadel.project',
          action: 'manage',
          conditions: [{ type: ConditionType.PROJECT, value: TEST_PROJECT_ID }],
        },
      ];

      const result = await permissionQueries.checkUserPermissions(context, requiredPermissions);

      expect(result.hasPermission).toBe(true);
    });

    it('should reject permissions for different project', async () => {
      await database.query(
        `INSERT INTO projections.user_grants 
         (id, user_id, project_id, resource_owner, instance_id, state, roles, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, $5, 1, $6, 1, NOW(), NOW())`,
        ['ug-5', TEST_USER_ID, TEST_PROJECT_ID, TEST_ORG_ID, TEST_INSTANCE_ID, ['PROJECT_OWNER']]
      );

      const context: PermissionContext = {
        userID: TEST_USER_ID,
        instanceID: TEST_INSTANCE_ID,
        projectID: TEST_PROJECT_ID,
      };

      const requiredPermissions: Permission[] = [
        {
          resource: 'zitadel.project',
          action: 'manage',
          conditions: [{ type: ConditionType.PROJECT, value: 'different-project' }],
        },
      ];

      const result = await permissionQueries.checkUserPermissions(context, requiredPermissions);

      expect(result.hasPermission).toBe(false);
    });
  });

  describe('System Permissions', () => {
    it('should get Zitadel system permissions for IAM owner', async () => {
      await database.query(
        `INSERT INTO projections.instance_members 
         (user_id, instance_id, roles, resource_owner, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, 1, NOW(), NOW())`,
        [TEST_USER_ID, TEST_INSTANCE_ID, ['IAM_OWNER'], TEST_INSTANCE_ID]
      );

      const permissions = await systemQueries.getMyZitadelPermissions(
        TEST_USER_ID,
        TEST_INSTANCE_ID
      );

      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some(p => p.resource === ZitadelResource.INSTANCE)).toBe(true);
      expect(permissions.every(p => p.action === ZitadelAction.MANAGE)).toBe(true);
    });

    it('should check specific Zitadel permission', async () => {
      await database.query(
        `INSERT INTO projections.instance_members 
         (user_id, instance_id, roles, resource_owner, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, 1, NOW(), NOW())`,
        [TEST_USER_ID, TEST_INSTANCE_ID, ['IAM_OWNER'], TEST_INSTANCE_ID]
      );

      const hasPermission = await systemQueries.hasZitadelPermission(
        TEST_USER_ID,
        TEST_INSTANCE_ID,
        ZitadelResource.ORG,
        ZitadelAction.MANAGE
      );

      expect(hasPermission).toBe(true);
    });

    it('should return limited permissions for IAM user', async () => {
      await database.query(
        `INSERT INTO projections.instance_members 
         (user_id, instance_id, roles, resource_owner, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, 1, NOW(), NOW())`,
        [TEST_USER_ID, TEST_INSTANCE_ID, ['IAM_USER'], TEST_INSTANCE_ID]
      );

      const permissions = await systemQueries.getMyZitadelPermissions(
        TEST_USER_ID,
        TEST_INSTANCE_ID
      );

      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.every(p => p.action === ZitadelAction.READ)).toBe(true);
    });
  });

  describe('Cache Behavior', () => {
    it('should cache permission results', async () => {
      await database.query(
        `INSERT INTO projections.user_grants 
         (id, user_id, project_id, resource_owner, instance_id, state, roles, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, $5, 1, $6, 1, NOW(), NOW())`,
        ['ug-6', TEST_USER_ID, TEST_PROJECT_ID, TEST_ORG_ID, TEST_INSTANCE_ID, ['PROJECT_OWNER']]
      );

      const context: PermissionContext = {
        userID: TEST_USER_ID,
        instanceID: TEST_INSTANCE_ID,
        projectID: TEST_PROJECT_ID,
      };

      // First call
      const perms1 = await permissionQueries.getMyPermissions(context);
      
      // Delete the grant
      await database.query(`DELETE FROM projections.user_grants WHERE id = 'ug-6'`);
      
      // Second call should return cached result
      const perms2 = await permissionQueries.getMyPermissions(context);

      expect(perms1.fromUserGrants.length).toBe(perms2.fromUserGrants.length);
    });

    it('should respect cache clear', async () => {
      await database.query(
        `INSERT INTO projections.user_grants 
         (id, user_id, project_id, resource_owner, instance_id, state, roles, sequence, creation_date, change_date)
         VALUES ($1, $2, $3, $4, $5, 1, $6, 1, NOW(), NOW())`,
        ['ug-7', TEST_USER_ID, TEST_PROJECT_ID, TEST_ORG_ID, TEST_INSTANCE_ID, ['PROJECT_OWNER']]
      );

      const context: PermissionContext = {
        userID: TEST_USER_ID,
        instanceID: TEST_INSTANCE_ID,
        projectID: TEST_PROJECT_ID,
      };

      // First call
      await permissionQueries.getMyPermissions(context);
      
      // Clear cache
      permissionQueries.clearCache(TEST_USER_ID, TEST_INSTANCE_ID);
      
      // Delete the grant
      await database.query(`DELETE FROM projections.user_grants WHERE id = 'ug-7'`);
      
      // Second call should query database again
      const perms = await permissionQueries.getMyPermissions(context);

      expect(perms.fromUserGrants.length).toBe(0);
    });
  });
});
