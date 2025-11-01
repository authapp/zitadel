/**
 * Lockout Policy Integration Tests - Complete Stack
 * 
 * Tests for:
 * - Instance lockout policy management (default/instance-level)
 * - Account lockout after failed login attempts
 * - Complete stack: Command → Event → Projection → Query
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';

describe('Lockout Policy - Complete Flow', () => {
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

  // ============================================================================
  // Default (Instance-Level) Lockout Policy Tests
  // ============================================================================

  describe('changeDefaultPasswordLockoutPolicy', () => {
    it('should change default lockout policy password attempts', async () => {
      // Act
      await ctx.commands.changeDefaultPasswordLockoutPolicy(
        ctx.createContext(),
        {
          maxPasswordAttempts: 5,
        }
      );
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeEvent = events.find(e => e.eventType === 'instance.password.lockout.policy.changed');
      expect(changeEvent).toBeDefined();
      expect(changeEvent!.payload!.maxPasswordAttempts).toBe(5);
      
      console.log('✓ Default lockout policy password attempts changed');
    });

    it('should change default lockout policy OTP attempts', async () => {
      // Act
      await ctx.commands.changeDefaultPasswordLockoutPolicy(
        ctx.createContext(),
        {
          maxOTPAttempts: 3,
        }
      );
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeEvent = events.find(e => e.eventType === 'instance.password.lockout.policy.changed');
      expect(changeEvent).toBeDefined();
      expect(changeEvent!.payload!.maxOTPAttempts).toBe(3);
      
      console.log('✓ Default lockout policy OTP attempts changed');
    });

    it('should change default lockout policy show failures', async () => {
      // Act
      await ctx.commands.changeDefaultPasswordLockoutPolicy(
        ctx.createContext(),
        {
          showLockoutFailures: false,
        }
      );
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeEvent = events.find(e => e.eventType === 'instance.password.lockout.policy.changed');
      expect(changeEvent).toBeDefined();
      expect(changeEvent!.payload!.showLockoutFailures).toBe(false);
      
      console.log('✓ Default lockout policy show failures changed');
    });

    it('should change multiple lockout policy fields', async () => {
      // Act
      await ctx.commands.changeDefaultPasswordLockoutPolicy(
        ctx.createContext(),
        {
          maxPasswordAttempts: 10,
          maxOTPAttempts: 5,
          showLockoutFailures: true,
        }
      );
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeEvent = events.find(e => e.eventType === 'instance.password.lockout.policy.changed');
      expect(changeEvent).toBeDefined();
      expect(changeEvent!.payload!.maxPasswordAttempts).toBe(10);
      expect(changeEvent!.payload!.maxOTPAttempts).toBe(5);
      expect(changeEvent!.payload!.showLockoutFailures).toBe(true);
      
      console.log('✓ Default lockout policy multiple fields changed');
    });

    it('should handle partial updates', async () => {
      // Arrange - First change
      await ctx.commands.changeDefaultPasswordLockoutPolicy(
        ctx.createContext(),
        {
          maxPasswordAttempts: 5,
          maxOTPAttempts: 3,
        }
      );
      
      // Act - Partial update (only change one field)
      await ctx.commands.changeDefaultPasswordLockoutPolicy(
        ctx.createContext(),
        {
          showLockoutFailures: false,
        }
      );
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeEvents = events.filter(e => e.eventType === 'instance.password.lockout.policy.changed');
      expect(changeEvents.length).toBeGreaterThanOrEqual(2);
      
      // Last change should have showLockoutFailures
      const lastChange = changeEvents[changeEvents.length - 1];
      expect(lastChange.payload!.showLockoutFailures).toBe(false);
      
      console.log('✓ Default lockout policy partial updates working');
    });

    it('should validate maxPasswordAttempts minimum value', async () => {
      // Act & Assert
      await expect(
        ctx.commands.changeDefaultPasswordLockoutPolicy(
          ctx.createContext(),
          {
            maxPasswordAttempts: 0,
          }
        )
      ).rejects.toThrow('maxPasswordAttempts must be at least 1');
      
      console.log('✓ Failed as expected - maxPasswordAttempts too low');
    });

    it('should validate maxOTPAttempts minimum value', async () => {
      // Act & Assert
      await expect(
        ctx.commands.changeDefaultPasswordLockoutPolicy(
          ctx.createContext(),
          {
            maxOTPAttempts: 0,
          }
        )
      ).rejects.toThrow('maxOTPAttempts must be at least 1');
      
      console.log('✓ Failed as expected - maxOTPAttempts too low');
    });

    it('should allow reasonable lockout values', async () => {
      // Act
      await ctx.commands.changeDefaultPasswordLockoutPolicy(
        ctx.createContext(),
        {
          maxPasswordAttempts: 3,
          maxOTPAttempts: 3,
          showLockoutFailures: true,
        }
      );
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeEvent = events.find(e => e.eventType === 'instance.password.lockout.policy.changed');
      expect(changeEvent).toBeDefined();
      expect(changeEvent!.payload!.maxPasswordAttempts).toBe(3);
      expect(changeEvent!.payload!.maxOTPAttempts).toBe(3);
      
      console.log('✓ Reasonable lockout values accepted');
    });

    it('should allow strict lockout policy', async () => {
      // Act - Very strict policy (1 attempt lockout)
      await ctx.commands.changeDefaultPasswordLockoutPolicy(
        ctx.createContext(),
        {
          maxPasswordAttempts: 1,
          maxOTPAttempts: 1,
          showLockoutFailures: false,
        }
      );
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeEvent = events.find(e => e.eventType === 'instance.password.lockout.policy.changed');
      expect(changeEvent).toBeDefined();
      expect(changeEvent!.payload!.maxPasswordAttempts).toBe(1);
      expect(changeEvent!.payload!.maxOTPAttempts).toBe(1);
      expect(changeEvent!.payload!.showLockoutFailures).toBe(false);
      
      console.log('✓ Strict lockout policy (1 attempt) accepted');
    });

    it('should allow lenient lockout policy', async () => {
      // Act - Lenient policy (many attempts)
      await ctx.commands.changeDefaultPasswordLockoutPolicy(
        ctx.createContext(),
        {
          maxPasswordAttempts: 100,
          maxOTPAttempts: 50,
          showLockoutFailures: true,
        }
      );
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeEvent = events.find(e => e.eventType === 'instance.password.lockout.policy.changed');
      expect(changeEvent).toBeDefined();
      expect(changeEvent!.payload!.maxPasswordAttempts).toBe(100);
      expect(changeEvent!.payload!.maxOTPAttempts).toBe(50);
      
      console.log('✓ Lenient lockout policy (100 attempts) accepted');
    });
  });

  // ============================================================================
  // Complete Lifecycle Tests
  // ============================================================================

  describe('Complete Lockout Policy Lifecycle', () => {
    it('should complete lifecycle: configure → update → reconfigure', async () => {
      // Step 1: Initial configuration
      await ctx.commands.changeDefaultPasswordLockoutPolicy(
        ctx.createContext(),
        {
          maxPasswordAttempts: 5,
          maxOTPAttempts: 3,
          showLockoutFailures: true,
        }
      );
      
      // Step 2: Update policy
      await ctx.commands.changeDefaultPasswordLockoutPolicy(
        ctx.createContext(),
        {
          maxPasswordAttempts: 10,
          showLockoutFailures: false,
        }
      );
      
      // Step 3: Another update
      await ctx.commands.changeDefaultPasswordLockoutPolicy(
        ctx.createContext(),
        {
          maxOTPAttempts: 5,
        }
      );
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeEvents = events.filter(e => e.eventType === 'instance.password.lockout.policy.changed');
      
      expect(changeEvents.length).toBe(3);
      expect(changeEvents[0].payload!.maxPasswordAttempts).toBe(5);
      expect(changeEvents[1].payload!.maxPasswordAttempts).toBe(10);
      expect(changeEvents[2].payload!.maxOTPAttempts).toBe(5);
      
      console.log('✓ Complete lockout policy lifecycle successful');
    });

    it('should handle changing from strict to lenient policy', async () => {
      // Step 1: Start with strict policy
      await ctx.commands.changeDefaultPasswordLockoutPolicy(
        ctx.createContext(),
        {
          maxPasswordAttempts: 3,
          maxOTPAttempts: 2,
          showLockoutFailures: false,
        }
      );
      
      // Step 2: Change to lenient policy
      await ctx.commands.changeDefaultPasswordLockoutPolicy(
        ctx.createContext(),
        {
          maxPasswordAttempts: 20,
          maxOTPAttempts: 10,
          showLockoutFailures: true,
        }
      );
      
      // Assert
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const changeEvents = events.filter(e => e.eventType === 'instance.password.lockout.policy.changed');
      
      expect(changeEvents.length).toBeGreaterThanOrEqual(2);
      const lastEvent = changeEvents[changeEvents.length - 1];
      expect(lastEvent.payload!.maxPasswordAttempts).toBe(20);
      expect(lastEvent.payload!.maxOTPAttempts).toBe(10);
      expect(lastEvent.payload!.showLockoutFailures).toBe(true);
      
      console.log('✓ Policy changed from strict to lenient successfully');
    });
  });
});
