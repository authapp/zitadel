/**
 * Password Policy Command Tests
 * 
 * Tests for:
 * - Password complexity policies (length, requirements)
 * - Password lockout policies (max attempts, duration)
 * - Instance-level (default) policies
 * - Organization-level policies (override defaults)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder } from '../../helpers/test-data-builders';

describe('Password Policy Commands', () => {
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

  describe('Password Complexity Policy', () => {
    describe('Default (Instance-Level) Policies', () => {
      describe('addDefaultPasswordComplexityPolicy', () => {
        it('should set instance-wide password complexity policy', async () => {
          const policyData = {
            minLength: 12,
            hasLowercase: true,
            hasUppercase: true,
            hasNumber: true,
            hasSymbol: true,
          };

          const result = await ctx.commands.addDefaultPasswordComplexityPolicy(
            ctx.createContext(),
            policyData
          );

          expect(result).toBeDefined();

          const event = await ctx.assertEventPublished(
            'instance.password.complexity.policy.added'
          );
          expect(event.payload).toHaveProperty('minLength', 12);
          expect(event.payload).toHaveProperty('hasLowercase', true);
        });

        it('should allow relaxed complexity requirements', async () => {
          const policyData = {
            minLength: 8,
            hasLowercase: false,
            hasUppercase: false,
            hasNumber: false,
            hasSymbol: false,
          };

          const result = await ctx.commands.addDefaultPasswordComplexityPolicy(
            ctx.createContext(),
            policyData
          );

          expect(result).toBeDefined();
        });
      });

      describe('changeDefaultPasswordComplexityPolicy', () => {
        it('should update instance-wide complexity policy', async () => {
          await ctx.commands.addDefaultPasswordComplexityPolicy(ctx.createContext(), {
            minLength: 8,
            hasLowercase: true,
            hasUppercase: false,
            hasNumber: false,
            hasSymbol: false,
          });

          const result = await ctx.commands.changeDefaultPasswordComplexityPolicy(
            ctx.createContext(),
            {
              minLength: 10,
              hasNumber: true,
            }
          );

          expect(result).toBeDefined();

          const event = await ctx.assertEventPublished(
            'instance.password.complexity.policy.changed'
          );
          expect(event.payload).toHaveProperty('minLength', 10);
        });
      });

      describe('removeDefaultPasswordComplexityPolicy', () => {
        it('should remove instance policy (revert to system defaults)', async () => {
          await ctx.commands.addDefaultPasswordComplexityPolicy(ctx.createContext(), {
            minLength: 12,
            hasLowercase: true,
            hasUppercase: true,
            hasNumber: true,
            hasSymbol: true,
          });

          const result = await ctx.commands.removeDefaultPasswordComplexityPolicy(
            ctx.createContext()
          );

          expect(result).toBeDefined();
          await ctx.assertEventPublished(
            'instance.password.complexity.policy.removed'
          );
        });
      });
    });

    describe('Organization-Level Policies', () => {
      async function createTestOrg() {
        const orgData = new OrganizationBuilder()
          .withName(`Policy Test Org ${Date.now()}`)
          .build();
        return await ctx.commands.addOrg(ctx.createContext(), orgData);
      }

      describe('addOrgPasswordComplexityPolicy', () => {
        it('should set org-specific password complexity policy', async () => {
          const org = await createTestOrg();

          const policyData = {
            minLength: 14,
            hasLowercase: true,
            hasUppercase: true,
            hasNumber: true,
            hasSymbol: true,
          };

          const result = await ctx.commands.addOrgPasswordComplexityPolicy(
            ctx.createContext(),
            org.orgID,
            policyData
          );

          expect(result).toBeDefined();

          const event = await ctx.assertEventPublished(
            'org.password.complexity.policy.added'
          );
          expect(event.payload).toHaveProperty('minLength', 14);
        });

        it('should allow org to override instance policy', async () => {
          // Set instance policy (strict)
          await ctx.commands.addDefaultPasswordComplexityPolicy(ctx.createContext(), {
            minLength: 16,
            hasLowercase: true,
            hasUppercase: true,
            hasNumber: true,
            hasSymbol: true,
          });

          // Set org policy (more relaxed)
          const org = await createTestOrg();
          const result = await ctx.commands.addOrgPasswordComplexityPolicy(
            ctx.createContext(),
            org.orgID,
            {
              minLength: 8,
              hasLowercase: true,
              hasUppercase: false,
              hasNumber: false,
              hasSymbol: false,
            }
          );

          expect(result).toBeDefined();
        });
      });

      describe('changeOrgPasswordComplexityPolicy', () => {
        it('should update org-specific policy', async () => {
          const org = await createTestOrg();

          await ctx.commands.addOrgPasswordComplexityPolicy(
            ctx.createContext(),
            org.orgID,
            {
              minLength: 10,
              hasLowercase: true,
              hasUppercase: false,
              hasNumber: false,
              hasSymbol: false,
            }
          );

          const result = await ctx.commands.changeOrgPasswordComplexityPolicy(
            ctx.createContext(),
            org.orgID,
            {
              minLength: 12,
              hasSymbol: true,
            }
          );

          expect(result).toBeDefined();
          await ctx.assertEventPublished('org.password.complexity.policy.changed');
        });
      });

      describe('removeOrgPasswordComplexityPolicy', () => {
        it('should remove org policy (revert to instance default)', async () => {
          const org = await createTestOrg();

          await ctx.commands.addOrgPasswordComplexityPolicy(
            ctx.createContext(),
            org.orgID,
            {
              minLength: 14,
              hasLowercase: true,
              hasUppercase: true,
              hasNumber: true,
              hasSymbol: true,
            }
          );

          const result = await ctx.commands.removeOrgPasswordComplexityPolicy(
            ctx.createContext(),
            org.orgID
          );

          expect(result).toBeDefined();
          await ctx.assertEventPublished('org.password.complexity.policy.removed');
        });
      });
    });
  });

  describe('Password Lockout Policy', () => {
    describe('Default (Instance-Level) Policies', () => {
      describe('addDefaultPasswordLockoutPolicy', () => {
        it('should set instance-wide lockout policy', async () => {
          const policyData = {
            maxPasswordAttempts: 5,
            showLockoutFailures: true,
          };

          const result = await ctx.commands.addDefaultPasswordLockoutPolicy(
            ctx.createContext(),
            policyData
          );

          expect(result).toBeDefined();

          const event = await ctx.assertEventPublished(
            'instance.password.lockout.policy.added'
          );
          expect(event.payload).toHaveProperty('maxPasswordAttempts', 5);
          expect(event.payload).toHaveProperty('showLockoutFailures', true);
        });

        it('should allow strict lockout policy', async () => {
          const policyData = {
            maxPasswordAttempts: 3,
            showLockoutFailures: false,
          };

          const result = await ctx.commands.addDefaultPasswordLockoutPolicy(
            ctx.createContext(),
            policyData
          );

          expect(result).toBeDefined();
        });
      });

      describe('changeDefaultPasswordLockoutPolicy', () => {
        it('should update instance-wide lockout policy', async () => {
          await ctx.commands.addDefaultPasswordLockoutPolicy(ctx.createContext(), {
            maxPasswordAttempts: 5,
            showLockoutFailures: true,
          });

          const result = await ctx.commands.changeDefaultPasswordLockoutPolicy(
            ctx.createContext(),
            {
              maxPasswordAttempts: 3,
            }
          );

          expect(result).toBeDefined();
          await ctx.assertEventPublished('instance.password.lockout.policy.changed');
        });
      });

      describe('removeDefaultPasswordLockoutPolicy', () => {
        it('should remove instance lockout policy', async () => {
          await ctx.commands.addDefaultPasswordLockoutPolicy(ctx.createContext(), {
            maxPasswordAttempts: 5,
            showLockoutFailures: true,
          });

          const result = await ctx.commands.removeDefaultPasswordLockoutPolicy(
            ctx.createContext()
          );

          expect(result).toBeDefined();
          await ctx.assertEventPublished('instance.password.lockout.policy.removed');
        });
      });
    });

    describe('Organization-Level Policies', () => {
      async function createTestOrg() {
        const orgData = new OrganizationBuilder()
          .withName(`Lockout Policy Org ${Date.now()}`)
          .build();
        return await ctx.commands.addOrg(ctx.createContext(), orgData);
      }

      describe('addOrgPasswordLockoutPolicy', () => {
        it('should set org-specific lockout policy', async () => {
          const org = await createTestOrg();

          const policyData = {
            maxPasswordAttempts: 10,
            showLockoutFailures: false,
          };

          const result = await ctx.commands.addOrgPasswordLockoutPolicy(
            ctx.createContext(),
            org.orgID,
            policyData
          );

          expect(result).toBeDefined();
          await ctx.assertEventPublished('org.lockout.policy.added');
        });
      });

      describe('changeOrgPasswordLockoutPolicy', () => {
        it('should update org lockout policy', async () => {
          const org = await createTestOrg();

          await ctx.commands.addOrgPasswordLockoutPolicy(
            ctx.createContext(),
            org.orgID,
            {
              maxPasswordAttempts: 5,
              showLockoutFailures: true,
            }
          );

          const result = await ctx.commands.changeOrgPasswordLockoutPolicy(
            ctx.createContext(),
            org.orgID,
            {
              maxPasswordAttempts: 3,
            }
          );

          expect(result).toBeDefined();
          await ctx.assertEventPublished('org.lockout.policy.changed');
        });
      });

      describe('removeOrgPasswordLockoutPolicy', () => {
        it('should remove org lockout policy', async () => {
          const org = await createTestOrg();

          await ctx.commands.addOrgPasswordLockoutPolicy(
            ctx.createContext(),
            org.orgID,
            {
              maxPasswordAttempts: 5,
              showLockoutFailures: true,
            }
          );

          const result = await ctx.commands.removeOrgPasswordLockoutPolicy(
            ctx.createContext(),
            org.orgID
          );

          expect(result).toBeDefined();
          await ctx.assertEventPublished('org.lockout.policy.removed');
        });
      });
    });
  });

  describe('Policy Hierarchy', () => {
    it('should support instance and org policy layers', async () => {
      // Instance policy (applies to all orgs)
      await ctx.commands.addDefaultPasswordComplexityPolicy(ctx.createContext(), {
        minLength: 12,
        hasLowercase: true,
        hasUppercase: true,
        hasNumber: true,
        hasSymbol: true,
      });

      // Org-specific override
      const orgData = new OrganizationBuilder()
        .withName(`Hierarchy Test Org ${Date.now()}`)
        .build();
      const org = await ctx.commands.addOrg(ctx.createContext(), orgData);

      await ctx.commands.addOrgPasswordComplexityPolicy(
        ctx.createContext(),
        org.orgID,
        {
          minLength: 10,
          hasLowercase: true,
          hasUppercase: false,
          hasNumber: false,
          hasSymbol: false,
        }
      );

      // Verify both policies exist independently
      const events = await ctx.getEvents('org', org.orgID);
      const orgPolicyEvents = events.filter(
        e => e.eventType === 'org.password.complexity.policy.added'
      );
      expect(orgPolicyEvents.length).toBe(1);
    });
  });
});
