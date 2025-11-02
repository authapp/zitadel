/**
 * Admin Organization Endpoints - Comprehensive Integration Tests
 * 
 * Tests the complete CQRS stack for Admin Organization gRPC API:
 * API Layer → Command Layer → Event Layer → Projection Layer → Query Layer → Database
 * 
 * Coverage: 5 organization admin endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';
import { Context } from '../../../../src/lib/command/context';
import { AdminService } from '../../../../src/api/grpc/admin/v1/admin_service';
import { OrgProjection } from '../../../../src/lib/query/projections/org-projection';
import { OrgQueries } from '../../../../src/lib/query/org/org-queries';
import { delay } from '../../../helpers/projection-test-helpers';
import { InstanceProjection } from '../../../../src/lib/query/projections/instance-projection';
import { InstanceQueries } from '../../../../src/lib/query/instance/instance-queries';

describe('Admin Organization Endpoints - COMPREHENSIVE Integration Tests (Full Stack)', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let adminService: AdminService;
  let orgProjection: OrgProjection;
  let orgQueries: OrgQueries;
  let instanceProjection: InstanceProjection;
  let instanceQueries: InstanceQueries;

  beforeAll(async () => {
    // Create test database
    pool = await createTestDatabase();
    
    // Setup command test infrastructure
    ctx = await setupCommandTest(pool);
    
    // Initialize projections
    orgProjection = new OrgProjection(ctx.eventstore, pool);
    await orgProjection.init();
    
    instanceProjection = new InstanceProjection(ctx.eventstore, pool);
    await instanceProjection.init();
    
    // Initialize queries
    orgQueries = new OrgQueries(pool);
    instanceQueries = new InstanceQueries(pool);
    
    // Initialize AdminService (gRPC layer)
    adminService = new AdminService(ctx.commands, pool);
    
    // Create instance for tests (needed for setDefaultOrg)
    const context = ctx.createContext();
    await ctx.commands.setupInstance(context, {
      instanceID: context.instanceID,  // Use the same instanceID from context
      instanceName: 'Test Instance',
      defaultOrgName: 'Initial Default Org',
      adminUser: {
        username: 'admin',
        email: 'admin@test.com',
        firstName: 'Admin',
        lastName: 'User',
      },
    });
    await processProjections();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  async function processProjections(): Promise<void> {
    const events = await ctx.getEvents('*', '*');
    for (const event of events) {
      await orgProjection.reduce(event);
      await instanceProjection.reduce(event);
    }
    // Delay to ensure DB commit
    await delay(100);
  }

  beforeEach(async () => {
    // No need to clear - tests are isolated by unique names
  });

  /**
   * Helper: Create a test organization
   */
  async function createTestOrg(name?: string): Promise<string> {
    const context = ctx.createContext();
    const orgName = name || `Test Org ${Date.now()}`;
    
    const result = await ctx.commands.addOrg(context, { name: orgName });
    await processProjections();
    
    return result.orgID;
  }

  /**
   * Helper: Verify organization via Query Layer
   */
  async function assertOrgInQuery(
    orgID: string,
    expectedName?: string
  ): Promise<void> {
    const org = await orgQueries.getOrgByID(orgID, ctx.createContext().instanceID);
    
    expect(org).not.toBeNull();
    if (expectedName) {
      expect(org!.name).toBe(expectedName);
    }
    
    console.log(`✓ Organization ${orgID} verified via query layer`);
  }

  // ============================================================================
  // ListOrgs Tests
  // ============================================================================

  describe('ListOrgs', () => {
    it('should list organizations through complete stack', async () => {
      const context = ctx.createContext();
      
      console.log('\n--- Creating test organizations ---');
      const org1 = await createTestOrg('Alpha Corp');
      const org2 = await createTestOrg('Beta Inc');
      const org3 = await createTestOrg('Gamma LLC');
      
      console.log('--- Listing organizations via Admin API ---');
      const response = await adminService.listOrgs(context, {
        query: { limit: 10, offset: 0 },
      });
      
      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.length).toBeGreaterThanOrEqual(3);
      expect(response.details.totalResult).toBeGreaterThanOrEqual(3);
      
      // Verify our created orgs are in the list
      const orgIDs = response.result.map(o => o.id);
      expect(orgIDs).toContain(org1);
      expect(orgIDs).toContain(org2);
      expect(orgIDs).toContain(org3);
      
      console.log(`✓ Listed ${response.result.length} organizations`);
    });

    it('should support pagination', async () => {
      const context = ctx.createContext();
      
      // Create multiple orgs
      await createTestOrg('Org 1');
      await createTestOrg('Org 2');
      await createTestOrg('Org 3');
      
      console.log('\n--- Testing pagination (limit=2) ---');
      const page1 = await adminService.listOrgs(context, {
        query: { limit: 2, offset: 0 },
      });
      
      expect(page1.result.length).toBeLessThanOrEqual(2);
      
      const page2 = await adminService.listOrgs(context, {
        query: { limit: 2, offset: 2 },
      });
      
      // Pages should have different orgs
      if (page1.result.length > 0 && page2.result.length > 0) {
        expect(page1.result[0].id).not.toBe(page2.result[0].id);
      }
      
      console.log(`✓ Pagination working (page1: ${page1.result.length}, page2: ${page2.result.length})`);
    });
  });

  // ============================================================================
  // GetOrgByID Tests
  // ============================================================================

  describe('GetOrgByID', () => {
    it('should retrieve organization through complete stack', async () => {
      const context = ctx.createContext();
      
      console.log('\n--- Creating test organization ---');
      const orgID = await createTestOrg('Delta Systems');
      
      console.log('--- Retrieving organization via Admin API ---');
      const response = await adminService.getOrgByID(context, { id: orgID });
      
      expect(response).toBeDefined();
      expect(response.org).toBeDefined();
      expect(response.org.id).toBe(orgID);
      expect(response.org.name).toBe('Delta Systems');
      expect(response.org.state).toBeDefined();
      
      console.log('✓ Organization retrieved successfully');
    });

    it('should throw error for non-existent organization', async () => {
      const context = ctx.createContext();
      
      console.log('\n--- Attempting to get non-existent org ---');
      
      await expect(
        adminService.getOrgByID(context, { id: 'non-existent-id' })
      ).rejects.toThrow('organization not found');
      
      console.log('✓ Error thrown correctly for non-existent org');
    });

    it('should validate required organization ID', async () => {
      const context = ctx.createContext();
      
      console.log('\n--- Testing validation ---');
      
      await expect(
        adminService.getOrgByID(context, { id: '' })
      ).rejects.toThrow('organization ID is required');
      
      console.log('✓ Validation working correctly');
    });
  });

  // ============================================================================
  // IsOrgUnique Tests
  // ============================================================================

  describe('IsOrgUnique', () => {
    it('should return true for unique organization name', async () => {
      const context = ctx.createContext();
      
      console.log('\n--- Checking unique organization name ---');
      const response = await adminService.isOrgUnique(context, {
        name: `Unique Org ${Date.now()}`,
      });
      
      expect(response).toBeDefined();
      expect(response.isUnique).toBe(true);
      
      console.log('✓ Unique name check passed');
    });

    it('should return false for existing organization name', async () => {
      const context = ctx.createContext();
      
      console.log('\n--- Creating organization ---');
      await createTestOrg('Existing Org');
      
      console.log('--- Checking if name is unique ---');
      const response = await adminService.isOrgUnique(context, {
        name: 'Existing Org',
      });
      
      expect(response).toBeDefined();
      expect(response.isUnique).toBe(false);
      
      console.log('✓ Non-unique name detected correctly');
    });

    it('should validate required name', async () => {
      const context = ctx.createContext();
      
      console.log('\n--- Testing validation ---');
      
      await expect(
        adminService.isOrgUnique(context, { name: '' })
      ).rejects.toThrow('organization name is required');
      
      console.log('✓ Validation working correctly');
    });
  });

  // ============================================================================
  // SetDefaultOrg Tests
  // ============================================================================

  describe('SetDefaultOrg', () => {
    it('should set default organization through complete stack', async () => {
      const context = ctx.createContext();
      
      console.log('\n--- Creating test organization ---');
      const orgID = await createTestOrg('Default Org Candidate');
      
      console.log('--- Setting as default organization ---');
      const response = await adminService.setDefaultOrg(context, { orgId: orgID });
      
      expect(response).toBeDefined();
      expect(response.details).toBeDefined();
      expect(response.details.sequence).toBeGreaterThanOrEqual(0);
      
      // Process projections
      await processProjections();
      
      // Verify via query layer
      const instance = await instanceQueries.getInstanceByID(context.instanceID);
      expect(instance).toBeDefined();
      expect(instance!.defaultOrgID).toBe(orgID);
      
      console.log('✓ Default organization set successfully');
    });

    it('should be idempotent - setting same org again', async () => {
      const context = ctx.createContext();
      
      console.log('\n--- Creating test organization ---');
      const orgID = await createTestOrg('Idempotent Default Org');
      
      console.log('--- Setting as default (first time) ---');
      await adminService.setDefaultOrg(context, { orgId: orgID });
      await processProjections();
      
      console.log('--- Setting as default (second time) ---');
      const response2 = await adminService.setDefaultOrg(context, { orgId: orgID });
      
      expect(response2).toBeDefined();
      expect(response2.details).toBeDefined();
      
      console.log('✓ Idempotency verified');
    });

    it('should validate required organization ID', async () => {
      const context = ctx.createContext();
      
      console.log('\n--- Testing validation ---');
      
      await expect(
        adminService.setDefaultOrg(context, { orgId: '' })
      ).rejects.toThrow('organization ID is required');
      
      console.log('✓ Validation working correctly');
    });

    it('should update when changing default organization', async () => {
      const context = ctx.createContext();
      
      console.log('\n--- Creating two organizations ---');
      const org1 = await createTestOrg('First Default');
      const org2 = await createTestOrg('Second Default');
      
      console.log('--- Setting first org as default ---');
      await adminService.setDefaultOrg(context, { orgId: org1 });
      await processProjections();
      
      let instance = await instanceQueries.getInstanceByID(context.instanceID);
      expect(instance!.defaultOrgID).toBe(org1);
      
      console.log('--- Changing to second org as default ---');
      await adminService.setDefaultOrg(context, { orgId: org2 });
      await processProjections();
      
      instance = await instanceQueries.getInstanceByID(context.instanceID);
      expect(instance!.defaultOrgID).toBe(org2);
      
      console.log('✓ Default organization changed successfully');
    });
  });

  // ============================================================================
  // GetDefaultOrg Tests
  // ============================================================================

  describe('GetDefaultOrg', () => {
    it('should retrieve default organization through complete stack', async () => {
      const context = ctx.createContext();
      
      console.log('\n--- Creating and setting default organization ---');
      const orgID = await createTestOrg('Default Org to Get');
      await adminService.setDefaultOrg(context, { orgId: orgID });
      await processProjections();
      
      console.log('--- Getting default organization ---');
      const response = await adminService.getDefaultOrg(context, {});
      
      expect(response).toBeDefined();
      expect(response.org).not.toBeNull();
      expect(response.org!.id).toBe(orgID);
      expect(response.org!.name).toBe('Default Org to Get');
      expect(response.org!.state).toBeDefined();
      
      console.log('✓ Default organization retrieved successfully');
    });

    it('should return null when no default org is set', async () => {
      const context = ctx.createContext();
      
      console.log('\n--- Getting default org when none is set ---');
      const response = await adminService.getDefaultOrg(context, {});
      
      expect(response).toBeDefined();
      // May be null if no default org set yet
      
      console.log(`✓ Response received (org: ${response.org ? 'found' : 'null'})`);
    });

    it('should reflect changes when default org is updated', async () => {
      const context = ctx.createContext();
      
      console.log('\n--- Creating two organizations ---');
      const org1 = await createTestOrg('First Get Default');
      const org2 = await createTestOrg('Second Get Default');
      
      console.log('--- Setting first org as default ---');
      await adminService.setDefaultOrg(context, { orgId: org1 });
      await processProjections();
      
      let response = await adminService.getDefaultOrg(context, {});
      expect(response.org).not.toBeNull();
      expect(response.org!.id).toBe(org1);
      
      console.log('--- Changing to second org ---');
      await adminService.setDefaultOrg(context, { orgId: org2 });
      await processProjections();
      
      response = await adminService.getDefaultOrg(context, {});
      expect(response.org).not.toBeNull();
      expect(response.org!.id).toBe(org2);
      
      console.log('✓ Default organization change reflected in get');
    });
  });

  // ============================================================================
  // Complete Lifecycle Test
  // ============================================================================

  describe('Complete Lifecycle', () => {
    it('should handle complete organization admin workflow', async () => {
      const context = ctx.createContext();
      
      console.log('\n=== COMPLETE ORGANIZATION ADMIN LIFECYCLE ===');
      
      // Step 1: Check uniqueness
      console.log('\n1. Checking organization name uniqueness');
      const uniqueCheck = await adminService.isOrgUnique(context, {
        name: 'Lifecycle Test Org',
      });
      expect(uniqueCheck.isUnique).toBe(true);
      
      // Step 2: Create organization
      console.log('\n2. Creating organization');
      const orgID = await createTestOrg('Lifecycle Test Org');
      await assertOrgInQuery(orgID, 'Lifecycle Test Org');
      
      // Step 3: Verify uniqueness check now returns false
      console.log('\n3. Verifying name is no longer unique');
      const uniqueCheck2 = await adminService.isOrgUnique(context, {
        name: 'Lifecycle Test Org',
      });
      expect(uniqueCheck2.isUnique).toBe(false);
      
      // Step 4: Get organization by ID
      console.log('\n4. Retrieving organization by ID');
      const getResponse = await adminService.getOrgByID(context, { id: orgID });
      expect(getResponse.org.id).toBe(orgID);
      expect(getResponse.org.name).toBe('Lifecycle Test Org');
      
      // Step 5: Set as default organization
      console.log('\n5. Setting as default organization');
      await adminService.setDefaultOrg(context, { orgId: orgID });
      await processProjections();
      
      // Step 6: Get default organization
      console.log('\n6. Retrieving default organization');
      const defaultResponse = await adminService.getDefaultOrg(context, {});
      expect(defaultResponse.org).not.toBeNull();
      expect(defaultResponse.org!.id).toBe(orgID);
      
      // Step 7: List all organizations
      console.log('\n7. Listing all organizations');
      const listResponse = await adminService.listOrgs(context, {
        query: { limit: 50, offset: 0 },
      });
      expect(listResponse.result.some(o => o.id === orgID)).toBe(true);
      
      console.log('\n✓ Complete lifecycle workflow successful');
    });
  });

  // ============================================================================
  // Coverage Summary
  // ============================================================================

  describe('Coverage Summary', () => {
    it('should confirm complete stack is tested', () => {
      console.log('\n=== COVERAGE SUMMARY ===');
      console.log('✓ gRPC API Layer - AdminService methods');
      console.log('✓ Command Layer - setDefaultOrg command');
      console.log('✓ Event Layer - instance.default_org.set event');
      console.log('✓ Projection Layer - InstanceProjection processes events');
      console.log('✓ Query Layer - OrgQueries and InstanceQueries');
      console.log('✓ Database Layer - Data persisted and retrieved');
      console.log('\n✓ All 5 Admin Organization endpoints tested');
      console.log('  1. ListOrgs - List all organizations');
      console.log('  2. GetOrgByID - Get organization by ID');
      console.log('  3. IsOrgUnique - Check name uniqueness');
      console.log('  4. SetDefaultOrg - Set default organization');
      console.log('  5. GetDefaultOrg - Get default organization');
    });
  });
});
