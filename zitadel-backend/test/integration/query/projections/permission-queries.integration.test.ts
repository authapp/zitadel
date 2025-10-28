/**
 * Permission Queries Integration Tests - REFACTORED
 * 
 * Tests complete stack: Command → Event → Projection → Query
 * Uses processProjections() (200ms wait) instead of direct SQL inserts
 * Projection intervals set to 50ms for fast detection
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database/pool';
import { PostgresEventstore } from '../../../../src/lib/eventstore/postgres/eventstore';
import { createTestDatabase, closeTestDatabase, cleanDatabase } from '../../setup';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { UserGrantProjection } from '../../../../src/lib/query/projections/user-grant-projection';
import { ProjectGrantProjection } from '../../../../src/lib/query/projections/project-grant-projection';
import { InstanceMemberProjection } from '../../../../src/lib/query/projections/instance-member-projection';
import { OrgMemberProjection } from '../../../../src/lib/query/projections/org-member-projection';
import { ProjectMemberProjection } from '../../../../src/lib/query/projections/project-member-projection';
import { PermissionQueries } from '../../../../src/lib/query/permission/permission-queries';
import { SystemPermissionQueries } from '../../../../src/lib/query/permission/system-permission-queries';
import {
  PermissionContext,
  Permission,
  ZitadelAction,
  ZitadelResource,
  ConditionType,
} from '../../../../src/lib/query/permission/permission-types';
import { generateId } from '../../../../src/lib/id';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';

describe('Permission Queries Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let permissionQueries: PermissionQueries;
  let systemQueries: SystemPermissionQueries;
  let commandCtx: CommandTestContext;

  const TEST_INSTANCE_ID = 'test-instance';

  beforeAll(async () => {
    pool = await createTestDatabase();
    await cleanDatabase(pool);
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: TEST_INSTANCE_ID,
      maxPushBatchSize: 100,
      enableSubscriptions: false,
    });

    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();

    // Register all needed projections with 50ms intervals
    const userGrantProjection = new UserGrantProjection(eventstore, pool);
    await userGrantProjection.init();
    registry.register({ name: 'user_grant_projection', tables: ['projections.user_grants'], interval: 50 }, userGrantProjection);
    
    const projectGrantProjection = new ProjectGrantProjection(eventstore, pool);
    await projectGrantProjection.init();
    registry.register({ name: 'project_grant_projection', tables: ['projections.project_grants'], interval: 50 }, projectGrantProjection);
    
    const instanceMemberProjection = new InstanceMemberProjection(eventstore, pool);
    await instanceMemberProjection.init();
    registry.register({ name: 'instance_member_projection', tables: ['projections.instance_members'], interval: 50 }, instanceMemberProjection);
    
    const orgMemberProjection = new OrgMemberProjection(eventstore, pool);
    await orgMemberProjection.init();
    registry.register({ name: 'org_member_projection', tables: ['projections.org_members'], interval: 50 }, orgMemberProjection);
    
    const projectMemberProjection = new ProjectMemberProjection(eventstore, pool);
    await projectMemberProjection.init();
    registry.register({ name: 'project_member_projection', tables: ['projections.project_members'], interval: 50 }, projectMemberProjection);

    // Start all projections
    await registry.start('user_grant_projection');
    await registry.start('project_grant_projection');
    await registry.start('instance_member_projection');
    await registry.start('org_member_projection');
    await registry.start('project_member_projection');
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2s warm-up

    permissionQueries = new PermissionQueries(pool);
    systemQueries = new SystemPermissionQueries(pool);
    commandCtx = await setupCommandTest(pool);

    // Setup instance (required for command API to work)
    await eventstore.push({
      eventType: 'instance.setup',
      aggregateType: 'instance',
      aggregateID: TEST_INSTANCE_ID,
      payload: {
        instanceName: 'Test Instance',
        defaultLanguage: 'en',
      },
      creator: 'system',
      owner: TEST_INSTANCE_ID,
      instanceID: TEST_INSTANCE_ID,
    });
    await new Promise(resolve => setTimeout(resolve, 200));
  }, 30000);

  afterAll(async () => {
    const names = registry.getNames();
    for (const name of names) {
      try {
        await registry.stop(name);
      } catch (e) {
        // Ignore if already stopped
      }
    }
    
    // Clear cache
    permissionQueries.cleanup();
    
    await closeTestDatabase();
  });

  // Helper: Process projections (200ms wait)
  async function processProjections(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Cache to track already setup entities (to avoid duplicate creation errors)
  const setupOrgs = new Set<string>();
  const setupProjects = new Set<string>();

  // Helper: Setup org (using Command API)
  async function setupOrg(orgId: string): Promise<void> {
    if (setupOrgs.has(orgId)) return; // Already setup
    
    const ctx = commandCtx.createContext({
      instanceID: TEST_INSTANCE_ID,
      orgID: TEST_INSTANCE_ID,
      userID: 'system-admin',
    });
    
    await commandCtx.commands.addOrg(ctx, {
      orgID: orgId,
      name: 'Test Org',
    });
    await processProjections();
    setupOrgs.add(orgId);
  }

  // Helper: Setup project (using Command API)
  async function setupProject(projectId: string, orgId: string): Promise<void> {
    if (setupProjects.has(projectId)) return; // Already setup
    
    const ctx = commandCtx.createContext({
      instanceID: TEST_INSTANCE_ID,
      orgID: orgId,
      userID: 'system-admin',
    });
    
    await commandCtx.commands.addProject(ctx, {
      projectID: projectId,
      orgID: orgId,
      name: 'Test Project',
      projectRoleAssertion: false,
      projectRoleCheck: false,
      hasProjectCheck: false,
      privateLabelingSetting: 0,
    });
    await processProjections();
    setupProjects.add(projectId);
  }

  // Helper: Add user grant (using Command API)
  async function addUserGrant(userId: string, projectId: string, orgId: string, roles: string[]): Promise<string> {
    await setupOrg(orgId);
    await setupProject(projectId, orgId);
    
    const ctx = commandCtx.createContext({
      instanceID: TEST_INSTANCE_ID,
      orgID: orgId,
      userID: 'system-admin',
    });
    
    const result = await commandCtx.commands.addUserGrant(ctx, {
      userID: userId,
      projectID: projectId,
      roleKeys: roles,
    });
    
    await processProjections();
    return result.grantID;
  }

  // Helper: Add instance member (using Command API)
  async function addInstanceMember(userId: string, roles: string[]): Promise<void> {
    const ctx = commandCtx.createContext({
      instanceID: TEST_INSTANCE_ID,
      orgID: TEST_INSTANCE_ID,
      userID: 'system-admin',
    });
    
    await commandCtx.commands.addInstanceMember(ctx, TEST_INSTANCE_ID, userId, roles);
    await processProjections();
  }

  // Helper: Add org member (using Command API)
  async function addOrgMember(userId: string, orgId: string, roles: string[]): Promise<void> {
    await setupOrg(orgId);
    
    const ctx = commandCtx.createContext({
      instanceID: TEST_INSTANCE_ID,
      orgID: orgId,
      userID: 'system-admin',
    });
    
    await commandCtx.commands.addOrgMember(ctx, orgId, {
      userID: userId,
      roles,
    });
    await processProjections();
  }

  // Helper: Add project member (using Command API)
  async function addProjectMember(userId: string, projectId: string, roles: string[]): Promise<void> {
    const orgId = generateId();
    await setupOrg(orgId);
    await setupProject(projectId, orgId);
    
    const ctx = commandCtx.createContext({
      instanceID: TEST_INSTANCE_ID,
      orgID: orgId,
      userID: 'system-admin',
    });
    
    await commandCtx.commands.addProjectMember(ctx, projectId, orgId, {
      userID: userId,
      roles,
    });
    await processProjections();
  }

  // Helper: Add project grant (using Command API)
  async function addProjectGrant(projectId: string, grantedOrgId: string, roles: string[]): Promise<string> {
    const ownerOrgId = generateId();
    await setupOrg(ownerOrgId);
    await setupOrg(grantedOrgId);
    await setupProject(projectId, ownerOrgId);
    
    const ctx = commandCtx.createContext({
      instanceID: TEST_INSTANCE_ID,
      orgID: ownerOrgId,
      userID: 'system-admin',
    });
    
    const result = await commandCtx.commands.addProjectGrant(ctx, projectId, ownerOrgId, {
      grantedOrgID: grantedOrgId,
      roleKeys: roles,
    });
    
    await processProjections();
    return result.grantID;
  }

  describe('User Grant Permissions', () => {
    it('should get permissions from user grants', async () => {
      const userId = generateId();
      const projectId = generateId();
      const orgId = generateId();

      await addUserGrant(userId, projectId, orgId, ['PROJECT_OWNER']);

      const context: PermissionContext = {
        userID: userId,
        instanceID: TEST_INSTANCE_ID,
        projectID: projectId,
      };

      const permissions = await permissionQueries.getMyPermissions(context);

      expect(permissions.userID).toBe(userId);
      expect(permissions.fromUserGrants.length).toBeGreaterThan(0);
      expect(
        permissions.fromUserGrants.some(p => p.resource === 'zitadel.project')
      ).toBe(true);
    });

    it('should check user grant permissions', async () => {
      const userId = generateId();
      const projectId = generateId();
      const orgId = generateId();

      await addUserGrant(userId, projectId, orgId, ['PROJECT_OWNER']);

      const context: PermissionContext = {
        userID: userId,
        instanceID: TEST_INSTANCE_ID,
        projectID: projectId,
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
      const userId = generateId();

      await addInstanceMember(userId, ['IAM_OWNER']);

      const context: PermissionContext = {
        userID: userId,
        instanceID: TEST_INSTANCE_ID,
      };

      const permissions = await permissionQueries.getMyPermissions(context);

      expect(permissions.userID).toBe(userId);
      expect(permissions.fromMembers.some(p => p.resource === 'zitadel.instance')).toBe(true);
    });

    it('should get permissions from org membership', async () => {
      const userId = generateId();
      const orgId = generateId();

      await addOrgMember(userId, orgId, ['ORG_OWNER']);

      const context: PermissionContext = {
        userID: userId,
        instanceID: TEST_INSTANCE_ID,
        orgID: orgId,
      };

      const permissions = await permissionQueries.getMyPermissions(context);

      expect(permissions.userID).toBe(userId);
      expect(permissions.fromMembers.some(
        p => p.resource === 'zitadel.org' && p.conditions?.some(c => c.type === ConditionType.ORGANIZATION && c.value === orgId)
      )).toBe(true);
    });

    it('should get permissions from project membership', async () => {
      const userId = generateId();
      const projectId = generateId();

      await addProjectMember(userId, projectId, ['PROJECT_OWNER']);

      const context: PermissionContext = {
        userID: userId,
        instanceID: TEST_INSTANCE_ID,
        projectID: projectId,
      };

      const permissions = await permissionQueries.getMyPermissions(context);

      expect(permissions.userID).toBe(userId);
      expect(permissions.fromMembers.some(
        p => p.resource === 'zitadel.project'
      )).toBe(true);
    });
  });

  describe('Project Grant Permissions', () => {
    it('should get permissions from project grants', async () => {
      const userId = generateId();
      const projectId = generateId();
      const grantedOrgId = generateId();

      await addProjectGrant(projectId, grantedOrgId, ['PROJECT_USER']);
      await addOrgMember(userId, grantedOrgId, ['ORG_OWNER']);

      const context: PermissionContext = {
        userID: userId,
        instanceID: TEST_INSTANCE_ID,
        projectID: projectId,
        orgID: grantedOrgId,
      };

      const permissions = await permissionQueries.getMyPermissions(context);

      expect(permissions.userID).toBe(userId);
      expect(permissions.fromProjectGrants.length).toBeGreaterThan(0);
    });
  });

  describe('Permission Aggregation', () => {
    it('should aggregate permissions from multiple sources', async () => {
      const userId = generateId();
      const orgId = generateId();
      const projectId = generateId();

      // Add instance membership
      await addInstanceMember(userId, ['IAM_OWNER']);

      // Add org membership
      await addOrgMember(userId, orgId, ['ORG_OWNER']);

      // Add user grant
      await addUserGrant(userId, projectId, orgId, ['PROJECT_OWNER']);

      const context: PermissionContext = {
        userID: userId,
        instanceID: TEST_INSTANCE_ID,
        orgID: orgId,
        projectID: projectId,
      };

      const permissions = await permissionQueries.getMyPermissions(context);

      expect(permissions.userID).toBe(userId);
      expect(permissions.fromMembers.length).toBeGreaterThan(0);
      expect(permissions.fromUserGrants.length).toBeGreaterThan(0);
      expect(
        permissions.fromMembers.some(p => p.resource === 'zitadel.instance')
      ).toBe(true);
      expect(
        permissions.fromMembers.some(p => p.resource === 'zitadel.org')
      ).toBe(true);
      expect(
        permissions.fromUserGrants.some(p => p.resource === 'zitadel.project')
      ).toBe(true);
    });
  });

  describe('Permission Conditions', () => {
    it('should check project-specific permissions', async () => {
      const userId = generateId();
      const projectId = generateId();
      const orgId = generateId();

      await addUserGrant(userId, projectId, orgId, ['PROJECT_OWNER']);

      const context: PermissionContext = {
        userID: userId,
        instanceID: TEST_INSTANCE_ID,
        projectID: projectId,
      };

      const requiredPermissions: Permission[] = [
        {
          resource: 'zitadel.project',
          action: 'manage',
          conditions: [{ type: ConditionType.PROJECT, value: projectId }],
        },
      ];

      const result = await permissionQueries.checkUserPermissions(context, requiredPermissions);

      expect(result.hasPermission).toBe(true);
    });

    it('should reject permissions for different project', async () => {
      const userId = generateId();
      const projectId1 = generateId();
      const projectId2 = generateId();
      const orgId = generateId();

      await addUserGrant(userId, projectId1, orgId, ['PROJECT_OWNER']);

      const context: PermissionContext = {
        userID: userId,
        instanceID: TEST_INSTANCE_ID,
        projectID: projectId2,
      };

      const requiredPermissions: Permission[] = [
        {
          resource: 'zitadel.project',
          action: 'manage',
          conditions: [{ type: ConditionType.PROJECT, value: projectId2 }],
        },
      ];

      const result = await permissionQueries.checkUserPermissions(context, requiredPermissions);

      expect(result.hasPermission).toBe(false);
    });
  });

  describe('System Permissions', () => {
    it('should get Zitadel system permissions for IAM owner', async () => {
      const userId = generateId();

      await addInstanceMember(userId, ['IAM_OWNER']);

      const permissions = await systemQueries.getMyZitadelPermissions(userId, TEST_INSTANCE_ID);

      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some(p => p.resource === 'zitadel.instance')).toBe(true);
    });

    it('should check specific Zitadel permission', async () => {
      const userId = generateId();

      await addInstanceMember(userId, ['IAM_OWNER']);

      const hasPermission = await systemQueries.hasZitadelPermission(
        userId,
        TEST_INSTANCE_ID,
        ZitadelResource.INSTANCE,
        ZitadelAction.MANAGE
      );

      expect(hasPermission).toBe(true);
    });

    it('should return limited permissions for IAM user', async () => {
      const userId = generateId();

      await addInstanceMember(userId, ['IAM_USER']);

      const permissions = await systemQueries.getMyZitadelPermissions(userId, TEST_INSTANCE_ID);

      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.every(p => p.action !== 'delete')).toBe(true);
    });
  });

  describe('Cache Behavior', () => {
    it('should cache permission results', async () => {
      const userId = generateId();
      const projectId = generateId();
      const orgId = generateId();

      await addUserGrant(userId, projectId, orgId, ['PROJECT_OWNER']);

      const context: PermissionContext = {
        userID: userId,
        instanceID: TEST_INSTANCE_ID,
        projectID: projectId,
      };

      // First call - miss cache
      const start1 = Date.now();
      const permissions1 = await permissionQueries.getMyPermissions(context);
      const time1 = Date.now() - start1;

      // Second call - hit cache (should be faster)
      const start2 = Date.now();
      const permissions2 = await permissionQueries.getMyPermissions(context);
      const time2 = Date.now() - start2;

      expect(permissions1.userID).toBe(permissions2.userID);
      expect(permissions1.fromUserGrants.length).toBe(permissions2.fromUserGrants.length);
      // Cache hit should be faster (allowing some variance)
      expect(time2).toBeLessThanOrEqual(time1 + 10);
    });

    it('should respect cache clear', async () => {
      const userId = generateId();
      const projectId = generateId();
      const orgId = generateId();

      await addUserGrant(userId, projectId, orgId, ['PROJECT_OWNER']);

      const context: PermissionContext = {
        userID: userId,
        instanceID: TEST_INSTANCE_ID,
        projectID: projectId,
      };

      // Get permissions (cache)
      const permissions1 = await permissionQueries.getMyPermissions(context);
      expect(permissions1.fromUserGrants.length).toBeGreaterThan(0);

      // Clear cache
      permissionQueries.cleanup();

      // Get permissions again (should still work)
      const permissions2 = await permissionQueries.getMyPermissions(context);
      expect(permissions2.fromUserGrants.length).toBeGreaterThan(0);
      expect(permissions1.userID).toBe(permissions2.userID);
    });
  });
});
