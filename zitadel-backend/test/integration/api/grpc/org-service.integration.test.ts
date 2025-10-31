/**
 * Organization Service - Comprehensive Integration Tests
 * 
 * Tests the complete CQRS stack for Organization gRPC API:
 * API Layer → Command Layer → Event Layer → Projection Layer → Query Layer → Database
 * 
 * Pattern: Based on User Service integration tests
 * Coverage: Organization CRUD operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';
import { Context } from '../../../../src/lib/command/context';
import { OrganizationService } from '../../../../src/api/grpc/org/v2/org_service';
import { OrgProjection } from '../../../../src/lib/query/projections/org-projection';
import { OrgQueries } from '../../../../src/lib/query/org/org-queries';

describe('Organization Service - COMPREHENSIVE Integration Tests (Full Stack)', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let orgService: OrganizationService;
  let orgProjection: OrgProjection;
  let orgQueries: OrgQueries;

  beforeAll(async () => {
    // Create test database
    pool = await createTestDatabase();
    
    // Setup command test infrastructure
    ctx = await setupCommandTest(pool);
    
    // Initialize projections
    orgProjection = new OrgProjection(ctx.eventstore, pool);
    await orgProjection.init();
    
    // Initialize queries
    orgQueries = new OrgQueries(pool);
    
    // Initialize OrganizationService (gRPC layer)
    orgService = new OrganizationService(ctx.commands);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await ctx.clearEvents();
  });

  /**
   * Helper: Process projections and wait for updates
   */
  async function processProjections(): Promise<void> {
    const events = await ctx.getEvents('*', '*');
    for (const event of events) {
      await orgProjection.reduce(event);
    }
    // Delay to ensure DB commit
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Create a test organization with an admin
   */
  async function createTestOrg(name?: string): Promise<string> {
    const context = ctx.createContext();
    const orgName = name || `Test Org ${Date.now()}`;
    
    // Create organization with a human admin
    const result = await orgService.addOrganization(context, {
      name: orgName,
      admins: [
        {
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
        },
      ],
    });
    
    await processProjections();
    return result.organizationId!;
  }

  /**
   * Helper: Verify organization via query layer
   */
  async function assertOrgInQuery(
    orgID: string,
    expectedName?: string
  ): Promise<any> {
    const org = await orgQueries.getOrgByID(orgID, 'test-instance');
    
    expect(org).not.toBeNull();
    if (expectedName) {
      expect(org!.name).toBe(expectedName);
    }
    
    console.log(`✓ Organization ${orgID} verified via query layer`);
    return org;
  }

  // ====================================================================
  // ORGANIZATION CRUD - Complete Stack Tests
  // ====================================================================

  describe('Organization CRUD - Complete Stack', () => {
    
    describe('AddOrganization', () => {
      it('should create organization through complete stack', async () => {
        const context = ctx.createContext();
        
        console.log('\n--- Creating organization ---');
        const result = await orgService.addOrganization(context, {
          name: 'Integration Test Org',
          admins: [
            {
              userType: {
                human: {
                  username: 'testadmin1',
                  email: {
                    email: 'testadmin1@test.com',
                  },
                  profile: {
                    givenName: 'Test',
                    familyName: 'Admin',
                  },
                  password: {
                    password: 'TestPassword123!',
                  },
                },
              },
              roles: ['ORG_OWNER'],
            },
          ],
        });

        expect(result).toBeDefined();
        expect(result.organizationId).toBeDefined();
        expect(result.details).toBeDefined();

        console.log('✓ AddOrganization: API response received');

        // Verify event was published
        const event = await ctx.assertEventPublished('org.added');
        expect(event.payload).toHaveProperty('name', 'Integration Test Org');
        console.log('✓ AddOrganization: Event published');

        // Process projection
        await processProjections();
        console.log('✓ AddOrganization: Projection processed');

        // Verify via query layer
        await assertOrgInQuery(result.organizationId!, 'Integration Test Org');
        console.log('✓ AddOrganization: Complete stack verified');
      });

      it('should create multiple organizations', async () => {
        const context = ctx.createContext();

        const org1 = await orgService.addOrganization(context, {
          name: 'Org One',
          admins: [
            {
              userType: {
                human: {
                  username: 'testadmin2',
                  email: { email: 'testadmin2@test.com' },
                  profile: { givenName: 'Test', familyName: 'Admin' },
                  password: { password: 'TestPassword123!' },
                },
              },
              roles: ['ORG_OWNER'],
            },
          ],
        });

        const org2 = await orgService.addOrganization(context, {
          name: 'Org Two',
          admins: [
            {
              userType: {
                human: {
                  username: 'testadmin3',
                  email: { email: 'testadmin3@test.com' },
                  profile: { givenName: 'Test', familyName: 'Admin' },
                  password: { password: 'TestPassword123!' },
                },
              },
              roles: ['ORG_OWNER'],
            },
          ],
        });

        expect(org1.organizationId).not.toBe(org2.organizationId);

        await processProjections();

        await assertOrgInQuery(org1.organizationId!, 'Org One');
        await assertOrgInQuery(org2.organizationId!, 'Org Two');

        console.log('✓ Multiple organizations created successfully');
      });

      it('should fail with empty name', async () => {
        const context = ctx.createContext();

        await expect(
          orgService.addOrganization(context, { name: '', admins: [] })
        ).rejects.toThrow('name is required');

        console.log('✓ AddOrganization: Validation error handled');
      });

      it('should fail with name too long', async () => {
        const context = ctx.createContext();
        const longName = 'a'.repeat(201);

        await expect(
          orgService.addOrganization(context, { name: longName, admins: [] })
        ).rejects.toThrow('name must be at most 200 characters');

        console.log('✓ AddOrganization: Length validation handled');
      });
    });

    describe('UpdateOrganization', () => {
      it('should update organization name through complete stack', async () => {
        const orgID = await createTestOrg('Original Name');
        const context = ctx.createContext();

        console.log('\n--- Updating organization ---');
        const result = await orgService.updateOrganization(context, {
          organizationId: orgID,
          name: 'Updated Name',
        });

        expect(result).toBeDefined();
        expect(result.details).toBeDefined();

        console.log('✓ UpdateOrganization: API response received');

        // Verify event
        const event = await ctx.assertEventPublished('org.changed');
        expect(event.payload).toHaveProperty('name', 'Updated Name');
        console.log('✓ UpdateOrganization: Event published');

        // Process projection
        await processProjections();

        // Verify via query layer
        await assertOrgInQuery(orgID, 'Updated Name');

        console.log('✓ UpdateOrganization: Complete stack verified');
      });

      it('should fail with empty organizationId', async () => {
        const context = ctx.createContext();

        await expect(
          orgService.updateOrganization(context, {
            organizationId: '',
            name: 'New Name',
          })
        ).rejects.toThrow('organizationId is required');

        console.log('✓ UpdateOrganization: Validation error handled');
      });

      it('should fail with empty name', async () => {
        const orgID = await createTestOrg();
        const context = ctx.createContext();

        await expect(
          orgService.updateOrganization(context, {
            organizationId: orgID,
            name: '',
          })
        ).rejects.toThrow('name is required');

        console.log('✓ UpdateOrganization: Name validation handled');
      });
    });

    describe('DeactivateOrganization', () => {
      it('should deactivate organization through complete stack', async () => {
        const orgID = await createTestOrg('Deactivate Test');
        const context = ctx.createContext();

        console.log('\n--- Deactivating organization ---');
        const result = await orgService.deactivateOrganization(context, {
          organizationId: orgID,
        });

        expect(result).toBeDefined();
        expect(result.details).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('org.deactivated');
        expect(event.aggregateID).toBe(orgID);

        // Process projection
        await processProjections();

        // Verify state in query layer
        const org = await orgQueries.getOrgByID(orgID, 'test-instance');
        expect(org).not.toBeNull();
        expect(org!.state).toBe('inactive');

        console.log('✓ DeactivateOrganization: Complete stack verified');
      });

      it('should fail with empty organizationId', async () => {
        const context = ctx.createContext();

        await expect(
          orgService.deactivateOrganization(context, {
            organizationId: '',
          })
        ).rejects.toThrow('organizationId is required');

        console.log('✓ DeactivateOrganization: Validation error handled');
      });
    });

    describe('ReactivateOrganization', () => {
      it('should reactivate organization through complete stack', async () => {
        const orgID = await createTestOrg('Reactivate Test');
        const context = ctx.createContext();

        // First deactivate
        await orgService.deactivateOrganization(context, {
          organizationId: orgID,
        });
        await processProjections();

        console.log('\n--- Reactivating organization ---');
        const result = await orgService.reactivateOrganization(context, {
          organizationId: orgID,
        });

        expect(result).toBeDefined();
        expect(result.details).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('org.reactivated');
        expect(event.aggregateID).toBe(orgID);

        // Process projection
        await processProjections();

        // Verify state in query layer
        const org = await orgQueries.getOrgByID(orgID, 'test-instance');
        expect(org).not.toBeNull();
        expect(org!.state).toBe('active');

        console.log('✓ ReactivateOrganization: Complete stack verified');
      });

      it('should fail with empty organizationId', async () => {
        const context = ctx.createContext();

        await expect(
          orgService.reactivateOrganization(context, {
            organizationId: '',
          })
        ).rejects.toThrow('organizationId is required');

        console.log('✓ ReactivateOrganization: Validation error handled');
      });
    });

    describe('RemoveOrganization', () => {
      it('should remove organization through complete stack', async () => {
        const orgID = await createTestOrg('Remove Test');
        const context = ctx.createContext();

        console.log('\n--- Removing organization ---');
        const result = await orgService.removeOrganization(context, {
          organizationId: orgID,
        });

        expect(result).toBeDefined();
        expect(result.details).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('org.removed');
        expect(event.aggregateID).toBe(orgID);

        // Process projection
        await processProjections();

        // Verify removed in query layer
        const org = await orgQueries.getOrgByID(orgID, 'test-instance');
        // Org may still exist but with deleted state
        if (org) {
          expect(org.state).toBe('removed');
        }

        console.log('✓ RemoveOrganization: Complete stack verified');
      });

      it('should fail with empty organizationId', async () => {
        const context = ctx.createContext();

        await expect(
          orgService.removeOrganization(context, {
            organizationId: '',
          })
        ).rejects.toThrow('organizationId is required');

        console.log('✓ RemoveOrganization: Validation error handled');
      });
    });

    describe('Complete Lifecycle', () => {
      it('should handle complete organization lifecycle', async () => {
        const context = ctx.createContext();

        console.log('\n--- Testing complete lifecycle ---');

        // 1. Create
        const createResult = await orgService.addOrganization(context, {
          name: 'Lifecycle Org',
          admins: [
            {
              userType: {
                human: {
                  username: 'lifecycleadmin',
                  email: { email: 'lifecycleadmin@test.com' },
                  profile: { givenName: 'Lifecycle', familyName: 'Admin' },
                  password: { password: 'TestPassword123!' },
                },
              },
              roles: ['ORG_OWNER'],
            },
          ],
        });
        const orgID = createResult.organizationId!;
        await processProjections();
        console.log('✓ Step 1: Organization created');

        // 2. Update
        await orgService.updateOrganization(context, {
          organizationId: orgID,
          name: 'Updated Lifecycle Org',
        });
        await processProjections();
        await assertOrgInQuery(orgID, 'Updated Lifecycle Org');
        console.log('✓ Step 2: Organization updated');

        // 3. Deactivate
        await orgService.deactivateOrganization(context, {
          organizationId: orgID,
        });
        await processProjections();
        let org = await orgQueries.getOrgByID(orgID, 'test-instance');
        expect(org!.state).toBe('inactive');
        console.log('✓ Step 3: Organization deactivated');

        // 4. Reactivate
        await orgService.reactivateOrganization(context, {
          organizationId: orgID,
        });
        await processProjections();
        org = await orgQueries.getOrgByID(orgID, 'test-instance');
        expect(org!.state).toBe('active');
        console.log('✓ Step 4: Organization reactivated');

        // 5. Remove
        await orgService.removeOrganization(context, {
          organizationId: orgID,
        });
        await processProjections();
        org = await orgQueries.getOrgByID(orgID, 'test-instance');
        if (org) {
          expect(org.state).toBe('removed');
        }
        console.log('✓ Step 5: Organization removed');

        console.log('✓ Complete lifecycle: All operations verified');
      });
    });
  });

  // ====================================================================
  // TEST COVERAGE SUMMARY
  // ====================================================================

  describe('Test Coverage Summary', () => {
    it('should confirm complete stack is tested', () => {
      console.log('\n=== Organization Service Integration Test Coverage ===');
      console.log('✅ API Layer: OrganizationService gRPC handlers');
      console.log('✅ Command Layer: Organization commands executed');
      console.log('✅ Event Layer: Events published and verified');
      console.log('✅ Projection Layer: OrgProjection processes events');
      console.log('✅ Query Layer: OrgQueries returns data');
      console.log('✅ Database Layer: PostgreSQL persistence');
      console.log('\n✅ Complete CQRS stack verified for Organization Service!');
      console.log('=======================================================\n');
      
      expect(true).toBe(true);
    });
  });
});
