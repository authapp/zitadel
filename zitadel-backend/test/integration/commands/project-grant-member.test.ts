/**
 * Project Grant Member Command Tests - Complete Stack
 * 
 * Tests for cross-org project grant member management:
 * - Add members to granted projects
 * - Change member roles in granted projects
 * - Remove members from granted projects
 * - Complete stack: Command → Event → Projection → Query
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { UserBuilder, OrganizationBuilder } from '../../helpers/test-data-builders';
import { ProjectProjection } from '../../../src/lib/query/projections/project-projection';
import { ProjectGrantProjection } from '../../../src/lib/query/projections/project-grant-projection';
import { ProjectGrantMemberProjection } from '../../../src/lib/query/projections/project-grant-member-projection';
import { ProjectGrantMemberQueries } from '../../../src/lib/query/member/project-grant-member-queries';

describe('Project Grant Member Commands - Complete Flow', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let projectProjection: ProjectProjection;
  let projectGrantProjection: ProjectGrantProjection;
  let projectGrantMemberProjection: ProjectGrantMemberProjection;
  let projectGrantMemberQueries: ProjectGrantMemberQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projections
    projectProjection = new ProjectProjection(ctx.eventstore, pool);
    await projectProjection.init();
    
    projectGrantProjection = new ProjectGrantProjection(ctx.eventstore, pool);
    await projectGrantProjection.init();
    
    projectGrantMemberProjection = new ProjectGrantMemberProjection(ctx.eventstore, pool);
    await projectGrantMemberProjection.init();
    
    // Initialize query layer
    projectGrantMemberQueries = new ProjectGrantMemberQueries(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    await ctx.clearEvents();
  });

  /**
   * Helper: Process all projections
   */
  async function processProjections() {
    const events = await ctx.getEvents('*', '*');
    
    console.log(`Processing ${events.length} event(s) through projections...`);
    
    for (const event of events) {
      try {
        await projectProjection.reduce(event);
        await projectGrantProjection.reduce(event);
        await projectGrantMemberProjection.reduce(event);
        console.log(`  ✓ Processed ${event.eventType} for ${event.aggregateID}`);
      } catch (err: any) {
        console.error(`  ✗ Failed to process ${event.eventType}:`, err.message);
        console.error('    Error details:', err.details);
        if (err.cause) {
          console.error('    Cause:', err.cause.message);
          console.error('    SQL Error code:', err.cause.code);
          console.error('    SQL Error detail:', err.cause.detail);
          console.error('    Full SQL Error:', JSON.stringify(err.cause, null, 2));
        }
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Create test org
   */
  async function createTestOrg(name = 'Test Organization') {
    const orgData = new OrganizationBuilder()
      .withName(name)
      .build();
    
    const result = await ctx.commands.addOrg(ctx.createContext(), orgData);
    return { orgID: result.orgID, orgData };
  }

  /**
   * Helper: Create test user
   */
  async function createTestUser() {
    const userData = new UserBuilder()
      .withUsername(`user-${Date.now()}`)
      .withEmail(`user-${Date.now()}@example.com`)
      .build();
    
    const result = await ctx.commands.addHumanUser(ctx.createContext(), userData);
    return result.userID;
  }

  /**
   * Helper: Verify member via Query Layer
   */
  async function assertMemberInQuery(
    projectID: string,
    grantID: string,
    userID: string,
    expectedRoles?: string[]
  ) {
    const member = await projectGrantMemberQueries.getProjectGrantMemberByID(
      projectID,
      grantID,
      userID,
      'test-instance'
    );

    expect(member).not.toBeNull();
    console.log(`✓ Member verified via query layer: ${userID}`);
    
    if (expectedRoles) {
      expect(member!.roles).toEqual(expectedRoles);
      console.log(`✓ Member has correct roles:`, expectedRoles);
    }
    
    return member;
  }

  /**
   * Helper: Verify member does NOT exist via Query Layer
   */
  async function assertMemberNotInQuery(
    projectID: string,
    grantID: string,
    userID: string
  ) {
    const member = await projectGrantMemberQueries.getProjectGrantMemberByID(
      projectID,
      grantID,
      userID,
      'test-instance'
    );

    expect(member).toBeNull();
    console.log(`✓ Verified member removed via query layer: ${userID}`);
  }

  describe('addProjectGrantMember', () => {
    describe('Success Cases', () => {
      it('should add member to project grant with single role', async () => {
        const { orgID: org1 } = await createTestOrg('Source Org');
        const { orgID: org2 } = await createTestOrg('Target Org');
        const userID = await createTestUser();

        console.log('\n--- Creating project and grant ---');

        // Create project in org1
        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Shared Project',
        });

        // Add role to project
        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            roleKey: 'viewer',
            displayName: 'Viewer',
          }
        );

        // Grant project to org2
        const grant = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            grantedOrgID: org2,
            roleKeys: ['viewer'],
          }
        );

        console.log('\n--- Adding grant member ---');

        // Add member to grant
        const result = await ctx.commands.addProjectGrantMember(
          ctx.createContext(),
          {
            projectID: project.projectID,
            orgID: org1,
            grantID: grant.grantID,
            userID,
            roles: ['viewer'],
          }
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('project.grant.member.added');
        expect(event.payload).toHaveProperty('userID', userID);
        expect(event.payload).toHaveProperty('roles', ['viewer']);

        // Process projections
        await processProjections();

        // Verify via query layer
        await assertMemberInQuery(project.projectID, grant.grantID, userID, ['viewer']);
      });

      it('should add member with multiple roles', async () => {
        const { orgID: org1 } = await createTestOrg('Source Org');
        const { orgID: org2 } = await createTestOrg('Target Org');
        const userID = await createTestUser();

        // Create project with multiple roles
        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Multi-Role Project',
        });

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            roleKey: 'viewer',
            displayName: 'Viewer',
          }
        );

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            roleKey: 'editor',
            displayName: 'Editor',
          }
        );

        // Grant project to org2
        const grant = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            grantedOrgID: org2,
            roleKeys: ['viewer', 'editor'],
          }
        );

        console.log('\n--- Adding grant member with multiple roles ---');

        // Add member with multiple roles
        await ctx.commands.addProjectGrantMember(
          ctx.createContext(),
          {
            projectID: project.projectID,
            orgID: org1,
            grantID: grant.grantID,
            userID,
            roles: ['viewer', 'editor'],
          }
        );

        // Process projections
        await processProjections();

        // Verify roles
        await assertMemberInQuery(project.projectID, grant.grantID, userID, ['viewer', 'editor']);
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty userID', async () => {
        const { orgID: org1 } = await createTestOrg();
        const { orgID: org2 } = await createTestOrg();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Test Project',
        });

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            roleKey: 'viewer',
            displayName: 'Viewer',
          }
        );

        const grant = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            grantedOrgID: org2,
            roleKeys: ['viewer'],
          }
        );

        await expect(
          ctx.commands.addProjectGrantMember(
            ctx.createContext(),
            {
              projectID: project.projectID,
              orgID: org1,
              grantID: grant.grantID,
              userID: '',
              roles: ['viewer'],
            }
          )
        ).rejects.toThrow(/userID/i);
      });

      it('should fail with empty roles array', async () => {
        const { orgID: org1 } = await createTestOrg();
        const { orgID: org2 } = await createTestOrg();
        const userID = await createTestUser();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Test Project',
        });

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            roleKey: 'viewer',
            displayName: 'Viewer',
          }
        );

        const grant = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            grantedOrgID: org2,
            roleKeys: ['viewer'],
          }
        );

        await expect(
          ctx.commands.addProjectGrantMember(
            ctx.createContext(),
            {
              projectID: project.projectID,
              orgID: org1,
              grantID: grant.grantID,
              userID,
              roles: [],
            }
          )
        ).rejects.toThrow(/roles/i);
      });

      it('should fail with invalid grant', async () => {
        const { orgID: org1 } = await createTestOrg();
        const userID = await createTestUser();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Test Project',
        });

        await expect(
          ctx.commands.addProjectGrantMember(
            ctx.createContext(),
            {
              projectID: project.projectID,
              orgID: org1,
              grantID: 'non-existent',
              userID,
              roles: ['viewer'],
            }
          )
        ).rejects.toThrow();
      });

      it('should fail adding duplicate member', async () => {
        const { orgID: org1 } = await createTestOrg();
        const { orgID: org2 } = await createTestOrg();
        const userID = await createTestUser();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Test Project',
        });

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            roleKey: 'viewer',
            displayName: 'Viewer',
          }
        );

        const grant = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            grantedOrgID: org2,
            roleKeys: ['viewer'],
          }
        );

        // Add member first time
        await ctx.commands.addProjectGrantMember(
          ctx.createContext(),
          {
            projectID: project.projectID,
            orgID: org1,
            grantID: grant.grantID,
            userID,
            roles: ['viewer'],
          }
        );

        // Try to add same member again
        await expect(
          ctx.commands.addProjectGrantMember(
            ctx.createContext(),
            {
              projectID: project.projectID,
              orgID: org1,
              grantID: grant.grantID,
              userID,
              roles: ['viewer'],
            }
          )
        ).rejects.toThrow(/already exists/i);
      });
    });
  });

  describe('changeProjectGrantMember', () => {
    describe('Success Cases', () => {
      it('should change member roles', async () => {
        const { orgID: org1 } = await createTestOrg('Source Org');
        const { orgID: org2 } = await createTestOrg('Target Org');
        const userID = await createTestUser();

        // Setup project with roles
        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Project',
        });

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            roleKey: 'viewer',
            displayName: 'Viewer',
          }
        );

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            roleKey: 'admin',
            displayName: 'Admin',
          }
        );

        const grant = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            grantedOrgID: org2,
            roleKeys: ['viewer', 'admin'],
          }
        );

        // Add member with viewer role
        await ctx.commands.addProjectGrantMember(
          ctx.createContext(),
          {
            projectID: project.projectID,
            orgID: org1,
            grantID: grant.grantID,
            userID,
            roles: ['viewer'],
          }
        );

        console.log('\n--- Changing member roles ---');

        // Change to admin role
        await ctx.commands.changeProjectGrantMember(
          ctx.createContext(),
          {
            projectID: project.projectID,
            orgID: org1,
            grantID: grant.grantID,
            userID,
            roles: ['admin'],
          }
        );

        // Verify event
        const event = await ctx.assertEventPublished('project.grant.member.changed');
        expect(event.payload).toHaveProperty('roles', ['admin']);

        // Process projections
        await processProjections();

        // Verify updated roles
        await assertMemberInQuery(project.projectID, grant.grantID, userID, ['admin']);
      });

      it('should handle idempotent role updates', async () => {
        const { orgID: org1 } = await createTestOrg();
        const { orgID: org2 } = await createTestOrg();
        const userID = await createTestUser();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Project',
        });

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            roleKey: 'viewer',
            displayName: 'Viewer',
          }
        );

        const grant = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            grantedOrgID: org2,
            roleKeys: ['viewer'],
          }
        );

        await ctx.commands.addProjectGrantMember(
          ctx.createContext(),
          {
            projectID: project.projectID,
            orgID: org1,
            grantID: grant.grantID,
            userID,
            roles: ['viewer'],
          }
        );

        // Count events before the idempotent update
        const eventsBefore = await ctx.getEvents('project', project.projectID);
        const eventCountBefore = eventsBefore.length;

        console.log('\n--- Idempotent role update ---');
        console.log('Events before:', eventCountBefore);

        // Update with same roles (should not create event)
        await ctx.commands.changeProjectGrantMember(
          ctx.createContext(),
          {
            projectID: project.projectID,
            orgID: org1,
            grantID: grant.grantID,
            userID,
            roles: ['viewer'],
          }
        );

        // Should not publish new event for unchanged roles
        const eventsAfter = await ctx.getEvents('project', project.projectID);
        expect(eventsAfter.length).toBe(eventCountBefore);
        console.log('✓ No new event published for unchanged roles');
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty roles', async () => {
        const { orgID: org1 } = await createTestOrg();
        const { orgID: org2 } = await createTestOrg();
        const userID = await createTestUser();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Project',
        });

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            roleKey: 'viewer',
            displayName: 'Viewer',
          }
        );

        const grant = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            grantedOrgID: org2,
            roleKeys: ['viewer'],
          }
        );

        await expect(
          ctx.commands.changeProjectGrantMember(
            ctx.createContext(),
            {
              projectID: project.projectID,
              orgID: org1,
              grantID: grant.grantID,
              userID,
              roles: [],
            }
          )
        ).rejects.toThrow(/roles/i);
      });

      it('should fail with non-existent member', async () => {
        const { orgID: org1 } = await createTestOrg();
        const { orgID: org2 } = await createTestOrg();
        const userID = await createTestUser();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Project',
        });

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            roleKey: 'viewer',
            displayName: 'Viewer',
          }
        );

        const grant = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            grantedOrgID: org2,
            roleKeys: ['viewer'],
          }
        );

        await expect(
          ctx.commands.changeProjectGrantMember(
            ctx.createContext(),
            {
              projectID: project.projectID,
              orgID: org1,
              grantID: grant.grantID,
              userID,
              roles: ['viewer'],
            }
          )
        ).rejects.toThrow();
      });
    });
  });

  describe('removeProjectGrantMember', () => {
    describe('Success Cases', () => {
      it('should remove grant member', async () => {
        const { orgID: org1 } = await createTestOrg('Source Org');
        const { orgID: org2 } = await createTestOrg('Target Org');
        const userID = await createTestUser();

        // Setup
        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Project',
        });

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            roleKey: 'viewer',
            displayName: 'Viewer',
          }
        );

        const grant = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            grantedOrgID: org2,
            roleKeys: ['viewer'],
          }
        );

        await ctx.commands.addProjectGrantMember(
          ctx.createContext(),
          {
            projectID: project.projectID,
            orgID: org1,
            grantID: grant.grantID,
            userID,
            roles: ['viewer'],
          }
        );

        // Process to verify member exists
        await processProjections();
        await assertMemberInQuery(project.projectID, grant.grantID, userID);

        console.log('\n--- Removing grant member ---');

        // Remove member
        await ctx.commands.removeProjectGrantMember(
          ctx.createContext(),
          project.projectID,
          userID,
          grant.grantID,
          org1
        );

        // Verify event
        await ctx.assertEventPublished('project.grant.member.removed');

        // Process projections
        await processProjections();

        // Verify member removed
        await assertMemberNotInQuery(project.projectID, grant.grantID, userID);
      });
    });

    describe('Error Cases', () => {
      it('should fail removing non-existent member', async () => {
        const { orgID: org1 } = await createTestOrg();
        const { orgID: org2 } = await createTestOrg();
        const userID = await createTestUser();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Project',
        });

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            roleKey: 'viewer',
            displayName: 'Viewer',
          }
        );

        const grant = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          {
            grantedOrgID: org2,
            roleKeys: ['viewer'],
          }
        );

        await expect(
          ctx.commands.removeProjectGrantMember(
            ctx.createContext(),
            project.projectID,
            userID,
            grant.grantID,
            org1
          )
        ).rejects.toThrow();
      });

      it('should fail with invalid grant', async () => {
        const { orgID: org1 } = await createTestOrg();
        const userID = await createTestUser();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Project',
        });

        await expect(
          ctx.commands.removeProjectGrantMember(
            ctx.createContext(),
            project.projectID,
            userID,
            'non-existent-grant',
            org1
          )
        ).rejects.toThrow();
      });
    });
  });

  describe('Complete Lifecycles', () => {
    it('should complete grant member lifecycle: add → change → remove', async () => {
      const { orgID: org1 } = await createTestOrg('Source Org');
      const { orgID: org2 } = await createTestOrg('Target Org');
      const userID = await createTestUser();

      console.log('\n--- Testing complete grant member lifecycle ---');

      // Setup project with roles
      const project = await ctx.commands.addProject(ctx.createContext(), {
        orgID: org1,
        name: 'Lifecycle Project',
      });

      await ctx.commands.addProjectRole(
        ctx.createContext(),
        project.projectID,
        org1,
        {
          roleKey: 'viewer',
          displayName: 'Viewer',
        }
      );

      await ctx.commands.addProjectRole(
        ctx.createContext(),
        project.projectID,
        org1,
        {
          roleKey: 'admin',
          displayName: 'Admin',
        }
      );

      const grant = await ctx.commands.addProjectGrant(
        ctx.createContext(),
        project.projectID,
        org1,
        {
          grantedOrgID: org2,
          roleKeys: ['viewer', 'admin'],
        }
      );

      // Add member
      await ctx.commands.addProjectGrantMember(
        ctx.createContext(),
        {
          projectID: project.projectID,
          orgID: org1,
          grantID: grant.grantID,
          userID,
          roles: ['viewer'],
        }
      );

      await processProjections();
      await assertMemberInQuery(project.projectID, grant.grantID, userID, ['viewer']);

      // Change roles
      await ctx.commands.changeProjectGrantMember(
        ctx.createContext(),
        {
          projectID: project.projectID,
          orgID: org1,
          grantID: grant.grantID,
          userID,
          roles: ['admin', 'viewer'],
        }
      );

      await processProjections();
      await assertMemberInQuery(project.projectID, grant.grantID, userID, ['admin', 'viewer']);

      // Remove member
      await ctx.commands.removeProjectGrantMember(
        ctx.createContext(),
        project.projectID,
        userID,
        grant.grantID,
        org1
      );

      await processProjections();
      await assertMemberNotInQuery(project.projectID, grant.grantID, userID);

      console.log('✓ Grant member lifecycle complete');
    });
  });
});
