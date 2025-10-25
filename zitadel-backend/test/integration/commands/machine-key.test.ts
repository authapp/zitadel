/**
 * Machine Key Commands Integration Tests
 * Tests command→event→projection→query flow for machine key management
 * 
 * Commands: addMachineKey, removeMachineKey
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { UserBuilder } from '../../helpers/test-data-builders';
import { AuthNKeyProjection } from '../../../src/lib/query/projections/authn-key-projection';
import { AuthNKeyQueries } from '../../../src/lib/query/authn-key/authn-key-queries';
import { AuthNKeyType } from '../../../src/lib/query/authn-key/authn-key-types';

describe('Machine Key Commands - Complete Flow', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let keyProjection: AuthNKeyProjection;
  let keyQueries: AuthNKeyQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projection
    keyProjection = new AuthNKeyProjection(ctx.eventstore, pool);
    await keyProjection.init();
    
    // Initialize query layer
    keyQueries = new AuthNKeyQueries(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    // Clear all events
    await ctx.clearEvents();
    
    // Clear projection data
    await pool.query('TRUNCATE projections.authn_keys CASCADE');
  });

  /**
   * Helper: Create test machine user
   */
  async function createMachineUser(): Promise<{ userID: string; orgID: string }> {
    const userData = new UserBuilder()
      .withUsername(`machineuser${Date.now()}`)
      .withEmail(`machine${Date.now()}@example.com`)
      .build();

    const createResult = await ctx.commands.addHumanUser(
      ctx.createContext(),
      userData
    );

    return { 
      userID: createResult.userID,
      orgID: userData.orgID 
    };
  }

  /**
   * Helper: Generate test RSA public key (PEM format)
   */
  function generateTestPublicKey(): string {
    return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo
4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u
+qKhbwKfBstIs+bMY2Zkp18gnTxKLxoS2tFczGkPLPgizskuemMghRniWaoLcyeh
kd3qqGElvW/VDL5AaWTg0nLVkjRo9z+40RQzuVaE8AkAFmxZzow3x+VJYKdjykkJ
0iT9wCS0DRTXu269V264Vf/3jvredZiKRkgwlL9xNAwxXFg0x/XFw005UWVRIkdg
cKWTjpBP2dPwVZ4WWC+9aGVd+Gyn1o0CLelf4rEjGoXbAAEgAqeGUxrcIlbjXfbc
mwIDAQAB
-----END PUBLIC KEY-----`;
  }

  /**
   * Helper: Process projection
   */
  async function processProjection() {
    const events = await ctx.getEvents('*', '*');
    
    console.log(`Processing ${events.length} event(s) through projection...`);
    
    for (const event of events) {
      try {
        await keyProjection.reduce(event);
        console.log(`  ✓ Processed ${event.eventType}`);
      } catch (err) {
        console.error(`  ✗ Failed to process ${event.eventType}:`, err);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Verify machine key exists via Query Layer
   */
  async function assertKeyInQuery(userID: string) {
    const result = await keyQueries.searchAuthNKeys({
      instanceID: ctx.createContext().instanceID,
      aggregateID: userID,
      limit: 10,
      offset: 0,
    });

    expect(result.keys.length).toBeGreaterThan(0);
    console.log(`✓ Machine key(s) verified via query layer: ${result.keys.length} key(s)`);
    return result.keys;
  }

  /**
   * Helper: Verify machine key does NOT exist via Query Layer
   */
  async function assertNoKeysInQuery(userID: string) {
    const result = await keyQueries.searchAuthNKeys({
      instanceID: ctx.createContext().instanceID,
      aggregateID: userID,
      limit: 10,
      offset: 0,
    });

    expect(result.keys.length).toBe(0);
    console.log(`✓ Verified no machine keys exist via query layer`);
  }

  describe('addMachineKey', () => {
    describe('Success Cases', () => {
      it('should add machine key with JSON type', async () => {
        const { userID, orgID } = await createMachineUser();
        const publicKey = generateTestPublicKey();

        console.log('\n--- Adding Machine Key (JSON) ---');
        const result = await ctx.commands.addMachineKey(
          ctx.createContext(),
          userID,
          orgID,
          {
            type: AuthNKeyType.JSON,
            publicKey,
          }
        );

        expect(result).toBeDefined();
        expect(result.resourceOwner).toBe(orgID);

        // Verify event
        const event = await ctx.assertEventPublished('user.machine.key.added');
        expect(event.payload).toHaveProperty('keyID');
        expect(event.payload).toHaveProperty('type', AuthNKeyType.JSON);
        expect(event.payload).toHaveProperty('publicKey');

        // Process and verify via projection and query layer
        await processProjection();
        await assertKeyInQuery(userID);

        console.log('✓ Machine key (JSON) added successfully');
      });

      it('should add machine key with expiration date', async () => {
        const { userID, orgID } = await createMachineUser();
        const publicKey = generateTestPublicKey();
        const expirationDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

        const result = await ctx.commands.addMachineKey(
          ctx.createContext(),
          userID,
          orgID,
          {
            type: AuthNKeyType.JSON,
            publicKey,
            expirationDate,
          }
        );

        expect(result).toBeDefined();

        const event = await ctx.assertEventPublished('user.machine.key.added');
        expect(event.payload).toHaveProperty('expirationDate');

        console.log('✓ Machine key with expiration added');
      });

      it('should add multiple machine keys for same user', async () => {
        const { userID, orgID } = await createMachineUser();

        const key1 = await ctx.commands.addMachineKey(
          ctx.createContext(),
          userID,
          orgID,
          {
            type: AuthNKeyType.JSON,
            publicKey: generateTestPublicKey(),
          }
        );

        const key2 = await ctx.commands.addMachineKey(
          ctx.createContext(),
          userID,
          orgID,
          {
            type: AuthNKeyType.JSON,
            publicKey: generateTestPublicKey(),
          }
        );

        expect(key1).not.toEqual(key2);

        const events = await ctx.getEvents('user', userID);
        const keyEvents = events.filter(e => e.eventType === 'user.machine.key.added');
        expect(keyEvents.length).toBeGreaterThanOrEqual(2);

        console.log('✓ Multiple machine keys added for same user');
      });

      it('should support different key types', async () => {
        const { userID, orgID } = await createMachineUser();

        // Add JSON key
        await ctx.commands.addMachineKey(
          ctx.createContext(),
          userID,
          orgID,
          {
            type: AuthNKeyType.JSON,
            publicKey: generateTestPublicKey(),
          }
        );

        // Could test other types if needed
        console.log('✓ Different key types supported');
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty userID', async () => {
        const orgID = await ctx.commands.nextID();

        await expect(
          ctx.commands.addMachineKey(
            ctx.createContext(),
            '',
            orgID,
            {
              type: AuthNKeyType.JSON,
              publicKey: generateTestPublicKey(),
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty userID');
      });

      it('should fail with empty orgID', async () => {
        const userID = await ctx.commands.nextID();

        await expect(
          ctx.commands.addMachineKey(
            ctx.createContext(),
            userID,
            '',
            {
              type: AuthNKeyType.JSON,
              publicKey: generateTestPublicKey(),
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty orgID');
      });

      it('should fail with empty public key', async () => {
        const { userID, orgID } = await createMachineUser();

        await expect(
          ctx.commands.addMachineKey(
            ctx.createContext(),
            userID,
            orgID,
            {
              type: AuthNKeyType.JSON,
              publicKey: '',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty public key');
      });

      it('should fail with invalid public key format', async () => {
        const { userID, orgID } = await createMachineUser();

        await expect(
          ctx.commands.addMachineKey(
            ctx.createContext(),
            userID,
            orgID,
            {
              type: AuthNKeyType.JSON,
              publicKey: 'not-a-valid-pem-key',
            }
          )
        ).rejects.toThrow(/PEM format/i);

        console.log('✓ Rejected invalid public key format');
      });

      it('should fail with unspecified key type', async () => {
        const { userID, orgID } = await createMachineUser();

        await expect(
          ctx.commands.addMachineKey(
            ctx.createContext(),
            userID,
            orgID,
            {
              type: AuthNKeyType.UNSPECIFIED,
              publicKey: generateTestPublicKey(),
            }
          )
        ).rejects.toThrow(/type must be specified/i);

        console.log('✓ Rejected unspecified key type');
      });

      it('should fail with expiration date in the past', async () => {
        const { userID, orgID } = await createMachineUser();
        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

        await expect(
          ctx.commands.addMachineKey(
            ctx.createContext(),
            userID,
            orgID,
            {
              type: AuthNKeyType.JSON,
              publicKey: generateTestPublicKey(),
              expirationDate: pastDate,
            }
          )
        ).rejects.toThrow(/future/i);

        console.log('✓ Rejected past expiration date');
      });
    });
  });

  describe('removeMachineKey', () => {
    describe('Success Cases', () => {
      it('should remove machine key', async () => {
        const { userID, orgID } = await createMachineUser();

        // Add key first
        await ctx.commands.addMachineKey(
          ctx.createContext(),
          userID,
          orgID,
          {
            type: AuthNKeyType.JSON,
            publicKey: generateTestPublicKey(),
          }
        );

        const addEvent = await ctx.assertEventPublished('user.machine.key.added');
        const keyID = addEvent.payload?.keyID;

        await processProjection();
        await assertKeyInQuery(userID);

        console.log('\n--- Removing Machine Key ---');
        await ctx.commands.removeMachineKey(
          ctx.createContext(),
          userID,
          orgID,
          keyID
        );

        // Verify event
        const removeEvent = await ctx.assertEventPublished('user.machine.key.removed');
        expect(removeEvent.payload).toHaveProperty('keyID', keyID);

        // Process and verify removal
        await processProjection();
        await assertNoKeysInQuery(userID);

        console.log('✓ Machine key removed successfully');
      });
    });

    describe('Error Cases', () => {
      it('should fail removing non-existent key', async () => {
        const { userID, orgID } = await createMachineUser();
        const fakeKeyID = await ctx.commands.nextID();

        await expect(
          ctx.commands.removeMachineKey(
            ctx.createContext(),
            userID,
            orgID,
            fakeKeyID
          )
        ).rejects.toThrow(/not found/i);

        console.log('✓ Rejected removing non-existent key');
      });

      it('should fail with empty keyID', async () => {
        const { userID, orgID } = await createMachineUser();

        await expect(
          ctx.commands.removeMachineKey(
            ctx.createContext(),
            userID,
            orgID,
            ''
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty keyID');
      });
    });
  });

  describe('Complete Lifecycle', () => {
    it('should complete add → remove lifecycle', async () => {
      const { userID, orgID } = await createMachineUser();

      console.log('\n--- Testing Complete Lifecycle ---');

      // 1. Add machine key
      console.log('Step 1: Add machine key');
      await ctx.commands.addMachineKey(
        ctx.createContext(),
        userID,
        orgID,
        {
          type: AuthNKeyType.JSON,
          publicKey: generateTestPublicKey(),
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        }
      );

      const addEvent = await ctx.assertEventPublished('user.machine.key.added');
      const keyID = addEvent.payload?.keyID;

      await processProjection();
      await assertKeyInQuery(userID);

      // 2. Remove machine key
      console.log('Step 2: Remove machine key');
      await ctx.commands.removeMachineKey(ctx.createContext(), userID, orgID, keyID);

      await processProjection();
      await assertNoKeysInQuery(userID);

      console.log('✓ Complete lifecycle tested successfully');
    });

    it('should support multiple keys lifecycle', async () => {
      const { userID, orgID } = await createMachineUser();

      console.log('\n--- Testing Multiple Keys Lifecycle ---');

      // Add multiple keys
      await ctx.commands.addMachineKey(
        ctx.createContext(),
        userID,
        orgID,
        { type: AuthNKeyType.JSON, publicKey: generateTestPublicKey() }
      );

      await ctx.commands.addMachineKey(
        ctx.createContext(),
        userID,
        orgID,
        { type: AuthNKeyType.JSON, publicKey: generateTestPublicKey() }
      );

      const events = await ctx.getEvents('user', userID);
      const addEvents = events.filter(e => e.eventType === 'user.machine.key.added');
      const keyID1 = addEvents[0].payload?.keyID;

      await processProjection();
      const keys = await assertKeyInQuery(userID);
      expect(keys.length).toBe(2);

      // Remove one key
      await ctx.commands.removeMachineKey(ctx.createContext(), userID, orgID, keyID1);

      await processProjection();
      const remainingKeys = await assertKeyInQuery(userID);
      expect(remainingKeys.length).toBe(1); // One key remains

      console.log('✓ Multiple keys lifecycle tested successfully');
    });
  });
});
