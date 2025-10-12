/**
 * User Metadata Command Tests
 * 
 * Tests for user key-value metadata storage:
 * - Set single metadata
 * - Bulk set multiple metadata
 * - Remove single metadata
 * - Bulk remove multiple metadata
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabaseMigrator } from '../../../src/lib/database/migrator';
import {
  setupCommandTest,
  CommandTestContext,
  UserBuilder,
} from '../../helpers';

describe('User Metadata Commands', () => {
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

  // Helper to create a test user
  async function createTestUser() {
    const userData = new UserBuilder()
      .withUsername(`testuser.${Date.now()}`)
      .withEmail(`test.${Date.now()}@example.com`)
      .withName('Test', 'User')
      .build();

    const result = await ctx.commands.addHumanUser(ctx.createContext(), {
      orgID: userData.orgID,
      username: userData.username,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: 'TestPassword123!',
    });

    return {
      userID: result.userID,
      orgID: userData.orgID,
    };
  }

  describe('setUserMetadata', () => {
    it('should set single string metadata', async () => {
      const user = await createTestUser();

      const result = await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        {
          key: 'department',
          value: 'engineering',
        }
      );

      expect(result).toBeDefined();
      expect(result.key).toBe('department');
      expect(result.value).toBe('engineering');

      const event = await ctx.assertEventPublished('user.metadata.set');
      expect(event.payload).toBeDefined();
      expect(event.payload!.key).toBe('department');
      expect(event.payload!.value).toBe('engineering');
    });

    it('should set JSON object metadata', async () => {
      const user = await createTestUser();

      const metadataValue = {
        team: 'backend',
        role: 'senior',
        location: 'remote',
      };

      const result = await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        {
          key: 'profile',
          value: metadataValue,
        }
      );

      expect(result).toBeDefined();
      expect(result.key).toBe('profile');
      
      // Value should be JSON stringified
      const parsedValue = JSON.parse(result.value as string);
      expect(parsedValue.team).toBe('backend');
      expect(parsedValue.role).toBe('senior');
      expect(parsedValue.location).toBe('remote');

      const event = await ctx.assertEventPublished('user.metadata.set');
      expect(event.payload!.key).toBe('profile');
    });

    it('should update existing metadata', async () => {
      const user = await createTestUser();

      // Set initial value
      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        { key: 'status', value: 'active' }
      );

      // Update value
      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        { key: 'status', value: 'inactive' }
      );

      const events = await ctx.getEvents('user', user.userID);
      const metadataEvents = events.filter(e => e.eventType === 'user.metadata.set');
      
      // Should have 2 events (initial + update)
      expect(metadataEvents.length).toBeGreaterThanOrEqual(2);
      
      // Last event should have updated value
      const lastEvent = metadataEvents[metadataEvents.length - 1];
      expect(lastEvent.payload!.key).toBe('status');
      expect(lastEvent.payload!.value).toBe('inactive');
    });

    it('should validate required fields', async () => {
      const user = await createTestUser();

      // Missing key
      await expect(
        ctx.commands.setUserMetadata(
          ctx.createContext(),
          user.userID,
          user.orgID,
          { key: '', value: 'test' }
        )
      ).rejects.toThrow();

      // Missing value
      await expect(
        ctx.commands.setUserMetadata(
          ctx.createContext(),
          user.userID,
          user.orgID,
          { key: 'test', value: '' }
        )
      ).rejects.toThrow();
    });

    it('should allow different users to have same metadata keys', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user1.userID,
        user1.orgID,
        { key: 'team', value: 'frontend' }
      );

      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user2.userID,
        user2.orgID,
        { key: 'team', value: 'backend' }
      );

      const user1Events = await ctx.getEvents('user', user1.userID);
      const user2Events = await ctx.getEvents('user', user2.userID);

      const user1Meta = user1Events.find(
        e => e.eventType === 'user.metadata.set' && e.payload?.key === 'team'
      );
      const user2Meta = user2Events.find(
        e => e.eventType === 'user.metadata.set' && e.payload?.key === 'team'
      );

      expect(user1Meta?.payload?.value).toBe('frontend');
      expect(user2Meta?.payload?.value).toBe('backend');
    });
  });

  describe('bulkSetUserMetadata', () => {
    it('should set multiple metadata entries', async () => {
      const user = await createTestUser();

      const result = await ctx.commands.bulkSetUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        [
          { key: 'department', value: 'engineering' },
          { key: 'level', value: 'senior' },
          { key: 'team', value: 'backend' },
        ]
      );

      expect(result).toBeDefined();
      expect(result.sequence).toBeGreaterThan(0);

      const events = await ctx.getEvents('user', user.userID);
      const metadataEvents = events.filter(e => e.eventType === 'user.metadata.set');
      
      expect(metadataEvents.length).toBeGreaterThanOrEqual(3);
      
      const keys = metadataEvents.map(e => e.payload?.key);
      expect(keys).toContain('department');
      expect(keys).toContain('level');
      expect(keys).toContain('team');
    });

    it('should handle mixed string and object values', async () => {
      const user = await createTestUser();

      await ctx.commands.bulkSetUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        [
          { key: 'name', value: 'John Doe' },
          { key: 'settings', value: { theme: 'dark', notifications: true } },
          { key: 'status', value: 'active' },
        ]
      );

      const events = await ctx.getEvents('user', user.userID);
      const metadataEvents = events.filter(e => e.eventType === 'user.metadata.set');
      
      expect(metadataEvents.length).toBeGreaterThanOrEqual(3);

      const settingsEvent = metadataEvents.find(e => e.payload?.key === 'settings');
      expect(settingsEvent).toBeDefined();
      
      const settingsValue = JSON.parse(settingsEvent!.payload!.value);
      expect(settingsValue.theme).toBe('dark');
      expect(settingsValue.notifications).toBe(true);
    });

    it('should reject empty metadata array', async () => {
      const user = await createTestUser();

      await expect(
        ctx.commands.bulkSetUserMetadata(
          ctx.createContext(),
          user.userID,
          user.orgID,
          []
        )
      ).rejects.toThrow();
    });

    it('should validate all metadata entries', async () => {
      const user = await createTestUser();

      // One entry has missing key
      await expect(
        ctx.commands.bulkSetUserMetadata(
          ctx.createContext(),
          user.userID,
          user.orgID,
          [
            { key: 'valid', value: 'test' },
            { key: '', value: 'invalid' }, // Invalid
          ]
        )
      ).rejects.toThrow();

      // One entry has missing value
      await expect(
        ctx.commands.bulkSetUserMetadata(
          ctx.createContext(),
          user.userID,
          user.orgID,
          [
            { key: 'valid', value: 'test' },
            { key: 'invalid', value: '' }, // Invalid
          ]
        )
      ).rejects.toThrow();
    });

    it('should allow updating multiple existing entries', async () => {
      const user = await createTestUser();

      // Set initial values
      await ctx.commands.bulkSetUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        [
          { key: 'status', value: 'pending' },
          { key: 'level', value: 'junior' },
        ]
      );

      // Update values
      await ctx.commands.bulkSetUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        [
          { key: 'status', value: 'active' },
          { key: 'level', value: 'senior' },
        ]
      );

      const events = await ctx.getEvents('user', user.userID);
      const metadataEvents = events.filter(e => e.eventType === 'user.metadata.set');
      
      // Should have at least 4 events (2 initial + 2 updates)
      expect(metadataEvents.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('removeUserMetadata', () => {
    it('should remove existing metadata', async () => {
      const user = await createTestUser();

      // Set metadata first
      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        { key: 'temporary', value: 'test' }
      );

      // Remove it
      const result = await ctx.commands.removeUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        'temporary'
      );

      expect(result).toBeDefined();
      expect(result.sequence).toBeGreaterThan(0);

      const event = await ctx.assertEventPublished('user.metadata.removed');
      expect(event.payload).toBeDefined();
      expect(event.payload!.key).toBe('temporary');
    });

    it('should fail when removing non-existent metadata', async () => {
      const user = await createTestUser();

      await expect(
        ctx.commands.removeUserMetadata(
          ctx.createContext(),
          user.userID,
          user.orgID,
          'nonexistent'
        )
      ).rejects.toThrow(/not found/i);
    });

    it('should fail when removing already removed metadata', async () => {
      const user = await createTestUser();

      // Set and remove
      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        { key: 'once', value: 'test' }
      );

      await ctx.commands.removeUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        'once'
      );

      // Try to remove again
      await expect(
        ctx.commands.removeUserMetadata(
          ctx.createContext(),
          user.userID,
          user.orgID,
          'once'
        )
      ).rejects.toThrow(/not found/i);
    });

    it('should validate required key parameter', async () => {
      const user = await createTestUser();

      await expect(
        ctx.commands.removeUserMetadata(
          ctx.createContext(),
          user.userID,
          user.orgID,
          ''
        )
      ).rejects.toThrow();
    });
  });

  describe('bulkRemoveUserMetadata', () => {
    it('should remove multiple metadata entries', async () => {
      const user = await createTestUser();

      // Set multiple metadata
      await ctx.commands.bulkSetUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        [
          { key: 'temp1', value: 'test1' },
          { key: 'temp2', value: 'test2' },
          { key: 'temp3', value: 'test3' },
        ]
      );

      // Remove them
      const result = await ctx.commands.bulkRemoveUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        ['temp1', 'temp2', 'temp3']
      );

      expect(result).toBeDefined();
      expect(result.sequence).toBeGreaterThan(0);

      const events = await ctx.getEvents('user', user.userID);
      const removeEvents = events.filter(e => e.eventType === 'user.metadata.removed');
      
      expect(removeEvents.length).toBeGreaterThanOrEqual(3);
      
      const keys = removeEvents.map(e => e.payload?.key);
      expect(keys).toContain('temp1');
      expect(keys).toContain('temp2');
      expect(keys).toContain('temp3');
    });

    it('should reject empty keys array', async () => {
      const user = await createTestUser();

      await expect(
        ctx.commands.bulkRemoveUserMetadata(
          ctx.createContext(),
          user.userID,
          user.orgID,
          []
        )
      ).rejects.toThrow();
    });

    it('should handle mix of existing and non-existing keys gracefully', async () => {
      const user = await createTestUser();

      // Set only one metadata
      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        { key: 'exists', value: 'test' }
      );

      // Bulk remove doesn't validate existence (optimistic approach)
      // It will just emit remove events for all keys
      const result = await ctx.commands.bulkRemoveUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        ['exists', 'notexists']
      );

      expect(result).toBeDefined();

      const events = await ctx.getEvents('user', user.userID);
      const removeEvents = events.filter(e => e.eventType === 'user.metadata.removed');
      
      // Should have removal events for both keys
      expect(removeEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('should allow removing after bulk set', async () => {
      const user = await createTestUser();

      // Bulk set
      await ctx.commands.bulkSetUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        [
          { key: 'key1', value: 'value1' },
          { key: 'key2', value: 'value2' },
          { key: 'key3', value: 'value3' },
        ]
      );

      // Bulk remove subset
      await ctx.commands.bulkRemoveUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        ['key1', 'key3']
      );

      const events = await ctx.getEvents('user', user.userID);
      const metadataEvents = events.filter(
        e => e.eventType === 'user.metadata.set' || e.eventType === 'user.metadata.removed'
      );
      
      // Should have 3 set + 2 remove events
      expect(metadataEvents.length).toBeGreaterThanOrEqual(5);

      const removeEvents = events.filter(e => e.eventType === 'user.metadata.removed');
      const removedKeys = removeEvents.map(e => e.payload?.key);
      expect(removedKeys).toContain('key1');
      expect(removedKeys).toContain('key3');
    });
  });

  describe('Metadata Lifecycle', () => {
    it('should support complete CRUD lifecycle', async () => {
      const user = await createTestUser();

      // Create
      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        { key: 'status', value: 'draft' }
      );

      // Update
      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        { key: 'status', value: 'published' }
      );

      // Update again
      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        { key: 'status', value: 'archived' }
      );

      // Delete
      await ctx.commands.removeUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        'status'
      );

      const events = await ctx.getEvents('user', user.userID);
      const metadataEvents = events.filter(
        e => e.eventType === 'user.metadata.set' || e.eventType === 'user.metadata.removed'
      );

      // Should have 3 set + 1 remove
      expect(metadataEvents.length).toBeGreaterThanOrEqual(4);

      const setEvents = events.filter(
        e => e.eventType === 'user.metadata.set' && e.payload?.key === 'status'
      );
      expect(setEvents).toHaveLength(3);

      const removeEvents = events.filter(
        e => e.eventType === 'user.metadata.removed' && e.payload?.key === 'status'
      );
      expect(removeEvents).toHaveLength(1);
    });

    it('should allow re-adding after removal', async () => {
      const user = await createTestUser();

      // Set
      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        { key: 'reusable', value: 'first' }
      );

      // Remove
      await ctx.commands.removeUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        'reusable'
      );

      // Set again (re-add)
      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        { key: 'reusable', value: 'second' }
      );

      const events = await ctx.getEvents('user', user.userID);
      const metadataEvents = events.filter(
        e => (e.eventType === 'user.metadata.set' || e.eventType === 'user.metadata.removed')
          && e.payload?.key === 'reusable'
      );

      // Should have set, remove, set
      expect(metadataEvents.length).toBe(3);
      expect(metadataEvents[0].eventType).toBe('user.metadata.set');
      expect(metadataEvents[1].eventType).toBe('user.metadata.removed');
      expect(metadataEvents[2].eventType).toBe('user.metadata.set');
      expect(metadataEvents[2].payload?.value).toBe('second');
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in keys', async () => {
      const user = await createTestUser();

      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        { key: 'key-with-dashes', value: 'test' }
      );

      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        { key: 'key_with_underscores', value: 'test' }
      );

      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        { key: 'key.with.dots', value: 'test' }
      );

      const events = await ctx.getEvents('user', user.userID);
      const metadataEvents = events.filter(e => e.eventType === 'user.metadata.set');
      
      expect(metadataEvents.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle long metadata values', async () => {
      const user = await createTestUser();

      const longValue = 'x'.repeat(5000); // 5KB string

      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        { key: 'large', value: longValue }
      );

      const event = await ctx.assertEventPublished('user.metadata.set');
      expect(event.payload!.key).toBe('large');
      expect(event.payload!.value).toHaveLength(5000);
    });

    it('should handle complex nested JSON objects', async () => {
      const user = await createTestUser();

      const complexObject = {
        level1: {
          level2: {
            level3: {
              data: 'deep value',
              array: [1, 2, 3],
              boolean: true,
            },
          },
        },
        topLevel: 'value',
      };

      await ctx.commands.setUserMetadata(
        ctx.createContext(),
        user.userID,
        user.orgID,
        { key: 'complex', value: complexObject }
      );

      const event = await ctx.assertEventPublished('user.metadata.set');
      const parsedValue = JSON.parse(event.payload!.value);
      
      expect(parsedValue.level1.level2.level3.data).toBe('deep value');
      expect(parsedValue.level1.level2.level3.array).toEqual([1, 2, 3]);
      expect(parsedValue.topLevel).toBe('value');
    });
  });
});
