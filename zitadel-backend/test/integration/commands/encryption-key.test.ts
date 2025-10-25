/**
 * Encryption Key Commands Integration Tests
 * Tests command→database flow for encryption key management
 * 
 * Note: Encryption keys are stored directly in the database (not via projections)
 * Commands: addEncryptionKey, getEncryptionKey, listEncryptionKeys, removeEncryptionKey
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { EncryptionAlgorithm } from '../../../src/lib/command/crypto/encryption-key-commands';

describe('Encryption Key Commands - Complete Flow', () => {
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
    // Clear encryption keys table
    await pool.query('DELETE FROM encryption_keys');
  });

  describe('addEncryptionKey', () => {
    describe('Success Cases', () => {
      it('should add AES256 encryption key', async () => {
        const keyData = Buffer.from('test-key-material-256bit');

        console.log('\n--- Adding AES256 Encryption Key ---');
        const result = await ctx.commands.addEncryptionKey(
          ctx.createContext(),
          {
            algorithm: EncryptionAlgorithm.AES256,
            identifier: 'test-aes-key',
            keyData,
          }
        );

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();

        console.log('✓ AES256 key added successfully');
      });

      it('should add RSA2048 encryption key', async () => {
        const keyData = Buffer.from('test-rsa-2048-key');

        const result = await ctx.commands.addEncryptionKey(
          ctx.createContext(),
          {
            algorithm: EncryptionAlgorithm.RSA2048,
            identifier: 'test-rsa-2048-key',
            keyData,
          }
        );

        expect(result.id).toBeDefined();

        console.log('✓ RSA2048 key added successfully');
      });

      it('should add RSA4096 encryption key', async () => {
        const keyData = Buffer.from('test-rsa-4096-key');

        const result = await ctx.commands.addEncryptionKey(
          ctx.createContext(),
          {
            algorithm: EncryptionAlgorithm.RSA4096,
            identifier: 'test-rsa-4096-key',
            keyData,
          }
        );

        expect(result.id).toBeDefined();

        console.log('✓ RSA4096 key added successfully');
      });

      it('should add multiple encryption keys', async () => {
        const key1 = await ctx.commands.addEncryptionKey(
          ctx.createContext(),
          {
            algorithm: EncryptionAlgorithm.AES256,
            identifier: 'key-1',
            keyData: Buffer.from('key-data-1'),
          }
        );

        const key2 = await ctx.commands.addEncryptionKey(
          ctx.createContext(),
          {
            algorithm: EncryptionAlgorithm.RSA2048,
            identifier: 'key-2',
            keyData: Buffer.from('key-data-2'),
          }
        );

        expect(key1.id).not.toBe(key2.id);

        console.log('✓ Multiple encryption keys added successfully');
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty identifier', async () => {
        await expect(
          ctx.commands.addEncryptionKey(
            ctx.createContext(),
            {
              algorithm: EncryptionAlgorithm.AES256,
              identifier: '',
              keyData: Buffer.from('test-key'),
            }
          )
        ).rejects.toThrow();

        console.log('✓ Failed as expected with empty identifier');
      });

      it('should fail with empty key data', async () => {
        await expect(
          ctx.commands.addEncryptionKey(
            ctx.createContext(),
            {
              algorithm: EncryptionAlgorithm.AES256,
              identifier: 'test-key',
              keyData: Buffer.from(''),
            }
          )
        ).rejects.toThrow();

        console.log('✓ Failed as expected with empty key data');
      });

      it('should fail with duplicate identifier', async () => {
        await ctx.commands.addEncryptionKey(
          ctx.createContext(),
          {
            algorithm: EncryptionAlgorithm.AES256,
            identifier: 'duplicate-key',
            keyData: Buffer.from('key-data-1'),
          }
        );

        await expect(
          ctx.commands.addEncryptionKey(
            ctx.createContext(),
            {
              algorithm: EncryptionAlgorithm.AES256,
              identifier: 'duplicate-key',
              keyData: Buffer.from('key-data-2'),
            }
          )
        ).rejects.toThrow();

        console.log('✓ Failed as expected with duplicate identifier');
      });
    });
  });

  describe('getEncryptionKey', () => {
    it('should get encryption key by ID', async () => {
      const keyData = Buffer.from('test-key-material');

      // Add key first
      const result = await ctx.commands.addEncryptionKey(
        ctx.createContext(),
        {
          algorithm: EncryptionAlgorithm.AES256,
          identifier: 'get-test-key',
          keyData,
        }
      );

      console.log('\n--- Getting Encryption Key ---');
      const retrievedKey = await ctx.commands.getEncryptionKey(
        ctx.createContext(),
        result.id
      );

      expect(retrievedKey).toBeDefined();
      expect(retrievedKey).not.toBeNull();
      expect(retrievedKey!.id).toBe(result.id);
      expect(retrievedKey!.identifier).toBe('get-test-key');
      expect(retrievedKey!.algorithm).toBe(EncryptionAlgorithm.AES256);
      expect(Buffer.compare(retrievedKey!.keyData, keyData)).toBe(0);

      console.log('✓ Encryption key retrieved successfully');
    });

    it('should return null for non-existent key', async () => {
      const fakeID = await ctx.commands.nextID();

      const result = await ctx.commands.getEncryptionKey(
        ctx.createContext(),
        fakeID
      );

      expect(result).toBeNull();

      console.log('✓ Returned null as expected for non-existent key');
    });
  });

  describe('listEncryptionKeys', () => {
    it('should list all encryption keys', async () => {
      // Add multiple keys
      await ctx.commands.addEncryptionKey(
        ctx.createContext(),
        {
          algorithm: EncryptionAlgorithm.AES256,
          identifier: 'list-key-1',
          keyData: Buffer.from('key-data-1'),
        }
      );

      await ctx.commands.addEncryptionKey(
        ctx.createContext(),
        {
          algorithm: EncryptionAlgorithm.RSA2048,
          identifier: 'list-key-2',
          keyData: Buffer.from('key-data-2'),
        }
      );

      await ctx.commands.addEncryptionKey(
        ctx.createContext(),
        {
          algorithm: EncryptionAlgorithm.RSA4096,
          identifier: 'list-key-3',
          keyData: Buffer.from('key-data-3'),
        }
      );

      console.log('\n--- Listing Encryption Keys ---');
      const keys = await ctx.commands.listEncryptionKeys(
        ctx.createContext()
      );

      expect(keys).toBeDefined();
      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThanOrEqual(3);

      const identifiers = keys.map(k => k.identifier);
      expect(identifiers).toContain('list-key-1');
      expect(identifiers).toContain('list-key-2');
      expect(identifiers).toContain('list-key-3');

      console.log(`✓ Listed ${keys.length} encryption keys successfully`);
    });

    it('should return empty array when no keys exist', async () => {
      const keys = await ctx.commands.listEncryptionKeys(
        ctx.createContext()
      );

      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBe(0);

      console.log('✓ Empty list returned successfully');
    });
  });

  describe('removeEncryptionKey', () => {
    it('should remove encryption key', async () => {
      // Add key first
      const result = await ctx.commands.addEncryptionKey(
        ctx.createContext(),
        {
          algorithm: EncryptionAlgorithm.AES256,
          identifier: 'remove-test-key',
          keyData: Buffer.from('test-key-data'),
        }
      );

      console.log('\n--- Removing Encryption Key ---');
      await ctx.commands.removeEncryptionKey(
        ctx.createContext(),
        result.id
      );

      // Verify it's removed
      const removedKey = await ctx.commands.getEncryptionKey(
        ctx.createContext(),
        result.id
      );

      expect(removedKey).toBeNull();

      console.log('✓ Encryption key removed successfully');
    });

    it('should fail on non-existent key', async () => {
      const fakeID = await ctx.commands.nextID();

      await expect(
        ctx.commands.removeEncryptionKey(
          ctx.createContext(),
          fakeID
        )
      ).rejects.toThrow();

      console.log('✓ Failed as expected with non-existent key');
    });
  });

  describe('Complete Lifecycle', () => {
    it('should handle complete encryption key lifecycle', async () => {
      console.log('\n=== Complete Encryption Key Lifecycle ===');

      // 1. Add key
      console.log('Step 1: Add encryption key');
      const keyData = Buffer.from('test-lifecycle-key-material');
      const result = await ctx.commands.addEncryptionKey(
        ctx.createContext(),
        {
          algorithm: EncryptionAlgorithm.AES256,
          identifier: 'lifecycle-test-key',
          keyData,
        }
      );

      expect(result.id).toBeDefined();

      // 2. Get key
      console.log('Step 2: Get encryption key');
      const retrievedKey = await ctx.commands.getEncryptionKey(
        ctx.createContext(),
        result.id
      );

      expect(retrievedKey).not.toBeNull();
      expect(retrievedKey!.id).toBe(result.id);
      expect(retrievedKey!.identifier).toBe('lifecycle-test-key');

      // 3. List keys (should include our key)
      console.log('Step 3: List encryption keys');
      const keys = await ctx.commands.listEncryptionKeys(
        ctx.createContext()
      );

      const ourKey = keys.find(k => k.id === result.id);
      expect(ourKey).toBeDefined();

      // 4. Remove key
      console.log('Step 4: Remove encryption key');
      await ctx.commands.removeEncryptionKey(
        ctx.createContext(),
        result.id
      );

      // 5. Verify removal
      console.log('Step 5: Verify removal');
      const removedKey = await ctx.commands.getEncryptionKey(
        ctx.createContext(),
        result.id
      );

      expect(removedKey).toBeNull();

      console.log('✓ Complete encryption key lifecycle successful');
    });
  });

  describe('Algorithm Support', () => {
    it('should support all encryption algorithms', async () => {
      console.log('\n--- Testing All Algorithm Types ---');

      const algorithms = [
        { type: EncryptionAlgorithm.AES256, name: 'AES256' },
        { type: EncryptionAlgorithm.RSA2048, name: 'RSA2048' },
        { type: EncryptionAlgorithm.RSA4096, name: 'RSA4096' },
      ];

      for (const algo of algorithms) {
        const result = await ctx.commands.addEncryptionKey(
          ctx.createContext(),
          {
            algorithm: algo.type,
            identifier: `test-${algo.name.toLowerCase()}`,
            keyData: Buffer.from(`test-${algo.name}-key-data`),
          }
        );

        expect(result.id).toBeDefined();
        console.log(`  ✓ ${algo.name} algorithm supported`);
      }

      console.log('✓ All algorithms supported successfully');
    });
  });
});
