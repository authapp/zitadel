/**
 * Organization Member Commands - Complete Integration Tests
 * 
 * Tests the full command→event→projection→query flow
 * Uses proper event sourcing instead of direct table writes
 * Verifies projection updates at each step
 * 
 * Based on existing pattern from test/integration/commands/org-member.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { UserBuilder, OrganizationBuilder } from '../../helpers/test-data-builders';
import { OrgMemberProjection } from '../../../src/lib/query/projections/org-member-projection';
import { OrgMemberQueries } from '../../../src/lib/query/member/org-member-queries';

describe('Organization Member Commands - Complete Flow', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let orgMemberProjection: OrgMemberProjection;
  let orgMemberQueries: OrgMemberQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projection
    orgMemberProjection = new OrgMemberProjection(ctx.eventstore, pool);
    await orgMemberProjection.init();
    
    // Initialize query layer
    orgMemberQueries = new OrgMemberQueries(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    // Clear all events before each test
    await ctx.clearEvents();
    
    // Clear projection data
    await pool.query('TRUNCATE projections.org_members CASCADE');
  });

  /**
   * Helper: Create org and user via commands (proper event sourcing)
   */
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

    // Debug: Verify user and org events were created
    const orgEvents = await ctx.getEvents('org', org.orgID);
    const userEvents = await ctx.getEvents('user', user.userID);
    
    console.log(`✓ Created org with ${orgEvents.length} event(s)`);
    console.log(`✓ Created user with ${userEvents.length} event(s)`);

    return { org, user, userData };
  }

  /**
   * Helper: Process projection and verify
   */
  async function processProjection() {
    // Get all events
    const events = await ctx.getEvents('*', '*');
    
    console.log(`Processing ${events.length} event(s) through projection...`);
    
    // Process each event through projection
    for (const event of events) {
      try {
        await orgMemberProjection.reduce(event);
        console.log(`  ✓ Processed ${event.eventType} for ${event.aggregateID}`);
      } catch (err) {
        console.error(`  ✗ Failed to process ${event.eventType}:`, err);
      }
    }
    
    // Small delay to ensure database consistency
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Verify member exists via Query Layer (not direct table query)
   */
  async function assertMemberInQuery(
    orgID: string,
    userID: string,
    expectedRoles?: string[]
  ) {
    const member = await orgMemberQueries.getOrgMemberByID(
      orgID,
      userID,
      'test-instance'
    );

    expect(member).not.toBeNull();
    if (expectedRoles) {
      expect(member!.roles).toEqual(expectedRoles);
    }
    
    console.log(`✓ Member verified via query layer: ${userID} with roles ${member!.roles.join(', ')}`);
    
    return member;
  }

  /**
   * Helper: Verify member does NOT exist via Query Layer
   */
  async function assertMemberNotInQuery(orgID: string, userID: string) {
    const member = await orgMemberQueries.getOrgMemberByID(
      orgID,
      userID,
      'test-instance'
    );

    expect(member).toBeNull();
    console.log(`✓ Verified member removed via query layer: ${userID}`);
  }

  describe('addOrgMember', () => {
    describe('Success Cases', () => {
      it('should add user as organization member and update projection', async () => {
        const { org, user } = await createOrgAndUser();

        // Step 1: Add member
        console.log('\n--- Adding member to organization ---');
        const result = await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          {
            userID: user.userID,
            roles: ['ORG_OWNER']
          }
        );

        expect(result).toBeDefined();

        // Step 2: Verify event was published
        console.log('--- Verifying event published ---');
        const event = await ctx.assertEventPublished('org.member.added');
        expect(event.payload).toBeDefined();
        expect(event.payload).toHaveProperty('userId', user.userID);
        expect(event.payload!.roles).toContain('ORG_OWNER');
        console.log(`✓ Event published: org.member.added`);

        // Step 3: Process projection
        console.log('--- Processing projection ---');
        await processProjection();

        // Step 4: Verify projection was updated
        console.log('--- Verifying projection updated ---');
        await assertMemberInQuery(org.orgID, user.userID, ['ORG_OWNER']);
      });

      it('should support multiple roles', async () => {
        const { org, user } = await createOrgAndUser();

        console.log('\n--- Adding member with multiple roles ---');
        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          {
            userID: user.userID,
            roles: ['ORG_OWNER', 'ORG_USER_MANAGER']
          }
        );

        const event = await ctx.assertEventPublished('org.member.added');
        expect(event.payload!.roles).toHaveLength(2);
        expect(event.payload!.roles).toContain('ORG_OWNER');
        expect(event.payload!.roles).toContain('ORG_USER_MANAGER');

        await processProjection();
        await assertMemberInQuery(org.orgID, user.userID, ['ORG_OWNER', 'ORG_USER_MANAGER']);
      });

      it('should allow SELF_MANAGEMENT_GLOBAL role', async () => {
        const { org, user } = await createOrgAndUser();

        console.log('\n--- Adding member with SELF_MANAGEMENT_GLOBAL role ---');
        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          {
            userID: user.userID,
            roles: ['SELF_MANAGEMENT_GLOBAL']
          }
        );

        const event = await ctx.assertEventPublished('org.member.added');
        expect(event.payload!.roles).toContain('SELF_MANAGEMENT_GLOBAL');

        await processProjection();
        await assertMemberInQuery(org.orgID, user.userID, ['SELF_MANAGEMENT_GLOBAL']);
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

        console.log('\n--- Adding two members to same org ---');
        
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

        // Verify events
        const events = await ctx.getEvents('org', org.orgID);
        const memberEvents = events.filter(
          e => e.eventType === 'org.member.added'
        );
        expect(memberEvents.length).toBe(2);

        // Process projection
        await processProjection();

        // Verify both members in projection
        await assertMemberInQuery(org.orgID, user1.userID, ['ORG_OWNER']);
        await assertMemberInQuery(org.orgID, user2.userID, ['ORG_USER_MANAGER']);
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

      it('should fail with invalid role prefix', async () => {
        const { org, user } = await createOrgAndUser();

        await expect(
          ctx.commands.addOrgMember(ctx.createContext(), org.orgID, {
            userID: user.userID,
            roles: ['INVALID_ROLE'] // Must start with ORG_
          })
        ).rejects.toThrow(/invalid.*role/i);
      });

      it('should fail when adding same member twice', async () => {
        const { org, user } = await createOrgAndUser();

        // Add first time
        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          { userID: user.userID, roles: ['ORG_OWNER'] }
        );

        // Try to add again
        await expect(
          ctx.commands.addOrgMember(
            ctx.createContext(),
            org.orgID,
            { userID: user.userID, roles: ['ORG_USER_MANAGER'] }
          )
        ).rejects.toThrow(/already.*member/i);
      });
    });
  });

  describe('changeOrgMember', () => {
    describe('Success Cases', () => {
      it('should update member roles and projection', async () => {
        const { org, user } = await createOrgAndUser();

        console.log('\n--- Initial: Add member ---');
        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          { userID: user.userID, roles: ['ORG_USER_MANAGER'] }
        );

        await processProjection();
        await assertMemberInQuery(org.orgID, user.userID, ['ORG_USER_MANAGER']);

        console.log('--- Update: Change roles ---');
        const result = await ctx.commands.changeOrgMember(
          ctx.createContext(),
          org.orgID,
          user.userID,
          ['ORG_OWNER', 'ORG_USER_MANAGER']
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('org.member.changed');
        expect(event.payload).toHaveProperty('userId', user.userID);
        expect(event.payload!.roles).toHaveLength(2);

        // Process and verify projection updated
        await processProjection();
        await assertMemberInQuery(org.orgID, user.userID, ['ORG_OWNER', 'ORG_USER_MANAGER']);
      });

      it('should be idempotent when roles unchanged', async () => {
        const { org, user } = await createOrgAndUser();

        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          { userID: user.userID, roles: ['ORG_OWNER'] }
        );

        const eventsBefore = await ctx.getEvents('org', org.orgID);
        const countBefore = eventsBefore.length;

        // Change to same roles
        await ctx.commands.changeOrgMember(
          ctx.createContext(),
          org.orgID,
          user.userID,
          ['ORG_OWNER']
        );

        const eventsAfter = await ctx.getEvents('org', org.orgID);
        const countAfter = eventsAfter.length;

        // Should not create new event
        expect(countAfter).toBe(countBefore);
        console.log('✓ Idempotency verified: no new event created');
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
      it('should remove member and update projection', async () => {
        const { org, user } = await createOrgAndUser();

        console.log('\n--- Add member ---');
        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          { userID: user.userID, roles: ['ORG_OWNER'] }
        );

        await processProjection();
        await assertMemberInQuery(org.orgID, user.userID);

        console.log('--- Remove member ---');
        const result = await ctx.commands.removeOrgMember(
          ctx.createContext(),
          org.orgID,
          user.userID
        );

        expect(result).toBeDefined();

        // Verify event
        await ctx.assertEventPublished('org.member.removed');

        // Process and verify projection updated
        await processProjection();
        await assertMemberNotInQuery(org.orgID, user.userID);
      });

      it('should support cascade removal', async () => {
        const { org, user } = await createOrgAndUser();

        await ctx.commands.addOrgMember(
          ctx.createContext(),
          org.orgID,
          { userID: user.userID, roles: ['ORG_OWNER'] }
        );

        console.log('\n--- Remove member with cascade ---');
        await ctx.commands.removeOrgMember(
          ctx.createContext(),
          org.orgID,
          user.userID,
          true // cascade
        );

        // Verify cascade event type
        const events = await ctx.getEvents('org', org.orgID);
        const cascadeEvents = events.filter(
          e => e.eventType === 'org.member.cascade.removed'
        );
        expect(cascadeEvents.length).toBe(1);

        await processProjection();
        await assertMemberNotInQuery(org.orgID, user.userID);
      });

      it('should be idempotent when member already removed', async () => {
        const { org, user } = await createOrgAndUser();

        // Remove non-existent member - should succeed
        const result = await ctx.commands.removeOrgMember(
          ctx.createContext(),
          org.orgID,
          user.userID
        );

        expect(result).toBeDefined();
        console.log('✓ Idempotency verified: removing non-existent member succeeds');
      });
    });
  });

  describe('Member Lifecycle', () => {
    it('should handle complete lifecycle: add → change → remove', async () => {
      const { org, user } = await createOrgAndUser();

      console.log('\n=== Complete Member Lifecycle ===');

      // Step 1: Add member
      console.log('\n1. ADD MEMBER');
      await ctx.commands.addOrgMember(
        ctx.createContext(),
        org.orgID,
        { userID: user.userID, roles: ['ORG_USER_MANAGER'] }
      );
      await processProjection();
      await assertMemberInQuery(org.orgID, user.userID, ['ORG_USER_MANAGER']);

      // Step 2: Change roles
      console.log('\n2. CHANGE ROLES');
      await ctx.commands.changeOrgMember(
        ctx.createContext(),
        org.orgID,
        user.userID,
        ['ORG_OWNER']
      );
      await processProjection();
      await assertMemberInQuery(org.orgID, user.userID, ['ORG_OWNER']);

      // Step 3: Remove member
      console.log('\n3. REMOVE MEMBER');
      await ctx.commands.removeOrgMember(
        ctx.createContext(),
        org.orgID,
        user.userID
      );
      await processProjection();
      await assertMemberNotInQuery(org.orgID, user.userID);

      // Verify event sequence
      console.log('\n4. VERIFY EVENT SEQUENCE');
      const events = await ctx.getEvents('org', org.orgID);
      const eventTypes = events.map(e => e.eventType);

      expect(eventTypes).toContain('org.member.added');
      expect(eventTypes).toContain('org.member.changed');
      expect(eventTypes).toContain('org.member.removed');

      console.log(`✓ Complete lifecycle verified: ${eventTypes.join(' → ')}`);
    });
  });
});
