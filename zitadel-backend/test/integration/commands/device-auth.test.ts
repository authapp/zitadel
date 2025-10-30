/**
 * Device Authorization Commands Integration Tests - Fully Isolated
 * Tests OAuth 2.0 Device Authorization Grant (RFC 8628)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { UserBuilder } from '../../helpers/test-data-builders';

describe('Device Authorization Commands Integration Tests (Isolated)', () => {
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
   * Helper: Create test user
   */
  async function createTestUser() {
    const userData = new UserBuilder()
      .withUsername(`testuser-${Date.now()}-${Math.random()}`)
      .withEmail(`test-${Date.now()}@example.com`)
      .build();
    
    const result = await ctx.commands.addHumanUser(ctx.createContext(), userData);
    return result.userID;
  }

  describe('addDeviceAuth', () => {
    describe('Success Cases', () => {
      it('should create device authorization successfully', async () => {
        const result = await ctx.commands.addDeviceAuth(
          ctx.createContext(),
          {
            clientID: 'test-client-123',
            scope: ['openid', 'profile', 'email'],
          }
        );

        expect(result).toBeDefined();
        expect(result.deviceCode).toBeDefined();
        expect(result.userCode).toBeDefined();
        expect(result.verificationURI).toBeDefined();
        expect(result.verificationURIComplete).toBeDefined();
        expect(result.expiresIn).toBe(600); // Default 10 minutes
        expect(result.interval).toBe(5); // Default 5 seconds polling

        // Verify user code format (XXXX-XXXX)
        expect(result.userCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

        // Verify event
        const events = await ctx.getEvents('device_auth', result.deviceCode);
        const addEvent = events.find(e => e.eventType === 'device_auth.added');
        expect(addEvent).toBeDefined();
        expect(addEvent!.payload).toMatchObject({
          clientID: 'test-client-123',
          deviceCode: result.deviceCode,
          userCode: result.userCode,
          scope: ['openid', 'profile', 'email'],
        });
      });

      it('should create device authorization with custom expiration', async () => {
        const result = await ctx.commands.addDeviceAuth(
          ctx.createContext(),
          {
            clientID: 'test-client',
            expiresIn: 300, // 5 minutes
          }
        );

        expect(result.expiresIn).toBe(300);

        const events = await ctx.getEvents('device_auth', result.deviceCode);
        const addEvent = events.find(e => e.eventType === 'device_auth.added');
        expect(addEvent!.payload!.expiresIn).toBe(300);
      });

      it('should create device authorization with custom verification URI', async () => {
        const customURI = 'https://custom.example.com/activate';
        const result = await ctx.commands.addDeviceAuth(
          ctx.createContext(),
          {
            clientID: 'test-client',
            verificationURI: customURI,
          }
        );

        expect(result.verificationURI).toBe(customURI);
        expect(result.verificationURIComplete).toContain(customURI);
        expect(result.verificationURIComplete).toContain(result.userCode);
      });

      it('should create multiple device authorizations', async () => {
        const result1 = await ctx.commands.addDeviceAuth(
          ctx.createContext(),
          { clientID: 'client-1' }
        );

        const result2 = await ctx.commands.addDeviceAuth(
          ctx.createContext(),
          { clientID: 'client-2' }
        );

        // Each should have unique codes
        expect(result1.deviceCode).not.toBe(result2.deviceCode);
        expect(result1.userCode).not.toBe(result2.userCode);
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty clientID', async () => {
        await expect(
          ctx.commands.addDeviceAuth(
            ctx.createContext(),
            { clientID: '' }
          )
        ).rejects.toThrow(/clientID is required/);
      });
    });
  });

  describe('approveDeviceAuth', () => {
    describe('Success Cases', () => {
      it('should approve device authorization successfully', async () => {
        const userID = await createTestUser();

        // Create device authorization
        const authResult = await ctx.commands.addDeviceAuth(
          ctx.createContext(),
          {
            clientID: 'test-client',
            scope: ['openid', 'profile'],
          }
        );

        // User approves the device
        const userContext = ctx.createContext();
        userContext.userID = userID;

        const result = await ctx.commands.approveDeviceAuth(
          userContext,
          authResult.userCode,
          userID
        );

        expect(result).toBeDefined();

        // Verify approval event
        const events = await ctx.getEvents('device_auth', authResult.deviceCode);
        const approveEvent = events.find(e => e.eventType === 'device_auth.approved');
        expect(approveEvent).toBeDefined();
        expect(approveEvent!.payload).toMatchObject({
          userID,
          userCode: authResult.userCode,
        });
        expect(approveEvent!.payload!.approvedAt).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty userCode', async () => {
        const userID = await createTestUser();
        const userContext = ctx.createContext();
        userContext.userID = userID;

        await expect(
          ctx.commands.approveDeviceAuth(
            userContext,
            '',
            userID
          )
        ).rejects.toThrow(/userCode is required/);
      });

      it('should fail with empty userID', async () => {
        await expect(
          ctx.commands.approveDeviceAuth(
            ctx.createContext(),
            'TEST-CODE',
            ''
          )
        ).rejects.toThrow(/userID is required/);
      });

      it('should fail with non-existent userCode', async () => {
        const userID = await createTestUser();
        const userContext = ctx.createContext();
        userContext.userID = userID;

        await expect(
          ctx.commands.approveDeviceAuth(
            userContext,
            'FAKE-CODE',
            userID
          )
        ).rejects.toThrow(/device authorization not found/);
      });

      it('should fail with user mismatch', async () => {
        const userID1 = await createTestUser();
        const userID2 = await createTestUser();

        const authResult = await ctx.commands.addDeviceAuth(
          ctx.createContext(),
          { clientID: 'test-client' }
        );

        const userContext = ctx.createContext();
        userContext.userID = userID1;

        // Try to approve with different userID in context vs parameter
        await expect(
          ctx.commands.approveDeviceAuth(
            userContext,
            authResult.userCode,
            userID2
          )
        ).rejects.toThrow(/user mismatch/);
      });

      it('should fail approving already approved device', async () => {
        const userID = await createTestUser();

        const authResult = await ctx.commands.addDeviceAuth(
          ctx.createContext(),
          { clientID: 'test-client' }
        );

        const userContext = ctx.createContext();
        userContext.userID = userID;

        // Approve once
        await ctx.commands.approveDeviceAuth(
          userContext,
          authResult.userCode,
          userID
        );

        // Try to approve again
        await expect(
          ctx.commands.approveDeviceAuth(
            userContext,
            authResult.userCode,
            userID
          )
        ).rejects.toThrow(/device authorization not active/);
      });
    });
  });

  describe('denyDeviceAuth', () => {
    describe('Success Cases', () => {
      it('should deny device authorization successfully', async () => {
        const userID = await createTestUser();

        const authResult = await ctx.commands.addDeviceAuth(
          ctx.createContext(),
          { clientID: 'test-client' }
        );

        const userContext = ctx.createContext();
        userContext.userID = userID;

        const result = await ctx.commands.denyDeviceAuth(
          userContext,
          authResult.userCode,
          userID
        );

        expect(result).toBeDefined();

        // Verify denial event
        const events = await ctx.getEvents('device_auth', authResult.deviceCode);
        const denyEvent = events.find(e => e.eventType === 'device_auth.denied');
        expect(denyEvent).toBeDefined();
        expect(denyEvent!.payload).toMatchObject({
          userID,
          userCode: authResult.userCode,
        });
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty userCode', async () => {
        const userID = await createTestUser();
        const userContext = ctx.createContext();
        userContext.userID = userID;

        await expect(
          ctx.commands.denyDeviceAuth(
            userContext,
            '',
            userID
          )
        ).rejects.toThrow(/userCode is required/);
      });

      it('should fail denying non-existent device', async () => {
        const userID = await createTestUser();
        const userContext = ctx.createContext();
        userContext.userID = userID;

        await expect(
          ctx.commands.denyDeviceAuth(
            userContext,
            'FAKE-CODE',
            userID
          )
        ).rejects.toThrow(/device authorization not found/);
      });
    });
  });

  describe('cancelDeviceAuth', () => {
    describe('Success Cases', () => {
      it('should cancel device authorization successfully', async () => {
        const authResult = await ctx.commands.addDeviceAuth(
          ctx.createContext(),
          { clientID: 'test-client' }
        );

        const result = await ctx.commands.cancelDeviceAuth(
          ctx.createContext(),
          authResult.deviceCode
        );

        expect(result).toBeDefined();

        // Verify cancellation event
        const events = await ctx.getEvents('device_auth', authResult.deviceCode);
        const cancelEvent = events.find(e => e.eventType === 'device_auth.cancelled');
        expect(cancelEvent).toBeDefined();
        expect(cancelEvent!.payload!.cancelledAt).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty deviceCode', async () => {
        await expect(
          ctx.commands.cancelDeviceAuth(
            ctx.createContext(),
            ''
          )
        ).rejects.toThrow(/deviceCode is required/);
      });

      it('should fail with non-existent deviceCode', async () => {
        await expect(
          ctx.commands.cancelDeviceAuth(
            ctx.createContext(),
            'non-existent-device-code'
          )
        ).rejects.toThrow(/device authorization not found/);
      });

      it('should fail cancelling approved device', async () => {
        const userID = await createTestUser();

        const authResult = await ctx.commands.addDeviceAuth(
          ctx.createContext(),
          { clientID: 'test-client' }
        );

        // Approve first
        const userContext = ctx.createContext();
        userContext.userID = userID;
        await ctx.commands.approveDeviceAuth(
          userContext,
          authResult.userCode,
          userID
        );

        // Try to cancel
        await expect(
          ctx.commands.cancelDeviceAuth(
            ctx.createContext(),
            authResult.deviceCode
          )
        ).rejects.toThrow(/cannot cancel approved authorization/);
      });

      it('should fail cancelling already cancelled device', async () => {
        const authResult = await ctx.commands.addDeviceAuth(
          ctx.createContext(),
          { clientID: 'test-client' }
        );

        // Cancel once
        await ctx.commands.cancelDeviceAuth(
          ctx.createContext(),
          authResult.deviceCode
        );

        // Try to cancel again
        await expect(
          ctx.commands.cancelDeviceAuth(
            ctx.createContext(),
            authResult.deviceCode
          )
        ).rejects.toThrow(/device authorization already cancelled/);
      });
    });
  });

  describe('Complete Lifecycle Tests', () => {
    it('complete flow: add → approve → verify events', async () => {
      const userID = await createTestUser();

      // 1. Device requests authorization
      const authResult = await ctx.commands.addDeviceAuth(
        ctx.createContext(),
        {
          clientID: 'smart-tv-app',
          scope: ['openid', 'profile', 'offline_access'],
          expiresIn: 600,
        }
      );

      expect(authResult.deviceCode).toBeDefined();
      expect(authResult.userCode).toBeDefined();

      // 2. User visits verification URI and approves
      const userContext = ctx.createContext();
      userContext.userID = userID;

      await ctx.commands.approveDeviceAuth(
        userContext,
        authResult.userCode,
        userID
      );

      // 3. Verify all events in order
      const events = await ctx.getEvents('device_auth', authResult.deviceCode);
      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe('device_auth.added');
      expect(events[1].eventType).toBe('device_auth.approved');
    });

    it('denial flow: add → deny', async () => {
      const userID = await createTestUser();

      const authResult = await ctx.commands.addDeviceAuth(
        ctx.createContext(),
        { clientID: 'test-client' }
      );

      const userContext = ctx.createContext();
      userContext.userID = userID;

      await ctx.commands.denyDeviceAuth(
        userContext,
        authResult.userCode,
        userID
      );

      const events = await ctx.getEvents('device_auth', authResult.deviceCode);
      expect(events[events.length - 1].eventType).toBe('device_auth.denied');
    });

    it('cancellation flow: add → cancel (before approval)', async () => {
      const authResult = await ctx.commands.addDeviceAuth(
        ctx.createContext(),
        { clientID: 'test-client' }
      );

      await ctx.commands.cancelDeviceAuth(
        ctx.createContext(),
        authResult.deviceCode
      );

      const events = await ctx.getEvents('device_auth', authResult.deviceCode);
      expect(events[events.length - 1].eventType).toBe('device_auth.cancelled');
    });

    it('RFC 8628 compliance: proper response structure', async () => {
      const result = await ctx.commands.addDeviceAuth(
        ctx.createContext(),
        {
          clientID: 'rfc-test-client',
          scope: ['read', 'write'],
        }
      );

      // RFC 8628 required fields (TypeScript camelCase convention)
      expect(result).toHaveProperty('deviceCode');
      expect(result).toHaveProperty('userCode');
      expect(result).toHaveProperty('verificationURI');
      expect(result).toHaveProperty('expiresIn');
      expect(result).toHaveProperty('interval');

      // Optional but recommended
      expect(result).toHaveProperty('verificationURIComplete');

      // Verification URI Complete should include user code
      expect(result.verificationURIComplete).toContain(result.userCode);
    });

    it('multiple devices for same user scenario', async () => {
      const userID = await createTestUser();

      // User has multiple devices (TV, Phone, etc.)
      const device1 = await ctx.commands.addDeviceAuth(
        ctx.createContext(),
        { clientID: 'smart-tv' }
      );

      const device2 = await ctx.commands.addDeviceAuth(
        ctx.createContext(),
        { clientID: 'mobile-app' }
      );

      const device3 = await ctx.commands.addDeviceAuth(
        ctx.createContext(),
        { clientID: 'cli-tool' }
      );

      // User approves two, denies one
      const userContext = ctx.createContext();
      userContext.userID = userID;

      await ctx.commands.approveDeviceAuth(userContext, device1.userCode, userID);
      await ctx.commands.approveDeviceAuth(userContext, device2.userCode, userID);
      await ctx.commands.denyDeviceAuth(userContext, device3.userCode, userID);

      // Verify states
      const events1 = await ctx.getEvents('device_auth', device1.deviceCode);
      const events2 = await ctx.getEvents('device_auth', device2.deviceCode);
      const events3 = await ctx.getEvents('device_auth', device3.deviceCode);

      expect(events1.find(e => e.eventType === 'device_auth.approved')).toBeDefined();
      expect(events2.find(e => e.eventType === 'device_auth.approved')).toBeDefined();
      expect(events3.find(e => e.eventType === 'device_auth.denied')).toBeDefined();
    });
  });
});
