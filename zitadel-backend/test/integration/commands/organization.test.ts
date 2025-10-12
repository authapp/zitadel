/**
 * Organization Lifecycle Command Tests
 * 
 * Tests for:
 * - Organization CRUD operations
 * - Organization state management
 * - Organization validation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder } from '../../helpers/test-data-builders';

describe('Organization Lifecycle Commands', () => {
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

  describe('addOrg', () => {
    describe('Success Cases', () => {
      it('should create new organization successfully', async () => {
        const orgData = new OrganizationBuilder()
          .withName(`Test Org ${Date.now()}`)
          .build();

        const result = await ctx.commands.addOrg(ctx.createContext(), orgData);

        expect(result).toBeDefined();
        expect(result.orgID).toBeDefined();
        expect(result.sequence).toBeGreaterThan(0);

        const event = await ctx.assertEventPublished('org.added');
        expect(event.payload).toHaveProperty('name', orgData.name);
      });

      it('should allow multiple organizations', async () => {
        const org1 = await ctx.commands.addOrg(ctx.createContext(), {
          name: 'Organization 1',
        });

        const org2 = await ctx.commands.addOrg(ctx.createContext(), {
          name: 'Organization 2',
        });

        expect(org1.orgID).not.toBe(org2.orgID);
      });

      it('should accept custom orgID', async () => {
        const customID = await ctx.commands.generateID();
        
        const result = await ctx.commands.addOrg(ctx.createContext(), {
          orgID: customID,
          name: 'Custom ID Org',
        });

        expect(result.orgID).toBe(customID);
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty name', async () => {
        await expect(
          ctx.commands.addOrg(ctx.createContext(), {
            name: '',
          })
        ).rejects.toThrow();
      });

      it('should fail with invalid name length', async () => {
        await expect(
          ctx.commands.addOrg(ctx.createContext(), {
            name: 'ab', // Too short (assuming min length validation)
          })
        ).rejects.toThrow();
      });
    });
  });

  describe('changeOrg', () => {
    describe('Success Cases', () => {
      it('should update organization name', async () => {
        const org = await ctx.commands.addOrg(ctx.createContext(), {
          name: 'Original Name',
        });

        const result = await ctx.commands.changeOrg(
          ctx.createContext(),
          org.orgID,
          { name: 'Updated Name' }
        );

        expect(result).toBeDefined();

        const event = await ctx.assertEventPublished('org.changed');
        expect(event.payload).toHaveProperty('name', 'Updated Name');
      });

      it('should allow multiple updates', async () => {
        const org = await ctx.commands.addOrg(ctx.createContext(), {
          name: 'Original',
        });

        await ctx.commands.changeOrg(ctx.createContext(), org.orgID, {
          name: 'Update 1',
        });

        await ctx.commands.changeOrg(ctx.createContext(), org.orgID, {
          name: 'Update 2',
        });

        const events = await ctx.getEvents('org', org.orgID);
        const changeEvents = events.filter(e => e.eventType === 'org.changed');
        expect(changeEvents.length).toBe(2);
      });
    });

    describe('Error Cases', () => {
      it('should fail for non-existent organization', async () => {
        await expect(
          ctx.commands.changeOrg(ctx.createContext(), 'non-existent-org', {
            name: 'New Name',
          })
        ).rejects.toThrow(/not found/i);
      });

      it('should fail with empty name', async () => {
        const org = await ctx.commands.addOrg(ctx.createContext(), {
          name: 'Test Org',
        });

        await expect(
          ctx.commands.changeOrg(ctx.createContext(), org.orgID, {
            name: '',
          })
        ).rejects.toThrow();
      });
    });
  });

  describe('deactivateOrg', () => {
    describe('Success Cases', () => {
      it('should deactivate active organization', async () => {
        const org = await ctx.commands.addOrg(ctx.createContext(), {
          name: 'Org to Deactivate',
        });

        const result = await ctx.commands.deactivateOrg(
          ctx.createContext(),
          org.orgID
        );

        expect(result).toBeDefined();
        await ctx.assertEventPublished('org.deactivated');
      });
    });

    describe('Error Cases', () => {
      it('should fail for non-existent organization', async () => {
        await expect(
          ctx.commands.deactivateOrg(ctx.createContext(), 'non-existent-org')
        ).rejects.toThrow(/not found/i);
      });
    });
  });

  describe('reactivateOrg', () => {
    describe('Success Cases', () => {
      it('should reactivate deactivated organization', async () => {
        const org = await ctx.commands.addOrg(ctx.createContext(), {
          name: 'Org to Reactivate',
        });

        await ctx.commands.deactivateOrg(ctx.createContext(), org.orgID);

        const result = await ctx.commands.reactivateOrg(
          ctx.createContext(),
          org.orgID
        );

        expect(result).toBeDefined();
        await ctx.assertEventPublished('org.reactivated');
      });
    });

    describe('Error Cases', () => {
      it('should fail for non-existent organization', async () => {
        await expect(
          ctx.commands.reactivateOrg(ctx.createContext(), 'non-existent-org')
        ).rejects.toThrow(/not found/i);
      });
    });
  });

  describe('Organization Lifecycle', () => {
    it('should handle complete organization lifecycle', async () => {
      // Create
      const org = await ctx.commands.addOrg(ctx.createContext(), {
        name: 'Lifecycle Org',
      });

      // Update
      await ctx.commands.changeOrg(ctx.createContext(), org.orgID, {
        name: 'Updated Lifecycle Org',
      });

      // Deactivate
      await ctx.commands.deactivateOrg(ctx.createContext(), org.orgID);

      // Reactivate
      await ctx.commands.reactivateOrg(ctx.createContext(), org.orgID);

      // Verify event sequence
      const events = await ctx.getEvents('org', org.orgID);
      const eventTypes = events.map(e => e.eventType);

      expect(eventTypes).toContain('org.added');
      expect(eventTypes).toContain('org.changed');
      expect(eventTypes).toContain('org.deactivated');
      expect(eventTypes).toContain('org.reactivated');
    });
  });

  describe('Organization Isolation', () => {
    it('should keep organizations isolated', async () => {
      const org1 = await ctx.commands.addOrg(ctx.createContext(), {
        name: 'Isolated Org 1',
      });

      const org2 = await ctx.commands.addOrg(ctx.createContext(), {
        name: 'Isolated Org 2',
      });

      // Deactivate org1
      await ctx.commands.deactivateOrg(ctx.createContext(), org1.orgID);

      // Org2 should still be active (no deactivation event)
      const org2Events = await ctx.getEvents('org', org2.orgID);
      const deactivationEvents = org2Events.filter(
        e => e.eventType === 'org.deactivated'
      );
      expect(deactivationEvents.length).toBe(0);
    });
  });

  describe('Organization Naming', () => {
    it('should allow organizations with same name', async () => {
      const name = 'Duplicate Name Org';

      const org1 = await ctx.commands.addOrg(ctx.createContext(), { name });
      const org2 = await ctx.commands.addOrg(ctx.createContext(), { name });

      expect(org1.orgID).not.toBe(org2.orgID);
      // Different IDs, same name is allowed
    });

    it('should handle special characters in name', async () => {
      const org = await ctx.commands.addOrg(ctx.createContext(), {
        name: 'Test Org with Special !@#$%',
      });

      expect(org.orgID).toBeDefined();
    });

    it('should handle unicode in name', async () => {
      const org = await ctx.commands.addOrg(ctx.createContext(), {
        name: 'Organisation 日本語 Café',
      });

      expect(org.orgID).toBeDefined();
    });
  });
});
