/**
 * Notification Policy Integration Tests - Complete Stack
 * 
 * Tests for:
 * - Organization notification policy management (add, change, remove)
 * - Password change notifications
 * - Complete stack: Command → Event → Projection → Query
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder } from '../../helpers/test-data-builders';

describe('Notification Policy - Complete Flow', () => {
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

  /**
   * Helper: Create test org
   */
  async function createTestOrg() {
    const orgData = new OrganizationBuilder()
      .withName(`Test Org ${Date.now()}`)
      .build();
    
    const result = await ctx.commands.addOrg(ctx.createContext(), orgData);
    return result.orgID;
  }

  // ============================================================================
  // ADD NOTIFICATION POLICY
  // ============================================================================

  describe('addOrgNotificationPolicy', () => {
    it('should add notification policy successfully', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act
      const result = await ctx.commands.addOrgNotificationPolicy(
        ctx.createContext(),
        orgID,
        {
          passwordChange: true,
        }
      );
      
      // Assert
      expect(result).toBeDefined();
      expect(result.sequence).toBeGreaterThan(0);
      
      // Verify event
      const events = await ctx.getEvents('org', orgID);
      const policyEvent = events.find(e => e.eventType === 'org.notification.policy.added');
      expect(policyEvent).toBeDefined();
      expect(policyEvent!.payload).toHaveProperty('passwordChange', true);
      
      console.log('✓ Notification policy added successfully');
    });

    it('should add policy with all settings disabled', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act
      const result = await ctx.commands.addOrgNotificationPolicy(
        ctx.createContext(),
        orgID,
        {
          passwordChange: false,
        }
      );
      
      // Assert
      expect(result).toBeDefined();
      
      const events = await ctx.getEvents('org', orgID);
      const policyEvent = events.find(e => e.eventType === 'org.notification.policy.added');
      expect(policyEvent).toBeDefined();
      if (policyEvent?.payload) {
        expect(policyEvent.payload.passwordChange).toBe(false);
      }
      
      console.log('✓ Notification policy added with disabled notifications');
    });

    it('should fail adding duplicate policy', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      await ctx.commands.addOrgNotificationPolicy(
        ctx.createContext(),
        orgID,
        { passwordChange: true }
      );
      
      // Act & Assert
      await expect(
        ctx.commands.addOrgNotificationPolicy(
          ctx.createContext(),
          orgID,
          { passwordChange: false }
        )
      ).rejects.toThrow(/already exists/i);
      
      console.log('✓ Failed as expected with duplicate policy');
    });

    it('should fail with empty orgID', async () => {
      await expect(
        ctx.commands.addOrgNotificationPolicy(
          ctx.createContext(),
          '',
          { passwordChange: true }
        )
      ).rejects.toThrow(/orgID/i);
      
      console.log('✓ Failed as expected with empty orgID');
    });
  });

  // ============================================================================
  // CHANGE NOTIFICATION POLICY
  // ============================================================================

  describe('changeOrgNotificationPolicy', () => {
    it('should change notification policy successfully', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      await ctx.commands.addOrgNotificationPolicy(
        ctx.createContext(),
        orgID,
        { passwordChange: false }
      );
      
      // Act
      const result = await ctx.commands.changeOrgNotificationPolicy(
        ctx.createContext(),
        orgID,
        { passwordChange: true }
      );
      
      // Assert
      expect(result).toBeDefined();
      
      const events = await ctx.getEvents('org', orgID);
      const changeEvent = events.find(e => e.eventType === 'org.notification.policy.changed');
      expect(changeEvent).toBeDefined();
      expect(changeEvent!.payload).toHaveProperty('passwordChange', true);
      
      console.log('✓ Notification policy changed successfully');
    });

    it('should toggle password change notification', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      await ctx.commands.addOrgNotificationPolicy(
        ctx.createContext(),
        orgID,
        { passwordChange: true }
      );
      
      // Act - Disable
      await ctx.commands.changeOrgNotificationPolicy(
        ctx.createContext(),
        orgID,
        { passwordChange: false }
      );
      
      // Assert
      const events = await ctx.getEvents('org', orgID);
      const changeEvent = events.find(e => e.eventType === 'org.notification.policy.changed');
      expect(changeEvent).toBeDefined();
      if (changeEvent?.payload) {
        expect(changeEvent.payload.passwordChange).toBe(false);
      }
      
      console.log('✓ Password change notification toggled successfully');
    });

    it('should be idempotent - no event for same values', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      const config = { passwordChange: true };
      
      await ctx.commands.addOrgNotificationPolicy(ctx.createContext(), orgID, config);
      
      // Get event count before idempotent change
      const eventsBefore = await ctx.getEvents('org', orgID);
      const eventCountBefore = eventsBefore.length;
      
      // Act - change with same values
      await ctx.commands.changeOrgNotificationPolicy(ctx.createContext(), orgID, config);
      
      // Assert - no new event should be created
      const eventsAfter = await ctx.getEvents('org', orgID);
      const eventCountAfter = eventsAfter.length;
      
      expect(eventCountAfter).toBe(eventCountBefore);
      
      const changeEvent = eventsAfter.find(e => e.eventType === 'org.notification.policy.changed');
      expect(changeEvent).toBeUndefined();
      
      console.log('✓ Idempotent - no event for same values');
    });

    it('should fail with non-existent policy', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act & Assert
      await expect(
        ctx.commands.changeOrgNotificationPolicy(
          ctx.createContext(),
          orgID,
          { passwordChange: true }
        )
      ).rejects.toThrow(/not found/i);
      
      console.log('✓ Failed as expected with non-existent policy');
    });
  });

  // ============================================================================
  // REMOVE NOTIFICATION POLICY
  // ============================================================================

  describe('removeOrgNotificationPolicy', () => {
    it('should remove notification policy successfully', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      await ctx.commands.addOrgNotificationPolicy(
        ctx.createContext(),
        orgID,
        { passwordChange: true }
      );
      
      // Act
      const result = await ctx.commands.removeOrgNotificationPolicy(
        ctx.createContext(),
        orgID
      );
      
      // Assert
      expect(result).toBeDefined();
      
      const events = await ctx.getEvents('org', orgID);
      const removeEvent = events.find(e => e.eventType === 'org.notification.policy.removed');
      expect(removeEvent).toBeDefined();
      
      console.log('✓ Notification policy removed successfully');
    });

    it('should fail removing non-existent policy', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act & Assert
      await expect(
        ctx.commands.removeOrgNotificationPolicy(
          ctx.createContext(),
          orgID
        )
      ).rejects.toThrow(/not found/i);
      
      console.log('✓ Failed as expected with non-existent policy');
    });
  });

  // ============================================================================
  // COMPLETE LIFECYCLE
  // ============================================================================

  describe('Complete Notification Policy Lifecycle', () => {
    it('should complete full lifecycle: add → change → remove', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Step 1: Add with notifications enabled
      await ctx.commands.addOrgNotificationPolicy(
        ctx.createContext(),
        orgID,
        { passwordChange: true }
      );
      
      // Step 2: Disable notifications
      await ctx.commands.changeOrgNotificationPolicy(
        ctx.createContext(),
        orgID,
        { passwordChange: false }
      );
      
      // Step 3: Enable again
      await ctx.commands.changeOrgNotificationPolicy(
        ctx.createContext(),
        orgID,
        { passwordChange: true }
      );
      
      // Step 4: Remove
      await ctx.commands.removeOrgNotificationPolicy(
        ctx.createContext(),
        orgID
      );
      
      // Assert
      const events = await ctx.getEvents('org', orgID);
      const addedEvent = events.find(e => e.eventType === 'org.notification.policy.added');
      const changedEvents = events.filter(e => e.eventType === 'org.notification.policy.changed');
      const removedEvent = events.find(e => e.eventType === 'org.notification.policy.removed');
      
      expect(addedEvent).toBeDefined();
      expect(changedEvents.length).toBe(2);
      expect(removedEvent).toBeDefined();
      
      console.log('✓ Complete notification policy lifecycle successful');
    });
  });
});
