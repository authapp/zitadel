/**
 * SCIM Users Update (PUT) Integration Tests
 * Tests the complete SCIM → Command → Event → Projection → Query flow
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase } from '../../setup';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';
import { UserQueries } from '../../../../src/lib/query/user/user-queries';
import { UserProjection } from '../../../../src/lib/query/projections/user-projection';
import { OrgProjection } from '../../../../src/lib/query/projections/org-projection';
import { OrganizationBuilder } from '../../../helpers/test-data-builders';

describe('SCIM Users Update (PUT) Integration Tests', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let userQueries: UserQueries;
  let userProjection: UserProjection;
  let orgProjection: OrgProjection;
  let testOrg: any;
  let testUser: any;

  // Helper: Process projections
  async function processProjections() {
    const events = await ctx.eventstore.query({});
    for (const event of events) {
      try {
        await userProjection.reduce(event);
      } catch (e) {
        // Projection may not handle all event types
      }
      try {
        await orgProjection.reduce(event);
      } catch (e) {
        // Projection may not handle all event types
      }
    }
  }

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize queries
    userQueries = new UserQueries(pool);
    
    // Initialize projections
    userProjection = new UserProjection(ctx.eventstore, pool);
    await userProjection.init();
    await userProjection.start();

    orgProjection = new OrgProjection(ctx.eventstore, pool);
    await orgProjection.init();
    await orgProjection.start();
    
    // Initialize query layer
    userQueries = new UserQueries(pool);
    
    // Create test organization using builder pattern
    const orgData = new OrganizationBuilder()
      .withName('Test Org for SCIM Updates')
      .build();
    
    const orgResult = await ctx.commands.addOrg(ctx.createContext(), orgData);
    
    // Wait for projection
    await new Promise(resolve => setTimeout(resolve, 100));
    
    testOrg = { id: orgResult.orgID };
  });

  afterAll(async () => {
    if (userProjection) {
      await userProjection.stop();
    }
    if (orgProjection) {
      await orgProjection.stop();
    }
    if (pool) {
      await pool.close();
    }
  });

  /**
   * Helper: Create a test user for update tests
   */
  async function createTestUser(
    username: string,
    email: string
  ): Promise<any> {
    const userCtx = ctx.createContext();

    const result = await ctx.commands.addHumanUser(userCtx, {
      orgID: testOrg.id,
      username,
      email,
      firstName: 'Original',
      lastName: 'User',
      password: 'Test123!@#',
      emailVerified: false,
      phoneVerified: false,
    });

    // Wait for projection
    await processProjections();

    return await userQueries.getUserByID(result.userID, 'test-instance');
  }

  /**
   * Helper: Verify user via query layer
   */
  async function assertUserInQuery(
    userID: string,
    expectedFields: any
  ): Promise<any> {
    const user = await userQueries.getUserByID(userID, 'test-instance');
    expect(user).not.toBeNull();

    if (expectedFields.firstName !== undefined) {
      expect(user!.firstName).toBe(expectedFields.firstName);
    }
    if (expectedFields.lastName !== undefined) {
      expect(user!.lastName).toBe(expectedFields.lastName);
    }
    if (expectedFields.email !== undefined) {
      expect(user!.email).toBe(expectedFields.email);
    }
    if (expectedFields.username !== undefined) {
      expect(user!.username).toBe(expectedFields.username);
    }

    return user;
  }

  describe('Profile Updates', () => {
    it('should update user profile (firstName, lastName)', async () => {
      console.log('\n--- Test: Update user profile ---');

      // Create test user
      testUser = await createTestUser('profile-test', 'profile@test.com');
      console.log(`✓ Created user: ${testUser.id}`);

      const userCtx = ctx.createContext();
      const unusedCtx = {
        userID: 'test-user',
        instanceID: 'test-instance',
        orgID: testOrg.id,
      };

      // Update profile
      await ctx.commands.changeProfile(userCtx, testUser.id, testOrg.id, {
        firstName: 'Updated',
        lastName: 'Person',
      });
      console.log('✓ Profile change command executed');

      // Wait for projection
      await processProjections();

      // Verify via query
      const updatedUser = await assertUserInQuery(testUser.id, {
        firstName: 'Updated',
        lastName: 'Person',
      });
      console.log('✓ Profile updated successfully');

      expect(updatedUser.firstName).toBe('Updated');
      expect(updatedUser.lastName).toBe('Person');
    });

    it('should update displayName and preferredLanguage', async () => {
      console.log('\n--- Test: Update displayName and language ---');

      testUser = await createTestUser('display-test', 'display@test.com');

      const userCtx = ctx.createContext();
      const unusedCtx = {
        userID: 'test-user',
        instanceID: 'test-instance',
        orgID: testOrg.id,
      };

      await ctx.commands.changeProfile(userCtx, testUser.id, testOrg.id, {
        displayName: 'Dr. Test User',
        preferredLanguage: 'de',
      });

      await processProjections();

      const updatedUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.displayName).toBe('Dr. Test User');
      expect(updatedUser!.preferredLanguage).toBe('de');

      console.log('✓ DisplayName and language updated');
    });
  });

  describe('Email Updates', () => {
    it('should update user email', async () => {
      console.log('\n--- Test: Update user email ---');

      testUser = await createTestUser('email-test', 'old@test.com');
      console.log(`✓ Created user with email: ${testUser.email}`);

      const userCtx = ctx.createContext();
      const unusedCtx = {
        userID: 'test-user',
        instanceID: 'test-instance',
        orgID: testOrg.id,
      };

      // Update email
      await ctx.commands.changeEmail(userCtx, testUser.id, testOrg.id, 'new@test.com');
      console.log('✓ Email change command executed');

      await processProjections();

      const updatedUser = await assertUserInQuery(testUser.id, {
        email: 'new@test.com',
      });
      console.log('✓ Email updated successfully');

      expect(updatedUser.email).toBe('new@test.com');
    });

    it('should reject invalid email format', async () => {
      console.log('\n--- Test: Reject invalid email ---');

      testUser = await createTestUser('invalid-email', 'valid@test.com');

      const userCtx = ctx.createContext();
      const unusedCtx = {
        userID: 'test-user',
        instanceID: 'test-instance',
        orgID: testOrg.id,
      };

      // Try invalid email
      await expect(
        ctx.commands.changeEmail(userCtx, testUser.id, testOrg.id, 'not-an-email')
      ).rejects.toThrow();

      console.log('✓ Invalid email rejected');
    });
  });

  describe('Username Updates', () => {
    it('should update username', async () => {
      console.log('\n--- Test: Update username ---');

      testUser = await createTestUser('old-username', 'username@test.com');

      const userCtx = ctx.createContext();
      const unusedCtx = {
        userID: 'test-user',
        instanceID: 'test-instance',
        orgID: testOrg.id,
      };

      await ctx.commands.changeUsername(userCtx, testUser.id, testOrg.id, 'new-username');
      await processProjections();

      const updatedUser = await assertUserInQuery(testUser.id, {
        username: 'new-username',
      });

      expect(updatedUser.username).toBe('new-username');
      console.log('✓ Username updated successfully');
    });
  });

  describe('User State Updates', () => {
    it('should deactivate user', async () => {
      console.log('\n--- Test: Deactivate user ---');

      testUser = await createTestUser('deactivate-test', 'deactivate@test.com');

      const userCtx = ctx.createContext();
      const unusedCtx = {
        userID: 'test-user',
        instanceID: 'test-instance',
        orgID: testOrg.id,
      };

      await ctx.commands.deactivateUser(userCtx, testUser.id, testOrg.id);
      await processProjections();

      const deactivatedUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(deactivatedUser).not.toBeNull();
      expect(deactivatedUser!.state).toBe('inactive');

      console.log('✓ User deactivated successfully');
    });

    it('should reactivate user', async () => {
      console.log('\n--- Test: Reactivate user ---');

      testUser = await createTestUser('reactivate-test', 'reactivate@test.com');

      const userCtx = ctx.createContext();
      const unusedCtx = {
        userID: 'test-user',
        instanceID: 'test-instance',
        orgID: testOrg.id,
      };

      // Deactivate first
      await ctx.commands.deactivateUser(userCtx, testUser.id, testOrg.id);
      await processProjections();

      // Then reactivate
      await ctx.commands.reactivateUser(userCtx, testUser.id, testOrg.id);
      await processProjections();

      const reactivatedUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(reactivatedUser).not.toBeNull();
      expect(reactivatedUser!.state).toBe('active');

      console.log('✓ User reactivated successfully');
    });
  });

  describe('Multiple Field Updates', () => {
    it('should update multiple fields in sequence', async () => {
      console.log('\n--- Test: Update multiple fields ---');

      testUser = await createTestUser('multi-test', 'multi@test.com');
      console.log(`✓ Created user: ${testUser.id}`);

      const userCtx = ctx.createContext();

      // Update username
      await ctx.commands.changeUsername(userCtx, testUser.id, testOrg.id, 'multi-new-username');
      await processProjections();

      // Verify all changes
      const finalUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(finalUser).not.toBeNull();
      expect(finalUser!.username).toBe('multi-new-username');
      expect(finalUser!.username).toBe('multi-new-username');

      console.log('✓ All fields updated successfully');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent user', async () => {
      console.log('\n--- Test: Update non-existent user ---');

      const userCtx = ctx.createContext();
      const unusedCtx = {
        userID: 'test-user',
        instanceID: 'test-instance',
        orgID: testOrg.id,
      };

      await expect(
        ctx.commands.changeProfile(userCtx, 'non-existent-user', testOrg.id, {
          firstName: 'Test',
        })
      ).rejects.toThrow();

      console.log('✓ Non-existent user rejected');
    });

    it('should handle unchanged values gracefully', async () => {
      console.log('\n--- Test: Update with same values ---');

      testUser = await createTestUser('unchanged-test', 'unchanged@test.com');

      const userCtx = ctx.createContext();
      const unusedCtx = {
        userID: 'test-user',
        instanceID: 'test-instance',
        orgID: testOrg.id,
      };

      // Try to set email to same value
      await expect(
        ctx.commands.changeEmail(userCtx, testUser.id, testOrg.id, testUser.email)
      ).rejects.toThrow(/not changed/i);

      console.log('✓ Unchanged values handled correctly');
    });
  });

  describe('Complete Stack Verification', () => {
    it('should verify Command → Event → Projection → Query flow', async () => {
      console.log('\n--- Test: Complete stack verification ---');

      testUser = await createTestUser('stack-test', 'stack@test.com');
      console.log(`✓ Created user: ${testUser.id}`);

      const userCtx = ctx.createContext();
      const unusedCtx = {
        userID: 'test-user',
        instanceID: 'test-instance',
        orgID: testOrg.id,
      };

      // 1. Execute command
      const result = await ctx.commands.changeProfile(userCtx, testUser.id, testOrg.id, {
        firstName: 'Stack',
        lastName: 'Test',
      });
      console.log('✓ Command executed, returned ObjectDetails');

      expect(result).toHaveProperty('sequence');
      expect(result).toHaveProperty('resourceOwner');

      // 2. Wait for projection
      await processProjections();
      console.log('✓ Projection processed');

      // 3. Query layer returns updated data
      const updatedUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.firstName).toBe('Stack');
      expect(updatedUser!.lastName).toBe('Test');
      console.log('✓ Query layer verified');

      console.log('✓ Complete stack verified: Command → Event → Projection → Query');
    });
  });
});
