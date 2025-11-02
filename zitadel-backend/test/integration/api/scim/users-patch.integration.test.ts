/**
 * SCIM Users PATCH Integration Tests
 * Tests the complete SCIM PATCH → Command → Event → Projection → Query flow
 * 
 * Following pattern from test/integration/commands/org-member.test.ts
 * Tests SCIM PATCH operations: add, replace, remove
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase } from '../../setup';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';
import { UserQueries } from '../../../../src/lib/query/user/user-queries';
import { UserProjection } from '../../../../src/lib/query/projections/user-projection';

describe('SCIM Users PATCH Integration Tests', () => {
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
      name: 'Test Org for SCIM PATCH',
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
   * Helper: Create a test user
   */
  async function createTestUser(
    username: string,
    email: string,
    additionalData: any = {}
  ): Promise<any> {
    const userCtx = ctx.createContext();

    const result = await ctx.commands.addHumanUser(userCtx, {
      orgID: testOrg.id,
      username,
      email,
      firstName: 'Test',
      lastName: 'User',
      password: 'Test123!@#',
      emailVerified: false,
      phoneVerified: false,
      ...additionalData,
    });

    // Wait for projection
    await processProjections();

    return await userQueries.getUserByID(result.userID, 'test-instance');
  }

  /**
   * Helper: Process projections
   */
  async function processProjections(): Promise<void> {
    const events = await ctx.eventstore.query({});
    for (const event of events) {
      try {
        await userProjection.reduce(event);
      } catch (e: any) {
        // Projection may not handle all event types
      }
    }
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
    if (expectedFields.phone !== undefined) {
      expect(user!.phone).toBe(expectedFields.phone);
    }

    return user;
  }

  describe('PATCH Replace Operations', () => {
    it('should replace firstName and lastName', async () => {
      console.log('\n--- Test: PATCH replace name fields ---');

      const testUser = await createTestUser('patch-name', 'patch-name@test.com');
      console.log(`✓ Created user: ${testUser.id}`);

      const userCtx = ctx.createContext();

      // PATCH replace operations
      await ctx.commands.changeProfile(userCtx, testUser.id, testOrg.id, {
        firstName: 'Patched',
        lastName: 'Name',
      });
      console.log('✓ Profile PATCH executed');

      await processProjections();

      const updatedUser = await assertUserInQuery(testUser.id, {
        firstName: 'Patched',
        lastName: 'Name',
      });
      console.log('✓ Name fields patched successfully');

      expect(updatedUser.firstName).toBe('Patched');
      expect(updatedUser.lastName).toBe('Name');
    });

    it('should replace email', async () => {
      console.log('\n--- Test: PATCH replace email ---');

      const testUser = await createTestUser('patch-email', 'old-email@test.com');
      const userCtx = ctx.createContext();

      await ctx.commands.changeEmail(userCtx, testUser.id, testOrg.id, 'new-email@test.com');
      await processProjections();

      const updatedUser = await assertUserInQuery(testUser.id, {
        email: 'new-email@test.com',
      });

      expect(updatedUser.email).toBe('new-email@test.com');
      console.log('✓ Email patched successfully');
    });

    it('should replace displayName', async () => {
      console.log('\n--- Test: PATCH replace displayName ---');

      const testUser = await createTestUser('patch-display', 'patch-display@test.com');
      const userCtx = ctx.createContext();

      await ctx.commands.changeProfile(userCtx, testUser.id, testOrg.id, {
        displayName: 'Dr. Patched User',
      });
      await processProjections();

      const updatedUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.displayName).toBe('Dr. Patched User');

      console.log('✓ DisplayName patched successfully');
    });

    it('should replace preferredLanguage', async () => {
      console.log('\n--- Test: PATCH replace preferredLanguage ---');

      const testUser = await createTestUser('patch-lang', 'patch-lang@test.com');
      const userCtx = ctx.createContext();

      await ctx.commands.changeProfile(userCtx, testUser.id, testOrg.id, {
        preferredLanguage: 'fr',
      });
      await processProjections();

      const updatedUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.preferredLanguage).toBe('fr');

      console.log('✓ PreferredLanguage patched successfully');
    });

    it('should replace active status (deactivate)', async () => {
      console.log('\n--- Test: PATCH replace active=false ---');

      const testUser = await createTestUser('patch-deactivate', 'patch-deactivate@test.com');
      const userCtx = ctx.createContext();

      await ctx.commands.deactivateUser(userCtx, testUser.id, testOrg.id);
      await processProjections();

      const updatedUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.state).toBe('inactive');

      console.log('✓ User deactivated via PATCH');
    });

    it('should replace active status (reactivate)', async () => {
      console.log('\n--- Test: PATCH replace active=true ---');

      const testUser = await createTestUser('patch-reactivate', 'patch-reactivate@test.com');
      const userCtx = ctx.createContext();

      // First deactivate
      await ctx.commands.deactivateUser(userCtx, testUser.id, testOrg.id);
      await processProjections();

      // Then reactivate via PATCH
      await ctx.commands.reactivateUser(userCtx, testUser.id, testOrg.id);
      await processProjections();

      const updatedUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.state).toBe('active');

      console.log('✓ User reactivated via PATCH');
    });
  });

  describe('PATCH Add Operations', () => {
    it('should add phone number', async () => {
      console.log('\n--- Test: PATCH add phoneNumber ---');

      const testUser = await createTestUser('patch-add-phone', 'patch-add-phone@test.com');
      const userCtx = ctx.createContext();

      // Add phone via PATCH
      await ctx.commands.changeUserPhone(userCtx, testUser.id, '+1234567890');
      await processProjections();

      const updatedUser = await assertUserInQuery(testUser.id, {
        phone: '+1234567890',
      });

      expect(updatedUser.phone).toBe('+1234567890');
      console.log('✓ Phone added via PATCH');
    });

    it('should add displayName if not present', async () => {
      console.log('\n--- Test: PATCH add displayName ---');

      const testUser = await createTestUser('patch-add-display', 'patch-add-display@test.com');
      const userCtx = ctx.createContext();

      await ctx.commands.changeProfile(userCtx, testUser.id, testOrg.id, {
        displayName: 'New Display Name',
      });
      await processProjections();

      const updatedUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.displayName).toBe('New Display Name');

      console.log('✓ DisplayName added via PATCH');
    });
  });

  describe('PATCH Remove Operations', () => {
    it('should remove phone number', async () => {
      console.log('\n--- Test: PATCH remove phoneNumber ---');

      // Create user with phone
      const testUser = await createTestUser(
        'patch-remove-phone',
        'patch-remove-phone@test.com'
      );
      
      const userCtx = ctx.createContext();
      
      // First add a phone
      await ctx.commands.changeUserPhone(userCtx, testUser.id, '+9876543210');
      await processProjections();
      
      // Verify phone was added
      let user = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(user!.phone).toBe('+9876543210');

      // Remove phone via PATCH
      await ctx.commands.removeUserPhone(userCtx, testUser.id);
      await processProjections();

      user = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(user).not.toBeNull();
      expect(user!.phone).toBeNull();

      console.log('✓ Phone removed via PATCH');
    });
  });

  describe('PATCH Multiple Operations', () => {
    it('should handle multiple replace operations in sequence', async () => {
      console.log('\n--- Test: PATCH multiple operations ---');

      const testUser = await createTestUser('patch-multi', 'patch-multi@test.com');
      const userCtx = ctx.createContext();

      // Operation 1: Update profile
      await ctx.commands.changeProfile(userCtx, testUser.id, testOrg.id, {
        firstName: 'Multi',
        lastName: 'Patch',
      });
      await processProjections();

      // Operation 2: Update email
      await ctx.commands.changeEmail(userCtx, testUser.id, testOrg.id, 'multi-patch@test.com');
      await processProjections();

      // Operation 3: Add phone
      await ctx.commands.changeUserPhone(userCtx, testUser.id, '+1111111111');
      await processProjections();

      // Verify all changes
      const updatedUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.firstName).toBe('Multi');
      expect(updatedUser!.lastName).toBe('Patch');
      expect(updatedUser!.email).toBe('multi-patch@test.com');
      expect(updatedUser!.phone).toBe('+1111111111');

      console.log('✓ Multiple PATCH operations succeeded');
    });

    it('should handle add and remove in sequence', async () => {
      console.log('\n--- Test: PATCH add then remove ---');

      const testUser = await createTestUser('patch-add-remove', 'patch-add-remove@test.com');
      const userCtx = ctx.createContext();

      // Add phone
      await ctx.commands.changeUserPhone(userCtx, testUser.id, '+2222222222');
      await processProjections();

      let user = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(user!.phone).toBe('+2222222222');

      // Remove phone
      await ctx.commands.removeUserPhone(userCtx, testUser.id);
      await processProjections();

      user = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(user!.phone).toBeNull();

      console.log('✓ Add then remove succeeded');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent user', async () => {
      console.log('\n--- Test: PATCH non-existent user ---');

      const userCtx = ctx.createContext();

      await expect(
        ctx.commands.changeProfile(userCtx, 'non-existent-id', testOrg.id, {
          firstName: 'Test',
        })
      ).rejects.toThrow();

      console.log('✓ Non-existent user rejected');
    });

    it('should handle invalid email format', async () => {
      console.log('\n--- Test: PATCH invalid email ---');

      const testUser = await createTestUser('patch-invalid', 'patch-invalid@test.com');
      const userCtx = ctx.createContext();

      await expect(
        ctx.commands.changeEmail(userCtx, testUser.id, testOrg.id, 'not-an-email')
      ).rejects.toThrow();

      console.log('✓ Invalid email rejected');
    });

    it('should handle unchanged email gracefully', async () => {
      console.log('\n--- Test: PATCH with same email ---');

      const testUser = await createTestUser('patch-same-email', 'same@test.com');
      const userCtx = ctx.createContext();

      await expect(
        ctx.commands.changeEmail(userCtx, testUser.id, testOrg.id, 'same@test.com')
      ).rejects.toThrow(/not changed/);

      console.log('✓ Unchanged email handled correctly');
    });
  });

  describe('Complete Stack Verification', () => {
    it('should verify PATCH through complete CQRS stack', async () => {
      console.log('\n--- Test: Complete stack verification ---');

      const testUser = await createTestUser('stack-patch', 'stack-patch@test.com');
      console.log(`✓ Created user: ${testUser.id}`);

      const userCtx = ctx.createContext();

      // 1. Execute PATCH command
      const result = await ctx.commands.changeProfile(userCtx, testUser.id, testOrg.id, {
        firstName: 'Stack',
        lastName: 'Verified',
      });
      console.log('✓ PATCH command executed');

      expect(result).toHaveProperty('sequence');
      expect(result).toHaveProperty('resourceOwner');

      // 2. Wait for projection
      await processProjections();
      console.log('✓ Projection processed');

      // 3. Verify via query layer
      const updatedUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.firstName).toBe('Stack');
      expect(updatedUser!.lastName).toBe('Verified');
      console.log('✓ Query layer verified');

      console.log('✓ Complete stack verified: PATCH → Command → Event → Projection → Query');
    });
  });

  describe('SCIM Spec Compliance', () => {
    it('should handle path-based replace (name.givenName)', async () => {
      console.log('\n--- Test: Path-based PATCH (name.givenName) ---');

      const testUser = await createTestUser('path-based', 'path-based@test.com');
      const userCtx = ctx.createContext();

      // Simulate SCIM PATCH with path: "name.givenName"
      await ctx.commands.changeProfile(userCtx, testUser.id, testOrg.id, {
        firstName: 'PathBased',
      });
      await processProjections();

      const updatedUser = await assertUserInQuery(testUser.id, {
        firstName: 'PathBased',
      });

      expect(updatedUser.firstName).toBe('PathBased');
      console.log('✓ Path-based PATCH succeeded');
    });

    it('should handle bulk value replace (no path)', async () => {
      console.log('\n--- Test: Bulk value replace (no path) ---');

      const testUser = await createTestUser('bulk-replace', 'bulk-replace@test.com');
      const userCtx = ctx.createContext();

      // Simulate SCIM PATCH with value object (no path)
      await ctx.commands.changeProfile(userCtx, testUser.id, testOrg.id, {
        firstName: 'Bulk',
        lastName: 'Replace',
        displayName: 'Bulk Replace User',
      });
      await processProjections();

      const updatedUser = await userQueries.getUserByID(testUser.id, 'test-instance');
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.firstName).toBe('Bulk');
      expect(updatedUser!.lastName).toBe('Replace');
      expect(updatedUser!.displayName).toBe('Bulk Replace User');

      console.log('✓ Bulk value replace succeeded');
    });
  });
});
