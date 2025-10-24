/**
 * Organization IDP Commands Integration Tests
 * 
 * Tests command→event→projection→query flow for IDP management
 * Based on established pattern from org-member.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder } from '../../helpers/test-data-builders';
import { IDPProjection } from '../../../src/lib/query/projections/idp-projection';
import { IDPQueries } from '../../../src/lib/query/idp/idp-queries';
import { IDPType, IDPState } from '../../../src/lib/query/idp/idp-types';

describe('Organization IDP Commands - Complete Flow', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let idpProjection: IDPProjection;
  let idpQueries: IDPQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projection
    idpProjection = new IDPProjection(ctx.eventstore, pool);
    await idpProjection.init();
    
    // Initialize query layer
    idpQueries = new IDPQueries(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    // Clear all events
    await ctx.clearEvents();
    
    // Clear projection data
    await pool.query('TRUNCATE projections.idps CASCADE');
  });

  /**
   * Helper: Create test organization via commands
   */
  async function createTestOrg() {
    const orgData = new OrganizationBuilder()
      .withName(`IDP Test Org ${Date.now()}`)
      .build();

    const org = await ctx.commands.addOrg(ctx.createContext(), orgData);
    console.log(`✓ Created org: ${org.orgID}`);
    
    return org;
  }

  /**
   * Helper: Process projection
   */
  async function processProjection() {
    const events = await ctx.getEvents('*', '*');
    
    console.log(`Processing ${events.length} event(s) through projection...`);
    
    for (const event of events) {
      try {
        await idpProjection.reduce(event);
        console.log(`  ✓ Processed ${event.eventType}`);
      } catch (err) {
        console.error(`  ✗ Failed to process ${event.eventType}:`, err);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Verify IDP exists via Query Layer
   */
  async function assertIDPInQuery(orgID: string, idpID: string, expectedName?: string) {
    const idp = await idpQueries.getIDPByID(idpID, 'test-instance');

    expect(idp).not.toBeNull();
    expect(idp!.resourceOwner).toBe(orgID);
    
    if (expectedName) {
      expect(idp!.name).toBe(expectedName);
    }
    
    console.log(`✓ IDP verified via query layer: ${idp!.name}`);
    return idp;
  }

  /**
   * Helper: Verify IDP does NOT exist
   */
  async function assertIDPNotInQuery(idpID: string) {
    const idp = await idpQueries.getIDPByID(idpID, 'test-instance');
    expect(idp).toBeNull();
    console.log(`✓ Verified IDP removed: ${idpID}`);
  }

  describe('addOIDCIDPToOrg', () => {
    describe('Success Cases', () => {
      it('should add OIDC IDP to organization', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        console.log('\n--- Adding OIDC IDP ---');
        const result = await ctx.commands.addOIDCIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Test OIDC IDP',
            issuer: 'https://accounts.google.com',
            clientID: 'test-client-id',
            clientSecret: 'test-client-secret',
            scopes: ['openid', 'profile', 'email'],
          }
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('org.idp.oidc.added');
        expect(event.payload).toHaveProperty('name', 'Test OIDC IDP');
        expect(event.payload).toHaveProperty('type', IDPType.OIDC);
        expect(event.payload?.config).toHaveProperty('issuer', 'https://accounts.google.com');

        // Process and verify via query layer
        await processProjection();
        const idp = await assertIDPInQuery(org.orgID, idpID, 'Test OIDC IDP');
        expect(idp?.type).toBe(IDPType.OIDC);
        expect(idp?.state).toBe(IDPState.ACTIVE);
      });

      it('should add OIDC IDP with optional mappings', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOIDCIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'OIDC with Mappings',
            issuer: 'https://idp.example.com',
            clientID: 'client-123',
            clientSecret: 'secret-456',
            scopes: ['openid', 'profile'],
            displayNameMapping: 'name',
            usernameMapping: 'preferred_username',
          }
        );

        const event = await ctx.assertEventPublished('org.idp.oidc.added');
        expect(event.payload?.config).toHaveProperty('displayNameMapping', 'name');
        expect(event.payload?.config).toHaveProperty('usernameMapping', 'preferred_username');
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty name', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addOIDCIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: '',
              issuer: 'https://example.com',
              clientID: 'client',
              clientSecret: 'secret',
              scopes: ['openid'],
            }
          )
        ).rejects.toThrow(/name.*required/i);
      });

      it('should fail with empty scopes', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addOIDCIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: 'Test IDP',
              issuer: 'https://example.com',
              clientID: 'client',
              clientSecret: 'secret',
              scopes: [],
            }
          )
        ).rejects.toThrow(/scope.*required/i);
      });

      it('should fail when adding duplicate IDP', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        // Add first time
        await ctx.commands.addOIDCIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Test IDP',
            issuer: 'https://example.com',
            clientID: 'client',
            clientSecret: 'secret',
            scopes: ['openid'],
          }
        );

        // Try to add again with same ID
        await expect(
          ctx.commands.addOIDCIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              idpID,
              name: 'Another IDP',
              issuer: 'https://example.com',
              clientID: 'client',
              clientSecret: 'secret',
              scopes: ['openid'],
            }
          )
        ).rejects.toThrow(/already exists/i);
      });
    });
  });

  describe('addOAuthIDPToOrg', () => {
    describe('Success Cases', () => {
      it('should add OAuth IDP to organization', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        console.log('\n--- Adding OAuth IDP ---');
        const result = await ctx.commands.addOAuthIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Custom OAuth Provider',
            clientID: 'oauth-client',
            clientSecret: 'oauth-secret',
            authorizationEndpoint: 'https://oauth.example.com/authorize',
            tokenEndpoint: 'https://oauth.example.com/token',
            userEndpoint: 'https://oauth.example.com/user',
            scopes: ['read', 'write'],
          }
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('org.idp.oauth.added');
        expect(event.payload).toHaveProperty('name', 'Custom OAuth Provider');
        expect(event.payload).toHaveProperty('type', IDPType.OAUTH);
        
        // Process and verify
        await processProjection();
        const idp = await assertIDPInQuery(org.orgID, idpID, 'Custom OAuth Provider');
        expect(idp?.type).toBe(IDPType.OAUTH);
      });
    });

    describe('Error Cases', () => {
      it('should fail with missing endpoints', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addOAuthIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: 'Invalid OAuth',
              clientID: 'client',
              clientSecret: 'secret',
              authorizationEndpoint: '',
              tokenEndpoint: '',
              userEndpoint: '',
              scopes: ['read'],
            }
          )
        ).rejects.toThrow();
      });
    });
  });

  describe('updateOrgIDP', () => {
    describe('Success Cases', () => {
      it('should update IDP name', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        // Add IDP
        await ctx.commands.addOIDCIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Original Name',
            issuer: 'https://example.com',
            clientID: 'client',
            clientSecret: 'secret',
            scopes: ['openid'],
          }
        );

        await processProjection();

        // Update name
        console.log('\n--- Updating IDP ---');
        await ctx.commands.updateOrgIDP(
          ctx.createContext(),
          org.orgID,
          idpID,
          {
            name: 'Updated Name',
          }
        );

        // Verify event
        const event = await ctx.assertEventPublished('org.idp.changed');
        expect(event.payload).toHaveProperty('name', 'Updated Name');

        // Process and verify
        await processProjection();
        const idp = await assertIDPInQuery(org.orgID, idpID, 'Updated Name');
        expect(idp?.name).toBe('Updated Name');
      });

      it('should be idempotent when no changes', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        await ctx.commands.addOIDCIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Test IDP',
            issuer: 'https://example.com',
            clientID: 'client',
            clientSecret: 'secret',
            scopes: ['openid'],
          }
        );

        const eventsBefore = await ctx.getEvents('org', org.orgID);
        const countBefore = eventsBefore.length;

        // Update with no changes
        await ctx.commands.updateOrgIDP(
          ctx.createContext(),
          org.orgID,
          idpID,
          {}
        );

        const eventsAfter = await ctx.getEvents('org', org.orgID);
        const countAfter = eventsAfter.length;

        // Should not create new event
        expect(countAfter).toBe(countBefore);
        console.log('✓ Idempotency verified: no new event created');
      });
    });

    describe('Error Cases', () => {
      it('should fail for non-existent IDP', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.updateOrgIDP(
            ctx.createContext(),
            org.orgID,
            'non-existent-idp',
            { name: 'New Name' }
          )
        ).rejects.toThrow(/not found/i);
      });
    });
  });

  describe('removeIDPFromOrg', () => {
    describe('Success Cases', () => {
      it('should remove IDP from organization', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        // Add IDP
        await ctx.commands.addOIDCIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'To Be Removed',
            issuer: 'https://example.com',
            clientID: 'client',
            clientSecret: 'secret',
            scopes: ['openid'],
          }
        );

        await processProjection();
        await assertIDPInQuery(org.orgID, idpID);

        // Remove IDP
        console.log('\n--- Removing IDP ---');
        await ctx.commands.removeIDPFromOrg(
          ctx.createContext(),
          org.orgID,
          idpID
        );

        // Verify event
        await ctx.assertEventPublished('org.idp.removed');

        // Process and verify removal
        await processProjection();
        await assertIDPNotInQuery(idpID);
      });

      it('should be idempotent when IDP already removed', async () => {
        const org = await createTestOrg();

        // Remove non-existent IDP - should succeed
        const result = await ctx.commands.removeIDPFromOrg(
          ctx.createContext(),
          org.orgID,
          'non-existent-idp'
        );

        expect(result).toBeDefined();
        console.log('✓ Idempotency verified: removing non-existent IDP succeeds');
      });
    });
  });

  describe('IDP Lifecycle', () => {
    it('should handle complete lifecycle: add → update → remove', async () => {
      const org = await createTestOrg();
      const idpID = await ctx.commands.nextID();

      console.log('\n=== Complete IDP Lifecycle ===');

      // Step 1: Add IDP
      console.log('\n1. ADD IDP');
      await ctx.commands.addOIDCIDPToOrg(
        ctx.createContext(),
        org.orgID,
        {
          idpID,
          name: 'Lifecycle IDP',
          issuer: 'https://example.com',
          clientID: 'client',
          clientSecret: 'secret',
          scopes: ['openid', 'profile'],
        }
      );
      await processProjection();
      await assertIDPInQuery(org.orgID, idpID, 'Lifecycle IDP');

      // Step 2: Update IDP
      console.log('\n2. UPDATE IDP');
      await ctx.commands.updateOrgIDP(
        ctx.createContext(),
        org.orgID,
        idpID,
        {
          name: 'Updated Lifecycle IDP',
          isAutoCreation: true,
        }
      );
      await processProjection();
      await assertIDPInQuery(org.orgID, idpID, 'Updated Lifecycle IDP');

      // Step 3: Remove IDP
      console.log('\n3. REMOVE IDP');
      await ctx.commands.removeIDPFromOrg(
        ctx.createContext(),
        org.orgID,
        idpID
      );
      await processProjection();
      await assertIDPNotInQuery(idpID);

      // Verify event sequence
      console.log('\n4. VERIFY EVENT SEQUENCE');
      const events = await ctx.getEvents('org', org.orgID);
      const eventTypes = events.map(e => e.eventType);

      expect(eventTypes).toContain('org.idp.oidc.added');
      expect(eventTypes).toContain('org.idp.changed');
      expect(eventTypes).toContain('org.idp.removed');

      console.log(`✓ Complete lifecycle verified`);
    });
  });
});
