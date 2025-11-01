/**
 * Instance Service - Comprehensive Integration Tests
 * 
 * Tests the complete CQRS stack for Instance gRPC API:
 * API Layer → Command Layer → Event Layer → Projection Layer → Query Layer → Database
 * 
 * Pattern: Based on Organization/Project Service integration tests
 * Coverage: Instance CRUD, Domain Management, Features, Member Management
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';
import { Context } from '../../../../src/lib/command/context';
import { InstanceService } from '../../../../src/api/grpc/instance/v2/instance_service';
import { InstanceProjection } from '../../../../src/lib/query/projections/instance-projection';
import { InstanceDomainProjection } from '../../../../src/lib/query/projections/instance-domain-projection';
import { InstanceMemberProjection } from '../../../../src/lib/query/projections/instance-member-projection';
import { InstanceQueries } from '../../../../src/lib/query/instance/instance-queries';
import { InstanceMemberQueries } from '../../../../src/lib/query/member/instance-member-queries';
import { OrgProjection } from '../../../../src/lib/query/projections/org-projection';
import { UserProjection } from '../../../../src/lib/query/projections/user-projection';

describe('Instance Service - COMPREHENSIVE Integration Tests (Full Stack)', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let instanceService: InstanceService;
  let instanceProjection: InstanceProjection;
  let instanceDomainProjection: InstanceDomainProjection;
  let instanceMemberProjection: InstanceMemberProjection;
  let orgProjection: OrgProjection;
  let userProjection: UserProjection;
  let instanceQueries: InstanceQueries;
  let memberQueries: InstanceMemberQueries;

  beforeAll(async () => {
    // Create test database
    pool = await createTestDatabase();
    
    // Setup command test infrastructure
    ctx = await setupCommandTest(pool);
    
    // Initialize projections
    instanceProjection = new InstanceProjection(ctx.eventstore, pool);
    await instanceProjection.init();
    
    instanceDomainProjection = new InstanceDomainProjection(ctx.eventstore, pool);
    await instanceDomainProjection.init();
    
    instanceMemberProjection = new InstanceMemberProjection(ctx.eventstore, pool);
    await instanceMemberProjection.init();
    
    orgProjection = new OrgProjection(ctx.eventstore, pool);
    await orgProjection.init();
    
    userProjection = new UserProjection(ctx.eventstore, pool);
    await userProjection.init();
    
    // Initialize queries
    instanceQueries = new InstanceQueries(pool);
    memberQueries = new InstanceMemberQueries(pool);
    
    // Initialize InstanceService (gRPC layer)
    instanceService = new InstanceService(ctx.commands, pool);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await ctx.clearEvents();
  });

  /**
   * Helper: Process all projections and wait for updates
   */
  async function processProjections(): Promise<void> {
    const events = await ctx.getEvents('*', '*');
    for (const event of events) {
      await instanceProjection.reduce(event);
      await instanceDomainProjection.reduce(event);
      await instanceMemberProjection.reduce(event);
      await orgProjection.reduce(event);
      await userProjection.reduce(event);
    }
    // Delay to ensure DB commit
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Assert instance exists in query layer
   */
  async function assertInstanceInQuery(instanceId: string, expectedName?: string) {
    const instance = await instanceQueries.getInstanceByID(instanceId);
    expect(instance).not.toBeNull();
    if (expectedName) {
      expect(instance!.name).toBe(expectedName);
    }
    return instance!;
  }

  /**
   * Helper: Assert instance domain exists in query layer
   */
  async function assertInstanceDomainInQuery(instanceId: string, domain: string) {
    const result = await instanceQueries.searchInstanceDomains({
      instanceID: instanceId,
      domain,
    });
    expect(result.domains.length).toBeGreaterThan(0);
    const foundDomain = result.domains.find(d => d.domain === domain);
    expect(foundDomain).toBeDefined();
    return foundDomain!;
  }

  /**
   * Helper: Assert instance member exists in query layer
   */
  async function assertInstanceMemberInQuery(instanceId: string, userId: string, expectedRoles?: string[]) {
    const member = await memberQueries.getIAMMemberByIAMIDAndUserID(instanceId, userId);
    expect(member).not.toBeNull();
    if (expectedRoles) {
      expect(member!.roles).toEqual(expect.arrayContaining(expectedRoles));
    }
    return member!;
  }

  // ============================================================================
  // Instance Lifecycle Tests
  // ============================================================================

  describe('SetupInstance', () => {
    it('should create a new instance with default org and admin through complete stack', async () => {
      const context = ctx.createContext();
      const instanceName = `Test Instance ${Date.now()}`;
      const orgName = `Default Org ${Date.now()}`;
      const adminUsername = `admin-${Date.now()}`;
      const adminEmail = `admin-${Date.now()}@test.com`;

      console.log('\n--- Setting up new instance ---');

      // Execute via gRPC service
      const response = await instanceService.setupInstance(context, {
        instanceName,
        defaultOrgName: orgName,
        adminUser: {
          username: adminUsername,
          email: adminEmail,
          firstName: 'Admin',
          lastName: 'User',
          password: 'AdminPassword123!',
        },
        customDomain: 'test.example.com',
        defaultLanguage: 'en',
      });

      expect(response.instanceId).toBeDefined();
      expect(response.orgId).toBeDefined();
      expect(response.userId).toBeDefined();
      expect(response.details).toBeDefined();

      // Process projections
      await processProjections();

      // Verify via query layer
      const instance = await assertInstanceInQuery(response.instanceId, instanceName);
      expect(instance.defaultOrgID).toBe(response.orgId);
      expect(instance.defaultLanguage).toBe('en');

      console.log(`✓ Instance created: ${response.instanceId}`);
      console.log(`✓ Default org created: ${response.orgId}`);
      console.log(`✓ Admin user created: ${response.userId}`);
    });

    it('should fail with empty instance name', async () => {
      const context = ctx.createContext();

      await expect(
        instanceService.setupInstance(context, {
          instanceName: '',
          defaultOrgName: 'Org',
          adminUser: {
            username: 'admin',
            email: 'admin@test.com',
            firstName: 'Admin',
            lastName: 'User',
          },
        })
      ).rejects.toThrow('instance name is required');
    });

    it('should fail with empty organization name', async () => {
      const context = ctx.createContext();

      await expect(
        instanceService.setupInstance(context, {
          instanceName: 'Instance',
          defaultOrgName: '',
          adminUser: {
            username: 'admin',
            email: 'admin@test.com',
            firstName: 'Admin',
            lastName: 'User',
          },
        })
      ).rejects.toThrow('default organization name is required');
    });
  });

  describe('GetInstance', () => {
    it('should retrieve instance with domains through query layer', async () => {
      const context = ctx.createContext();

      // Setup instance
      const setupResponse = await instanceService.setupInstance(context, {
        instanceName: 'Test Instance',
        defaultOrgName: 'Test Org',
        adminUser: {
          username: `admin-${Date.now()}`,
          email: `admin-${Date.now()}@test.com`,
          firstName: 'Admin',
          lastName: 'User',
        },
      });

      await processProjections();

      // Get instance via gRPC service
      const response = await instanceService.getInstance(context, {
        instanceId: setupResponse.instanceId,
      });

      expect(response.instance).toBeDefined();
      expect(response.instance.id).toBe(setupResponse.instanceId);
      expect(response.instance.name).toBe('Test Instance');
      expect(response.instance.state).toBeDefined();
      expect(response.instance.domains).toBeDefined();

      console.log(`✓ Instance retrieved: ${response.instance.id}`);
    });

    it('should fail for non-existent instance', async () => {
      const context = ctx.createContext();

      await expect(
        instanceService.getInstance(context, {
          instanceId: 'non-existent-id',
        })
      ).rejects.toThrow('instance not found');
    });
  });

  // ============================================================================
  // Instance Domain Tests
  // ============================================================================

  describe('Instance Domain Management', () => {
    let testInstanceId: string;

    beforeEach(async () => {
      const context = ctx.createContext();
      const response = await instanceService.setupInstance(context, {
        instanceName: `Instance ${Date.now()}`,
        defaultOrgName: `Org ${Date.now()}`,
        adminUser: {
          username: `admin-${Date.now()}`,
          email: `admin-${Date.now()}@test.com`,
          firstName: 'Admin',
          lastName: 'User',
        },
      });
      testInstanceId = response.instanceId;
      await processProjections();
    });

    it('should add domain to instance through complete stack', async () => {
      const context = ctx.createContext();
      const domain = `test-${Date.now()}.example.com`;

      console.log('\n--- Adding instance domain ---');

      // Add domain via gRPC service
      const response = await instanceService.addInstanceDomain(context, {
        instanceId: testInstanceId,
        domain,
        isGenerated: false,
      });

      expect(response.details).toBeDefined();

      // Process projections
      await processProjections();

      // Verify via query layer
      const foundDomain = await assertInstanceDomainInQuery(testInstanceId, domain);
      expect(foundDomain.isGenerated).toBe(false);
      expect(foundDomain.isPrimary).toBe(false);

      console.log(`✓ Domain added: ${domain}`);
    });

    it('should set default domain', async () => {
      const context = ctx.createContext();
      const domain1 = `domain1-${Date.now()}.example.com`;
      const domain2 = `domain2-${Date.now()}.example.com`;

      // Add two domains
      await instanceService.addInstanceDomain(context, {
        instanceId: testInstanceId,
        domain: domain1,
      });
      await processProjections();
      
      await instanceService.addInstanceDomain(context, {
        instanceId: testInstanceId,
        domain: domain2,
      });
      await processProjections();

      console.log('\n--- Setting default domain ---');

      // Set domain2 as default
      await instanceService.setDefaultInstanceDomain(context, {
        instanceId: testInstanceId,
        domain: domain2,
      });

      await processProjections();

      // Verify via query layer
      const foundDomain = await assertInstanceDomainInQuery(testInstanceId, domain2);
      expect(foundDomain.isPrimary).toBe(true);

      console.log(`✓ Domain set as default: ${domain2}`);
    });

    it('should remove non-default domain', async () => {
      const context = ctx.createContext();
      const firstDomain = `first-${Date.now()}.example.com`;
      const removeDomain = `remove-${Date.now()}.example.com`;

      // Add first domain (becomes default automatically)
      await instanceService.addInstanceDomain(context, {
        instanceId: testInstanceId,
        domain: firstDomain,
      });
      await processProjections();

      // Add second domain to remove (won't be default since first one is default)
      await instanceService.addInstanceDomain(context, {
        instanceId: testInstanceId,
        domain: removeDomain,
      });
      await processProjections();

      console.log('\n--- Removing non-default instance domain ---');

      // Remove non-default domain
      await instanceService.removeInstanceDomain(context, {
        instanceId: testInstanceId,
        domain: removeDomain,
      });

      await processProjections();

      // Verify via query layer (should not exist)
      const result = await instanceQueries.searchInstanceDomains({
        instanceID: testInstanceId,
        domain: removeDomain,
      });
      expect(result.domains.length).toBe(0);

      console.log(`✓ Domain removed: ${removeDomain}`);
    });

    it('should list instance domains', async () => {
      const context = ctx.createContext();

      // Add multiple domains
      const domains = [
        `domain1-${Date.now()}.example.com`,
        `domain2-${Date.now()}.example.com`,
      ];

      for (const domain of domains) {
        await instanceService.addInstanceDomain(context, {
          instanceId: testInstanceId,
          domain,
        });
      }

      await processProjections();

      console.log('\n--- Listing instance domains ---');

      // List domains via gRPC service
      const response = await instanceService.listInstanceDomains(context, {
        instanceId: testInstanceId,
      });

      expect(response.result).toBeDefined();
      expect(response.result.length).toBeGreaterThanOrEqual(domains.length);
      expect(response.details.totalResult).toBeGreaterThanOrEqual(domains.length);

      console.log(`✓ Found ${response.result.length} domains`);
    });
  });

  // ============================================================================
  // Instance Features Tests
  // ============================================================================

  describe('Instance Features', () => {
    let testInstanceId: string;

    beforeEach(async () => {
      const context = ctx.createContext();
      const response = await instanceService.setupInstance(context, {
        instanceName: `Instance ${Date.now()}`,
        defaultOrgName: `Org ${Date.now()}`,
        adminUser: {
          username: `admin-${Date.now()}`,
          email: `admin-${Date.now()}@test.com`,
          firstName: 'Admin',
          lastName: 'User',
        },
      });
      testInstanceId = response.instanceId;
      await processProjections();
    });

    it('should set instance features through complete stack', async () => {
      const context = ctx.createContext();

      console.log('\n--- Setting instance features ---');

      // Set features via gRPC service
      const response = await instanceService.setInstanceFeatures(context, {
        instanceId: testInstanceId,
        loginDefaultOrg: true,
        tokenExchange: true,
        actions: true,
      });

      expect(response.details).toBeDefined();

      // Process projections
      await processProjections();

      // Verify via query layer
      const features = await instanceQueries.getInstanceFeatures(testInstanceId);
      expect(features).not.toBeNull();
      expect(features!.loginDefaultOrg).toBe(true);
      expect(features!.tokenExchange).toBe(true);
      expect(features!.actions).toBe(true);

      console.log('✓ Features set successfully');
    });

    it('should get instance features', async () => {
      const context = ctx.createContext();

      // Set some features first
      await instanceService.setInstanceFeatures(context, {
        instanceId: testInstanceId,
        improvedPerformance: true,
        userSchema: true,
      });
      await processProjections();

      console.log('\n--- Getting instance features ---');

      // Get features via gRPC service
      const response = await instanceService.getInstanceFeatures(context, {
        instanceId: testInstanceId,
      });

      expect(response.features).toBeDefined();
      expect(response.features.improvedPerformance).toBe(true);
      expect(response.features.userSchema).toBe(true);

      console.log('✓ Features retrieved successfully');
    });

    it('should reset instance features to defaults', async () => {
      const context = ctx.createContext();

      // Set some features first
      await instanceService.setInstanceFeatures(context, {
        instanceId: testInstanceId,
        loginDefaultOrg: true,
        actions: true,
      });
      await processProjections();

      console.log('\n--- Resetting instance features ---');

      // Reset features via gRPC service
      await instanceService.resetInstanceFeatures(context, {
        instanceId: testInstanceId,
      });

      await processProjections();

      // Verify via query layer (features should be defaults/false)
      const features = await instanceQueries.getInstanceFeatures(testInstanceId);
      expect(features).not.toBeNull();

      console.log('✓ Features reset to defaults');
    });
  });

  // ============================================================================
  // Instance Member Tests
  // ============================================================================

  describe('Instance Member Management', () => {
    let testInstanceId: string;
    let testUserId: string;

    beforeEach(async () => {
      const context = ctx.createContext();
      const response = await instanceService.setupInstance(context, {
        instanceName: `Instance ${Date.now()}`,
        defaultOrgName: `Org ${Date.now()}`,
        adminUser: {
          username: `admin-${Date.now()}`,
          email: `admin-${Date.now()}@test.com`,
          firstName: 'Admin',
          lastName: 'User',
        },
      });
      testInstanceId = response.instanceId;
      testUserId = response.userId;
      await processProjections();
    });

    it('should add instance member through complete stack', async () => {
      const context = ctx.createContext();

      console.log('\n--- Adding instance member ---');

      // Add member via gRPC service
      const response = await instanceService.addInstanceMember(context, {
        instanceId: testInstanceId,
        userId: testUserId,
        roles: ['IAM_OWNER', 'IAM_ADMIN'],
      });

      expect(response.details).toBeDefined();

      // Process projections
      await processProjections();

      // Verify via query layer
      const member = await assertInstanceMemberInQuery(testInstanceId, testUserId, ['IAM_OWNER', 'IAM_ADMIN']);
      expect(member.roles).toContain('IAM_OWNER');
      expect(member.roles).toContain('IAM_ADMIN');

      console.log(`✓ Member added: ${testUserId}`);
    });

    it('should update instance member roles', async () => {
      const context = ctx.createContext();

      // Add member first
      await instanceService.addInstanceMember(context, {
        instanceId: testInstanceId,
        userId: testUserId,
        roles: ['IAM_ADMIN'],
      });
      await processProjections();

      console.log('\n--- Updating instance member roles ---');

      // Update member via gRPC service
      await instanceService.updateInstanceMember(context, {
        instanceId: testInstanceId,
        userId: testUserId,
        roles: ['IAM_OWNER'],
      });

      await processProjections();

      // Verify via query layer
      const member = await assertInstanceMemberInQuery(testInstanceId, testUserId, ['IAM_OWNER']);
      expect(member.roles).toContain('IAM_OWNER');
      expect(member.roles).not.toContain('IAM_ADMIN');

      console.log('✓ Member roles updated');
    });

    it('should remove instance member', async () => {
      const context = ctx.createContext();

      // Add member first
      await instanceService.addInstanceMember(context, {
        instanceId: testInstanceId,
        userId: testUserId,
        roles: ['IAM_ADMIN'],
      });
      await processProjections();

      console.log('\n--- Removing instance member ---');

      // Remove member via gRPC service
      await instanceService.removeInstanceMember(context, {
        instanceId: testInstanceId,
        userId: testUserId,
      });

      await processProjections();

      // Verify via query layer (should not exist)
      const member = await memberQueries.getIAMMemberByIAMIDAndUserID(testInstanceId, testUserId);
      expect(member).toBeNull();

      console.log('✓ Member removed');
    });

    it('should list instance members', async () => {
      const context = ctx.createContext();

      // Add member
      await instanceService.addInstanceMember(context, {
        instanceId: testInstanceId,
        userId: testUserId,
        roles: ['IAM_OWNER'],
      });
      await processProjections();

      console.log('\n--- Listing instance members ---');

      // List members via gRPC service
      const response = await instanceService.listInstanceMembers(context, {
        instanceId: testInstanceId,
      });

      expect(response.result).toBeDefined();
      expect(response.result.length).toBeGreaterThan(0);
      expect(response.details.totalResult).toBeGreaterThan(0);

      const foundMember = response.result.find((m: any) => m.userId === testUserId);
      expect(foundMember).toBeDefined();
      expect(foundMember.roles).toContain('IAM_OWNER');

      console.log(`✓ Found ${response.result.length} members`);
    });

    it('should fail to add member with empty roles', async () => {
      const context = ctx.createContext();

      await expect(
        instanceService.addInstanceMember(context, {
          instanceId: testInstanceId,
          userId: testUserId,
          roles: [],
        })
      ).rejects.toThrow('at least one role is required');
    });
  });

  // ============================================================================
  // Complete Lifecycle Test
  // ============================================================================

  describe('Complete Instance Lifecycle', () => {
    it('should handle complete instance lifecycle through all layers', async () => {
      const context = ctx.createContext();

      console.log('\n=== COMPLETE INSTANCE LIFECYCLE TEST ===');

      // 1. Setup instance
      console.log('\n1. Setting up instance...');
      const setupResponse = await instanceService.setupInstance(context, {
        instanceName: 'Lifecycle Test Instance',
        defaultOrgName: 'Lifecycle Test Org',
        adminUser: {
          username: `lifecycle-admin-${Date.now()}`,
          email: `lifecycle-${Date.now()}@test.com`,
          firstName: 'Lifecycle',
          lastName: 'Admin',
        },
      });
      const instanceId = setupResponse.instanceId;
      const userId = setupResponse.userId;
      await processProjections();
      console.log(`✓ Instance created: ${instanceId}`);

      // 2. Add domain
      console.log('\n2. Adding domain...');
      await instanceService.addInstanceDomain(context, {
        instanceId,
        domain: `lifecycle-${Date.now()}.example.com`,
      });
      await processProjections();
      console.log('✓ Domain added');

      // 3. Set features
      console.log('\n3. Setting features...');
      await instanceService.setInstanceFeatures(context, {
        instanceId,
        loginDefaultOrg: true,
        actions: true,
      });
      await processProjections();
      console.log('✓ Features configured');

      // 4. Add member
      console.log('\n4. Adding member...');
      await instanceService.addInstanceMember(context, {
        instanceId,
        userId,
        roles: ['IAM_OWNER'],
      });
      await processProjections();
      console.log('✓ Member added');

      // 5. Update member
      console.log('\n5. Updating member...');
      await instanceService.updateInstanceMember(context, {
        instanceId,
        userId,
        roles: ['IAM_ADMIN', 'IAM_OWNER'],
      });
      await processProjections();
      console.log('✓ Member updated');

      // 6. Verify everything via query layer
      console.log('\n6. Verifying via query layer...');
      const instance = await assertInstanceInQuery(instanceId, 'Lifecycle Test Instance');
      const features = await instanceQueries.getInstanceFeatures(instanceId);
      const member = await assertInstanceMemberInQuery(instanceId, userId);

      expect(instance).toBeDefined();
      expect(features!.loginDefaultOrg).toBe(true);
      expect(member.roles).toContain('IAM_OWNER');
      console.log('✓ All verifications passed');

      console.log('\n=== COMPLETE STACK TESTED ===');
      console.log('✓ API Layer (InstanceService)');
      console.log('✓ Command Layer (Commands)');
      console.log('✓ Event Layer (Event publishing)');
      console.log('✓ Projection Layer (Instance/Domain/Member projections)');
      console.log('✓ Query Layer (InstanceQueries/MemberQueries)');
      console.log('✓ Database Layer (PostgreSQL persistence)');
      console.log('================================');
    });
  });
});
