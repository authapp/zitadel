/**
 * Admin Service - Comprehensive Integration Tests
 * 
 * Tests the complete CQRS stack for Admin gRPC API:
 * API Layer → Command Layer → Event Layer → Projection Layer → Query Layer → Database
 * 
 * Pattern: Based on Instance/Organization Service integration tests
 * Coverage: System & Health, Languages, Organizations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';
import { Context } from '../../../../src/lib/command/context';
import { AdminService } from '../../../../src/api/grpc/admin/v1/admin_service';
import { OrganizationService } from '../../../../src/api/grpc/org/v2/org_service';
import { InstanceProjection } from '../../../../src/lib/query/projections/instance-projection';
import { OrgProjection } from '../../../../src/lib/query/projections/org-projection';
import { UserProjection } from '../../../../src/lib/query/projections/user-projection';
import { InstanceQueries } from '../../../../src/lib/query/instance/instance-queries';
import { OrgQueries } from '../../../../src/lib/query/org/org-queries';

describe('Admin Service - Integration Tests (System & Health)', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let adminService: AdminService;
  let orgService: OrganizationService;
  let instanceProjection: InstanceProjection;
  let orgProjection: OrgProjection;
  let userProjection: UserProjection;
  let instanceQueries: InstanceQueries;
  let orgQueries: OrgQueries;

  beforeAll(async () => {
    // Create test database
    pool = await createTestDatabase();
    
    // Setup command test infrastructure
    ctx = await setupCommandTest(pool);
    
    // Initialize projections
    instanceProjection = new InstanceProjection(ctx.eventstore, pool);
    await instanceProjection.init();
    
    orgProjection = new OrgProjection(ctx.eventstore, pool);
    await orgProjection.init();
    
    userProjection = new UserProjection(ctx.eventstore, pool);
    await userProjection.init();
    
    // Initialize queries
    instanceQueries = new InstanceQueries(pool);
    orgQueries = new OrgQueries(pool);
    
    // Initialize services (gRPC layer)
    adminService = new AdminService(ctx.commands, pool);
    orgService = new OrganizationService(ctx.commands);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  /**
   * Helper: Process all projections and wait for updates
   * Uses 50ms intervals between projections and 200ms final wait
   */
  async function processProjections(): Promise<void> {
    const events = await ctx.getEvents('*', '*');
    console.log(`  → Processing ${events.length} events through projections`);
    
    for (const event of events) {
      console.log(`    • Event: ${event.eventType} (aggregate: ${event.aggregateType}, id: ${event.aggregateID})`);
      
      // Process through each projection with small delay and error handling
      try {
        await instanceProjection.reduce(event);
      } catch (err) {
        console.log(`    ✗ Instance projection error: ${err}`);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        await orgProjection.reduce(event);
        if (event.eventType === 'org.added') {
          console.log(`    ✓ Org projection processed org.added for ${event.aggregateID}`);
        }
      } catch (err) {
        console.log(`    ✗ Org projection error: ${err}`);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        await userProjection.reduce(event);
      } catch (err) {
        console.log(`    ✗ User projection error: ${err}`);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Final delay to ensure DB commit
    console.log(`  → Waiting 300ms for DB commit...`);
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  /**
   * Helper: Assert organization exists in query layer
   * With retry logic for projection timing
   */
  async function assertOrgInQuery(orgID: string, context?: Context): Promise<any> {
    const instanceID = context?.instanceID || ctx.createContext().instanceID;
    
    // Retry up to 3 times with delays
    for (let attempt = 1; attempt <= 3; attempt++) {
      // CORRECT: getOrgByID(orgID, instanceID) - orgID is FIRST parameter
      const org = await orgQueries.getOrgByID(orgID, instanceID!);
      
      if (org) {
        console.log(`  ✓ Org found in query layer (attempt ${attempt})`);
        return org;
      }
      
      if (attempt < 3) {
        console.log(`  → Org not found, waiting 200ms and retrying (attempt ${attempt}/3)...`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Final attempt failed - provide debug info
    const allOrgs = await orgQueries.searchOrgs({ instanceID: instanceID!, limit: 100 });
    console.log(`  ✗ Org ${orgID} not found after 3 attempts`);
    console.log(`  → Found ${allOrgs.total} total orgs: ${allOrgs.orgs.map(o => o.id).slice(0, 5).join(', ')}`);
    
    expect(null).not.toBeNull(); // Will fail with proper message
    return null;
  }

  // ============================================================================
  // System & Health Tests
  // ============================================================================

  describe('Healthz', () => {
    it('should return healthy status', async () => {
      const context = ctx.createContext();

      console.log('\n--- Health check ---');

      const response = await adminService.healthz(context, {});

      expect(response).toBeDefined();
      expect(response).toEqual({});

      console.log('✓ System is healthy');
    });
  });

  // ============================================================================
  // Language Tests
  // ============================================================================

  describe('Language Support', () => {
    it('should return list of supported languages', async () => {
      const context = ctx.createContext();

      console.log('\n--- Getting supported languages ---');

      const response = await adminService.getSupportedLanguages(context, {});

      expect(response).toBeDefined();
      expect(response.languages).toBeDefined();
      expect(Array.isArray(response.languages)).toBe(true);
      expect(response.languages.length).toBeGreaterThan(0);
      
      // Check for common languages
      expect(response.languages).toContain('en');
      expect(response.languages).toContain('de');
      expect(response.languages).toContain('es');
      expect(response.languages).toContain('fr');

      console.log(`✓ Found ${response.languages.length} supported languages`);
    });

    it('should return list of allowed languages', async () => {
      const context = ctx.createContext();

      console.log('\n--- Getting allowed languages ---');

      const response = await adminService.getAllowedLanguages(context, {});

      expect(response).toBeDefined();
      expect(response.languages).toBeDefined();
      expect(Array.isArray(response.languages)).toBe(true);
      expect(response.languages.length).toBeGreaterThan(0);

      console.log(`✓ Found ${response.languages.length} allowed languages`);
    });

    it('should get default language from instance', async () => {
      const context = ctx.createContext();

      // Create a test instance first
      const setupResponse = await ctx.commands.setupInstance(context, {
        instanceName: 'Language Test Instance',
        defaultOrgName: 'Language Test Org',
        adminUser: {
          username: `langtest-${Date.now()}`,
          email: `langtest-${Date.now()}@test.com`,
          firstName: 'Lang',
          lastName: 'Test',
        },
        defaultLanguage: 'fr',
      });

      await processProjections();

      console.log('\n--- Getting default language ---');

      // Get default language
      const response = await adminService.getDefaultLanguage(context, {});

      expect(response).toBeDefined();
      expect(response.language).toBeDefined();
      expect(typeof response.language).toBe('string');
      expect(response.language).toBe('fr');

      console.log(`✓ Default language: ${response.language}`);
    });

    it('should validate language when setting default', async () => {
      const context = ctx.createContext();

      console.log('\n--- Testing language validation ---');

      // Test with invalid language
      await expect(
        adminService.setDefaultLanguage(context, {
          language: 'invalid-lang',
        })
      ).rejects.toThrow('is not supported');

      console.log('✓ Invalid language rejected');
    });

    it('should require language parameter', async () => {
      const context = ctx.createContext();

      await expect(
        adminService.setDefaultLanguage(context, {
          language: '',
        })
      ).rejects.toThrow('language is required');
    });
  });

  // ============================================================================
  // Organization Tests
  // ============================================================================

  describe('Organization Management', () => {
    it('should list all organizations', async () => {
      const context = ctx.createContext();

      // Create multiple organizations
      const org1 = await orgService.addOrganization(context, {
        name: `Admin List Org 1 ${Date.now()}`,
        admins: [{
          userType: {
            human: {
              username: `admin1-${Date.now()}`,
              email: {
                email: `admin1-${Date.now()}@test.com`,
              },
              profile: {
                givenName: 'Admin',
                familyName: 'One',
              },
              password: {
                password: 'AdminPassword123!',
              },
            },
          },
          roles: ['ORG_OWNER'],
        }],
      });

      const org2 = await orgService.addOrganization(context, {
        name: `Admin List Org 2 ${Date.now()}`,
        admins: [{
          userType: {
            human: {
              username: `admin2-${Date.now()}`,
              email: {
                email: `admin2-${Date.now()}@test.com`,
              },
              profile: {
                givenName: 'Admin',
                familyName: 'Two',
              },
              password: {
                password: 'AdminPassword123!',
              },
            },
          },
          roles: ['ORG_OWNER'],
        }],
      });

      await processProjections();

      console.log('\n--- Listing organizations ---');

      // List organizations
      const response = await adminService.listOrgs(context, {});

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(Array.isArray(response.result)).toBe(true);
      expect(response.result.length).toBeGreaterThanOrEqual(2);
      expect(response.details.totalResult).toBeGreaterThanOrEqual(2);

      // Verify our orgs are in the list
      const foundOrg1 = response.result.find(o => o.id === org1.organizationId);
      const foundOrg2 = response.result.find(o => o.id === org2.organizationId);

      expect(foundOrg1).toBeDefined();
      expect(foundOrg2).toBeDefined();

      console.log(`✓ Found ${response.result.length} organizations`);
    });

    it('should get organization by ID', async () => {
      const context = ctx.createContext();

      // Create organization
      const orgResult = await orgService.addOrganization(context, {
        name: `Admin Get Org ${Date.now()}`,
        admins: [{
          userType: {
            human: {
              username: `admin-${Date.now()}`,
              email: {
                email: `admin-${Date.now()}@test.com`,
              },
              profile: {
                givenName: 'Admin',
                familyName: 'User',
              },
              password: {
                password: 'AdminPassword123!',
              },
            },
          },
          roles: ['ORG_OWNER'],
        }],
      });

      await processProjections();

      // Verify org is in query layer
      await assertOrgInQuery(orgResult.organizationId!, context);

      console.log('\n--- Getting organization by ID ---');

      // Get organization
      const response = await adminService.getOrgByID(context, {
        id: orgResult.organizationId!,
      });

      expect(response).toBeDefined();
      expect(response.org).toBeDefined();
      expect(response.org.id).toBe(orgResult.organizationId);
      expect(response.org.name).toContain('Admin Get Org');

      console.log(`✓ Organization retrieved: ${response.org.id}`);
    });

    it('should check organization name uniqueness', async () => {
      const context = ctx.createContext();

      // Create organization
      const orgName = `Unique Test Org ${Date.now()}`;
      await orgService.addOrganization(context, {
        name: orgName,
        admins: [{
          userType: {
            human: {
              username: `admin-${Date.now()}`,
              email: {
                email: `admin-${Date.now()}@test.com`,
              },
              profile: {
                givenName: 'Admin',
                familyName: 'User',
              },
              password: {
                password: 'AdminPassword123!',
              },
            },
          },
          roles: ['ORG_OWNER'],
        }],
      });

      await processProjections();

      console.log('\n--- Checking organization uniqueness ---');

      // Check if name is unique (should NOT be unique)
      const response1 = await adminService.isOrgUnique(context, {
        name: orgName,
      });

      expect(response1).toBeDefined();
      expect(response1.isUnique).toBe(false);

      // Check with a unique name (should be unique)
      const response2 = await adminService.isOrgUnique(context, {
        name: `Non-existent Org ${Date.now()}`,
      });

      expect(response2.isUnique).toBe(true);

      console.log('✓ Uniqueness check working correctly');
    });

    it('should fail to get non-existent organization', async () => {
      const context = ctx.createContext();

      await expect(
        adminService.getOrgByID(context, {
          id: 'non-existent-org-id',
        })
      ).rejects.toThrow('organization not found');
    });

    it('should require organization ID', async () => {
      const context = ctx.createContext();

      await expect(
        adminService.getOrgByID(context, {
          id: '',
        })
      ).rejects.toThrow('organization ID is required');
    });

    it('should require organization name for uniqueness check', async () => {
      const context = ctx.createContext();

      await expect(
        adminService.isOrgUnique(context, {
          name: '',
        })
      ).rejects.toThrow('organization name is required');
    });
  });

  // ============================================================================
  // Complete Stack Test
  // ============================================================================

  describe('Complete Admin Stack', () => {
    it('should verify complete stack is functional', async () => {
      const context = ctx.createContext();

      console.log('\n=== COMPLETE ADMIN SERVICE STACK TEST ===');

      // 1. Health check
      console.log('\n1. Health check...');
      const healthResponse = await adminService.healthz(context, {});
      expect(healthResponse).toBeDefined();
      console.log('✓ Health check passed');

      // 2. Get supported languages
      console.log('\n2. Getting supported languages...');
      const langResponse = await adminService.getSupportedLanguages(context, {});
      expect(langResponse.languages.length).toBeGreaterThan(0);
      console.log(`✓ Found ${langResponse.languages.length} languages`);

      // 3. Create organization
      console.log('\n3. Creating organization...');
      const orgResult = await orgService.addOrganization(context, {
        name: `Stack Test Org ${Date.now()}`,
        admins: [{
          userType: {
            human: {
              username: `stacktest-${Date.now()}`,
              email: {
                email: `stacktest-${Date.now()}@test.com`,
              },
              profile: {
                givenName: 'Stack',
                familyName: 'Test',
              },
              password: {
                password: 'StackTest123!',
              },
            },
          },
          roles: ['ORG_OWNER'],
        }],
      });
      await processProjections();
      
      // Verify org is in query layer
      await assertOrgInQuery(orgResult.organizationId!, context);
      console.log(`✓ Organization created: ${orgResult.organizationId}`);

      // 4. List organizations
      console.log('\n4. Listing organizations...');
      const listResponse = await adminService.listOrgs(context, {});
      expect(listResponse.result.length).toBeGreaterThan(0);
      console.log(`✓ Found ${listResponse.result.length} organizations`);

      // 5. Get specific organization
      console.log('\n5. Getting organization...');
      const getResponse = await adminService.getOrgByID(context, {
        id: orgResult.organizationId!,
      });
      expect(getResponse.org.id).toBe(orgResult.organizationId);
      console.log(`✓ Organization retrieved: ${getResponse.org.name}`);

      console.log('\n=== COMPLETE STACK TESTED ===');
      console.log('✓ API Layer (AdminService)');
      console.log('✓ Command Layer (Commands)');
      console.log('✓ Event Layer (Event publishing)');
      console.log('✓ Projection Layer (Instance/Org projections)');
      console.log('✓ Query Layer (InstanceQueries/OrgQueries)');
      console.log('✓ Database Layer (PostgreSQL persistence)');
      console.log('================================');
    });
  });
});
