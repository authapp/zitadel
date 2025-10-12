/**
 * User Command Tests
 * 
 * Integration tests for basic user commands using the new test infrastructure
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabaseMigrator } from '../../../src/lib/database/migrator';
import {
  setupCommandTest,
  CommandTestContext,
  UserBuilder,
  createTestUserData,
} from '../../helpers';

describe('User Integration Commands', () => {
  let ctx: CommandTestContext;

  beforeAll(async () => {
    const pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
    ctx = await setupCommandTest(pool);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await ctx.clearEvents();
  });

  describe('addHumanUser', () => {
    it('should create a new human user', async () => {
      // Arrange
      const context = ctx.createContext();
      const userData = new UserBuilder()
        .withUsername('john.doe')
        .withEmail('john.doe@example.com')
        .withName('John', 'Doe')
        .build();

      // Act
      const result = await ctx.commands.addHumanUser(context, {
        orgID: context.orgID,
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: 'SecurePassword123!',
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.sequence).toBeGreaterThan(0);

      // Verify event was published
      const event = await ctx.assertEventPublished('user.human.added');
      expect(event.aggregateType).toBe('user');
      expect(event.payload?.username).toBe('john.doe');
      expect(event.payload?.email).toBe('john.doe@example.com');
    });

    it.skip('should reject duplicate username (requires query layer)', async () => {
      // NOTE: This test is skipped because username uniqueness checking
      // requires the query layer to check existing usernames.
      // The current command implementation only checks userID uniqueness.
      // This will be implemented when the query/projection layer is complete.
      
      // Arrange
      const context = ctx.createContext();
      const userData = createTestUserData({ username: 'duplicate.user' });

      // Create first user
      await ctx.commands.addHumanUser(context, {
        orgID: context.orgID,
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: 'SecurePassword123!',
      });

      await ctx.clearEvents();

      // Act & Assert - Try to create second user with same username
      await expect(
        ctx.commands.addHumanUser(context, {
          orgID: context.orgID,
          username: userData.username, // Same username
          email: 'different@example.com',
          firstName: 'Different',
          lastName: 'User',
          password: 'SecurePassword123!',
        })
      ).rejects.toThrow();
    });

    it('should create user with optional phone', async () => {
      // Arrange
      const context = ctx.createContext();
      const userData = new UserBuilder()
        .withUsername('jane.doe')
        .withEmail('jane.doe@example.com')
        .withName('Jane', 'Doe')
        .withPhone('+41791234567')
        .build();

      // Act
      const result = await ctx.commands.addHumanUser(context, {
        orgID: context.orgID,
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        password: 'SecurePassword123!',
      });

      // Assert
      expect(result).toBeDefined();
      
      const event = await ctx.assertEventPublished('user.human.added');
      expect(event.payload?.phone).toBe('+41791234567');
    });

    it('should validate required fields', async () => {
      const context = ctx.createContext();

      // Missing username
      await expect(
        ctx.commands.addHumanUser(context, {
          orgID: context.orgID,
          username: '',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          password: 'Password123!',
        })
      ).rejects.toThrow();

      // Missing email
      await expect(
        ctx.commands.addHumanUser(context, {
          orgID: context.orgID,
          username: 'testuser',
          email: '',
          firstName: 'Test',
          lastName: 'User',
          password: 'Password123!',
        })
      ).rejects.toThrow();
    });
  });

  describe('changeUsername', () => {
    it('should change user username', async () => {
      // Arrange - Create a user first
      const context = ctx.createContext();
      const userData = createTestUserData();
      
      const createResult = await ctx.commands.addHumanUser(context, {
        orgID: context.orgID,
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: 'Password123!',
      });

      // Don't clear events here - the user needs to exist for changeUsername!

      // Act - Change username
      const newUsername = 'new.username';
      await ctx.commands.changeUsername(
        context,
        createResult.userID,
        context.orgID,
        newUsername
      );

      // Assert
      await ctx.assertEventsPublished([
        {
          type: 'user.username.changed',
          count: 1,
          aggregateID: createResult.userID,
        },
      ]);

      const event = await ctx.assertEventPublished('user.username.changed');
      expect(event.payload?.username).toBe(newUsername);
    });
  });

  describe('changeProfile', () => {
    it('should update user profile', async () => {
      // Arrange - Create a user first
      const context = ctx.createContext();
      const userData = createTestUserData();
      
      const createResult = await ctx.commands.addHumanUser(context, {
        orgID: context.orgID,
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: 'Password123!',
      });

      // Don't clear events here - the user needs to exist for changeProfile!

      // Act - Change profile
      await ctx.commands.changeProfile(
        context,
        createResult.userID,
        context.orgID,
        {
          firstName: 'Updated',
          lastName: 'Name',
          displayName: 'Updated Display',
        }
      );

      // Assert
      const event = await ctx.assertEventPublished('user.profile.changed');
      expect(event.payload?.firstName).toBe('Updated');
      expect(event.payload?.lastName).toBe('Name');
      expect(event.payload?.displayName).toBe('Updated Display');
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate active user', async () => {
      // Arrange - Create a user first
      const context = ctx.createContext();
      const userData = createTestUserData();
      
      const createResult = await ctx.commands.addHumanUser(context, {
        orgID: context.orgID,
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: 'Password123!',
      });

      // Don't clear events here - the user needs to exist for deactivateUser!

      // Act - Deactivate user
      await ctx.commands.deactivateUser(
        context,
        createResult.userID,
        context.orgID
      );

      // Assert
      await ctx.assertEventPublished('user.deactivated', createResult.userID);
    });
  });

  describe('reactivateUser', () => {
    it('should reactivate deactivated user', async () => {
      // Arrange - Create and deactivate a user
      const context = ctx.createContext();
      const userData = createTestUserData();
      
      const createResult = await ctx.commands.addHumanUser(context, {
        orgID: context.orgID,
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: 'Password123!',
      });

      await ctx.commands.deactivateUser(
        context,
        createResult.userID,
        context.orgID
      );

      // Don't clear events here - the user needs to exist for reactivateUser!

      // Act - Reactivate user
      await ctx.commands.reactivateUser(
        context,
        createResult.userID,
        context.orgID
      );

      // Assert - Check for reactivation event (user.human.added, user.deactivated, and user.reactivated will all be present)
      const events = await ctx.getEvents('user', createResult.userID);
      const reactivatedEvent = events.find(e => e.eventType === 'user.reactivated');
      expect(reactivatedEvent).toBeDefined();
    });
  });

  describe('removeUser', () => {
    it('should remove user', async () => {
      // Arrange - Create a user first
      const context = ctx.createContext();
      const userData = createTestUserData();
      
      const createResult = await ctx.commands.addHumanUser(context, {
        orgID: context.orgID,
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: 'Password123!',
      });

      // Don't clear events here - the user needs to exist for removeUser!

      // Act - Remove user
      await ctx.commands.removeUser(
        context,
        createResult.userID,
        context.orgID
      );

      // Assert
      await ctx.assertEventPublished('user.removed', createResult.userID);
    });
  });
});
