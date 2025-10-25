/**
 * JWT IDP Commands Integration Tests
 * 
 * Tests command→event→projection→query flow for JWT IDP management
 * Based on established pattern from org-idp.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder } from '../../helpers/test-data-builders';
import { IDPProjection } from '../../../src/lib/query/projections/idp-projection';
import { IDPQueries } from '../../../src/lib/query/idp/idp-queries';
import { IDPType, IDPState } from '../../../src/lib/query/idp/idp-types';

describe('JWT IDP Commands - Complete Flow', () => {
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
      .withName(`JWT IDP Test Org ${Date.now()}`)
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
   * Helper: Verify JWT IDP exists via Query Layer
   */
  async function assertJWTIDPInQuery(orgID: string, idpID: string, expectedName?: string) {
    const idp = await idpQueries.getIDPByID(idpID, 'test-instance');

    expect(idp).not.toBeNull();
    expect(idp!.resourceOwner).toBe(orgID);
    
    if (expectedName) {
      expect(idp!.name).toBe(expectedName);
    }
    
    console.log(`✓ JWT IDP verified via query layer: ${idp!.name}`);
    return idp;
  }

  /**
   * Helper: Verify JWT IDP is removed (state = REMOVED)
   */
  async function assertJWTIDPNotInQuery(idpID: string) {
    const idp = await idpQueries.getIDPByID(idpID, 'test-instance');
    // IDP should either be null or have state = 3 (REMOVED)
    if (idp) {
      expect(idp.state).toBe(IDPState.REMOVED); // state = 3
    }
    console.log(`✓ Verified JWT IDP removed: ${idpID}`);
  }

  describe('addJWTIDPToOrg', () => {
    describe('Success Cases', () => {
      it('should add JWT IDP to organization with all fields', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        console.log('\n--- Adding JWT IDP ---');
        const result = await ctx.commands.addJWTIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Test JWT IDP',
            issuer: 'https://jwt-issuer.example.com',
            jwtEndpoint: 'https://jwt-issuer.example.com/token',
            keysEndpoint: 'https://jwt-issuer.example.com/.well-known/jwks.json',
            headerName: 'Authorization',
          }
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('org.idp.jwt.added');
        expect(event.payload).toHaveProperty('name', 'Test JWT IDP');
        expect(event.payload).toHaveProperty('type', IDPType.JWT);
        expect(event.payload?.config).toHaveProperty('issuer', 'https://jwt-issuer.example.com');
        expect(event.payload?.config).toHaveProperty('jwtEndpoint', 'https://jwt-issuer.example.com/token');
        expect(event.payload?.config).toHaveProperty('keysEndpoint', 'https://jwt-issuer.example.com/.well-known/jwks.json');
        expect(event.payload?.config).toHaveProperty('headerName', 'Authorization');

        // Process and verify via query layer
        await processProjection();
        const idp = await assertJWTIDPInQuery(org.orgID, idpID, 'Test JWT IDP');
        expect(idp?.type).toBe(IDPType.JWT);
        expect(idp?.state).toBe(IDPState.ACTIVE);
      });

      it('should add JWT IDP with default flags', async () => {
        const org = await createTestOrg();

        await ctx.commands.addJWTIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'JWT IDP with Defaults',
            issuer: 'https://issuer.example.com',
            jwtEndpoint: 'https://issuer.example.com/jwt',
            keysEndpoint: 'https://issuer.example.com/keys',
            headerName: 'X-JWT-Token',
          }
        );

        const event = await ctx.assertEventPublished('org.idp.jwt.added');
        expect(event.payload?.isCreationAllowed).toBe(true);
        expect(event.payload?.isLinkingAllowed).toBe(true);
        expect(event.payload?.isAutoCreation).toBe(false);
        expect(event.payload?.isAutoUpdate).toBe(false);
      });

      it('should support multiple JWT IDPs per organization', async () => {
        const org = await createTestOrg();

        // Add first JWT IDP
        await ctx.commands.addJWTIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'JWT IDP 1',
            issuer: 'https://jwt1.example.com',
            jwtEndpoint: 'https://jwt1.example.com/token',
            keysEndpoint: 'https://jwt1.example.com/keys',
            headerName: 'Authorization',
          }
        );

        // Add second JWT IDP
        await ctx.commands.addJWTIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'JWT IDP 2',
            issuer: 'https://jwt2.example.com',
            jwtEndpoint: 'https://jwt2.example.com/token',
            keysEndpoint: 'https://jwt2.example.com/keys',
            headerName: 'X-Custom-JWT',
          }
        );

        await processProjection();

        // Verify both exist
        const idps = await idpQueries.searchIDPs({
          instanceID: 'test-instance',
          resourceOwner: org.orgID,
          type: IDPType.JWT,
        });

        expect(idps.idps.length).toBe(2);
        console.log('✓ Multiple JWT IDPs supported');
      });

      it('should verify via query layer after adding', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        await ctx.commands.addJWTIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Query Test JWT IDP',
            issuer: 'https://query-test.example.com',
            jwtEndpoint: 'https://query-test.example.com/token',
            keysEndpoint: 'https://query-test.example.com/keys',
            headerName: 'Authorization',
          }
        );

        await processProjection();

        const idp = await assertJWTIDPInQuery(org.orgID, idpID, 'Query Test JWT IDP');
        expect(idp?.type).toBe(IDPType.JWT);
        expect(idp?.state).toBe(IDPState.ACTIVE);
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty name', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addJWTIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: '',
              issuer: 'https://issuer.example.com',
              jwtEndpoint: 'https://issuer.example.com/token',
              keysEndpoint: 'https://issuer.example.com/keys',
              headerName: 'Authorization',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty name');
      });

      it('should fail with empty issuer', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addJWTIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: 'Test JWT IDP',
              issuer: '',
              jwtEndpoint: 'https://issuer.example.com/token',
              keysEndpoint: 'https://issuer.example.com/keys',
              headerName: 'Authorization',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty issuer');
      });

      it('should fail with empty jwtEndpoint', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addJWTIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: 'Test JWT IDP',
              issuer: 'https://issuer.example.com',
              jwtEndpoint: '',
              keysEndpoint: 'https://issuer.example.com/keys',
              headerName: 'Authorization',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty jwtEndpoint');
      });

      it('should fail with empty keysEndpoint', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addJWTIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: 'Test JWT IDP',
              issuer: 'https://issuer.example.com',
              jwtEndpoint: 'https://issuer.example.com/token',
              keysEndpoint: '',
              headerName: 'Authorization',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty keysEndpoint');
      });
    });
  });

  describe('changeJWTIDP', () => {
    describe('Success Cases', () => {
      it('should update JWT IDP configuration', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        // Add JWT IDP
        await ctx.commands.addJWTIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Original JWT IDP',
            issuer: 'https://original.example.com',
            jwtEndpoint: 'https://original.example.com/token',
            keysEndpoint: 'https://original.example.com/keys',
            headerName: 'Authorization',
          }
        );

        // Get event count before update
        const eventsBefore = await ctx.getEvents('org', org.orgID);
        const eventCountBefore = eventsBefore.length;

        console.log('\n--- Updating JWT IDP ---');
        await ctx.commands.changeJWTIDP(
          ctx.createContext(),
          org.orgID,
          idpID,
          {
            name: 'Updated JWT IDP',
            issuer: 'https://updated.example.com',
            jwtEndpoint: 'https://updated.example.com/token',
            keysEndpoint: 'https://updated.example.com/keys',
            headerName: 'X-Updated-JWT',
          }
        );

        // Verify change event was published
        const eventsAfter = await ctx.getEvents('org', org.orgID);
        expect(eventsAfter.length).toBe(eventCountBefore + 1);

        const changeEvent = eventsAfter.find(e => e.eventType === 'org.idp.jwt.changed');
        expect(changeEvent).toBeDefined();
        expect(changeEvent!.payload).toHaveProperty('name', 'Updated JWT IDP');
        expect(changeEvent!.payload?.config).toHaveProperty('issuer', 'https://updated.example.com');
        expect(changeEvent!.payload?.config).toHaveProperty('jwtEndpoint', 'https://updated.example.com/token');
        expect(changeEvent!.payload?.config).toHaveProperty('keysEndpoint', 'https://updated.example.com/keys');
        expect(changeEvent!.payload?.config).toHaveProperty('headerName', 'X-Updated-JWT');

        console.log('✓ JWT IDP updated successfully');
      });

      it('should be idempotent - no event for same values', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        await ctx.commands.addJWTIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Idempotent JWT IDP',
            issuer: 'https://idempotent.example.com',
            jwtEndpoint: 'https://idempotent.example.com/token',
            keysEndpoint: 'https://idempotent.example.com/keys',
            headerName: 'Authorization',
          }
        );

        // Get event count before idempotent change
        const eventsBefore = await ctx.getEvents('org', org.orgID);
        const eventCountBefore = eventsBefore.length;

        // Update with same values
        await ctx.commands.changeJWTIDP(
          ctx.createContext(),
          org.orgID,
          idpID,
          {
            name: 'Idempotent JWT IDP',
            issuer: 'https://idempotent.example.com',
            jwtEndpoint: 'https://idempotent.example.com/token',
            keysEndpoint: 'https://idempotent.example.com/keys',
            headerName: 'Authorization',
          }
        );

        // Verify no new event
        const eventsAfter = await ctx.getEvents('org', org.orgID);
        const eventCountAfter = eventsAfter.length;

        expect(eventCountAfter).toBe(eventCountBefore);

        const changeEvent = eventsAfter.find(e => e.eventType === 'org.idp.jwt.changed');
        expect(changeEvent).toBeUndefined();

        console.log('✓ Idempotent - no event for same values');
      });
    });

    describe('Error Cases', () => {
      it('should fail on non-existent JWT IDP', async () => {
        const org = await createTestOrg();
        const fakeIDPID = await ctx.commands.nextID();

        await expect(
          ctx.commands.changeJWTIDP(
            ctx.createContext(),
            org.orgID,
            fakeIDPID,
            {
              name: 'Updated Name',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected change to non-existent JWT IDP');
      });

      it('should fail with invalid orgID', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        await ctx.commands.addJWTIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Test JWT IDP',
            issuer: 'https://test.example.com',
            jwtEndpoint: 'https://test.example.com/token',
            keysEndpoint: 'https://test.example.com/keys',
            headerName: 'Authorization',
          }
        );

        await expect(
          ctx.commands.changeJWTIDP(
            ctx.createContext(),
            'invalid-org-id',
            idpID,
            {
              name: 'Updated Name',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected invalid orgID');
      });
    });
  });

  describe('Complete Lifecycle', () => {
    it('should complete add → change → remove lifecycle', async () => {
      const org = await createTestOrg();
      const idpID = await ctx.commands.nextID();

      console.log('\n--- Testing Complete Lifecycle ---');

      // 1. Add JWT IDP
      console.log('Step 1: Add JWT IDP');
      await ctx.commands.addJWTIDPToOrg(
        ctx.createContext(),
        org.orgID,
        {
          idpID,
          name: 'Lifecycle JWT IDP',
          issuer: 'https://lifecycle.example.com',
          jwtEndpoint: 'https://lifecycle.example.com/token',
          keysEndpoint: 'https://lifecycle.example.com/keys',
          headerName: 'Authorization',
        }
      );

      await processProjection();
      await assertJWTIDPInQuery(org.orgID, idpID, 'Lifecycle JWT IDP');

      // 2. Change JWT IDP
      console.log('Step 2: Change JWT IDP');
      await ctx.commands.changeJWTIDP(
        ctx.createContext(),
        org.orgID,
        idpID,
        {
          name: 'Updated Lifecycle JWT IDP',
          issuer: 'https://updated-lifecycle.example.com',
        }
      );

      await processProjection();
      await assertJWTIDPInQuery(org.orgID, idpID, 'Updated Lifecycle JWT IDP');

      // 3. Remove JWT IDP (reuse existing removeIDPFromOrg)
      console.log('Step 3: Remove JWT IDP');
      await ctx.commands.removeIDPFromOrg(
        ctx.createContext(),
        org.orgID,
        idpID
      );

      await processProjection();
      await assertJWTIDPNotInQuery(idpID);

      console.log('✓ Complete lifecycle tested successfully');
    });
  });
});
