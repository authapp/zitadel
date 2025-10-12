/**
 * Organization Domain Command Tests
 * 
 * Tests for:
 * - Adding domains to organizations
 * - Domain verification
 * - Setting primary domains
 * - Removing domains
 * - Domain validation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder } from '../../helpers/test-data-builders';

describe('Organization Domain Commands', () => {
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

  // Helper: Create organization
  async function createTestOrg(name?: string) {
    const orgData = new OrganizationBuilder()
      .withName(name || `Domain Test Org ${Date.now()}`)
      .build();

    const org = await ctx.commands.addOrg(ctx.createContext(), orgData);
    return org;
  }

  describe('addDomain', () => {
    describe('Success Cases', () => {
      it('should add domain to organization', async () => {
        const org = await createTestOrg();
        const domain = `test-${Date.now()}.example.com`;

        const result = await ctx.commands.addDomain(
          ctx.createContext(),
          org.orgID,
          { domain }
        );

        expect(result).toBeDefined();

        // Get all domain.added events and find ours (not the IAM domain)
        const events = await ctx.getEvents('org', org.orgID);
        const domainAddedEvents = events.filter(e => e.eventType === 'org.domain.added');
        const ourEvent = domainAddedEvents.find(e => e.payload?.domain === domain);
        expect(ourEvent).toBeDefined();
        expect(ourEvent?.payload).toHaveProperty('domain', domain);
      });

      it('should allow multiple domains per organization', async () => {
        const org = await createTestOrg();
        
        const domain1 = `domain1-${Date.now()}.example.com`;
        const domain2 = `domain2-${Date.now()}.example.com`;

        await ctx.commands.addDomain(
          ctx.createContext(),
          org.orgID,
          { domain: domain1 }
        );

        await ctx.commands.addDomain(
          ctx.createContext(),
          org.orgID,
          { domain: domain2 }
        );

        const events = await ctx.getEvents('org', org.orgID);
        const domainEvents = events.filter(e => e.eventType === 'org.domain.added');
        // Should have 3: 1 IAM domain + 2 added domains
        expect(domainEvents.length).toBeGreaterThanOrEqual(2);
        
        // Verify our specific domains were added
        const domain1Event = domainEvents.find(e => e.payload?.domain === domain1);
        const domain2Event = domainEvents.find(e => e.payload?.domain === domain2);
        expect(domain1Event).toBeDefined();
        expect(domain2Event).toBeDefined();
      });

      it('should handle subdomains', async () => {
        const org = await createTestOrg();
        const domain = `app.subdomain.${Date.now()}.example.com`;

        const result = await ctx.commands.addDomain(
          ctx.createContext(),
          org.orgID,
          { domain }
        );

        expect(result).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail with invalid domain format', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addDomain(ctx.createContext(), org.orgID, { domain: 'invalid domain!' })
        ).rejects.toThrow();
      });

      it('should fail with empty domain', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addDomain(ctx.createContext(), org.orgID, { domain: '' })
        ).rejects.toThrow();
      });

      it('should fail for non-existent organization', async () => {
        await expect(
          ctx.commands.addDomain(
            ctx.createContext(),
            'non-existent-org',
            { domain: 'test.example.com' }
          )
        ).rejects.toThrow(/not found/i);
      });
    });
  });

  describe('verifyDomain', () => {
    describe('Success Cases', () => {
      it('should mark domain as verified', async () => {
        const org = await createTestOrg();
        const domain = `verify-${Date.now()}.example.com`;

        await ctx.commands.addDomain(ctx.createContext(), org.orgID, { domain });

        const result = await ctx.commands.verifyDomain(
          ctx.createContext(),
          org.orgID,
          domain
        );

        expect(result).toBeDefined();
        await ctx.assertEventPublished('org.domain.verified');
      });
    });

    describe('Error Cases', () => {
      it('should fail for non-existent domain', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.verifyDomain(
            ctx.createContext(),
            org.orgID,
            'non-existent.example.com'
          )
        ).rejects.toThrow();
      });

      it('should fail for non-existent organization', async () => {
        await expect(
          ctx.commands.verifyDomain(
            ctx.createContext(),
            'non-existent-org',
            'test.example.com'
          )
        ).rejects.toThrow(/not found/i);
      });
    });
  });

  describe('setPrimaryDomain', () => {
    describe('Success Cases', () => {
      it('should set domain as primary', async () => {
        const org = await createTestOrg();
        const domain = `primary-${Date.now()}.example.com`;

        await ctx.commands.addDomain(ctx.createContext(), org.orgID, { domain });
        await ctx.commands.verifyDomain(ctx.createContext(), org.orgID, domain);

        const result = await ctx.commands.setPrimaryDomain(
          ctx.createContext(),
          org.orgID,
          domain
        );

        expect(result).toBeDefined();
        await ctx.assertEventPublished('org.domain.primary.set');
      });

      it('should change primary domain', async () => {
        const org = await createTestOrg();
        const domain1 = `primary1-${Date.now()}.example.com`;
        const domain2 = `primary2-${Date.now()}.example.com`;

        // Add and verify both domains
        await ctx.commands.addDomain(ctx.createContext(), org.orgID, { domain: domain1 });
        await ctx.commands.verifyDomain(ctx.createContext(), org.orgID, domain1);

        await ctx.commands.addDomain(ctx.createContext(), org.orgID, { domain: domain2 });
        await ctx.commands.verifyDomain(ctx.createContext(), org.orgID, domain2);

        // Set first as primary
        await ctx.commands.setPrimaryDomain(ctx.createContext(), org.orgID, domain1);

        // Change to second as primary
        await ctx.commands.setPrimaryDomain(ctx.createContext(), org.orgID, domain2);

        const events = await ctx.getEvents('org', org.orgID);
        const primaryEvents = events.filter(
          e => e.eventType === 'org.domain.primary.set'
        );
        // Should have at least 2 primary set events (may have 3 if IAM domain was also set as primary)
        expect(primaryEvents.length).toBeGreaterThanOrEqual(2);
        
        // Verify our specific domains were set
        const domain1Primary = primaryEvents.find(e => e.payload?.domain === domain1);
        const domain2Primary = primaryEvents.find(e => e.payload?.domain === domain2);
        expect(domain1Primary).toBeDefined();
        expect(domain2Primary).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail for unverified domain', async () => {
        const org = await createTestOrg();
        const domain = `unverified-${Date.now()}.example.com`;

        await ctx.commands.addDomain(ctx.createContext(), org.orgID, { domain });

        await expect(
          ctx.commands.setPrimaryDomain(ctx.createContext(), org.orgID, domain)
        ).rejects.toThrow();
      });

      it('should fail for non-existent domain', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.setPrimaryDomain(
            ctx.createContext(),
            org.orgID,
            'non-existent.example.com'
          )
        ).rejects.toThrow();
      });
    });
  });

  describe('removeDomain', () => {
    describe('Success Cases', () => {
      it('should remove domain from organization', async () => {
        const org = await createTestOrg();
        const domain = `remove-${Date.now()}.example.com`;

        await ctx.commands.addDomain(ctx.createContext(), org.orgID, { domain });

        const result = await ctx.commands.removeDomain(
          ctx.createContext(),
          org.orgID,
          domain
        );

        expect(result).toBeDefined();
        await ctx.assertEventPublished('org.domain.removed');
      });

      it('should allow re-adding after removal', async () => {
        const org = await createTestOrg();
        const domain = `readd-${Date.now()}.example.com`;

        // Add
        await ctx.commands.addDomain(ctx.createContext(), org.orgID, { domain });

        // Remove
        await ctx.commands.removeDomain(ctx.createContext(), org.orgID, domain);

        // Re-add
        await ctx.commands.addDomain(ctx.createContext(), org.orgID, { domain });

        const events = await ctx.getEvents('org', org.orgID);
        const addEvents = events.filter(e => e.eventType === 'org.domain.added' && e.payload?.domain === domain);
        const removeEvents = events.filter(
          e => e.eventType === 'org.domain.removed' && e.payload?.domain === domain
        );

        expect(addEvents.length).toBe(2); // Added twice
        expect(removeEvents.length).toBe(1); // Removed once
      });
    });

    describe('Error Cases', () => {
      it('should fail for non-existent domain', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.removeDomain(
            ctx.createContext(),
            org.orgID,
            'non-existent.example.com'
          )
        ).rejects.toThrow();
      });

      it('should fail to remove primary domain', async () => {
        const org = await createTestOrg();
        const domain = `primary-remove-${Date.now()}.example.com`;

        await ctx.commands.addDomain(ctx.createContext(), org.orgID, { domain });
        await ctx.commands.verifyDomain(ctx.createContext(), org.orgID, domain);
        await ctx.commands.setPrimaryDomain(ctx.createContext(), org.orgID, domain);

        await expect(
          ctx.commands.removeDomain(ctx.createContext(), org.orgID, domain)
        ).rejects.toThrow();
      });
    });
  });

  describe('Domain Lifecycle', () => {
    it('should handle complete domain lifecycle', async () => {
      const org = await createTestOrg();
      const domain1 = `lifecycle1-${Date.now()}.example.com`;
      const domain2 = `lifecycle2-${Date.now()}.example.com`;

      // Add domains
      await ctx.commands.addDomain(ctx.createContext(), org.orgID, { domain: domain1 });
      await ctx.commands.addDomain(ctx.createContext(), org.orgID, { domain: domain2 });

      // Verify domains
      await ctx.commands.verifyDomain(ctx.createContext(), org.orgID, domain1);
      await ctx.commands.verifyDomain(ctx.createContext(), org.orgID, domain2);

      // Set primary
      await ctx.commands.setPrimaryDomain(ctx.createContext(), org.orgID, domain1);

      // Change primary
      await ctx.commands.setPrimaryDomain(ctx.createContext(), org.orgID, domain2);

      // Remove non-primary domain
      await ctx.commands.removeDomain(ctx.createContext(), org.orgID, domain1);

      // Verify event sequence
      const events = await ctx.getEvents('org', org.orgID);
      const eventTypes = events.map(e => e.eventType);

      expect(eventTypes).toContain('org.domain.added');
      expect(eventTypes).toContain('org.domain.verified');
      expect(eventTypes).toContain('org.domain.primary.set');
      expect(eventTypes).toContain('org.domain.removed');
    });
  });

  describe('Domain Validation', () => {
    it('should handle international domain names', async () => {
      const org = await createTestOrg();
      // Punycode representation of internationalized domain
      const domain = `xn--test-${Date.now()}.example.com`;

      const result = await ctx.commands.addDomain(
        ctx.createContext(),
        org.orgID,
        { domain }
      );

      expect(result).toBeDefined();
    });

    it('should handle long domain names', async () => {
      const org = await createTestOrg();
      const domain = `very-long-domain-name-that-is-still-valid-${Date.now()}.example.com`;

      const result = await ctx.commands.addDomain(
        ctx.createContext(),
        org.orgID,
        { domain }
      );

      expect(result).toBeDefined();
    });
  });

  describe('Multi-Organization Domain Isolation', () => {
    it('should allow same domain in different organizations', async () => {
      const org1 = await createTestOrg('Org 1');
      const org2 = await createTestOrg('Org 2');
      const domain = `shared-${Date.now()}.example.com`;

      // Add to first org
      await ctx.commands.addDomain(ctx.createContext(), org1.orgID, { domain });

      // Should be able to add to second org (domains are org-scoped, not globally unique)
      const result = await ctx.commands.addDomain(ctx.createContext(), org2.orgID, { domain });
      expect(result).toBeDefined();
    });
  });
});
