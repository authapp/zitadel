/**
 * Instance-Level IDP Commands Integration Tests
 * 
 * Tests command→event→projection→query flow for instance-level IDP management
 * Based on established pattern from jwt-idp.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { IDPProjection } from '../../../src/lib/query/projections/idp-projection';
import { IDPQueries } from '../../../src/lib/query/idp/idp-queries';
import { IDPType, IDPState } from '../../../src/lib/query/idp/idp-types';

describe('Instance-Level IDP Commands - Complete Flow', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let idpProjection: IDPProjection;
  let idpQueries: IDPQueries;
  const instanceID = 'test-instance';

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
   * Helper: Verify instance IDP exists via Query Layer
   */
  async function assertInstanceIDPInQuery(idpID: string, expectedName?: string, expectedType?: IDPType) {
    const idp = await idpQueries.getIDPByID(idpID, instanceID);

    expect(idp).not.toBeNull();
    expect(idp!.resourceOwner).toBe(instanceID);
    
    if (expectedName) {
      expect(idp!.name).toBe(expectedName);
    }

    if (expectedType) {
      expect(idp!.type).toBe(expectedType);
    }
    
    console.log(`✓ Instance IDP verified via query layer: ${idp!.name} (${idp!.type})`);
    return idp;
  }

  /**
   * Helper: Verify instance IDP is removed (state = REMOVED)
   */
  async function assertInstanceIDPNotInQuery(idpID: string) {
    const idp = await idpQueries.getIDPByID(idpID, instanceID);
    // IDP should either be null or have state = 2 (REMOVED)
    if (idp) {
      expect(idp.state).toBe(IDPState.REMOVED); // state = 2
    }
    console.log(`✓ Verified instance IDP removed: ${idpID}`);
  }

  describe('addOIDCIDPToInstance', () => {
    describe('Success Cases', () => {
      it('should add OIDC IDP to instance', async () => {
        const idpID = await ctx.commands.nextID();

        console.log('\n--- Adding Instance-Level OIDC IDP ---');
        const result = await ctx.commands.addOIDCIDPToInstance(
          ctx.createContext(),
          instanceID,
          {
            idpID,
            name: 'Global OIDC Provider',
            clientID: 'global-client-id',
            clientSecret: 'global-client-secret',
            issuer: 'https://oidc.global.com',
            scopes: ['openid', 'profile', 'email'],
          }
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('instance.idp.oidc.added');
        expect(event.payload).toHaveProperty('name', 'Global OIDC Provider');
        expect(event.payload).toHaveProperty('type', IDPType.OIDC);
        expect(event.payload).toHaveProperty('issuer', 'https://oidc.global.com');

        // Process and verify via query layer
        await processProjection();
        const idp = await assertInstanceIDPInQuery(idpID, 'Global OIDC Provider', IDPType.OIDC);
        expect(idp?.state).toBe(IDPState.ACTIVE);
      });

      it('should add instance OIDC IDP with default scopes', async () => {
        const idpID = await ctx.commands.nextID();

        await ctx.commands.addOIDCIDPToInstance(
          ctx.createContext(),
          instanceID,
          {
            idpID,
            name: 'Default Scopes OIDC',
            clientID: 'client-id',
            clientSecret: 'client-secret',
            issuer: 'https://oidc.example.com',
          }
        );

        const event = await ctx.assertEventPublished('instance.idp.oidc.added');
        expect(event.payload?.scopes).toEqual(['openid', 'profile', 'email']);

        console.log('✓ Instance OIDC IDP with default scopes added');
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty name', async () => {
        await expect(
          ctx.commands.addOIDCIDPToInstance(
            ctx.createContext(),
            instanceID,
            {
              name: '',
              clientID: 'client-id',
              clientSecret: 'client-secret',
              issuer: 'https://oidc.example.com',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty name');
      });

      it('should fail with missing clientID', async () => {
        await expect(
          ctx.commands.addOIDCIDPToInstance(
            ctx.createContext(),
            instanceID,
            {
              name: 'Test OIDC',
              clientID: '',
              clientSecret: 'client-secret',
              issuer: 'https://oidc.example.com',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected missing clientID');
      });
    });
  });

  describe('addOAuthIDPToInstance', () => {
    describe('Success Cases', () => {
      it('should add OAuth IDP to instance', async () => {
        const idpID = await ctx.commands.nextID();

        console.log('\n--- Adding Instance-Level OAuth IDP ---');
        const result = await ctx.commands.addOAuthIDPToInstance(
          ctx.createContext(),
          instanceID,
          {
            idpID,
            name: 'Global OAuth Provider',
            clientID: 'global-oauth-client',
            clientSecret: 'global-oauth-secret',
            authorizationEndpoint: 'https://oauth.global.com/authorize',
            tokenEndpoint: 'https://oauth.global.com/token',
            userEndpoint: 'https://oauth.global.com/userinfo',
            scopes: ['read:user', 'read:email'],
          }
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('instance.idp.oauth.added');
        expect(event.payload).toHaveProperty('name', 'Global OAuth Provider');
        expect(event.payload).toHaveProperty('type', IDPType.OAUTH);
        expect(event.payload).toHaveProperty('authorizationEndpoint', 'https://oauth.global.com/authorize');

        // Process and verify via query layer
        await processProjection();
        await assertInstanceIDPInQuery(idpID, 'Global OAuth Provider', IDPType.OAUTH);
      });
    });

    describe('Error Cases', () => {
      it('should fail with missing endpoints', async () => {
        await expect(
          ctx.commands.addOAuthIDPToInstance(
            ctx.createContext(),
            instanceID,
            {
              name: 'Test OAuth',
              clientID: 'client-id',
              clientSecret: 'client-secret',
              authorizationEndpoint: '',
              tokenEndpoint: 'https://oauth.example.com/token',
              userEndpoint: 'https://oauth.example.com/userinfo',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected missing authorization endpoint');
      });
    });
  });

  describe('updateInstanceIDP', () => {
    describe('Success Cases', () => {
      it('should update instance IDP name', async () => {
        const idpID = await ctx.commands.nextID();

        // Add instance IDP
        await ctx.commands.addOIDCIDPToInstance(
          ctx.createContext(),
          instanceID,
          {
            idpID,
            name: 'Original Name',
            clientID: 'client-id',
            clientSecret: 'client-secret',
            issuer: 'https://oidc.example.com',
          }
        );

        // Get event count before update
        const eventsBefore = await ctx.getEvents('*', '*');
        const eventCountBefore = eventsBefore.length;

        console.log('\n--- Updating Instance IDP ---');
        await ctx.commands.updateInstanceIDP(
          ctx.createContext(),
          instanceID,
          idpID,
          {
            name: 'Updated Name',
          }
        );

        // Verify change event was published
        const eventsAfter = await ctx.getEvents('*', '*');
        expect(eventsAfter.length).toBe(eventCountBefore + 1);

        const changeEvent = eventsAfter.find(e => e.eventType === 'instance.idp.changed');
        expect(changeEvent).toBeDefined();
        expect(changeEvent!.payload).toHaveProperty('name', 'Updated Name');

        console.log('✓ Instance IDP updated successfully');
      });

      it('should be idempotent - no event for same name', async () => {
        const idpID = await ctx.commands.nextID();

        await ctx.commands.addOIDCIDPToInstance(
          ctx.createContext(),
          instanceID,
          {
            idpID,
            name: 'Idempotent Name',
            clientID: 'client-id',
            clientSecret: 'client-secret',
            issuer: 'https://oidc.example.com',
          }
        );

        // Get event count before idempotent update
        const eventsBefore = await ctx.getEvents('*', '*');
        const eventCountBefore = eventsBefore.length;

        // Update with same name
        await ctx.commands.updateInstanceIDP(
          ctx.createContext(),
          instanceID,
          idpID,
          {
            name: 'Idempotent Name',
          }
        );

        // Verify no new event
        const eventsAfter = await ctx.getEvents('*', '*');
        expect(eventsAfter.length).toBe(eventCountBefore);

        console.log('✓ Idempotent - no event for same name');
      });
    });

    describe('Error Cases', () => {
      it('should fail on non-existent IDP', async () => {
        const fakeIDPID = await ctx.commands.nextID();

        await expect(
          ctx.commands.updateInstanceIDP(
            ctx.createContext(),
            instanceID,
            fakeIDPID,
            {
              name: 'Updated Name',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected update to non-existent IDP');
      });
    });
  });

  describe('removeInstanceIDP', () => {
    describe('Success Cases', () => {
      it('should remove instance IDP', async () => {
        const idpID = await ctx.commands.nextID();

        // Add instance IDP
        await ctx.commands.addOIDCIDPToInstance(
          ctx.createContext(),
          instanceID,
          {
            idpID,
            name: 'To Be Removed',
            clientID: 'client-id',
            clientSecret: 'client-secret',
            issuer: 'https://oidc.example.com',
          }
        );

        await processProjection();
        await assertInstanceIDPInQuery(idpID, 'To Be Removed');

        console.log('\n--- Removing Instance IDP ---');
        await ctx.commands.removeInstanceIDP(
          ctx.createContext(),
          instanceID,
          idpID
        );

        // Verify remove event
        const event = await ctx.assertEventPublished('instance.idp.removed');
        expect(event.payload).toHaveProperty('idpID', idpID);

        await processProjection();
        await assertInstanceIDPNotInQuery(idpID);
      });
    });

    describe('Error Cases', () => {
      it('should fail removing non-existent IDP', async () => {
        const fakeIDPID = await ctx.commands.nextID();

        await expect(
          ctx.commands.removeInstanceIDP(
            ctx.createContext(),
            instanceID,
            fakeIDPID
          )
        ).rejects.toThrow();

        console.log('✓ Rejected remove of non-existent IDP');
      });
    });
  });

  describe('Complete Lifecycle', () => {
    it('should complete add → update → remove lifecycle for OIDC', async () => {
      const idpID = await ctx.commands.nextID();

      console.log('\n--- Testing Complete Lifecycle ---');

      // 1. Add instance OIDC IDP
      console.log('Step 1: Add instance OIDC IDP');
      await ctx.commands.addOIDCIDPToInstance(
        ctx.createContext(),
        instanceID,
        {
          idpID,
          name: 'Lifecycle OIDC IDP',
          clientID: 'client-id',
          clientSecret: 'client-secret',
          issuer: 'https://oidc.example.com',
        }
      );

      await processProjection();
      await assertInstanceIDPInQuery(idpID, 'Lifecycle OIDC IDP', IDPType.OIDC);

      // 2. Update instance IDP
      console.log('Step 2: Update instance IDP');
      await ctx.commands.updateInstanceIDP(
        ctx.createContext(),
        instanceID,
        idpID,
        {
          name: 'Updated Lifecycle OIDC IDP',
        }
      );

      await processProjection();
      await assertInstanceIDPInQuery(idpID, 'Updated Lifecycle OIDC IDP', IDPType.OIDC);

      // 3. Remove instance IDP
      console.log('Step 3: Remove instance IDP');
      await ctx.commands.removeInstanceIDP(
        ctx.createContext(),
        instanceID,
        idpID
      );

      await processProjection();
      await assertInstanceIDPNotInQuery(idpID);

      console.log('✓ Complete lifecycle tested successfully');
    });

    it('should complete add → remove lifecycle for OAuth', async () => {
      const idpID = await ctx.commands.nextID();

      console.log('\n--- Testing OAuth Lifecycle ---');

      // 1. Add instance OAuth IDP
      console.log('Step 1: Add instance OAuth IDP');
      await ctx.commands.addOAuthIDPToInstance(
        ctx.createContext(),
        instanceID,
        {
          idpID,
          name: 'Lifecycle OAuth IDP',
          clientID: 'oauth-client',
          clientSecret: 'oauth-secret',
          authorizationEndpoint: 'https://oauth.example.com/authorize',
          tokenEndpoint: 'https://oauth.example.com/token',
          userEndpoint: 'https://oauth.example.com/userinfo',
        }
      );

      await processProjection();
      await assertInstanceIDPInQuery(idpID, 'Lifecycle OAuth IDP', IDPType.OAUTH);

      // 2. Remove instance IDP
      console.log('Step 2: Remove instance OAuth IDP');
      await ctx.commands.removeInstanceIDP(
        ctx.createContext(),
        instanceID,
        idpID
      );

      await processProjection();
      await assertInstanceIDPNotInQuery(idpID);

      console.log('✓ OAuth lifecycle tested successfully');
    });
  });
});
