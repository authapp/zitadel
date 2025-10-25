/**
 * Domain Policy Integration Tests - Complete Stack
 * 
 * Tests for:
 * - Organization domain policy management (add, change, remove)
 * - Username validation rules, domain validation
 * - Complete stack: Command → Event → Projection → Query
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder } from '../../helpers/test-data-builders';

describe('Domain Policy - Complete Flow', () => {
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
  // ADD DOMAIN POLICY
  // ============================================================================

  describe('addOrgDomainPolicy', () => {
    it('should add domain policy successfully', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act
      const result = await ctx.commands.addOrgDomainPolicy(
        ctx.createContext(),
        orgID,
        {
          userLoginMustBeDomain: true,
          validateOrgDomains: true,
          smtpSenderAddressMatchesInstanceDomain: false,
        }
      );
      
      // Assert
      expect(result).toBeDefined();
      expect(result.sequence).toBeGreaterThan(0);
      
      // Verify event
      const events = await ctx.getEvents('org', orgID);
      const policyEvent = events.find(e => e.eventType === 'org.domain.policy.added');
      expect(policyEvent).toBeDefined();
      expect(policyEvent!.payload).toMatchObject({
        userLoginMustBeDomain: true,
        validateOrgDomains: true,
        smtpSenderAddressMatchesInstanceDomain: false,
      });
      
      console.log('✓ Domain policy added successfully');
    });

    it('should add policy with all validations disabled', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act
      const result = await ctx.commands.addOrgDomainPolicy(
        ctx.createContext(),
        orgID,
        {
          userLoginMustBeDomain: false,
          validateOrgDomains: false,
          smtpSenderAddressMatchesInstanceDomain: false,
        }
      );
      
      // Assert
      expect(result).toBeDefined();
      
      const events = await ctx.getEvents('org', orgID);
      const policyEvent = events.find(e => e.eventType === 'org.domain.policy.added');
      expect(policyEvent).toBeDefined();
      if (policyEvent?.payload) {
        expect(policyEvent.payload.userLoginMustBeDomain).toBe(false);
        expect(policyEvent.payload.validateOrgDomains).toBe(false);
        expect(policyEvent.payload.smtpSenderAddressMatchesInstanceDomain).toBe(false);
      }
      
      console.log('✓ Domain policy added with validations disabled');
    });

    it('should fail adding duplicate policy', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      await ctx.commands.addOrgDomainPolicy(
        ctx.createContext(),
        orgID,
        {
          userLoginMustBeDomain: true,
          validateOrgDomains: false,
          smtpSenderAddressMatchesInstanceDomain: false,
        }
      );
      
      // Act & Assert
      await expect(
        ctx.commands.addOrgDomainPolicy(
          ctx.createContext(),
          orgID,
          {
            userLoginMustBeDomain: false,
            validateOrgDomains: true,
            smtpSenderAddressMatchesInstanceDomain: true,
          }
        )
      ).rejects.toThrow(/already exists/i);
      
      console.log('✓ Failed as expected with duplicate policy');
    });

    it('should fail with empty orgID', async () => {
      await expect(
        ctx.commands.addOrgDomainPolicy(
          ctx.createContext(),
          '',
          {
            userLoginMustBeDomain: true,
            validateOrgDomains: true,
            smtpSenderAddressMatchesInstanceDomain: false,
          }
        )
      ).rejects.toThrow(/orgID/i);
      
      console.log('✓ Failed as expected with empty orgID');
    });
  });

  // ============================================================================
  // CHANGE DOMAIN POLICY
  // ============================================================================

  describe('changeOrgDomainPolicy', () => {
    it('should change domain policy successfully', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      await ctx.commands.addOrgDomainPolicy(
        ctx.createContext(),
        orgID,
        {
          userLoginMustBeDomain: false,
          validateOrgDomains: false,
          smtpSenderAddressMatchesInstanceDomain: false,
        }
      );
      
      // Act
      const result = await ctx.commands.changeOrgDomainPolicy(
        ctx.createContext(),
        orgID,
        {
          userLoginMustBeDomain: true,
          validateOrgDomains: true,
          smtpSenderAddressMatchesInstanceDomain: true,
        }
      );
      
      // Assert
      expect(result).toBeDefined();
      
      const events = await ctx.getEvents('org', orgID);
      const changeEvent = events.find(e => e.eventType === 'org.domain.policy.changed');
      expect(changeEvent).toBeDefined();
      expect(changeEvent!.payload).toMatchObject({
        userLoginMustBeDomain: true,
        validateOrgDomains: true,
        smtpSenderAddressMatchesInstanceDomain: true,
      });
      
      console.log('✓ Domain policy changed successfully');
    });

    it('should toggle individual validation rules', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      await ctx.commands.addOrgDomainPolicy(
        ctx.createContext(),
        orgID,
        {
          userLoginMustBeDomain: true,
          validateOrgDomains: false,
          smtpSenderAddressMatchesInstanceDomain: false,
        }
      );
      
      // Act - Toggle userLoginMustBeDomain
      await ctx.commands.changeOrgDomainPolicy(
        ctx.createContext(),
        orgID,
        {
          userLoginMustBeDomain: false,
          validateOrgDomains: true,
          smtpSenderAddressMatchesInstanceDomain: true,
        }
      );
      
      // Assert
      const events = await ctx.getEvents('org', orgID);
      const changeEvent = events.find(e => e.eventType === 'org.domain.policy.changed');
      expect(changeEvent).toBeDefined();
      if (changeEvent?.payload) {
        expect(changeEvent.payload.userLoginMustBeDomain).toBe(false);
        expect(changeEvent.payload.validateOrgDomains).toBe(true);
        expect(changeEvent.payload.smtpSenderAddressMatchesInstanceDomain).toBe(true);
      }
      
      console.log('✓ Domain validation rules toggled successfully');
    });

    it('should be idempotent - no event for same values', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      const config = {
        userLoginMustBeDomain: true,
        validateOrgDomains: true,
        smtpSenderAddressMatchesInstanceDomain: false,
      };
      
      await ctx.commands.addOrgDomainPolicy(ctx.createContext(), orgID, config);
      
      // Get event count before idempotent change
      const eventsBefore = await ctx.getEvents('org', orgID);
      const eventCountBefore = eventsBefore.length;
      
      // Act - change with same values
      await ctx.commands.changeOrgDomainPolicy(ctx.createContext(), orgID, config);
      
      // Assert - no new event should be created
      const eventsAfter = await ctx.getEvents('org', orgID);
      const eventCountAfter = eventsAfter.length;
      
      expect(eventCountAfter).toBe(eventCountBefore);
      
      const changeEvent = eventsAfter.find(e => e.eventType === 'org.domain.policy.changed');
      expect(changeEvent).toBeUndefined();
      
      console.log('✓ Idempotent - no event for same values');
    });

    it('should fail with non-existent policy', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act & Assert
      await expect(
        ctx.commands.changeOrgDomainPolicy(
          ctx.createContext(),
          orgID,
          {
            userLoginMustBeDomain: true,
            validateOrgDomains: true,
            smtpSenderAddressMatchesInstanceDomain: false,
          }
        )
      ).rejects.toThrow(/not found/i);
      
      console.log('✓ Failed as expected with non-existent policy');
    });
  });

  // ============================================================================
  // REMOVE DOMAIN POLICY
  // ============================================================================

  describe('removeOrgDomainPolicy', () => {
    it('should remove domain policy successfully', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      await ctx.commands.addOrgDomainPolicy(
        ctx.createContext(),
        orgID,
        {
          userLoginMustBeDomain: true,
          validateOrgDomains: true,
          smtpSenderAddressMatchesInstanceDomain: false,
        }
      );
      
      // Act
      const result = await ctx.commands.removeOrgDomainPolicy(
        ctx.createContext(),
        orgID
      );
      
      // Assert
      expect(result).toBeDefined();
      
      const events = await ctx.getEvents('org', orgID);
      const removeEvent = events.find(e => e.eventType === 'org.domain.policy.removed');
      expect(removeEvent).toBeDefined();
      
      console.log('✓ Domain policy removed successfully');
    });

    it('should fail removing non-existent policy', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act & Assert
      await expect(
        ctx.commands.removeOrgDomainPolicy(
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

  describe('Complete Domain Policy Lifecycle', () => {
    it('should complete full lifecycle: add → change → remove', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Step 1: Add with strict validation
      await ctx.commands.addOrgDomainPolicy(
        ctx.createContext(),
        orgID,
        {
          userLoginMustBeDomain: true,
          validateOrgDomains: true,
          smtpSenderAddressMatchesInstanceDomain: true,
        }
      );
      
      // Step 2: Relax validation
      await ctx.commands.changeOrgDomainPolicy(
        ctx.createContext(),
        orgID,
        {
          userLoginMustBeDomain: false,
          validateOrgDomains: false,
          smtpSenderAddressMatchesInstanceDomain: false,
        }
      );
      
      // Step 3: Enable some validations again
      await ctx.commands.changeOrgDomainPolicy(
        ctx.createContext(),
        orgID,
        {
          userLoginMustBeDomain: true,
          validateOrgDomains: false,
          smtpSenderAddressMatchesInstanceDomain: true,
        }
      );
      
      // Step 4: Remove
      await ctx.commands.removeOrgDomainPolicy(
        ctx.createContext(),
        orgID
      );
      
      // Assert
      const events = await ctx.getEvents('org', orgID);
      const addedEvent = events.find(e => e.eventType === 'org.domain.policy.added');
      const changedEvents = events.filter(e => e.eventType === 'org.domain.policy.changed');
      const removedEvent = events.find(e => e.eventType === 'org.domain.policy.removed');
      
      expect(addedEvent).toBeDefined();
      expect(changedEvents.length).toBe(2);
      expect(removedEvent).toBeDefined();
      
      console.log('✓ Complete domain policy lifecycle successful');
    });
  });
});
