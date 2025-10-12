/**
 * Organization Member Command Tests
 * 
 * Tests for:
 * - Adding members to organizations
 * - Changing member roles
 * - Removing members
 * - Member validation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { UserBuilder, OrganizationBuilder } from '../../helpers/test-data-builders';

describe('Organization Member Commands', () => {
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

  // Helper: Create org and user
  async function createOrgAndUser() {
    const orgData = new OrganizationBuilder()
      .withName(`Member Test Org ${Date.now()}`)
      .build();

    const org = await ctx.commands.addOrg(ctx.createContext(), orgData);

    const userData = new UserBuilder()
      .withOrgID(org.orgID)
      .withUsername(`member.user.${Date.now()}`)
      .withEmail(`member.${Date.now()}@example.com`)
      .build();

    const user = await ctx.commands.addHumanUser(ctx.createContext(), userData);

    return { org, user, userData };
  }

  describe('addOrgMember', () => {
    describe('Success Cases', () => {
      it('should add user as organization member', async () => {
        const { org, user } = await createOrgAndUser();

        const result = await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          {
            userID: user.userID,
            roles: ['ORG_OWNER']
          }
        );

        expect(result).toBeDefined();

        const event = await ctx.assertEventPublished('org.member.added');
        expect(event.payload).toBeDefined();
        expect(event.payload).toHaveProperty('userID', user.userID);
        expect(event.payload).toHaveProperty('roles');
        expect(event.payload!.roles).toContain('ORG_OWNER');      });

      it('should support multiple roles', async () => {
        const { org, user } = await createOrgAndUser();

        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          {
            userID: user.userID,
            roles: ['ORG_OWNER', 'ORG_PROJECT_CREATOR']
          }
        );

        const event = await ctx.assertEventPublished('org.member.added');
        expect(event.payload).toBeDefined();
        expect(event.payload!.roles).toHaveLength(2);
        expect(event.payload!.roles).toContain('ORG_OWNER');
        expect(event.payload!.roles).toContain('ORG_PROJECT_CREATOR');
      });

      it('should allow multiple members in same organization', async () => {
        const orgData = new OrganizationBuilder()
          .withName(`Multi Member Org ${Date.now()}`)
          .build();

        const org = await ctx.commands.addOrg(ctx.createContext(), orgData);

        // Create first user
        const user1Data = new UserBuilder()
          .withOrgID(org.orgID)
          .withUsername(`member1.${Date.now()}`)
          .withEmail(`member1.${Date.now()}@example.com`)
          .build();
        const user1 = await ctx.commands.addHumanUser(
          ctx.createContext(),
          user1Data
        );

        // Create second user
        const user2Data = new UserBuilder()
          .withOrgID(org.orgID)
          .withUsername(`member2.${Date.now()}`)
          .withEmail(`member2.${Date.now()}@example.com`)
          .build();
        const user2 = await ctx.commands.addHumanUser(
          ctx.createContext(),
          user2Data
        );

        // Add both as members
        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          { userID: user1.userID, roles: ['ORG_OWNER'] }
        );

        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          { userID: user2.userID, roles: ['ORG_USER_MANAGER'] }
        );

        const events = await ctx.getEvents('org', org.orgID);
        const memberEvents = events.filter(
          e => e.eventType === 'org.member.added'
        );
        expect(memberEvents.length).toBe(2);
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty roles array', async () => {
        const { org, user } = await createOrgAndUser();

        await expect(
          ctx.commands.addOrgMember(ctx.createContext(), org.orgID, {
            userID: user.userID,
            roles: []
          })
        ).rejects.toThrow(/role/i);
      });

      it('should fail for non-existent organization', async () => {
        const { user } = await createOrgAndUser();

        await expect(
          ctx.commands.addOrgMember(
            ctx.createContext(),
            'non-existent-org',
            { userID: user.userID, roles: ['ORG_OWNER'] }
          )
        ).rejects.toThrow(/not found/i);
      });

      it('should fail for non-existent user', async () => {
        const { org } = await createOrgAndUser();

        await expect(
          ctx.commands.addOrgMember(
            ctx.createContext(),
            org.orgID,
            { userID: 'non-existent-user', roles: ['ORG_OWNER'] }
          )
        ).rejects.toThrow();
      });
    });
  });

  describe('changeOrgMember', () => {
    describe('Success Cases', () => {
      it('should update member roles', async () => {
        const { org, user } = await createOrgAndUser();

        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          { userID: user.userID, roles: ['ORG_OWNER'] }
        );

        const result = await ctx.commands.changeOrgMember(
          ctx.createContext(),
          org.orgID,
          user.userID,
          ['ORG_OWNER', 'ORG_USER_MANAGER']
        );

        expect(result).toBeDefined();

        const event = await ctx.assertEventPublished('org.member.changed');
        expect(event.payload).toBeDefined();
        expect(event.payload).toHaveProperty('userID', user.userID);
        expect(event.payload!.roles).toHaveLength(2);
      });

      it('should allow removing roles', async () => {
        const { org, user } = await createOrgAndUser();

        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          { userID: user.userID, roles: ['ORG_OWNER', 'ORG_USER_MANAGER'] }
        );

        await ctx.commands.changeOrgMember(
          ctx.createContext(),
          org.orgID,
          user.userID,
          ['ORG_USER_MANAGER'] // Remove ORG_OWNER
        );

        const event = await ctx.assertEventPublished('org.member.changed');
        expect(event.payload).toBeDefined();
        expect(event.payload!.roles).toEqual(['ORG_USER_MANAGER']);
      });
    });

    describe('Error Cases', () => {
      it('should fail for non-member user', async () => {
        const { org, user } = await createOrgAndUser();

        await expect(
          ctx.commands.changeOrgMember(
            ctx.createContext(),
            org.orgID,
            user.userID,
            ['ORG_OWNER']
          )
        ).rejects.toThrow();
      });

      it('should fail with empty roles', async () => {
        const { org, user } = await createOrgAndUser();

        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          { userID: user.userID, roles: ['ORG_OWNER'] }
        );

        await expect(
          ctx.commands.changeOrgMember(
            ctx.createContext(),
            org.orgID,
            user.userID,
            []
          )
        ).rejects.toThrow(/role/i);
      });
    });
  });

  describe('removeOrgMember', () => {
    describe('Success Cases', () => {
      it('should remove member from organization', async () => {
        const { org, user } = await createOrgAndUser();

        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          { userID: user.userID, roles: ['ORG_OWNER'] }
        );

        const result = await ctx.commands.removeOrgMember(
          ctx.createContext(),
          org.orgID,
          user.userID
        );

        expect(result).toBeDefined();
        await ctx.assertEventPublished('org.member.removed');
      });

      it('should allow re-adding after removal', async () => {
        const { org, user } = await createOrgAndUser();

        // Add
        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          { userID: user.userID, roles: ['ORG_OWNER'] }
        );

        // Remove
        await ctx.commands.removeOrgMember(
          ctx.createContext(),
          org.orgID,
          user.userID
        );

        // Re-add
        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          { userID: user.userID, roles: ['ORG_USER_MANAGER'] }
        );

        const events = await ctx.getEvents('org', org.orgID);
        const addEvents = events.filter(e => e.eventType === 'org.member.added');
        const removeEvents = events.filter(
          e => e.eventType === 'org.member.removed'
        );

        expect(addEvents.length).toBe(2);
        expect(removeEvents.length).toBe(1);
      });
    });

    describe('Error Cases', () => {
      it('should fail for non-member user', async () => {
        const { org, user } = await createOrgAndUser();

        await expect(
          ctx.commands.removeOrgMember(ctx.createContext(), org.orgID, user.userID)
        ).rejects.toThrow();
      });

      it('should fail for non-existent organization', async () => {
        const { user } = await createOrgAndUser();

        await expect(
          ctx.commands.removeOrgMember(
            ctx.createContext(),
            'non-existent-org',
            user.userID
          )
        ).rejects.toThrow(/not found/i);
      });
    });
  });

  describe('Member Lifecycle', () => {
    it('should handle complete member lifecycle', async () => {
      const { org, user } = await createOrgAndUser();

      // Add member
      await ctx.commands.addOrgMember(
        ctx.createContext(),
        org.orgID,
        { userID: user.userID, roles: ['ORG_USER_MANAGER'] }
      );

      // Change roles
      await ctx.commands.changeOrgMember(
        ctx.createContext(),
        org.orgID,
        user.userID,
        ['ORG_OWNER']
      );

      // Remove member
      await ctx.commands.removeOrgMember(
        ctx.createContext(),
        org.orgID,
        user.userID
      );

      // Verify event sequence
      const events = await ctx.getEvents('org', org.orgID);
      const eventTypes = events.map(e => e.eventType);

      expect(eventTypes).toContain('org.member.added');
      expect(eventTypes).toContain('org.member.changed');
      expect(eventTypes).toContain('org.member.removed');
    });
  });
});
