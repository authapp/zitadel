/**
 * Organization Login Policy Commands Integration Tests
 * 
 * Tests the complete stack: Command → Event → Projection → Query
 * Following established pattern from org-member and org-idp tests
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder } from '../../helpers/test-data-builders';
import { LoginPolicyProjection } from '../../../src/lib/query/projections/login-policy-projection';
import { LoginPolicyQueries } from '../../../src/lib/query/login-policy/login-policy-queries';
import { SecondFactorType, MultiFactorType } from '../../../src/lib/command/org/org-login-policy-commands';

describe('Organization Login Policy Commands - Complete Flow', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let loginPolicyProjection: LoginPolicyProjection;
  let loginPolicyQueries: LoginPolicyQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projection
    loginPolicyProjection = new LoginPolicyProjection(ctx.eventstore, pool);
    await loginPolicyProjection.init();
    
    // Initialize query layer
    loginPolicyQueries = new LoginPolicyQueries(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  /**
   * Helper: Create test organization
   */
  async function createTestOrg() {
    const orgData = new OrganizationBuilder()
      .withName(`Test Org ${Date.now()}`)
      .build();
    const org = await ctx.commands.addOrg(ctx.createContext(), orgData);
    return org;
  }

  /**
   * Helper: Process projection and wait for completion
   */
  async function processProjection() {
    const events = await ctx.getEvents('*', '*');
    
    console.log(`Processing ${events.length} event(s) through projection...`);
    
    for (const event of events) {
      try {
        await loginPolicyProjection.reduce(event);
        console.log(`  ✓ Processed ${event.eventType}`);
      } catch (err) {
        console.error(`  ✗ Failed to process ${event.eventType}:`, err);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Verify policy exists via Query Layer
   */
  async function assertPolicyInQuery(orgID: string, expectedDefaults?: Partial<{
    allowUsernamePassword: boolean;
    allowRegister: boolean;
    forceMFA: boolean;
  }>) {
    const policy = await loginPolicyQueries.getLoginPolicy(orgID, 'test-instance');
    
    expect(policy).not.toBeNull();
    expect(policy!.resourceOwner).toBe(orgID);
    
    if (expectedDefaults) {
      if (expectedDefaults.allowUsernamePassword !== undefined) {
        expect(policy!.allowUsernamePassword).toBe(expectedDefaults.allowUsernamePassword);
      }
      if (expectedDefaults.allowRegister !== undefined) {
        expect(policy!.allowRegister).toBe(expectedDefaults.allowRegister);
      }
      if (expectedDefaults.forceMFA !== undefined) {
        expect(policy!.forceMFA).toBe(expectedDefaults.forceMFA);
      }
    }
    
    console.log(`  ✓ Policy verified for org: ${orgID}`);
    return policy;
  }

  /**
   * Helper: Verify policy does not exist
   */
  async function assertPolicyNotInQuery(orgID: string) {
    const policy = await loginPolicyQueries.getLoginPolicy(orgID, 'test-instance');
    expect(policy).toBeNull();
    console.log(`  ✓ Verified policy removed for org: ${orgID}`);
  }

  describe('addOrgLoginPolicy', () => {
    describe('Success Cases', () => {
      it('should add login policy to organization', async () => {
        const org = await createTestOrg();

        console.log('\n--- Adding login policy ---');
        const result = await ctx.commands.addOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          {
            allowUsernamePassword: true,
            allowRegister: false,
            forceMFA: true,
            passwordCheckLifetime: 86400, // 1 day
          }
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('org.login.policy.added');
        expect(event.payload).toHaveProperty('allowUsernamePassword', true);
        expect(event.payload).toHaveProperty('allowRegister', false);
        expect(event.payload).toHaveProperty('forceMFA', true);
        expect(event.payload).toHaveProperty('passwordCheckLifetime', 86400);

        // Process and verify via query layer
        await processProjection();
        const policy = await assertPolicyInQuery(org.orgID, {
          allowUsernamePassword: true,
          allowRegister: false,
          forceMFA: true,
        });
        expect(Number(policy?.passwordCheckLifetime)).toBe(86400);
      });

      it('should add login policy with default values', async () => {
        const org = await createTestOrg();

        const result = await ctx.commands.addOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          {}
        );

        expect(result).toBeDefined();

        await processProjection();
        const policy = await assertPolicyInQuery(org.orgID, {
          allowUsernamePassword: true,
          allowRegister: true,
          forceMFA: false,
        });
        expect(policy?.allowDomainDiscovery).toBe(true);
      });

      it('should add policy with all lifetimes configured', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          {
            passwordCheckLifetime: 3600,
            externalLoginCheckLifetime: 7200,
            mfaInitSkipLifetime: 43200,
            secondFactorCheckLifetime: 18000,
            multiFactorCheckLifetime: 12000,
          }
        );

        await processProjection();
        const policy = await assertPolicyInQuery(org.orgID);
        expect(Number(policy?.passwordCheckLifetime)).toBe(3600);
        expect(Number(policy?.externalLoginCheckLifetime)).toBe(7200);
        expect(Number(policy?.mfaInitSkipLifetime)).toBe(43200);
      });
    });

    describe('Error Cases', () => {
      it('should fail when policy already exists', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          { allowRegister: false }
        );

        await expect(
          ctx.commands.addOrgLoginPolicy(
            ctx.createContext(),
            org.orgID,
            { allowRegister: true }
          )
        ).rejects.toThrow(/already exists/i);
      });

      it('should fail with negative passwordCheckLifetime', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addOrgLoginPolicy(
            ctx.createContext(),
            org.orgID,
            { passwordCheckLifetime: -1 }
          )
        ).rejects.toThrow(/must be >= 0/i);
      });

      it('should fail with negative externalLoginCheckLifetime', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addOrgLoginPolicy(
            ctx.createContext(),
            org.orgID,
            { externalLoginCheckLifetime: -100 }
          )
        ).rejects.toThrow(/must be >= 0/i);
      });
    });
  });

  describe('changeOrgLoginPolicy', () => {
    describe('Success Cases', () => {
      it('should update login policy settings', async () => {
        const org = await createTestOrg();

        // Add policy
        await ctx.commands.addOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          { allowRegister: true, forceMFA: false }
        );

        await processProjection();

        // Update policy
        console.log('\n--- Updating login policy ---');
        await ctx.commands.changeOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          { allowRegister: false, forceMFA: true }
        );

        // Verify event
        const event = await ctx.assertEventPublished('org.login.policy.changed');
        expect(event.payload).toHaveProperty('allowRegister', false);
        expect(event.payload).toHaveProperty('forceMFA', true);

        // Process and verify
        await processProjection();
        const policy = await assertPolicyInQuery(org.orgID, {
          allowRegister: false,
          forceMFA: true,
        });
        expect(policy?.allowRegister).toBe(false);
        expect(policy?.forceMFA).toBe(true);
      });

      it('should be idempotent when no changes', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          { allowRegister: true }
        );

        const eventsBefore = await ctx.getEvents('org', org.orgID);
        const countBefore = eventsBefore.length;

        // Update with no changes
        await ctx.commands.changeOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          {}
        );

        const eventsAfter = await ctx.getEvents('org', org.orgID);
        const countAfter = eventsAfter.length;

        // Should not create new event
        expect(countAfter).toBe(countBefore);
        console.log('✓ Idempotency verified: no new event created');
      });

      it('should update only specified fields', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          {
            allowRegister: true,
            forceMFA: false,
            hidePasswordReset: false,
          }
        );

        await processProjection();

        // Update only one field
        await ctx.commands.changeOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          { forceMFA: true }
        );

        await processProjection();
        const policy = await assertPolicyInQuery(org.orgID);
        expect(policy?.allowRegister).toBe(true); // unchanged
        expect(policy?.forceMFA).toBe(true); // changed
        expect(policy?.hidePasswordReset).toBe(false); // unchanged
      });
    });

    describe('Error Cases', () => {
      it('should fail for non-existent policy', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.changeOrgLoginPolicy(
            ctx.createContext(),
            org.orgID,
            { allowRegister: false }
          )
        ).rejects.toThrow(/not found/i);
      });

      it('should fail with negative lifetime values', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          {}
        );

        await expect(
          ctx.commands.changeOrgLoginPolicy(
            ctx.createContext(),
            org.orgID,
            { mfaInitSkipLifetime: -500 }
          )
        ).rejects.toThrow(/must be >= 0/i);
      });
    });
  });

  describe('removeOrgLoginPolicy', () => {
    describe('Success Cases', () => {
      it('should remove login policy from organization', async () => {
        const org = await createTestOrg();

        // Add policy
        await ctx.commands.addOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          { allowRegister: false }
        );

        await processProjection();
        await assertPolicyInQuery(org.orgID);

        // Remove policy
        console.log('\n--- Removing login policy ---');
        await ctx.commands.removeOrgLoginPolicy(
          ctx.createContext(),
          org.orgID
        );

        // Verify event
        await ctx.assertEventPublished('org.login.policy.removed');

        // Process and verify removal
        await processProjection();
        await assertPolicyNotInQuery(org.orgID);
      });
    });

    describe('Error Cases', () => {
      it('should fail when policy does not exist', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.removeOrgLoginPolicy(
            ctx.createContext(),
            org.orgID
          )
        ).rejects.toThrow(/not found/i);
      });
    });
  });

  describe('addSecondFactorToOrgLoginPolicy', () => {
    describe('Success Cases', () => {
      it('should add second factor to policy', async () => {
        const org = await createTestOrg();

        // Add policy first
        await ctx.commands.addOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          {}
        );

        // Add second factor
        console.log('\n--- Adding second factor ---');
        await ctx.commands.addSecondFactorToOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          SecondFactorType.OTP
        );

        // Verify event
        const event = await ctx.assertEventPublished('org.login.policy.second.factor.added');
        expect(event.payload).toHaveProperty('factorType', SecondFactorType.OTP);

        await processProjection();
        const policy = await assertPolicyInQuery(org.orgID);
        expect(policy).toBeDefined();
      });

      it('should add multiple second factors', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOrgLoginPolicy(ctx.createContext(), org.orgID, {});

        await ctx.commands.addSecondFactorToOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          SecondFactorType.OTP
        );

        await ctx.commands.addSecondFactorToOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          SecondFactorType.U2F
        );

        await processProjection();
        const policy = await assertPolicyInQuery(org.orgID);
        expect(policy).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail when policy does not exist', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addSecondFactorToOrgLoginPolicy(
            ctx.createContext(),
            org.orgID,
            SecondFactorType.OTP
          )
        ).rejects.toThrow(/not found/i);
      });

      it('should fail with UNSPECIFIED factor type', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOrgLoginPolicy(ctx.createContext(), org.orgID, {});

        await expect(
          ctx.commands.addSecondFactorToOrgLoginPolicy(
            ctx.createContext(),
            org.orgID,
            SecondFactorType.UNSPECIFIED
          )
        ).rejects.toThrow(/cannot be UNSPECIFIED/i);
      });

      it('should fail when second factor already exists', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOrgLoginPolicy(ctx.createContext(), org.orgID, {});
        await ctx.commands.addSecondFactorToOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          SecondFactorType.OTP
        );

        await expect(
          ctx.commands.addSecondFactorToOrgLoginPolicy(
            ctx.createContext(),
            org.orgID,
            SecondFactorType.OTP
          )
        ).rejects.toThrow(/already exists/i);
      });
    });
  });

  describe('removeSecondFactorFromOrgLoginPolicy', () => {
    describe('Success Cases', () => {
      it('should remove second factor from policy', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOrgLoginPolicy(ctx.createContext(), org.orgID, {});
        await ctx.commands.addSecondFactorToOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          SecondFactorType.OTP
        );

        // Remove second factor
        console.log('\n--- Removing second factor ---');
        await ctx.commands.removeSecondFactorFromOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          SecondFactorType.OTP
        );

        // Verify event
        await ctx.assertEventPublished('org.login.policy.second.factor.removed');

        await processProjection();
        const policy = await assertPolicyInQuery(org.orgID);
        expect(policy).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail when policy does not exist', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.removeSecondFactorFromOrgLoginPolicy(
            ctx.createContext(),
            org.orgID,
            SecondFactorType.OTP
          )
        ).rejects.toThrow(/not found/i);
      });

      it('should fail when second factor does not exist', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOrgLoginPolicy(ctx.createContext(), org.orgID, {});

        await expect(
          ctx.commands.removeSecondFactorFromOrgLoginPolicy(
            ctx.createContext(),
            org.orgID,
            SecondFactorType.OTP
          )
        ).rejects.toThrow(/not found/i);
      });
    });
  });

  describe('addMultiFactorToOrgLoginPolicy', () => {
    describe('Success Cases', () => {
      it('should add multi factor to policy', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOrgLoginPolicy(ctx.createContext(), org.orgID, {});

        console.log('\n--- Adding multi factor ---');
        await ctx.commands.addMultiFactorToOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          MultiFactorType.OTP
        );

        // Verify event
        const event = await ctx.assertEventPublished('org.login.policy.multi.factor.added');
        expect(event.payload).toHaveProperty('factorType', MultiFactorType.OTP);

        await processProjection();
        const policy = await assertPolicyInQuery(org.orgID);
        expect(policy).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail with UNSPECIFIED factor type', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOrgLoginPolicy(ctx.createContext(), org.orgID, {});

        await expect(
          ctx.commands.addMultiFactorToOrgLoginPolicy(
            ctx.createContext(),
            org.orgID,
            MultiFactorType.UNSPECIFIED
          )
        ).rejects.toThrow(/cannot be UNSPECIFIED/i);
      });

      it('should fail when multi factor already exists', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOrgLoginPolicy(ctx.createContext(), org.orgID, {});
        await ctx.commands.addMultiFactorToOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          MultiFactorType.U2F
        );

        await expect(
          ctx.commands.addMultiFactorToOrgLoginPolicy(
            ctx.createContext(),
            org.orgID,
            MultiFactorType.U2F
          )
        ).rejects.toThrow(/already exists/i);
      });
    });
  });

  describe('removeMultiFactorFromOrgLoginPolicy', () => {
    describe('Success Cases', () => {
      it('should remove multi factor from policy', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOrgLoginPolicy(ctx.createContext(), org.orgID, {});
        await ctx.commands.addMultiFactorToOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          MultiFactorType.U2F
        );

        console.log('\n--- Removing multi factor ---');
        await ctx.commands.removeMultiFactorFromOrgLoginPolicy(
          ctx.createContext(),
          org.orgID,
          MultiFactorType.U2F
        );

        // Verify event
        await ctx.assertEventPublished('org.login.policy.multi.factor.removed');

        await processProjection();
        const policy = await assertPolicyInQuery(org.orgID);
        expect(policy).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail when multi factor does not exist', async () => {
        const org = await createTestOrg();

        await ctx.commands.addOrgLoginPolicy(ctx.createContext(), org.orgID, {});

        await expect(
          ctx.commands.removeMultiFactorFromOrgLoginPolicy(
            ctx.createContext(),
            org.orgID,
            MultiFactorType.OTP
          )
        ).rejects.toThrow(/not found/i);
      });
    });
  });

  describe('Login Policy Lifecycle', () => {
    it('should handle complete lifecycle: add → update → factors → remove', async () => {
      const org = await createTestOrg();

      console.log('\n=== Complete Login Policy Lifecycle ===');

      // Step 1: Add policy
      console.log('\n1. ADD POLICY');
      await ctx.commands.addOrgLoginPolicy(
        ctx.createContext(),
        org.orgID,
        {
          allowRegister: true,
          forceMFA: false,
          passwordCheckLifetime: 3600,
        }
      );
      await processProjection();
      await assertPolicyInQuery(org.orgID, { allowRegister: true, forceMFA: false });

      // Step 2: Update policy
      console.log('\n2. UPDATE POLICY');
      await ctx.commands.changeOrgLoginPolicy(
        ctx.createContext(),
        org.orgID,
        {
          forceMFA: true,
          passwordCheckLifetime: 7200,
        }
      );
      await processProjection();
      await assertPolicyInQuery(org.orgID, { forceMFA: true });

      // Step 3: Add factors
      console.log('\n3. ADD FACTORS');
      await ctx.commands.addSecondFactorToOrgLoginPolicy(
        ctx.createContext(),
        org.orgID,
        SecondFactorType.OTP
      );
      await ctx.commands.addMultiFactorToOrgLoginPolicy(
        ctx.createContext(),
        org.orgID,
        MultiFactorType.U2F
      );
      await processProjection();

      // Step 4: Remove factors
      console.log('\n4. REMOVE FACTORS');
      await ctx.commands.removeSecondFactorFromOrgLoginPolicy(
        ctx.createContext(),
        org.orgID,
        SecondFactorType.OTP
      );
      await ctx.commands.removeMultiFactorFromOrgLoginPolicy(
        ctx.createContext(),
        org.orgID,
        MultiFactorType.U2F
      );
      await processProjection();

      // Step 5: Remove policy
      console.log('\n5. REMOVE POLICY');
      await ctx.commands.removeOrgLoginPolicy(
        ctx.createContext(),
        org.orgID
      );
      await processProjection();
      await assertPolicyNotInQuery(org.orgID);

      // Verify event sequence
      console.log('\n6. VERIFY EVENT SEQUENCE');
      const events = await ctx.getEvents('org', org.orgID);
      const eventTypes = events.map(e => e.eventType);

      expect(eventTypes).toContain('org.login.policy.added');
      expect(eventTypes).toContain('org.login.policy.changed');
      expect(eventTypes).toContain('org.login.policy.second.factor.added');
      expect(eventTypes).toContain('org.login.policy.second.factor.removed');
      expect(eventTypes).toContain('org.login.policy.multi.factor.added');
      expect(eventTypes).toContain('org.login.policy.multi.factor.removed');
      expect(eventTypes).toContain('org.login.policy.removed');

      console.log('✓ Complete lifecycle verified');
    });
  });
});
