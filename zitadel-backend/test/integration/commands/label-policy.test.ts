/**
 * Label Policy Integration Tests - Complete Stack
 * 
 * Tests for:
 * - Organization label policy management (add, change, remove)
 * - Instance label policy management (add, change, remove)
 * - Complete stack: Command → Event → Projection → Query
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder } from '../../helpers/test-data-builders';
import { DomainLabelPolicyProjection } from '../../../src/lib/query/projections/domain-label-policy-projection';

describe('Label Policy - Complete Flow', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let labelPolicyProjection: DomainLabelPolicyProjection;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projection
    labelPolicyProjection = new DomainLabelPolicyProjection(ctx.eventstore, pool);
    await labelPolicyProjection.init();
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    await ctx.clearEvents();
  });

  /**
   * Helper: Process projections
   */
  async function processProjections() {
    const events = await ctx.getEvents('*', '*');
    
    console.log(`Processing ${events.length} event(s) through projections...`);
    
    for (const event of events) {
      try {
        await labelPolicyProjection.reduce(event);
        console.log(`  ✓ Processed ${event.eventType} for ${event.aggregateID}`);
      } catch (err: any) {
        console.error(`  ✗ Failed to process ${event.eventType}:`, err.message);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

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

  /**
   * Helper: Verify policy in database
   */
  async function assertPolicyInDB(orgID: string, isInstance: boolean = false) {
    const query = isInstance
      ? 'SELECT * FROM projections.label_policies WHERE instance_id = $1 AND id = $2'
      : 'SELECT * FROM projections.label_policies WHERE instance_id = $1 AND organization_id = $2';
    
    const result = await pool.query(query, ['test-instance', orgID]);
    
    expect(result.rows.length).toBeGreaterThan(0);
    console.log(`✓ Label policy verified in database for ${isInstance ? 'instance' : 'org'}: ${orgID}`);
    
    return result.rows[0];
  }

  // ============================================================================
  // Organization Label Policy Tests
  // ============================================================================

  describe('addOrgLabelPolicy', () => {
    it('should add org label policy with default colors', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act
      await ctx.commands.addOrgLabelPolicy(
        ctx.createContext(),
        orgID,
        {}
      );
      
      // Process projections
      await processProjections();
      
      // Assert - Check event
      const events = await ctx.getEvents('org', orgID);
      const policyEvent = events.find(e => e.eventType === 'org.label.policy.added');
      expect(policyEvent).toBeDefined();
      expect(policyEvent!.payload!.primaryColor).toBe('#5469d4');
      expect(policyEvent!.payload!.backgroundColor).toBe('#ffffff');
      
      // Verify in database
      const policy = await assertPolicyInDB(orgID);
      expect(policy.primary_color).toBe('#5469d4');
      expect(policy.background_color).toBe('#ffffff');
      
      console.log('✓ Org label policy added with defaults');
    });

    it('should add org label policy with custom colors', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act
      await ctx.commands.addOrgLabelPolicy(
        ctx.createContext(),
        orgID,
        {
          primaryColor: '#FF0000',
          backgroundColor: '#000000',
          warnColor: '#FFFF00',
          fontColor: '#FFFFFF',
        }
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const events = await ctx.getEvents('org', orgID);
      const policyEvent = events.find(e => e.eventType === 'org.label.policy.added');
      expect(policyEvent!.payload!.primaryColor).toBe('#FF0000');
      expect(policyEvent!.payload!.backgroundColor).toBe('#000000');
      
      // Verify in database
      const policy = await assertPolicyInDB(orgID);
      expect(policy.primary_color).toBe('#FF0000');
      expect(policy.background_color).toBe('#000000');
      
      console.log('✓ Org label policy added with custom colors');
    });

    it('should add org label policy with assets', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act
      await ctx.commands.addOrgLabelPolicy(
        ctx.createContext(),
        orgID,
        {
          logoURL: 'https://example.com/logo.png',
          iconURL: 'https://example.com/icon.png',
          fontURL: 'https://fonts.googleapis.com/css?family=Roboto',
        }
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const policy = await assertPolicyInDB(orgID);
      expect(policy.logo_url).toBe('https://example.com/logo.png');
      expect(policy.icon_url).toBe('https://example.com/icon.png');
      expect(policy.font_url).toBe('https://fonts.googleapis.com/css?family=Roboto');
      
      console.log('✓ Org label policy added with assets');
    });

    it('should add org label policy with dark mode colors', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act
      await ctx.commands.addOrgLabelPolicy(
        ctx.createContext(),
        orgID,
        {
          primaryColorDark: '#1E40AF',
          backgroundColorDark: '#1F2937',
          warnColorDark: '#DC2626',
          fontColorDark: '#F9FAFB',
        }
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const policy = await assertPolicyInDB(orgID);
      expect(policy.primary_color_dark).toBe('#1E40AF');
      expect(policy.background_color_dark).toBe('#1F2937');
      
      console.log('✓ Org label policy added with dark mode colors');
    });

    it('should fail with empty orgID', async () => {
      // Act & Assert
      await expect(
        ctx.commands.addOrgLabelPolicy(
          ctx.createContext(),
          '',
          {}
        )
      ).rejects.toThrow();
      
      console.log('✓ Failed as expected with empty orgID');
    });

    it('should fail if policy already exists', async () => {
      // Arrange
      const orgID = await createTestOrg();
      await ctx.commands.addOrgLabelPolicy(ctx.createContext(), orgID, {});
      
      // Act & Assert
      await expect(
        ctx.commands.addOrgLabelPolicy(ctx.createContext(), orgID, {})
      ).rejects.toThrow('label policy already exists');
      
      console.log('✓ Failed as expected - policy already exists');
    });
  });

  describe('changeOrgLabelPolicy', () => {
    it('should change org label policy colors', async () => {
      // Arrange
      const orgID = await createTestOrg();
      await ctx.commands.addOrgLabelPolicy(ctx.createContext(), orgID, {});
      
      // Act
      await ctx.commands.changeOrgLabelPolicy(
        ctx.createContext(),
        orgID,
        {
          primaryColor: '#00FF00',
          backgroundColor: '#FFFFFF',
        }
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const events = await ctx.getEvents('org', orgID);
      const changeEvent = events.find(e => e.eventType === 'org.label.policy.changed');
      expect(changeEvent).toBeDefined();
      expect(changeEvent!.payload!.primaryColor).toBe('#00FF00');
      
      // Verify in database
      const policy = await assertPolicyInDB(orgID);
      expect(policy.primary_color).toBe('#00FF00');
      
      console.log('✓ Org label policy colors changed');
    });

    it('should change org label policy assets', async () => {
      // Arrange
      const orgID = await createTestOrg();
      await ctx.commands.addOrgLabelPolicy(ctx.createContext(), orgID, {});
      
      // Act
      await ctx.commands.changeOrgLabelPolicy(
        ctx.createContext(),
        orgID,
        {
          logoURL: 'https://example.com/new-logo.png',
          iconURL: 'https://example.com/new-icon.png',
        }
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const policy = await assertPolicyInDB(orgID);
      expect(policy.logo_url).toBe('https://example.com/new-logo.png');
      expect(policy.icon_url).toBe('https://example.com/new-icon.png');
      
      console.log('✓ Org label policy assets changed');
    });

    it('should be idempotent when no changes', async () => {
      // Arrange
      const orgID = await createTestOrg();
      await ctx.commands.addOrgLabelPolicy(ctx.createContext(), orgID, {
        primaryColor: '#FF0000',
      });
      
      // Get event count before
      const eventsBefore = await ctx.getEvents('org', orgID);
      const changeEventsBefore = eventsBefore.filter(e => e.eventType === 'org.label.policy.changed');
      
      // Act - Change to same color
      await ctx.commands.changeOrgLabelPolicy(
        ctx.createContext(),
        orgID,
        {
          primaryColor: '#FF0000',
        }
      );
      
      // Assert - No new change event
      const eventsAfter = await ctx.getEvents('org', orgID);
      const changeEventsAfter = eventsAfter.filter(e => e.eventType === 'org.label.policy.changed');
      expect(changeEventsAfter.length).toBe(changeEventsBefore.length);
      
      console.log('✓ Idempotent - no event for same values');
    });

    it('should fail if policy does not exist', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act & Assert
      await expect(
        ctx.commands.changeOrgLabelPolicy(
          ctx.createContext(),
          orgID,
          { primaryColor: '#FF0000' }
        )
      ).rejects.toThrow('label policy not found');
      
      console.log('✓ Failed as expected - policy not found');
    });

    it('should fail with no fields provided', async () => {
      // Arrange
      const orgID = await createTestOrg();
      await ctx.commands.addOrgLabelPolicy(ctx.createContext(), orgID, {});
      
      // Act & Assert
      await expect(
        ctx.commands.changeOrgLabelPolicy(
          ctx.createContext(),
          orgID,
          {}
        )
      ).rejects.toThrow('at least one field must be provided');
      
      console.log('✓ Failed as expected - no fields provided');
    });
  });

  describe('removeOrgLabelPolicy', () => {
    it('should remove org label policy', async () => {
      // Arrange
      const orgID = await createTestOrg();
      await ctx.commands.addOrgLabelPolicy(ctx.createContext(), orgID, {});
      
      // Act
      await ctx.commands.removeOrgLabelPolicy(
        ctx.createContext(),
        orgID
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const events = await ctx.getEvents('org', orgID);
      const removeEvent = events.find(e => e.eventType === 'org.label.policy.removed');
      expect(removeEvent).toBeDefined();
      
      console.log('✓ Org label policy removed');
    });

    it('should fail if policy does not exist', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act & Assert
      await expect(
        ctx.commands.removeOrgLabelPolicy(
          ctx.createContext(),
          orgID
        )
      ).rejects.toThrow('label policy not found');
      
      console.log('✓ Failed as expected - policy not found');
    });
  });

  // ============================================================================
  // Instance Label Policy Tests
  // ============================================================================

  describe('addInstanceLabelPolicy', () => {
    it('should add instance label policy', async () => {
      // Act
      await ctx.commands.addInstanceLabelPolicy(
        ctx.createContext(),
        {
          primaryColor: '#0000FF',
          backgroundColor: '#F0F0F0',
        }
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const policyEvent = events.find(e => e.eventType === 'instance.label.policy.added');
      expect(policyEvent).toBeDefined();
      expect(policyEvent!.payload!.primaryColor).toBe('#0000FF');
      
      console.log('✓ Instance label policy added');
    });

    it('should fail if instance policy already exists', async () => {
      // Arrange
      await ctx.commands.addInstanceLabelPolicy(ctx.createContext(), {});
      
      // Act & Assert
      await expect(
        ctx.commands.addInstanceLabelPolicy(ctx.createContext(), {})
      ).rejects.toThrow('instance label policy already exists');
      
      console.log('✓ Failed as expected - instance policy exists');
    });
  });

  describe('changeInstanceLabelPolicy', () => {
    it('should change instance label policy', async () => {
      // Arrange
      await ctx.commands.addInstanceLabelPolicy(ctx.createContext(), {});
      
      // Act
      await ctx.commands.changeInstanceLabelPolicy(
        ctx.createContext(),
        {
          primaryColor: '#CCCCCC',
          logoURL: 'https://instance.com/logo.png',
        }
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeEvent = events.find(e => e.eventType === 'instance.label.policy.changed');
      expect(changeEvent).toBeDefined();
      expect(changeEvent!.payload!.primaryColor).toBe('#CCCCCC');
      
      console.log('✓ Instance label policy changed');
    });

    it('should fail if instance policy does not exist', async () => {
      // Act & Assert
      await expect(
        ctx.commands.changeInstanceLabelPolicy(
          ctx.createContext(),
          { primaryColor: '#FF0000' }
        )
      ).rejects.toThrow('instance label policy not found');
      
      console.log('✓ Failed as expected - instance policy not found');
    });
  });

  // ============================================================================
  // Default (Instance-Level) Label Policy Tests - NEW
  // ============================================================================

  describe('changeDefaultLabelPolicy', () => {
    it('should change default label policy colors', async () => {
      // Arrange - First add a default policy
      await ctx.commands.addInstanceLabelPolicy(ctx.createContext(), {
        primaryColor: '#000000',
      });
      
      // Act
      await ctx.commands.changeDefaultLabelPolicy(
        ctx.createContext(),
        {
          primaryColor: '#FF5500',
          backgroundColor: '#FAFAFA',
          warnColor: '#FFA500',
          fontColor: '#333333',
        }
      );
      
      // Process projections
      await processProjections();
      
      // Assert - Check event
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeEvent = events.find(e => e.eventType === 'instance.label.policy.changed');
      expect(changeEvent).toBeDefined();
      expect(changeEvent!.payload!.primaryColor).toBe('#FF5500');
      expect(changeEvent!.payload!.backgroundColor).toBe('#FAFAFA');
      expect(changeEvent!.payload!.warnColor).toBe('#FFA500');
      
      console.log('✓ Default label policy colors changed');
    });

    it('should change default label policy assets', async () => {
      // Arrange
      await ctx.commands.addInstanceLabelPolicy(ctx.createContext(), {});
      
      // Act
      await ctx.commands.changeDefaultLabelPolicy(
        ctx.createContext(),
        {
          logoURL: 'https://default.com/logo.png',
          iconURL: 'https://default.com/icon.png',
          fontURL: 'https://fonts.google.com/roboto',
        }
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeEvent = events.find(e => e.eventType === 'instance.label.policy.changed');
      expect(changeEvent).toBeDefined();
      expect(changeEvent!.payload!.logoURL).toBe('https://default.com/logo.png');
      expect(changeEvent!.payload!.iconURL).toBe('https://default.com/icon.png');
      
      console.log('✓ Default label policy assets changed');
    });

    it('should change default label policy dark mode colors', async () => {
      // Arrange
      await ctx.commands.addInstanceLabelPolicy(ctx.createContext(), {});
      
      // Act
      await ctx.commands.changeDefaultLabelPolicy(
        ctx.createContext(),
        {
          primaryColorDark: '#2563EB',
          backgroundColorDark: '#111827',
          warnColorDark: '#EF4444',
          fontColorDark: '#F3F4F6',
        }
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeEvent = events.find(e => e.eventType === 'instance.label.policy.changed');
      expect(changeEvent).toBeDefined();
      expect(changeEvent!.payload!.primaryColorDark).toBe('#2563EB');
      expect(changeEvent!.payload!.backgroundColorDark).toBe('#111827');
      
      console.log('✓ Default label policy dark mode colors changed');
    });

    it('should change default label policy UI preferences', async () => {
      // Arrange
      await ctx.commands.addInstanceLabelPolicy(ctx.createContext(), {});
      
      // Act
      await ctx.commands.changeDefaultLabelPolicy(
        ctx.createContext(),
        {
          hideLoginNameSuffix: true,
          errorMsgPopup: false,
          disableWatermark: true,
          themeMode: 'dark',
        }
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeEvent = events.find(e => e.eventType === 'instance.label.policy.changed');
      expect(changeEvent).toBeDefined();
      expect(changeEvent!.payload!.hideLoginNameSuffix).toBe(true);
      expect(changeEvent!.payload!.errorMsgPopup).toBe(false);
      expect(changeEvent!.payload!.disableWatermark).toBe(true);
      expect(changeEvent!.payload!.themeMode).toBe('dark');
      
      console.log('✓ Default label policy UI preferences changed');
    });

    it('should be idempotent when no changes', async () => {
      // Arrange
      await ctx.commands.addInstanceLabelPolicy(ctx.createContext(), {
        primaryColor: '#123456',
      });
      
      // Get initial change event count
      const eventsBefore = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeCountBefore = eventsBefore.filter(e => e.eventType === 'instance.label.policy.changed').length;
      
      // Act - Change to same value
      await ctx.commands.changeDefaultLabelPolicy(
        ctx.createContext(),
        {
          primaryColor: '#123456',
        }
      );
      
      // Assert - No new change event
      const eventsAfter = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeCountAfter = eventsAfter.filter(e => e.eventType === 'instance.label.policy.changed').length;
      expect(changeCountAfter).toBe(changeCountBefore);
      
      console.log('✓ Idempotent - no event for same values');
    });

    it('should fail with no fields provided', async () => {
      // Arrange
      await ctx.commands.addInstanceLabelPolicy(ctx.createContext(), {});
      
      // Act & Assert
      await expect(
        ctx.commands.changeDefaultLabelPolicy(
          ctx.createContext(),
          {}
        )
      ).rejects.toThrow('at least one field must be provided');
      
      console.log('✓ Failed as expected - no fields provided');
    });

    it('should fail if default policy does not exist', async () => {
      // Act & Assert
      await expect(
        ctx.commands.changeDefaultLabelPolicy(
          ctx.createContext(),
          { primaryColor: '#FF0000' }
        )
      ).rejects.toThrow('default label policy not found');
      
      console.log('✓ Failed as expected - default policy not found');
    });
  });

  // ============================================================================
  // Complete Lifecycle Tests
  // ============================================================================

  describe('Complete Label Policy Lifecycle', () => {
    it('should complete org policy lifecycle: add → change → remove', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act - Add
      await ctx.commands.addOrgLabelPolicy(ctx.createContext(), orgID, {
        primaryColor: '#111111',
      });
      
      // Change
      await ctx.commands.changeOrgLabelPolicy(ctx.createContext(), orgID, {
        primaryColor: '#222222',
        logoURL: 'https://example.com/logo.png',
      });
      
      // Remove
      await ctx.commands.removeOrgLabelPolicy(ctx.createContext(), orgID);
      
      // Process projections
      await processProjections();
      
      // Assert
      const events = await ctx.getEvents('org', orgID);
      const addedEvent = events.find(e => e.eventType === 'org.label.policy.added');
      const changedEvent = events.find(e => e.eventType === 'org.label.policy.changed');
      const removedEvent = events.find(e => e.eventType === 'org.label.policy.removed');
      
      expect(addedEvent).toBeDefined();
      expect(changedEvent).toBeDefined();
      expect(removedEvent).toBeDefined();
      
      console.log('✓ Complete org policy lifecycle successful');
    });

    it('should complete instance policy lifecycle: add → change', async () => {
      // Act - Add
      await ctx.commands.addInstanceLabelPolicy(ctx.createContext(), {
        primaryColor: '#333333',
      });
      
      // Change
      await ctx.commands.changeInstanceLabelPolicy(ctx.createContext(), {
        primaryColor: '#444444',
        backgroundColor: '#FAFAFA',
      });
      
      // Process projections
      await processProjections();
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const addedEvent = events.find(e => e.eventType === 'instance.label.policy.added');
      const changedEvent = events.find(e => e.eventType === 'instance.label.policy.changed');
      
      expect(addedEvent).toBeDefined();
      expect(changedEvent).toBeDefined();
      
      console.log('✓ Complete instance policy lifecycle successful');
    });
  });
});
