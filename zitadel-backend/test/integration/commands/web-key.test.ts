/**
 * Web Key Commands Integration Tests - Fully Isolated
 * Tests JWKS key generation, activation, deactivation, and removal
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { WebKeyAlgorithm, WebKeyUsage } from '../../../src/lib/command/crypto/web-key-commands';

describe('Web Key Commands Integration Tests (Isolated)', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  describe('generateWebKey', () => {
    describe('Success Cases', () => {
      it('should generate RS256 web key successfully', async () => {
        const result = await ctx.commands.generateWebKey(
          ctx.createContext(),
          WebKeyAlgorithm.RS256,
          WebKeyUsage.SIGNING
        );

        expect(result).toBeDefined();
        expect(result.keyID).toBeDefined();

        // Verify event
        const events = await ctx.getEvents('web_key', result.keyID);
        const generateEvent = events.find(e => e.eventType === 'web_key.generated');
        expect(generateEvent).toBeDefined();
        expect(generateEvent!.payload).toMatchObject({
          algorithm: 'RS256',
          usage: 'sig',
        });
        expect(generateEvent!.payload!.publicKey).toBeDefined();
        expect(generateEvent!.payload!.privateKey).toBeDefined();
        expect(generateEvent!.payload!.publicKey).toContain('BEGIN PUBLIC KEY');
        expect(generateEvent!.payload!.privateKey).toContain('BEGIN PRIVATE KEY');
      });

      it('should generate ES256 web key successfully', async () => {
        const result = await ctx.commands.generateWebKey(
          ctx.createContext(),
          WebKeyAlgorithm.ES256,
          WebKeyUsage.SIGNING
        );

        expect(result.keyID).toBeDefined();

        const events = await ctx.getEvents('web_key', result.keyID);
        const generateEvent = events.find(e => e.eventType === 'web_key.generated');
        expect(generateEvent!.payload).toMatchObject({
          algorithm: 'ES256',
          usage: 'sig',
        });
      });

      it('should generate RS384 web key', async () => {
        const result = await ctx.commands.generateWebKey(
          ctx.createContext(),
          WebKeyAlgorithm.RS384,
          WebKeyUsage.SIGNING
        );

        const events = await ctx.getEvents('web_key', result.keyID);
        const generateEvent = events.find(e => e.eventType === 'web_key.generated');
        expect(generateEvent!.payload!.algorithm).toBe('RS384');
      });

      it('should generate RS512 web key', async () => {
        const result = await ctx.commands.generateWebKey(
          ctx.createContext(),
          WebKeyAlgorithm.RS512,
          WebKeyUsage.SIGNING
        );

        const events = await ctx.getEvents('web_key', result.keyID);
        const generateEvent = events.find(e => e.eventType === 'web_key.generated');
        expect(generateEvent!.payload!.algorithm).toBe('RS512');
      });

      it('should generate ES384 web key', async () => {
        const result = await ctx.commands.generateWebKey(
          ctx.createContext(),
          WebKeyAlgorithm.ES384,
          WebKeyUsage.SIGNING
        );

        const events = await ctx.getEvents('web_key', result.keyID);
        const generateEvent = events.find(e => e.eventType === 'web_key.generated');
        expect(generateEvent!.payload!.algorithm).toBe('ES384');
      });

      it('should generate ES512 web key', async () => {
        const result = await ctx.commands.generateWebKey(
          ctx.createContext(),
          WebKeyAlgorithm.ES512,
          WebKeyUsage.SIGNING
        );

        const events = await ctx.getEvents('web_key', result.keyID);
        const generateEvent = events.find(e => e.eventType === 'web_key.generated');
        expect(generateEvent!.payload!.algorithm).toBe('ES512');
      });
    });

    describe('Error Cases', () => {
      it('should fail with invalid algorithm', async () => {
        await expect(
          ctx.commands.generateWebKey(
            ctx.createContext(),
            'INVALID_ALG' as WebKeyAlgorithm,
            WebKeyUsage.SIGNING
          )
        ).rejects.toThrow(/Invalid algorithm/);
      });

      it('should fail with invalid usage', async () => {
        await expect(
          ctx.commands.generateWebKey(
            ctx.createContext(),
            WebKeyAlgorithm.RS256,
            'invalid' as WebKeyUsage
          )
        ).rejects.toThrow(/Invalid usage/);
      });
    });
  });

  describe('activateWebKey', () => {
    describe('Success Cases', () => {
      it('should activate generated web key', async () => {
        // Generate key first
        const genResult = await ctx.commands.generateWebKey(
          ctx.createContext(),
          WebKeyAlgorithm.RS256,
          WebKeyUsage.SIGNING
        );

        // Activate the key
        const result = await ctx.commands.activateWebKey(
          ctx.createContext(),
          genResult.keyID
        );

        expect(result).toBeDefined();

        // Verify event
        const events = await ctx.getEvents('web_key', genResult.keyID);
        const activateEvent = events.find(e => e.eventType === 'web_key.activated');
        expect(activateEvent).toBeDefined();
        expect(activateEvent!.payload!.activatedAt).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty keyID', async () => {
        await expect(
          ctx.commands.activateWebKey(
            ctx.createContext(),
            ''
          )
        ).rejects.toThrow(/keyID is required/);
      });

      it('should fail with non-existent keyID', async () => {
        await expect(
          ctx.commands.activateWebKey(
            ctx.createContext(),
            'non-existent-key'
          )
        ).rejects.toThrow(/web key not found/);
      });

      it('should fail activating already active key', async () => {
        const genResult = await ctx.commands.generateWebKey(
          ctx.createContext(),
          WebKeyAlgorithm.RS256,
          WebKeyUsage.SIGNING
        );

        // Activate once
        await ctx.commands.activateWebKey(
          ctx.createContext(),
          genResult.keyID
        );

        // Try to activate again
        await expect(
          ctx.commands.activateWebKey(
            ctx.createContext(),
            genResult.keyID
          )
        ).rejects.toThrow(/web key already active/);
      });
    });
  });

  describe('deactivateWebKey', () => {
    describe('Success Cases', () => {
      it('should deactivate active web key', async () => {
        // Generate and activate key
        const genResult = await ctx.commands.generateWebKey(
          ctx.createContext(),
          WebKeyAlgorithm.RS256,
          WebKeyUsage.SIGNING
        );

        await ctx.commands.activateWebKey(
          ctx.createContext(),
          genResult.keyID
        );

        // Deactivate the key
        const result = await ctx.commands.deactivateWebKey(
          ctx.createContext(),
          genResult.keyID
        );

        expect(result).toBeDefined();

        // Verify event
        const events = await ctx.getEvents('web_key', genResult.keyID);
        const deactivateEvent = events.find(e => e.eventType === 'web_key.deactivated');
        expect(deactivateEvent).toBeDefined();
        expect(deactivateEvent!.payload!.deactivatedAt).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty keyID', async () => {
        await expect(
          ctx.commands.deactivateWebKey(
            ctx.createContext(),
            ''
          )
        ).rejects.toThrow(/keyID is required/);
      });

      it('should fail with non-existent keyID', async () => {
        await expect(
          ctx.commands.deactivateWebKey(
            ctx.createContext(),
            'non-existent-key'
          )
        ).rejects.toThrow(/web key not found/);
      });

      it('should fail deactivating non-active key', async () => {
        const genResult = await ctx.commands.generateWebKey(
          ctx.createContext(),
          WebKeyAlgorithm.RS256,
          WebKeyUsage.SIGNING
        );

        // Try to deactivate without activating first
        await expect(
          ctx.commands.deactivateWebKey(
            ctx.createContext(),
            genResult.keyID
          )
        ).rejects.toThrow(/web key not active/);
      });
    });
  });

  describe('removeWebKey', () => {
    describe('Success Cases', () => {
      it('should remove inactive web key', async () => {
        // Generate key
        const genResult = await ctx.commands.generateWebKey(
          ctx.createContext(),
          WebKeyAlgorithm.RS256,
          WebKeyUsage.SIGNING
        );

        // Remove the key (it's in INITIAL state, not active)
        const result = await ctx.commands.removeWebKey(
          ctx.createContext(),
          genResult.keyID
        );

        expect(result).toBeDefined();

        // Verify event
        const events = await ctx.getEvents('web_key', genResult.keyID);
        const removeEvent = events.find(e => e.eventType === 'web_key.removed');
        expect(removeEvent).toBeDefined();
        expect(removeEvent!.payload!.removedAt).toBeDefined();
      });

      it('should remove deactivated web key', async () => {
        // Generate, activate, then deactivate
        const genResult = await ctx.commands.generateWebKey(
          ctx.createContext(),
          WebKeyAlgorithm.RS256,
          WebKeyUsage.SIGNING
        );

        await ctx.commands.activateWebKey(ctx.createContext(), genResult.keyID);
        await ctx.commands.deactivateWebKey(ctx.createContext(), genResult.keyID);

        // Now remove it
        const result = await ctx.commands.removeWebKey(
          ctx.createContext(),
          genResult.keyID
        );

        expect(result).toBeDefined();

        const events = await ctx.getEvents('web_key', genResult.keyID);
        expect(events.filter(e => e.eventType === 'web_key.removed')).toHaveLength(1);
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty keyID', async () => {
        await expect(
          ctx.commands.removeWebKey(
            ctx.createContext(),
            ''
          )
        ).rejects.toThrow(/keyID is required/);
      });

      it('should fail with non-existent keyID', async () => {
        await expect(
          ctx.commands.removeWebKey(
            ctx.createContext(),
            'non-existent-key'
          )
        ).rejects.toThrow(/web key not found/);
      });

      it('should fail removing active key', async () => {
        // Generate and activate key
        const genResult = await ctx.commands.generateWebKey(
          ctx.createContext(),
          WebKeyAlgorithm.RS256,
          WebKeyUsage.SIGNING
        );

        await ctx.commands.activateWebKey(ctx.createContext(), genResult.keyID);

        // Try to remove active key
        await expect(
          ctx.commands.removeWebKey(
            ctx.createContext(),
            genResult.keyID
          )
        ).rejects.toThrow(/cannot remove active key/);
      });
    });
  });

  describe('Complete Lifecycle Tests', () => {
    it('complete lifecycle: generate → activate → deactivate → remove', async () => {
      // 1. Generate key
      const genResult = await ctx.commands.generateWebKey(
        ctx.createContext(),
        WebKeyAlgorithm.RS256,
        WebKeyUsage.SIGNING
      );
      expect(genResult.keyID).toBeDefined();

      // 2. Activate key
      await ctx.commands.activateWebKey(
        ctx.createContext(),
        genResult.keyID
      );

      // 3. Deactivate key
      await ctx.commands.deactivateWebKey(
        ctx.createContext(),
        genResult.keyID
      );

      // 4. Remove key
      await ctx.commands.removeWebKey(
        ctx.createContext(),
        genResult.keyID
      );

      // Verify all events in order
      const events = await ctx.getEvents('web_key', genResult.keyID);
      expect(events).toHaveLength(4);
      expect(events[0].eventType).toBe('web_key.generated');
      expect(events[1].eventType).toBe('web_key.activated');
      expect(events[2].eventType).toBe('web_key.deactivated');
      expect(events[3].eventType).toBe('web_key.removed');
    });

    it('key rotation scenario: generate new → activate new → deactivate old', async () => {
      // Generate first key
      const key1 = await ctx.commands.generateWebKey(
        ctx.createContext(),
        WebKeyAlgorithm.RS256,
        WebKeyUsage.SIGNING
      );

      await ctx.commands.activateWebKey(ctx.createContext(), key1.keyID);

      // Generate second key for rotation
      const key2 = await ctx.commands.generateWebKey(
        ctx.createContext(),
        WebKeyAlgorithm.RS256,
        WebKeyUsage.SIGNING
      );

      await ctx.commands.activateWebKey(ctx.createContext(), key2.keyID);

      // Deactivate old key
      await ctx.commands.deactivateWebKey(ctx.createContext(), key1.keyID);

      // Verify both keys exist
      const key1Events = await ctx.getEvents('web_key', key1.keyID);
      const key2Events = await ctx.getEvents('web_key', key2.keyID);

      expect(key1Events.filter(e => e.eventType === 'web_key.deactivated')).toHaveLength(1);
      expect(key2Events.filter(e => e.eventType === 'web_key.activated')).toHaveLength(1);
    });

    it('multiple algorithm keys scenario', async () => {
      // Generate keys with different algorithms
      const rsKey = await ctx.commands.generateWebKey(
        ctx.createContext(),
        WebKeyAlgorithm.RS256,
        WebKeyUsage.SIGNING
      );

      const esKey = await ctx.commands.generateWebKey(
        ctx.createContext(),
        WebKeyAlgorithm.ES256,
        WebKeyUsage.SIGNING
      );

      // Activate both
      await ctx.commands.activateWebKey(ctx.createContext(), rsKey.keyID);
      await ctx.commands.activateWebKey(ctx.createContext(), esKey.keyID);

      // Verify both are different keys with different algorithms
      const rsEvents = await ctx.getEvents('web_key', rsKey.keyID);
      const esEvents = await ctx.getEvents('web_key', esKey.keyID);

      const rsGenEvent = rsEvents.find(e => e.eventType === 'web_key.generated');
      const esGenEvent = esEvents.find(e => e.eventType === 'web_key.generated');

      expect(rsGenEvent!.payload!.algorithm).toBe('RS256');
      expect(esGenEvent!.payload!.algorithm).toBe('ES256');
      expect(rsGenEvent!.payload!.publicKey).not.toBe(esGenEvent!.payload!.publicKey);
    });
  });
});
