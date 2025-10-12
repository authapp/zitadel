/**
 * Project Command Tests
 * 
 * Tests for:
 * - Project lifecycle (create, update, deactivate, reactivate, remove)
 * - Project roles management
 * - Project members management
 * - Project grants (cross-org sharing)
 * - State management and validation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { UserBuilder, OrganizationBuilder } from '../../helpers/test-data-builders';

describe('Project Commands', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    await ctx.clearEvents();
  });

  // Helper: Create organization for projects
  async function createTestOrg(name?: string) {
    const orgData = new OrganizationBuilder()
      .withName(name || `Test Org ${Date.now()}`)
      .build();

    const result = await ctx.commands.addOrg(ctx.createContext(), orgData);
    return { orgID: result.orgID, orgData };
  }

  describe('Project Lifecycle', () => {
    describe('addProject', () => {
      it('should create new project successfully', async () => {
        const { orgID } = await createTestOrg();

        const projectData = {
          orgID,
          name: `Test Project ${Date.now()}`,
          projectRoleAssertion: true,
          projectRoleCheck: true,
          hasProjectCheck: false,
        };

        const result = await ctx.commands.addProject(
          ctx.createContext(),
          projectData
        );

        expect(result).toBeDefined();
        expect(result.projectID).toBeDefined();
        expect(result.sequence).toBeGreaterThan(0);

        const event = await ctx.assertEventPublished('project.added');
        expect(event.payload).toHaveProperty('name', projectData.name);
        expect(event.payload).toHaveProperty('projectRoleAssertion', true);
      });

      it('should allow multiple projects in same org', async () => {
        const { orgID } = await createTestOrg();

        const project1 = await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Project 1',
        });

        const project2 = await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Project 2',
        });

        expect(project1.projectID).not.toBe(project2.projectID);
      });

      it('should apply default values for optional fields', async () => {
        const { orgID } = await createTestOrg();

        await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Minimal Project',
        });

        const event = await ctx.assertEventPublished('project.added');
        expect(event.payload).toHaveProperty('projectRoleAssertion', false);
        expect(event.payload).toHaveProperty('projectRoleCheck', false);
        expect(event.payload).toHaveProperty('hasProjectCheck', false);
      });

      it('should fail with empty name', async () => {
        const { orgID } = await createTestOrg();

        await expect(
          ctx.commands.addProject(ctx.createContext(), {
            orgID,
            name: '',
          })
        ).rejects.toThrow(/name/i);
      });

      it('should fail with name too long', async () => {
        const { orgID } = await createTestOrg();

        await expect(
          ctx.commands.addProject(ctx.createContext(), {
            orgID,
            name: 'a'.repeat(201),
          })
        ).rejects.toThrow();
      });
    });

    describe('changeProject', () => {
      it('should update project name', async () => {
        const { orgID } = await createTestOrg();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Original Name',
        });

        await ctx.commands.changeProject(
          ctx.createContext(),
          project.projectID,
          orgID,
          { name: 'Updated Name' }
        );

        const event = await ctx.assertEventPublished('project.changed');
        expect(event.payload).toHaveProperty('name', 'Updated Name');
      });

      it('should update project configuration', async () => {
        const { orgID } = await createTestOrg();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Test Project',
          projectRoleAssertion: false,
        });

        await ctx.commands.changeProject(
          ctx.createContext(),
          project.projectID,
          orgID,
          {
            projectRoleAssertion: true,
            projectRoleCheck: true,
          }
        );

        const event = await ctx.assertEventPublished('project.changed');
        expect(event.payload).toHaveProperty('projectRoleAssertion', true);
        expect(event.payload).toHaveProperty('projectRoleCheck', true);
      });

      it('should fail if no fields provided', async () => {
        const { orgID } = await createTestOrg();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Test Project',
        });

        await expect(
          ctx.commands.changeProject(ctx.createContext(), project.projectID, orgID, {})
        ).rejects.toThrow(/at least one field/i);
      });

      it('should fail for non-existent project', async () => {
        const { orgID } = await createTestOrg();

        await expect(
          ctx.commands.changeProject(
            ctx.createContext(),
            'non-existent-project',
            orgID,
            { name: 'New Name' }
          )
        ).rejects.toThrow(/not found/i);
      });
    });

    describe('deactivateProject', () => {
      it('should deactivate active project', async () => {
        const { orgID } = await createTestOrg();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Project to Deactivate',
        });

        const result = await ctx.commands.deactivateProject(
          ctx.createContext(),
          project.projectID,
          orgID
        );

        expect(result).toBeDefined();
        await ctx.assertEventPublished('project.deactivated');
      });

      it('should fail for non-existent project', async () => {
        const { orgID } = await createTestOrg();

        await expect(
          ctx.commands.deactivateProject(ctx.createContext(), 'non-existent', orgID)
        ).rejects.toThrow(/not found/i);
      });
    });

    describe('reactivateProject', () => {
      it('should reactivate deactivated project', async () => {
        const { orgID } = await createTestOrg();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Project to Reactivate',
        });

        await ctx.commands.deactivateProject(
          ctx.createContext(),
          project.projectID,
          orgID
        );

        await ctx.commands.reactivateProject(
          ctx.createContext(),
          project.projectID,
          orgID
        );
        await ctx.assertEventPublished('project.reactivated');
      });
    });

    describe('removeProject', () => {
      it('should remove project', async () => {
        const { orgID } = await createTestOrg();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Project to Remove',
        });

        const result = await ctx.commands.removeProject(
          ctx.createContext(),
          project.projectID
        );

        expect(result).toBeDefined();
        await ctx.assertEventPublished('project.removed');
      });
    });

    it('should handle complete project lifecycle', async () => {
      const { orgID } = await createTestOrg();

      // Create
      const project = await ctx.commands.addProject(ctx.createContext(), {
        orgID,
        name: 'Lifecycle Project',
      });

      // Update
      await ctx.commands.changeProject(ctx.createContext(), project.projectID, orgID, {
        name: 'Updated Lifecycle Project',
      });

      // Deactivate
      await ctx.commands.deactivateProject(ctx.createContext(), project.projectID, orgID);

      // Reactivate
      await ctx.commands.reactivateProject(ctx.createContext(), project.projectID, orgID);

      // Remove
      await ctx.commands.removeProject(ctx.createContext(), project.projectID);

      // Verify event sequence
      const events = await ctx.getEvents('project', project.projectID);
      const eventTypes = events.map(e => e.eventType);

      expect(eventTypes).toContain('project.added');
      expect(eventTypes).toContain('project.changed');
      expect(eventTypes).toContain('project.deactivated');
      expect(eventTypes).toContain('project.reactivated');
      expect(eventTypes).toContain('project.removed');
    });
  });

  describe('Project Roles', () => {
    describe('addProjectRole', () => {
      it('should add role to project', async () => {
        const { orgID } = await createTestOrg();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Project with Roles',
        });

        const result = await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          orgID,
          {
            roleKey: 'admin',
            displayName: 'Administrator role',
            group: 'ADMIN'
          }
        );

        expect(result).toBeDefined();
        const event = await ctx.assertEventPublished('project.role.added');
        expect(event.payload).toHaveProperty('roleKey', 'admin');
        expect(event.payload).toHaveProperty('displayName', 'Administrator role');
      });

      it('should allow multiple roles in project', async () => {
        const { orgID } = await createTestOrg();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Multi-Role Project',
        });

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          orgID,
          { roleKey: 'admin', displayName: 'Admin', group: 'ADMIN' }
        );

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          orgID,
          { roleKey: 'viewer', displayName: 'Viewer', group: 'VIEWER' }
        );

        const events = await ctx.getEvents('project', project.projectID);
        const roleEvents = events.filter(e => e.eventType === 'project.role.added');
        expect(roleEvents.length).toBe(2);
      });
    });

    describe('changeProjectRole', () => {
      it('should update existing role', async () => {
        const { orgID } = await createTestOrg();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Project Role Change',
        });

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          orgID,
          { roleKey: 'editor', displayName: 'Editor', group: 'EDITOR' }
        );

        await ctx.commands.changeProjectRole(
          ctx.createContext(),
          project.projectID,
          orgID,
          'editor',
          'Senior Editor',
          'SENIOR_EDITOR'
        );

        const event = await ctx.assertEventPublished('project.role.changed');
        expect(event.payload).toHaveProperty('displayName', 'Senior Editor');
      });
    });

    describe('removeProjectRole', () => {
      it('should remove project role', async () => {
        const { orgID } = await createTestOrg();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Project Role Removal',
        });

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          orgID,
          { roleKey: 'temp-role', displayName: 'Temporary Role', group: 'TEMP' }
        );

        await ctx.commands.removeProjectRole(
          ctx.createContext(),
          project.projectID,
          orgID,
          'temp-role'
        );

        await ctx.assertEventPublished('project.role.removed');
      });
    });
  });

  describe('Project Members', () => {
    describe('addProjectMember', () => {
      it('should add member to project', async () => {
        const { orgID } = await createTestOrg();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Project with Members',
        });

        const userData = new UserBuilder()
          .withOrgID(orgID)
          .withUsername(`member.${Date.now()}`)
          .withEmail(`member.${Date.now()}@example.com`)
          .build();

        const user = await ctx.commands.addHumanUser(ctx.createContext(), userData);

        const result = await ctx.commands.addProjectMember(
          ctx.createContext(),
          project.projectID,
          orgID,
          {
            userID: user.userID,
            roles: ['PROJECT_OWNER']
          }
        );

        expect(result).toBeDefined();
        const event = await ctx.assertEventPublished('project.member.added');
        expect(event.payload).toHaveProperty('userID', user.userID);
        expect(event.payload).toHaveProperty('roles');
      });
    });

    describe('changeProjectMember', () => {
      it('should update member roles', async () => {
        const { orgID } = await createTestOrg();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Project Member Change',
        });

        const userData = new UserBuilder()
          .withOrgID(orgID)
          .withUsername(`member.change.${Date.now()}`)
          .withEmail(`member.change.${Date.now()}@example.com`)
          .build();

        const user = await ctx.commands.addHumanUser(ctx.createContext(), userData);

        await ctx.commands.addProjectMember(
          ctx.createContext(),
          project.projectID,
          orgID,
          { userID: user.userID, roles: ['PROJECT_OWNER'] }
        );

        await ctx.commands.changeProjectMember(
          ctx.createContext(),
          project.projectID,
          orgID,
          user.userID,
          ['PROJECT_OWNER', 'PROJECT_EDITOR']
        );

        const event = await ctx.assertEventPublished('project.member.changed');
        expect(event.payload).toHaveProperty('roles');
      });
    });

    describe('removeProjectMember', () => {
      it('should remove member from project', async () => {
        const { orgID } = await createTestOrg();

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: 'Project Member Removal',
        });

        const userData = new UserBuilder()
          .withOrgID(orgID)
          .withUsername(`member.remove.${Date.now()}`)
          .withEmail(`member.remove.${Date.now()}@example.com`)
          .build();

        const user = await ctx.commands.addHumanUser(ctx.createContext(), userData);

        await ctx.commands.addProjectMember(
          ctx.createContext(),
          project.projectID,
          orgID,
          { userID: user.userID, roles: ['PROJECT_OWNER'] }
        );

        await ctx.commands.removeProjectMember(
          ctx.createContext(),
          project.projectID,
          user.userID
        );

        await ctx.assertEventPublished('project.member.removed');
      });
    });
  });

  describe('Project Grants (Cross-Org Sharing)', () => {
    describe('addProjectGrant', () => {
      it('should grant project access to another organization', async () => {
        const { orgID: org1 } = await createTestOrg('Org 1');
        const { orgID: org2 } = await createTestOrg('Org 2');

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Shared Project',
        });

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          org1,
          { roleKey: 'viewer', displayName: 'Viewer', group: 'VIEWER' }
        );

        const result = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          { grantedOrgID: org2, roleKeys: ['viewer'] }
        );

        expect(result).toBeDefined();
        const event = await ctx.assertEventPublished('project.grant.added');
        expect(event.payload).toHaveProperty('grantedOrgID', org2);
        expect(event.payload).toHaveProperty('roleKeys');
      });
    });

    describe('changeProjectGrant', () => {
      it('should update project grant roles', async () => {
        const { orgID: org1 } = await createTestOrg('Org 1');
        const { orgID: org2 } = await createTestOrg('Org 2');

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Grant Project',
        });

        await ctx.commands.addProjectRole(
          ctx.createContext(),
          project.projectID,
          org1,
          { roleKey: 'viewer', displayName: 'Viewer', group: 'VIEWER' }
        );

        const grant = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          { grantedOrgID: org2, roleKeys: ['viewer'] }
        );

        await ctx.commands.changeProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          grant.grantID!,
          ['viewer']
        );

        await ctx.assertEventPublished('project.grant.changed');
      });
    });

    describe('deactivateProjectGrant', () => {
      it('should deactivate project grant', async () => {
        const { orgID: org1 } = await createTestOrg('Org 1');
        const { orgID: org2 } = await createTestOrg('Org 2');

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Grant Deactivation',
        });

        const grant = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          { grantedOrgID: org2, roleKeys: ['viewer'] }
        );

        await ctx.commands.deactivateProjectGrant(
          ctx.createContext(),
          project.projectID,
          grant.grantID!
        );

        await ctx.assertEventPublished('project.grant.deactivated');
      });
    });

    describe('reactivateProjectGrant', () => {
      it('should reactivate project grant', async () => {
        const { orgID: org1 } = await createTestOrg('Org 1');
        const { orgID: org2 } = await createTestOrg('Org 2');

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Grant Reactivation',
        });

        const grant = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          { grantedOrgID: org2, roleKeys: ['viewer'] }
        );

        await ctx.commands.deactivateProjectGrant(
          ctx.createContext(),
          project.projectID,
          grant.grantID!
        );

        await ctx.commands.reactivateProjectGrant(
          ctx.createContext(),
          project.projectID,
          grant.grantID!
        );

        await ctx.assertEventPublished('project.grant.reactivated');
      });
    });

    describe('removeProjectGrant', () => {
      it('should remove project grant', async () => {
        const { orgID: org1 } = await createTestOrg('Org 1');
        const { orgID: org2 } = await createTestOrg('Org 2');

        const project = await ctx.commands.addProject(ctx.createContext(), {
          orgID: org1,
          name: 'Grant Removal',
        });

        const grant = await ctx.commands.addProjectGrant(
          ctx.createContext(),
          project.projectID,
          org1,
          { grantedOrgID: org2, roleKeys: ['viewer'] }
        );

        await ctx.commands.removeProjectGrant(
          ctx.createContext(),
          project.projectID,
          grant.grantID!
        );

        await ctx.assertEventPublished('project.grant.removed');
      });
    });
  });

  describe('Error Handling & Validation', () => {
    it('should enforce project name requirements', async () => {
      const { orgID } = await createTestOrg();

      await expect(
        ctx.commands.addProject(ctx.createContext(), {
          orgID,
          name: '',
        })
      ).rejects.toThrow();
    });

    it('should prevent operations on removed projects', async () => {
      const { orgID } = await createTestOrg();

      const project = await ctx.commands.addProject(ctx.createContext(), {
        orgID,
        name: 'Removed Project',
      });

      await ctx.commands.removeProject(ctx.createContext(), project.projectID);

      await expect(
        ctx.commands.changeProject(ctx.createContext(), project.projectID, orgID, {
          name: 'New Name',
        })
      ).rejects.toThrow(/not found|removed/i);
    });

    it('should require valid organization', async () => {
      await expect(
        ctx.commands.addProject(ctx.createContext(), {
          orgID: 'non-existent-org',
          name: 'Test Project',
        })
      ).rejects.toThrow();
    });
  });
});
