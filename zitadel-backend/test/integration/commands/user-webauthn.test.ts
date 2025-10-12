/**
 * User WebAuthn Command Tests
 * 
 * Tests for U2F Security Keys and Passwordless/Passkey authentication
 * Note: Uses simplified WebAuthn credential data for testing
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { UserBuilder } from '../../helpers/test-data-builders';

describe('User WebAuthn Commands', () => {
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

  function createMockCredentialData(): Uint8Array {
    return new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  }

  describe('U2F Security Key Commands', () => {
    describe('humanAddU2FSetup', () => {
      it('should begin U2F registration and generate challenge', async () => {
        const userData = new UserBuilder()
          .withUsername(`u2f.setup.${Date.now()}`)
          .withEmail(`u2f.setup.${Date.now()}@example.com`)
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        const result = await ctx.commands.humanAddU2FSetup(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          'localhost'
        );

        expect(result).toBeDefined();
        expect(result.challenge).toBeDefined();
        expect(result.webAuthNTokenID).toBeDefined();
        
        const event = await ctx.assertEventPublished('user.human.u2f.added', createResult.userID);
        expect(event.payload).toHaveProperty('challenge');
      });

      it('should allow multiple U2F tokens', async () => {
        const userData = new UserBuilder()
          .withUsername(`u2f.multiple.${Date.now()}`)
          .withEmail(`u2f.multiple.${Date.now()}@example.com`)
          .build();

        const createResult = await ctx.commands.addHumanUser(ctx.createContext(), userData);

        const result1 = await ctx.commands.humanAddU2FSetup(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        const result2 = await ctx.commands.humanAddU2FSetup(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        expect(result1.webAuthNTokenID).not.toBe(result2.webAuthNTokenID);
      });
    });

    describe('humanVerifyU2FSetup', () => {
      it('should complete U2F registration', async () => {
        const userData = new UserBuilder()
          .withUsername(`u2f.verify.${Date.now()}`)
          .withEmail(`u2f.verify.${Date.now()}@example.com`)
          .build();

        const createResult = await ctx.commands.addHumanUser(ctx.createContext(), userData);
        await ctx.commands.humanAddU2FSetup(ctx.createContext(), createResult.userID, userData.orgID);

        const result = await ctx.commands.humanVerifyU2FSetup(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          'My Security Key',
          createMockCredentialData()
        );

        expect(result).toBeDefined();
        
        const event = await ctx.assertEventPublished('user.human.u2f.verified', createResult.userID);
        expect(event.payload).toHaveProperty('webAuthNTokenName', 'My Security Key');
      });
    });

    describe('humanBeginU2FLogin and humanFinishU2FLogin', () => {
      it('should handle U2F authentication flow', async () => {
        const userData = new UserBuilder()
          .withUsername(`u2f.login.${Date.now()}`)
          .withEmail(`u2f.login.${Date.now()}@example.com`)
          .build();

        const createResult = await ctx.commands.addHumanUser(ctx.createContext(), userData);
        await ctx.commands.humanAddU2FSetup(ctx.createContext(), createResult.userID, userData.orgID);
        
        const credentialData = createMockCredentialData();
        await ctx.commands.humanVerifyU2FSetup(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          'Test Key',
          credentialData
        );

        const loginBegin = await ctx.commands.humanBeginU2FLogin(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        expect(loginBegin.challenge).toBeDefined();
        expect(loginBegin.allowedCredentialIDs.length).toBeGreaterThan(0);

        const loginFinish = await ctx.commands.humanFinishU2FLogin(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          credentialData
        );

        expect(loginFinish).toBeDefined();
        await ctx.assertEventPublished('user.human.u2f.login.succeeded', createResult.userID);
      });
    });

    describe('humanRemoveU2F', () => {
      it('should remove U2F token', async () => {
        const userData = new UserBuilder()
          .withUsername(`u2f.remove.${Date.now()}`)
          .withEmail(`u2f.remove.${Date.now()}@example.com`)
          .build();

        const createResult = await ctx.commands.addHumanUser(ctx.createContext(), userData);
        const setupResult = await ctx.commands.humanAddU2FSetup(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        await ctx.commands.humanVerifyU2FSetup(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          'Test Key',
          createMockCredentialData()
        );

        const result = await ctx.commands.humanRemoveU2F(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          setupResult.webAuthNTokenID!
        );

        expect(result).toBeDefined();
        await ctx.assertEventPublished('user.human.u2f.removed', createResult.userID);
      });
    });
  });

  describe('Passwordless/Passkey Commands', () => {
    describe('humanAddPasswordlessSetup', () => {
      it('should begin passwordless registration', async () => {
        const userData = new UserBuilder()
          .withUsername(`pwl.setup.${Date.now()}`)
          .withEmail(`pwl.setup.${Date.now()}@example.com`)
          .build();

        const createResult = await ctx.commands.addHumanUser(ctx.createContext(), userData);

        const result = await ctx.commands.humanAddPasswordlessSetup(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        expect(result).toBeDefined();
        expect(result.challenge).toBeDefined();
        await ctx.assertEventPublished('user.human.passwordless.added', createResult.userID);
      });
    });

    describe('humanHumanPasswordlessSetup', () => {
      it('should complete passwordless registration', async () => {
        const userData = new UserBuilder()
          .withUsername(`pwl.verify.${Date.now()}`)
          .withEmail(`pwl.verify.${Date.now()}@example.com`)
          .build();

        const createResult = await ctx.commands.addHumanUser(ctx.createContext(), userData);
        await ctx.commands.humanAddPasswordlessSetup(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        const result = await ctx.commands.humanHumanPasswordlessSetup(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          'My Passkey',
          createMockCredentialData()
        );

        expect(result).toBeDefined();
        const event = await ctx.assertEventPublished('user.human.passwordless.verified', createResult.userID);
        expect(event.payload).toHaveProperty('webAuthNTokenName', 'My Passkey');
      });

      it('should allow multiple passwordless credentials', async () => {
        const userData = new UserBuilder()
          .withUsername(`pwl.multiple.${Date.now()}`)
          .withEmail(`pwl.multiple.${Date.now()}@example.com`)
          .build();

        const createResult = await ctx.commands.addHumanUser(ctx.createContext(), userData);

        await ctx.commands.humanAddPasswordlessSetup(ctx.createContext(), createResult.userID, userData.orgID);
        await ctx.commands.humanHumanPasswordlessSetup(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          'iPhone',
          createMockCredentialData()
        );

        await ctx.commands.humanAddPasswordlessSetup(ctx.createContext(), createResult.userID, userData.orgID);
        await ctx.commands.humanHumanPasswordlessSetup(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          'MacBook',
          createMockCredentialData()
        );

        const events = await ctx.getEvents('user', createResult.userID);
        const verifiedEvents = events.filter(e => e.eventType === 'user.human.passwordless.verified');
        expect(verifiedEvents.length).toBe(2);
      });
    });

    describe('humanBeginPasswordlessLogin and humanFinishPasswordlessLogin', () => {
      it('should handle passwordless authentication flow', async () => {
        const userData = new UserBuilder()
          .withUsername(`pwl.login.${Date.now()}`)
          .withEmail(`pwl.login.${Date.now()}@example.com`)
          .build();

        const createResult = await ctx.commands.addHumanUser(ctx.createContext(), userData);
        await ctx.commands.humanAddPasswordlessSetup(ctx.createContext(), createResult.userID, userData.orgID);

        const credentialData = createMockCredentialData();
        await ctx.commands.humanHumanPasswordlessSetup(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          'Test Passkey',
          credentialData
        );

        const loginBegin = await ctx.commands.humanBeginPasswordlessLogin(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        expect(loginBegin.challenge).toBeDefined();
        expect(loginBegin.userVerification).toBe(1); // UserVerificationRequirement.REQUIRED

        const loginFinish = await ctx.commands.humanFinishPasswordlessLogin(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          credentialData
        );

        expect(loginFinish).toBeDefined();
        await ctx.assertEventPublished('user.human.passwordless.login.succeeded', createResult.userID);
      });
    });

    describe('humanRemovePasswordless', () => {
      it('should remove passwordless credential', async () => {
        const userData = new UserBuilder()
          .withUsername(`pwl.remove.${Date.now()}`)
          .withEmail(`pwl.remove.${Date.now()}@example.com`)
          .build();

        const createResult = await ctx.commands.addHumanUser(ctx.createContext(), userData);
        const setupResult = await ctx.commands.humanAddPasswordlessSetup(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        await ctx.commands.humanHumanPasswordlessSetup(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          'Test Passkey',
          createMockCredentialData()
        );

        const result = await ctx.commands.humanRemovePasswordless(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          setupResult.webAuthNTokenID!
        );

        expect(result).toBeDefined();
        await ctx.assertEventPublished('user.human.passwordless.removed', createResult.userID);
      });
    });
  });

  describe('Lifecycle Tests', () => {
    it('should handle complete U2F lifecycle', async () => {
      const userData = new UserBuilder()
        .withUsername(`u2f.lifecycle.${Date.now()}`)
        .withEmail(`u2f.lifecycle.${Date.now()}@example.com`)
        .build();

      const createResult = await ctx.commands.addHumanUser(ctx.createContext(), userData);
      const setupResult = await ctx.commands.humanAddU2FSetup(ctx.createContext(), createResult.userID, userData.orgID);
      
      const credentialData = createMockCredentialData();
      await ctx.commands.humanVerifyU2FSetup(ctx.createContext(), createResult.userID, userData.orgID, 'Key', credentialData);
      await ctx.commands.humanBeginU2FLogin(ctx.createContext(), createResult.userID, userData.orgID);
      await ctx.commands.humanFinishU2FLogin(ctx.createContext(), createResult.userID, userData.orgID, credentialData);
      await ctx.commands.humanRemoveU2F(ctx.createContext(), createResult.userID, userData.orgID, setupResult.webAuthNTokenID!);

      const events = await ctx.getEvents('user', createResult.userID);
      const u2fEvents = events.filter(e => e.eventType.includes('u2f'));
      expect(u2fEvents.length).toBeGreaterThanOrEqual(5);
    });

    it('should handle complete passwordless lifecycle', async () => {
      const userData = new UserBuilder()
        .withUsername(`pwl.lifecycle.${Date.now()}`)
        .withEmail(`pwl.lifecycle.${Date.now()}@example.com`)
        .build();

      const createResult = await ctx.commands.addHumanUser(ctx.createContext(), userData);
      const setupResult = await ctx.commands.humanAddPasswordlessSetup(ctx.createContext(), createResult.userID, userData.orgID);
      
      const credentialData = createMockCredentialData();
      await ctx.commands.humanHumanPasswordlessSetup(ctx.createContext(), createResult.userID, userData.orgID, 'Passkey', credentialData);
      await ctx.commands.humanBeginPasswordlessLogin(ctx.createContext(), createResult.userID, userData.orgID);
      await ctx.commands.humanFinishPasswordlessLogin(ctx.createContext(), createResult.userID, userData.orgID, credentialData);
      await ctx.commands.humanRemovePasswordless(ctx.createContext(), createResult.userID, userData.orgID, setupResult.webAuthNTokenID!);

      const events = await ctx.getEvents('user', createResult.userID);
      const pwlEvents = events.filter(e => e.eventType.includes('passwordless'));
      expect(pwlEvents.length).toBeGreaterThanOrEqual(5);
    });
  });
});
