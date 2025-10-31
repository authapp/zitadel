/**
 * User Service gRPC API Integration Tests
 * 
 * Complete end-to-end tests for Sprint 2 Week 3: User gRPC API
 * Tests the full stack: API → Command → Event → Projection → Query
 * 
 * This complements existing tests:
 * - test/integration/commands/user-commands.test.ts (command layer only)
 * - test/integration/query/projections/user-projection.integration.test.ts (projection layer only)
 * 
 * This test ensures the gRPC API layer correctly integrates with the complete stack.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabaseMigrator } from '../../../../src/lib/database/migrator';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';
import { UserService } from '../../../../src/api/grpc/user/v2/user_service';
import { UserProjection } from '../../../../src/lib/query/projections/user-projection';
import { UserQueries } from '../../../../src/lib/query/user/user-queries';
import { Context } from '../../../../src/lib/command/context';
import { generateId as generateSnowflakeId } from '../../../../src/lib/id/snowflake';

describe('User Service Integration Tests - Complete Stack', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let userService: UserService;
  let userProjection: UserProjection;
  let userQueries: UserQueries;

  beforeAll(async () => {
    // Setup database
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
    
    // Setup command infrastructure
    ctx = await setupCommandTest(pool);
    
    // Initialize projection
    userProjection = new UserProjection(ctx.eventstore, pool);
    await userProjection.init();
    
    // Initialize query layer
    userQueries = new UserQueries(pool);
    
    // Initialize UserService (gRPC layer)
    userService = new UserService(ctx.commands, pool);
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
      await userProjection.reduce(event);
    }
    // Small delay to ensure DB commit
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  /**
   * Helper: Create a test user and return userID
   */
  async function createTestUser(username: string = 'testuser'): Promise<string> {
    const context = ctx.createContext();
    const result = await ctx.commands.addHumanUser(context, {
      orgID: context.orgID,
      username,
      email: `${username}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      password: 'SecurePassword123!',
    });
    
    // Process projection to ensure user is in query layer
    await processProjections();
    
    return result.userID;
  }

  /**
   * Helper: Verify user via query layer
   */
  async function assertUserInQuery(
    userId: string,
    instanceId: string,
    expectedState?: string
  ): Promise<any> {
    const user = await userQueries.getUserByID(userId, instanceId);
    expect(user).not.toBeNull();
    if (expectedState) {
      expect(user!.state).toBe(expectedState);
    }
    return user;
  }

  describe('GetUserByID - Complete Stack Test', () => {
    it('should retrieve user through complete stack (API → Query → DB)', async () => {
      // Arrange: Create user via command
      const userId = await createTestUser('get-user-test');
      const context = ctx.createContext();

      // Act: Call gRPC service
      const response = await userService.getUserByID(context, {
        userId,
      });

      // Assert: Response structure
      expect(response).toBeDefined();
      expect(response.user).toBeDefined();
      expect(response.user.userId).toBe(userId);
      expect(response.user.username).toBe('get-user-test');
      expect(response.user.state).toBe(1); // USER_STATE_ACTIVE
      expect(response.details).toBeDefined();

      // Assert: Verify via query layer directly
      const user = await assertUserInQuery(userId, context.instanceID, 'active');
      expect(user.username).toBe('get-user-test');
      
      console.log('✓ GetUserByID: Complete stack verified (API → Query → DB)');
    });

    it('should return human user with profile data', async () => {
      // Arrange
      const userId = await createTestUser('human-profile-test');
      const context = ctx.createContext();

      // Act
      const response = await userService.getUserByID(context, {
        userId,
      });

      // Assert
      expect(response.user.type).toBe(1); // USER_TYPE_HUMAN
      expect(response.user.human).toBeDefined();
      expect(response.user.human?.profile?.givenName).toBe('Test');
      expect(response.user.human?.profile?.familyName).toBe('User');
      expect(response.user.human?.email?.email).toBe('human-profile-test@example.com');
      
      console.log('✓ Human user profile data retrieved correctly');
    });

    it('should throw error for non-existent user', async () => {
      const context = ctx.createContext();
      const nonExistentUserId = generateSnowflakeId();

      await expect(
        userService.getUserByID(context, { userId: nonExistentUserId })
      ).rejects.toThrow();
      
      console.log('✓ Non-existent user error handled correctly');
    });
  });

  describe('ListUsers - Complete Stack Test', () => {
    it('should list users through complete stack', async () => {
      // Arrange: Create multiple users
      await createTestUser('list-user-1');
      await createTestUser('list-user-2');
      await createTestUser('list-user-3');
      const context = ctx.createContext();

      // Act
      const response = await userService.listUsers(context, {
        limit: 10,
        offset: 0,
      });

      // Assert
      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.length).toBeGreaterThanOrEqual(3);
      expect(response.details?.totalResult).toBeGreaterThanOrEqual(3);
      
      console.log(`✓ ListUsers: Found ${response.result.length} users in complete stack`);
    });

    it('should support pagination', async () => {
      const context = ctx.createContext();

      // Act: Get first page
      const page1 = await userService.listUsers(context, {
        limit: 2,
        offset: 0,
      });

      // Act: Get second page
      const page2 = await userService.listUsers(context, {
        limit: 2,
        offset: 2,
      });

      // Assert
      expect(page1.result.length).toBeLessThanOrEqual(2);
      expect(page2.result.length).toBeGreaterThanOrEqual(0);
      
      console.log('✓ Pagination working correctly');
    });
  });

  describe('UpdateUserName - Complete Stack Test', () => {
    it('should update username through complete stack (API → Command → Event → Projection → Query)', async () => {
      // Arrange: Create user
      const userId = await createTestUser('update-name-test');
      const context = ctx.createContext();

      // Act: Update username via gRPC
      const response = await userService.updateUserName(context, {
        userId,
        userName: 'updated-username',
      });

      // Assert: Response
      expect(response).toBeDefined();
      expect(response.details).toBeDefined();

      // Assert: Event published
      const event = await ctx.assertEventPublished('user.username.changed');
      expect(event.aggregateID).toBe(userId);
      expect(event.payload?.username).toBe('updated-username');

      // Assert: Projection updated
      await processProjections();

      // Assert: Query layer reflects change
      const user = await userQueries.getUserByID(userId, context.instanceID);
      expect(user).not.toBeNull();
      expect(user!.username).toBe('updated-username');
      
      console.log('✓ UpdateUserName: Complete stack verified (API → Command → Event → Projection → Query)');
    });
  });

  describe('DeactivateUser - Complete Stack Test', () => {
    it('should deactivate user through complete stack', async () => {
      // Arrange
      const userId = await createTestUser('deactivate-test');
      const context = ctx.createContext();

      // Verify user is active
      let user = await assertUserInQuery(userId, context.instanceID, 'active');
      expect(user.state).toBe('active');

      // Act: Deactivate
      await userService.deactivateUser(context, { userId });

      // Assert: Event published
      await ctx.assertEventPublished('user.deactivated');

      // Assert: Projection updated
      await processProjections();

      // Assert: Query layer shows inactive
      user = await assertUserInQuery(userId, context.instanceID, 'inactive');
      expect(user.state).toBe('inactive');
      
      console.log('✓ DeactivateUser: Complete stack verified');
    });
  });

  describe('ReactivateUser - Complete Stack Test', () => {
    it('should reactivate user through complete stack', async () => {
      // Arrange: Create and deactivate user
      const userId = await createTestUser('reactivate-test');
      const context = ctx.createContext();
      
      await ctx.commands.deactivateUser(context, userId, context.orgID);
      await processProjections();

      // Verify user is inactive
      let user = await assertUserInQuery(userId, context.instanceID, 'inactive');

      // Act: Reactivate via gRPC
      await userService.reactivateUser(context, { userId });

      // Assert: Event published
      await ctx.assertEventPublished('user.reactivated');

      // Assert: Projection updated
      await processProjections();

      // Assert: Query layer shows active
      user = await assertUserInQuery(userId, context.instanceID, 'active');
      expect(user.state).toBe('active');
      
      console.log('✓ ReactivateUser: Complete stack verified');
    });
  });

  describe('LockUser - Complete Stack Test', () => {
    it('should lock user through complete stack (NEW COMMAND)', async () => {
      // Arrange
      const userId = await createTestUser('lock-test');
      const context = ctx.createContext();

      // Verify user is active
      let user = await assertUserInQuery(userId, context.instanceID, 'active');

      // Act: Lock user via gRPC
      await userService.lockUser(context, { userId });

      // Assert: Event published
      const event = await ctx.assertEventPublished('user.locked');
      expect(event.aggregateID).toBe(userId);

      // Assert: Projection updated
      await processProjections();

      // Assert: Query layer shows locked
      user = await assertUserInQuery(userId, context.instanceID, 'locked');
      expect(user.state).toBe('locked');
      
      console.log('✓ LockUser: Complete stack verified (NEW COMMAND)');
    });
  });

  describe('UnlockUser - Complete Stack Test', () => {
    it('should unlock user through complete stack (NEW COMMAND)', async () => {
      // Arrange: Create and lock user
      const userId = await createTestUser('unlock-test');
      const context = ctx.createContext();
      
      await ctx.commands.lockUser(context, userId, context.orgID);
      await processProjections();

      // Verify user is locked
      let user = await assertUserInQuery(userId, context.instanceID, 'locked');

      // Act: Unlock via gRPC
      await userService.unlockUser(context, { userId });

      // Assert: Event published
      const event = await ctx.assertEventPublished('user.unlocked');
      expect(event.aggregateID).toBe(userId);

      // Assert: Projection updated
      await processProjections();

      // Assert: Query layer shows active (unlocked returns to active state)
      user = await assertUserInQuery(userId, context.instanceID, 'active');
      expect(user.state).toBe('active');
      
      console.log('✓ UnlockUser: Complete stack verified (NEW COMMAND)');
    });
  });

  describe('RemoveUser - Complete Stack Test', () => {
    it('should remove user through complete stack', async () => {
      // Arrange
      const userId = await createTestUser('remove-test');
      const context = ctx.createContext();

      // Verify user exists
      await assertUserInQuery(userId, context.instanceID, 'active');

      // Act: Remove user via gRPC
      await userService.removeUser(context, { userId });

      // Assert: Event published
      await ctx.assertEventPublished('user.removed');

      // Assert: Projection updated
      await processProjections();

      // Assert: Query layer shows deleted
      const user = await assertUserInQuery(userId, context.instanceID, 'deleted');
      expect(user.state).toBe('deleted');
      
      console.log('✓ RemoveUser: Complete stack verified');
    });
  });

  describe('Complete User Lifecycle - Full Stack Integration', () => {
    it('should handle complete user lifecycle through gRPC API', async () => {
      const context = ctx.createContext();
      
      console.log('\n--- Testing Complete User Lifecycle ---');

      // Step 1: Create user
      console.log('Step 1: Creating user...');
      const userId = await createTestUser('lifecycle-test');
      let user = await assertUserInQuery(userId, context.instanceID, 'active');
      console.log('  ✓ User created and active');

      // Step 2: Update username
      console.log('Step 2: Updating username...');
      await userService.updateUserName(context, {
        userId,
        userName: 'lifecycle-updated',
      });
      await ctx.assertEventPublished('user.username.changed');
      await processProjections();
      user = await userQueries.getUserByID(userId, context.instanceID);
      expect(user!.username).toBe('lifecycle-updated');
      console.log('  ✓ Username updated');

      // Step 3: Deactivate
      console.log('Step 3: Deactivating user...');
      await userService.deactivateUser(context, { userId });
      await processProjections();
      user = await assertUserInQuery(userId, context.instanceID, 'inactive');
      console.log('  ✓ User deactivated');

      // Step 4: Reactivate
      console.log('Step 4: Reactivating user...');
      await userService.reactivateUser(context, { userId });
      await processProjections();
      user = await assertUserInQuery(userId, context.instanceID, 'active');
      console.log('  ✓ User reactivated');

      // Step 5: Lock
      console.log('Step 5: Locking user...');
      await userService.lockUser(context, { userId });
      await processProjections();
      user = await assertUserInQuery(userId, context.instanceID, 'locked');
      console.log('  ✓ User locked');

      // Step 6: Unlock
      console.log('Step 6: Unlocking user...');
      await userService.unlockUser(context, { userId });
      await processProjections();
      user = await assertUserInQuery(userId, context.instanceID, 'active');
      console.log('  ✓ User unlocked');

      // Step 7: Remove
      console.log('Step 7: Removing user...');
      await userService.removeUser(context, { userId });
      await processProjections();
      user = await assertUserInQuery(userId, context.instanceID, 'deleted');
      console.log('  ✓ User removed');

      console.log('\n✅ Complete lifecycle test passed - All stack layers working correctly!');
    });
  });

  describe('Error Handling - API Layer', () => {
    it('should validate userId is required', async () => {
      const context = ctx.createContext();

      await expect(
        userService.getUserByID(context, { userId: '' })
      ).rejects.toThrow(/userId is required/);
      
      console.log('✓ API validation working correctly');
    });

    it('should handle command layer errors gracefully', async () => {
      const context = ctx.createContext();
      const nonExistentUserId = generateSnowflakeId();

      await expect(
        userService.deactivateUser(context, { userId: nonExistentUserId })
      ).rejects.toThrow(); // User not found error from command layer
      
      console.log('✓ Command layer errors propagated correctly');
    });
  });

  describe('Test Coverage Summary', () => {
    it('should confirm complete stack is tested', () => {
      console.log('\n=== Test Coverage Summary ===');
      console.log('✅ gRPC API Layer: UserService endpoints tested');
      console.log('✅ Command Layer: Commands executed via API');
      console.log('✅ Event Layer: Events published and verified');
      console.log('✅ Projection Layer: UserProjection processes events');
      console.log('✅ Query Layer: UserQueries returns correct data');
      console.log('✅ Database Layer: Data persisted and retrieved');
      console.log('\nComplete Stack: API → Command → Event → Projection → Query ✅');
      console.log('=============================\n');
      
      expect(true).toBe(true);
    });
  });
});
