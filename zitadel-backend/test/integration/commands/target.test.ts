/**
 * Target Commands Integration Tests - Fully Isolated
 * Each test creates its own organization and test data
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder } from '../../helpers/test-data-builders';
import { TargetType } from '../../../src/lib/domain/target';

describe('Target Commands Integration Tests (Isolated)', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  /**
   * Helper: Create isolated test organization
   */
  async function createTestOrg() {
    const orgData = new OrganizationBuilder()
      .withName(`Target Test Org ${Date.now()}-${Math.random()}`)
      .build();
    
    const result = await ctx.commands.addOrg(ctx.createContext(), orgData);
    return { id: result.orgID, name: orgData.name };
  }

  describe('addTarget', () => {
    describe('Success Cases', () => {
      it('should add webhook target successfully', async () => {
        const testOrg = await createTestOrg();
        
        const result = await ctx.commands.addTarget(
          ctx.createContext(),
          testOrg.id,
          {
            name: 'Test Webhook',
            targetType: TargetType.WEBHOOK,
            endpoint: 'https://example.com/webhook',
            timeout: 10000,
            interruptOnError: false,
          }
        );

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.signingKey).toBeDefined();
        expect(result.signingKey.length).toBeGreaterThan(0);
      });

      it('should add target with interrupt on error', async () => {
        const testOrg = await createTestOrg();
        const result = await ctx.commands.addTarget(
          ctx.createContext(),
          testOrg.id,
          {
            name: 'Critical Webhook',
            targetType: TargetType.REQUEST_RESPONSE,
            endpoint: 'https://api.example.com/validate',
            timeout: 5000,
            interruptOnError: true,
          }
        );

        expect(result.id).toBeDefined();
      });

      it('should generate unique signing keys for each target', async () => {
        const testOrg = await createTestOrg();
        const result1 = await ctx.commands.addTarget(
          ctx.createContext(),
          testOrg.id,
          {
            name: 'Target 1',
            targetType: TargetType.WEBHOOK,
            endpoint: 'https://example.com/webhook1',
            timeout: 10000,
            interruptOnError: false,
          }
        );

        const result2 = await ctx.commands.addTarget(
          ctx.createContext(),
          testOrg.id,
          {
            name: 'Target 2',
            targetType: TargetType.WEBHOOK,
            endpoint: 'https://example.com/webhook2',
            timeout: 10000,
            interruptOnError: false,
          }
        );

        expect(result1.signingKey).not.toBe(result2.signingKey);
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty name', async () => {
        const testOrg = await createTestOrg();
        await expect(
          ctx.commands.addTarget(
            ctx.createContext(),
            testOrg.id,
            {
              name: '',
              targetType: TargetType.WEBHOOK,
              endpoint: 'https://example.com/webhook',
              timeout: 10000,
              interruptOnError: false,
            }
          )
        ).rejects.toThrow(/target is invalid/);
      });

      it('should fail with invalid URL', async () => {
        const testOrg = await createTestOrg();
        await expect(
          ctx.commands.addTarget(
            ctx.createContext(),
            testOrg.id,
            {
              name: 'Invalid URL',
              targetType: TargetType.WEBHOOK,
              endpoint: 'not-a-valid-url',
              timeout: 10000,
              interruptOnError: false,
            }
          )
        ).rejects.toThrow(/target is invalid/);
      });

      it('should fail with zero timeout', async () => {
        const testOrg = await createTestOrg();
        await expect(
          ctx.commands.addTarget(
            ctx.createContext(),
            testOrg.id,
            {
              name: 'Zero Timeout',
              targetType: TargetType.WEBHOOK,
              endpoint: 'https://example.com/webhook',
              timeout: 0,
              interruptOnError: false,
            }
          )
        ).rejects.toThrow(/timeout must be positive/);
      });

      it('should fail with negative timeout', async () => {
        const testOrg = await createTestOrg();
        await expect(
          ctx.commands.addTarget(
            ctx.createContext(),
            testOrg.id,
            {
              name: 'Negative Timeout',
              targetType: TargetType.WEBHOOK,
              endpoint: 'https://example.com/webhook',
              timeout: -1000,
              interruptOnError: false,
            }
          )
        ).rejects.toThrow(/timeout must be positive/);
      });

      it('should fail with empty orgID', async () => {
        await expect(
          ctx.commands.addTarget(
            ctx.createContext(),
            '',
            {
              name: 'Test',
              targetType: TargetType.WEBHOOK,
              endpoint: 'https://example.com/webhook',
              timeout: 10000,
              interruptOnError: false,
            }
          )
        ).rejects.toThrow();
      });
    });
  });

  describe('changeTarget', () => {
    describe('Success Cases', () => {
      it('should update target name', async () => {
        const testOrg = await createTestOrg();
        const addResult = await ctx.commands.addTarget(
          ctx.createContext(),
          testOrg.id,
          {
            name: 'Original Target',
            targetType: TargetType.WEBHOOK,
            endpoint: 'https://example.com/original',
            timeout: 10000,
            interruptOnError: false,
          }
        );
        
        const result = await ctx.commands.changeTarget(
          ctx.createContext(),
          testOrg.id,
          addResult.id,
          {
            name: 'Updated Target',
          }
        );

        expect(result).toBeDefined();
        expect(result.signingKey).toBeUndefined();
      });

      it('should update endpoint', async () => {
        const testOrg = await createTestOrg();
        const addResult = await ctx.commands.addTarget(
          ctx.createContext(),
          testOrg.id,
          {
            name: 'Test Target',
            targetType: TargetType.WEBHOOK,
            endpoint: 'https://example.com/original',
            timeout: 10000,
            interruptOnError: false,
          }
        );

        const result = await ctx.commands.changeTarget(
          ctx.createContext(),
          testOrg.id,
          addResult.id,
          {
            endpoint: 'https://example.com/new-endpoint',
          }
        );

        expect(result).toBeDefined();
      });

      it('should rotate signing key', async () => {
        const testOrg = await createTestOrg();
        const addResult = await ctx.commands.addTarget(
          ctx.createContext(),
          testOrg.id,
          {
            name: 'Test Target',
            targetType: TargetType.WEBHOOK,
            endpoint: 'https://example.com/test',
            timeout: 10000,
            interruptOnError: false,
          }
        );
        
        const result = await ctx.commands.changeTarget(
          ctx.createContext(),
          testOrg.id,
          addResult.id,
          {
            rotateSigningKey: true,
          }
        );

        expect(result.signingKey).toBeDefined();
        expect(result.signingKey!.length).toBeGreaterThan(0);
        expect(result.signingKey).not.toBe(addResult.signingKey);
      });

      it('should update multiple properties', async () => {
        const testOrg = await createTestOrg();
        const addResult = await ctx.commands.addTarget(
          ctx.createContext(),
          testOrg.id,
          {
            name: 'Test Target',
            targetType: TargetType.WEBHOOK,
            endpoint: 'https://example.com/test',
            timeout: 10000,
            interruptOnError: false,
          }
        );

        const result = await ctx.commands.changeTarget(
          ctx.createContext(),
          testOrg.id,
          addResult.id,
          {
            name: 'Multi Update',
            endpoint: 'https://example.com/multi',
            timeout: 15000,
            interruptOnError: true,
          }
        );

        expect(result).toBeDefined();
      });

      it('should handle idempotent updates (no changes)', async () => {
        const testOrg = await createTestOrg();
        const addResult = await ctx.commands.addTarget(
          ctx.createContext(),
          testOrg.id,
          {
            name: 'Test Target',
            targetType: TargetType.WEBHOOK,
            endpoint: 'https://example.com/test',
            timeout: 10000,
            interruptOnError: false,
          }
        );

        const result = await ctx.commands.changeTarget(
          ctx.createContext(),
          testOrg.id,
          addResult.id,
          {}
        );

        expect(result).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty name', async () => {
        const testOrg = await createTestOrg();
        const addResult = await ctx.commands.addTarget(
          ctx.createContext(),
          testOrg.id,
          {
            name: 'Test Target',
            targetType: TargetType.WEBHOOK,
            endpoint: 'https://example.com/test',
            timeout: 10000,
            interruptOnError: false,
          }
        );

        await expect(
          ctx.commands.changeTarget(
            ctx.createContext(),
            testOrg.id,
            addResult.id,
            {
              name: '',
            }
          )
        ).rejects.toThrow(/name cannot be empty/);
      });

      it('should fail with invalid URL', async () => {
        const testOrg = await createTestOrg();
        const addResult = await ctx.commands.addTarget(
          ctx.createContext(),
          testOrg.id,
          {
            name: 'Test Target',
            targetType: TargetType.WEBHOOK,
            endpoint: 'https://example.com/test',
            timeout: 10000,
            interruptOnError: false,
          }
        );

        await expect(
          ctx.commands.changeTarget(
            ctx.createContext(),
            testOrg.id,
            addResult.id,
            {
              endpoint: 'invalid-url',
            }
          )
        ).rejects.toThrow(/invalid URL/);
      });

      it('should fail with non-existent target', async () => {
        const testOrg = await createTestOrg();
        await expect(
          ctx.commands.changeTarget(
            ctx.createContext(),
            testOrg.id,
            'non-existent-id',
            {
              name: 'Updated',
            }
          )
        ).rejects.toThrow(/target not found/);
      });

      it('should fail with zero timeout', async () => {
        const testOrg = await createTestOrg();
        const addResult = await ctx.commands.addTarget(
          ctx.createContext(),
          testOrg.id,
          {
            name: 'Test Target',
            targetType: TargetType.WEBHOOK,
            endpoint: 'https://example.com/test',
            timeout: 10000,
            interruptOnError: false,
          }
        );

        await expect(
          ctx.commands.changeTarget(
            ctx.createContext(),
            testOrg.id,
            addResult.id,
            {
              timeout: 0,
            }
          )
        ).rejects.toThrow(/timeout must be positive/);
      });
    });
  });

  describe('removeTarget', () => {
    describe('Success Cases', () => {
      it('should remove target successfully', async () => {
        const testOrg = await createTestOrg();
        const addResult = await ctx.commands.addTarget(
          ctx.createContext(),
          testOrg.id,
          {
            name: 'Target to Remove',
            targetType: TargetType.WEBHOOK,
            endpoint: 'https://example.com/remove',
            timeout: 10000,
            interruptOnError: false,
          }
        );
        
        const result = await ctx.commands.removeTarget(
          ctx.createContext(),
          testOrg.id,
          addResult.id
        );

        expect(result).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail with non-existent target', async () => {
        const testOrg = await createTestOrg();
        await expect(
          ctx.commands.removeTarget(
            ctx.createContext(),
            testOrg.id,
            'non-existent-id'
          )
        ).rejects.toThrow(/target not found/);
      });

      it('should fail to remove twice', async () => {
        const testOrg = await createTestOrg();
        const addResult = await ctx.commands.addTarget(
          ctx.createContext(),
          testOrg.id,
          {
            name: 'Target to Remove',
            targetType: TargetType.WEBHOOK,
            endpoint: 'https://example.com/remove',
            timeout: 10000,
            interruptOnError: false,
          }
        );

        await ctx.commands.removeTarget(
          ctx.createContext(),
          testOrg.id,
          addResult.id
        );

        await expect(
          ctx.commands.removeTarget(
            ctx.createContext(),
            testOrg.id,
            addResult.id
          )
        ).rejects.toThrow(/target not found/);
      });
    });
  });

  describe('Lifecycle Tests', () => {
    it('complete lifecycle: add → change → rotate key → remove', async () => {
      const testOrg = await createTestOrg();
      
      const addResult = await ctx.commands.addTarget(
        ctx.createContext(),
        testOrg.id,
        {
          name: 'Lifecycle Test',
          targetType: TargetType.WEBHOOK,
          endpoint: 'https://example.com/lifecycle',
          timeout: 10000,
          interruptOnError: false,
        }
      );
      expect(addResult.id).toBeDefined();
      const originalKey = addResult.signingKey;

      await ctx.commands.changeTarget(
        ctx.createContext(),
        testOrg.id,
        addResult.id,
        {
          name: 'Updated Lifecycle',
          timeout: 15000,
        }
      );

      const rotateResult = await ctx.commands.changeTarget(
        ctx.createContext(),
        testOrg.id,
        addResult.id,
        {
          rotateSigningKey: true,
        }
      );
      expect(rotateResult.signingKey).toBeDefined();
      expect(rotateResult.signingKey).not.toBe(originalKey);

      await ctx.commands.removeTarget(
        ctx.createContext(),
        testOrg.id,
        addResult.id
      );
    });

    it('multiple targets in same organization', async () => {
      const testOrg = await createTestOrg();
      const targets = [];

      for (let i = 1; i <= 3; i++) {
        const result = await ctx.commands.addTarget(
          ctx.createContext(),
          testOrg.id,
          {
            name: `Target ${i}`,
            targetType: TargetType.WEBHOOK,
            endpoint: `https://example.com/webhook-${i}`,
            timeout: 10000,
            interruptOnError: false,
          }
        );
        targets.push(result.id);
      }

      expect(targets.length).toBe(3);
      expect(new Set(targets).size).toBe(3);
    });
  });
});
