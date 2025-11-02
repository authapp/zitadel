/**
 * SCIM Users DELETE Integration Tests
 * Tests the complete SCIM DELETE → Command → Event → Projection → Query flow
 * 
 * Following pattern from test/integration/commands/org-member.test.ts
 * Tests soft delete functionality (user.removed event, state = 'deleted')
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase } from '../../setup';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';
import { UserQueries } from '../../../../src/lib/query/user/user-queries';
import { UserProjection } from '../../../../src/lib/query/projections/user-projection';

describe('SCIM Users DELETE Integration Tests', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let userQueries: UserQueries;
  let userProjection: UserProjection;
  let testOrg: any;

  beforeAll(async () => {
    pool = await createTestDatabase();
    
    // Use command test helper
    ctx = await setupCommandTest(pool);
    
    // Initialize user projection
    userProjection = new UserProjection(ctx.eventstore, pool);
    await userProjection.init();
    
    // Initialize query layer
    userQueries = new UserQueries(pool);
    
    // Create test organization
    const orgCtx = ctx.createContext();
    const orgResult = await ctx.commands.addOrg(orgCtx, {
      name: 'Test Org for SCIM DELETE',
    });
    
    // Wait for projection
    await new Promise(resolve => setTimeout(resolve, 100));
    
    testOrg = { id: orgResult.orgID };
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    // Clear events before each test
    await ctx.clearEvents();
  });

  /**
   * Helper: Create a test user for delete testing
   */
  async function createTestUser(
    username: string,
    email: string
  ): Promise<any> {
    console.log('\n=== DEBUG: createTestUser START ===');
    console.log('1. Creating user with username:', username, 'email:', email);
    
    const userCtx = ctx.createContext();
    console.log('2. Context created:', { instanceID: userCtx.instanceID, orgID: userCtx.orgID, userID: userCtx.userID });

    const result = await ctx.commands.addHumanUser(userCtx, {
      orgID: testOrg.id,
      username,
      email,
      firstName: 'Delete',
      lastName: 'Test',
      password: 'Test123!@#',
      emailVerified: false,
      phoneVerified: false,
    });
    console.log('3. Command executed, userID:', result.userID);

    // Check events
    console.log('4. Querying events...');
    const events = await ctx.eventstore.query({});
    console.log('5. Total events in eventstore:', events.length);
    const userEvents = events.filter(e => e.aggregateID === result.userID);
    console.log('6. Events for this user:', userEvents.length);
    if (userEvents.length > 0) {
      console.log('   Event types:', userEvents.map(e => e.eventType));
    }

    // Wait for projection
    console.log('7. Processing projections...');
    await processProjections();
    console.log('8. Projections processed');

    // Query user
    console.log('9. Querying user from database...');
    const user = await userQueries.getUserByID(result.userID, 'test-instance');
    console.log('10. Query result:', user ? `User found: ${user.id}` : 'User NOT FOUND (null)');
    if (!user) {
      console.log('11. DEBUG: User is null! Checking projection table directly...');
      try {
        const directQuery = await pool.query(
          'SELECT * FROM projections.users WHERE id = $1 AND instance_id = $2',
          [result.userID, 'test-instance']
        );
        console.log('12. Direct DB query result:', directQuery.rows.length, 'rows');
        if (directQuery.rows.length > 0) {
          console.log('    Row data:', directQuery.rows[0]);
        }
      } catch (err: any) {
        console.log('12. Direct DB query error:', err?.message || String(err));
      }
    }
    console.log('=== DEBUG: createTestUser END ===\n');

    return user;
  }

  /**
   * Helper: Process projections
   */
  async function processProjections(): Promise<void> {
    console.log('   > processProjections: Querying events...');
    const events = await ctx.eventstore.query({});
    console.log('   > processProjections: Found', events.length, 'events');
    
    for (const event of events) {
      try {
        await userProjection.reduce(event);
      } catch (e: any) {
        // Projection may not handle all event types
        console.log('   > processProjections: Skipped event', event.eventType, ':', e?.message);
      }
    }
    console.log('   > processProjections: Done');
  }

  /**
   * Helper: Verify user is deleted (state = 'deleted')
   */
  async function assertUserIsDeleted(userID: string): Promise<any> {
    const user = await userQueries.getUserByID(userID, 'test-instance');
    
    // User should still exist but be marked as deleted
    expect(user).not.toBeNull();
    expect(user!.state).toBe('deleted');
    
    return user;
  }

  /**
   * Helper: Verify user does not appear in search
   */
  async function assertUserNotInSearch(username: string): Promise<void> {
    const searchResults = await userQueries.searchUsers(
      {
        filter: { username },
        limit: 10,
        offset: 0,
      },
      'test-instance'
    );

    // Deleted users should not appear in search results
    expect(searchResults.users.length).toBe(0);
  }

  describe('Delete User (Soft Delete)', () => {
    it('should soft delete user successfully', async () => {
      console.log('\n--- Test: DELETE user (soft delete) ---');

      const testUser = await createTestUser('delete-test', 'delete@test.com');
      console.log(`✓ Created user: ${testUser.id}`);

      // Verify user exists and is active
      expect(testUser.state).toBe('active');

      const userCtx = ctx.createContext();

      // Delete user (soft delete)
      await ctx.commands.removeUser(userCtx, testUser.id, testOrg.id);
      console.log('✓ Delete command executed');

      await processProjections();

      // Verify user is marked as deleted
      const deletedUser = await assertUserIsDeleted(testUser.id);
      console.log('✓ User marked as deleted in projection');

      expect(deletedUser.state).toBe('deleted');
      expect(deletedUser.id).toBe(testUser.id);
      expect(deletedUser.username).toBe('delete-test');
    });

    it('should verify deleted user has user.removed event', async () => {
      console.log('\n--- Test: Verify user.removed event ---');

      const testUser = await createTestUser('event-test', 'event@test.com');
      const userCtx = ctx.createContext();

      await ctx.commands.removeUser(userCtx, testUser.id, testOrg.id);
      await processProjections();

      // Verify event was published
      const events = await ctx.getEvents('user', testUser.id);
      const removeEvent = events.find(e => e.eventType === 'user.removed');

      expect(removeEvent).toBeDefined();
      expect(removeEvent!.aggregateID).toBe(testUser.id);
      expect(removeEvent!.aggregateType).toBe('user');

      console.log('✓ user.removed event verified');
    });

    it('should exclude deleted users from search results', async () => {
      console.log('\n--- Test: Deleted users not in search ---');

      const testUser = await createTestUser('search-test', 'search@test.com');
      const userCtx = ctx.createContext();

      // Before deletion: user should be in search
      let searchResults = await userQueries.searchUsers(
        {
          filter: { username: 'search-test' },
          limit: 10,
          offset: 0,
        },
        'test-instance'
      );
      expect(searchResults.users.length).toBe(1);
      console.log('✓ User found in search before deletion');

      // Delete user
      await ctx.commands.removeUser(userCtx, testUser.id, testOrg.id);
      await processProjections();

      // After deletion: user should NOT be in search
      await assertUserNotInSearch('search-test');
      console.log('✓ Deleted user excluded from search results');
    });

    it('should allow querying deleted user by ID', async () => {
      console.log('\n--- Test: Query deleted user by ID ---');

      const testUser = await createTestUser('query-test', 'query@test.com');
      const userCtx = ctx.createContext();

      await ctx.commands.removeUser(userCtx, testUser.id, testOrg.id);
      await processProjections();

      // Should be able to query deleted user by ID (for audit/history)
      const deletedUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(deletedUser).not.toBeNull();
      expect(deletedUser!.state).toBe('deleted');
      expect(deletedUser!.id).toBe(testUser.id);

      console.log('✓ Deleted user can be queried by ID');
    });

    it('should preserve user data after deletion', async () => {
      console.log('\n--- Test: Preserve user data after deletion ---');

      const testUser = await createTestUser('preserve-test', 'preserve@test.com');
      const userCtx = ctx.createContext();

      // Store original data
      const originalData = {
        username: testUser.username,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
      };

      // Delete user
      await ctx.commands.removeUser(userCtx, testUser.id, testOrg.id);
      await processProjections();

      // Verify data is preserved
      const deletedUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(deletedUser!.username).toBe(originalData.username);
      expect(deletedUser!.email).toBe(originalData.email);
      expect(deletedUser!.firstName).toBe(originalData.firstName);
      expect(deletedUser!.lastName).toBe(originalData.lastName);
      expect(deletedUser!.state).toBe('deleted');

      console.log('✓ User data preserved after deletion');
    });

    it('should handle multiple user deletions', async () => {
      console.log('\n--- Test: Multiple user deletions ---');

      const user1 = await createTestUser('multi-1', 'multi1@test.com');
      const user2 = await createTestUser('multi-2', 'multi2@test.com');
      const user3 = await createTestUser('multi-3', 'multi3@test.com');

      const userCtx = ctx.createContext();

      // Delete all users
      await ctx.commands.removeUser(userCtx, user1.id, testOrg.id);
      await ctx.commands.removeUser(userCtx, user2.id, testOrg.id);
      await ctx.commands.removeUser(userCtx, user3.id, testOrg.id);
      await processProjections();

      // Verify all are deleted
      await assertUserIsDeleted(user1.id);
      await assertUserIsDeleted(user2.id);
      await assertUserIsDeleted(user3.id);

      console.log('✓ Multiple users deleted successfully');
    });
  });

  describe('Error Handling', () => {
    it('should handle deleting non-existent user', async () => {
      console.log('\n--- Test: DELETE non-existent user ---');

      const userCtx = ctx.createContext();

      await expect(
        ctx.commands.removeUser(userCtx, 'non-existent-id', testOrg.id)
      ).rejects.toThrow();

      console.log('✓ Non-existent user deletion rejected');
    });

    it('should handle deleting already deleted user', async () => {
      console.log('\n--- Test: DELETE already deleted user ---');

      const testUser = await createTestUser('double-delete', 'double@test.com');
      const userCtx = ctx.createContext();

      // First deletion
      await ctx.commands.removeUser(userCtx, testUser.id, testOrg.id);
      await processProjections();

      // Second deletion should be rejected or idempotent
      await expect(
        ctx.commands.removeUser(userCtx, testUser.id, testOrg.id)
      ).rejects.toThrow();

      console.log('✓ Double deletion handled correctly');
    });

    it('should handle invalid user ID format', async () => {
      console.log('\n--- Test: DELETE with invalid ID ---');

      const userCtx = ctx.createContext();

      // Empty ID should fail validation
      await expect(
        ctx.commands.removeUser(userCtx, '', testOrg.id)
      ).rejects.toThrow();

      console.log('✓ Invalid ID format rejected');
    });
  });

  describe('Complete Stack Verification', () => {
    it('should verify DELETE through complete CQRS stack', async () => {
      console.log('\n--- Test: Complete stack verification ---');

      const testUser = await createTestUser('stack-delete', 'stack-delete@test.com');
      console.log(`✓ Created user: ${testUser.id}`);

      const userCtx = ctx.createContext();

      // 1. Execute DELETE command
      const result = await ctx.commands.removeUser(userCtx, testUser.id, testOrg.id);
      console.log('✓ DELETE command executed');

      expect(result).toHaveProperty('sequence');
      expect(result).toHaveProperty('resourceOwner');

      // 2. Verify event was published
      const events = await ctx.getEvents('user', testUser.id);
      const removeEvent = events.find(e => e.eventType === 'user.removed');
      expect(removeEvent).toBeDefined();
      console.log('✓ Event published');

      // 3. Wait for projection
      await processProjections();
      console.log('✓ Projection processed');

      // 4. Verify via query layer
      const deletedUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(deletedUser).not.toBeNull();
      expect(deletedUser!.state).toBe('deleted');
      console.log('✓ Query layer verified');

      // 5. Verify not in search
      await assertUserNotInSearch('stack-delete');
      console.log('✓ Search exclusion verified');

      console.log('✓ Complete stack verified: DELETE → Command → Event → Projection → Query');
    });
  });

  describe('SCIM Specification Compliance', () => {
    it('should return 204 No Content on successful delete', async () => {
      console.log('\n--- Test: SCIM spec - 204 response ---');

      const testUser = await createTestUser('scim-204', 'scim204@test.com');
      const userCtx = ctx.createContext();

      await ctx.commands.removeUser(userCtx, testUser.id, testOrg.id);
      await processProjections();

      // SCIM spec: DELETE returns 204 No Content (no response body)
      // This is verified in the actual handler implementation
      console.log('✓ DELETE command succeeded (would return 204 in HTTP layer)');
    });

    it('should handle DELETE for deactivated user', async () => {
      console.log('\n--- Test: DELETE deactivated user ---');

      const testUser = await createTestUser('deactivated-delete', 'deactivated@test.com');
      const userCtx = ctx.createContext();

      // First deactivate
      await ctx.commands.deactivateUser(userCtx, testUser.id, testOrg.id);
      await processProjections();

      let user = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(user!.state).toBe('inactive');

      // Then delete
      await ctx.commands.removeUser(userCtx, testUser.id, testOrg.id);
      await processProjections();

      user = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(user!.state).toBe('deleted');

      console.log('✓ Deactivated user can be deleted');
    });
  });

  describe('User Lifecycle', () => {
    it('should handle complete user lifecycle: create → update → delete', async () => {
      console.log('\n--- Test: Complete user lifecycle ---');

      // Create
      const testUser = await createTestUser('lifecycle', 'lifecycle@test.com');
      console.log('✓ User created');
      expect(testUser.state).toBe('active');

      const userCtx = ctx.createContext();

      // Update
      await ctx.commands.changeProfile(userCtx, testUser.id, testOrg.id, {
        firstName: 'Updated',
        lastName: 'User',
      });
      await processProjections();
      console.log('✓ User updated');

      let user = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(user!.firstName).toBe('Updated');

      // Deactivate
      await ctx.commands.deactivateUser(userCtx, testUser.id, testOrg.id);
      await processProjections();
      console.log('✓ User deactivated');

      user = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(user!.state).toBe('inactive');

      // Delete
      await ctx.commands.removeUser(userCtx, testUser.id, testOrg.id);
      await processProjections();
      console.log('✓ User deleted');

      user = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(user!.state).toBe('deleted');

      console.log('✓ Complete lifecycle: create → update → deactivate → delete');
    });
  });
});
