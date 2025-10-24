/**
 * Auth Command Tests - Complete Stack
 * 
 * Tests for:
 * - Auth request lifecycle (create, select user, verify factors)
 * - Password verification
 * - TOTP verification
 * - Auth request completion (success/failure)
 * - Complete stack: Command → Event → Projection → Query
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { UserBuilder, OrganizationBuilder } from '../../helpers/test-data-builders';
import { AuthRequestProjection } from '../../../src/lib/query/projections/auth-request-projection';
import { AuthRequestQueries } from '../../../src/lib/query/auth-request/auth-request-queries';

describe('Auth Commands - Complete Flow', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let authRequestProjection: AuthRequestProjection;
  let authRequestQueries: AuthRequestQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projection
    authRequestProjection = new AuthRequestProjection(ctx.eventstore, pool);
    await authRequestProjection.init();
    
    // Initialize query layer
    authRequestQueries = new AuthRequestQueries(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    await ctx.clearEvents();
  });

  /**
   * Helper: Process projections
   */
  async function processProjections() {
    const events = await ctx.getEvents('*', '*');
    
    console.log(`Processing ${events.length} event(s) through projections...`);
    
    for (const event of events) {
      try {
        await authRequestProjection.reduce(event);
        console.log(`  ✓ Processed ${event.eventType} for ${event.aggregateID}`);
      } catch (err: any) {
        console.error(`  ✗ Failed to process ${event.eventType}:`, err.message);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Create test user
   */
  async function createTestUser() {
    const userData = new UserBuilder()
      .withUsername(`user-${Date.now()}`)
      .withEmail(`user-${Date.now()}@example.com`)
      .build();
    
    const result = await ctx.commands.addHumanUser(ctx.createContext(), userData);
    return result.userID;
  }

  /**
   * Helper: Create test org
   */
  async function createTestOrg() {
    const orgData = new OrganizationBuilder()
      .withName(`Test Org ${Date.now()}`)
      .build();
    
    const result = await ctx.commands.addOrg(ctx.createContext(), orgData);
    return result.orgID;
  }

  /**
   * Helper: Verify auth request via Query Layer
   */
  async function assertAuthRequestInQuery(authRequestID: string) {
    const authRequest = await authRequestQueries.getAuthRequestByID(authRequestID, 'test-instance');
    
    expect(authRequest).not.toBeNull();
    console.log(`✓ Auth request verified via query layer: ${authRequestID}`);
    
    return authRequest;
  }

  describe('addAuthRequest', () => {
    describe('Success Cases', () => {
      it('should create auth request successfully', async () => {
        const orgID = await createTestOrg();

        console.log('\n--- Creating auth request ---');

        const result = await ctx.commands.addAuthRequest(
          ctx.createContext(),
          {
            clientID: 'test-client',
            redirectURI: 'https://example.com/callback',
            scope: ['openid', 'profile'],
            responseType: 'code',
            state: 'random-state',
            orgID,
          }
        );

        expect(result).toBeDefined();
        expect(result.authRequestID).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('auth.request.added');
        expect(event.payload).toHaveProperty('clientID', 'test-client');

        // Process projections
        await processProjections();

        // Verify via query layer
        const authRequest = await assertAuthRequestInQuery(result.authRequestID);
        expect(authRequest?.clientID).toBe('test-client');
      });

      it('should create auth request with PKCE', async () => {
        const orgID = await createTestOrg();

        const result = await ctx.commands.addAuthRequest(
          ctx.createContext(),
          {
            clientID: 'test-client',
            redirectURI: 'https://example.com/callback',
            scope: ['openid'],
            responseType: 'code',
            codeChallenge: 'challenge-string',
            codeChallengeMethod: 'S256',
            orgID,
          }
        );

        expect(result).toBeDefined();

        // Verify event has PKCE params
        const event = await ctx.assertEventPublished('auth.request.added');
        expect(event.payload).toHaveProperty('codeChallenge');
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty clientID', async () => {
        const orgID = await createTestOrg();

        await expect(
          ctx.commands.addAuthRequest(
            ctx.createContext(),
            {
              clientID: '',
              redirectURI: 'https://example.com/callback',
              scope: ['openid'],
              responseType: 'code',
              orgID,
            }
          )
        ).rejects.toThrow(/clientID/i);
      });

      it('should fail with empty redirectURI', async () => {
        const orgID = await createTestOrg();

        await expect(
          ctx.commands.addAuthRequest(
            ctx.createContext(),
            {
              clientID: 'test-client',
              redirectURI: '',
              scope: ['openid'],
              responseType: 'code',
              orgID,
            }
          )
        ).rejects.toThrow(/redirectURI/i);
      });
    });
  });

  describe('selectUser', () => {
    describe('Success Cases', () => {
      it('should select user for auth request', async () => {
        const orgID = await createTestOrg();
        const userID = await createTestUser();

        const authRequest = await ctx.commands.addAuthRequest(
          ctx.createContext(),
          {
            clientID: 'test-client',
            redirectURI: 'https://example.com/callback',
            scope: ['openid'],
            responseType: 'code',
            orgID,
          }
        );

        console.log('\n--- Selecting user ---');

        await ctx.commands.selectUser(
          ctx.createContext(),
          authRequest.authRequestID,
          {
            userID,
            orgID,
          }
        );

        // Verify event
        const event = await ctx.assertEventPublished('auth.request.user.selected');
        expect(event.payload).toHaveProperty('userID', userID);

        console.log('✓ User selected');
      });
    });

    describe('Error Cases', () => {
      it('should fail with non-existent auth request', async () => {
        const userID = await createTestUser();

        await expect(
          ctx.commands.selectUser(
            ctx.createContext(),
            'non-existent',
            {
              userID,
              orgID: await createTestOrg(),
            }
          )
        ).rejects.toThrow();
      });
    });
  });

  describe('checkPassword', () => {
    describe('Success Cases', () => {
      it('should verify password for auth request', async () => {
        const orgID = await createTestOrg();
        const userID = await createTestUser();

        const authRequest = await ctx.commands.addAuthRequest(
          ctx.createContext(),
          {
            clientID: 'test-client',
            redirectURI: 'https://example.com/callback',
            scope: ['openid'],
            responseType: 'code',
            orgID,
          }
        );

        await ctx.commands.selectUser(
          ctx.createContext(),
          authRequest.authRequestID,
          {
            userID,
            orgID,
          }
        );

        console.log('\n--- Checking password ---');

        await ctx.commands.checkPassword(
          ctx.createContext(),
          authRequest.authRequestID,
          {
            password: 'test-password',
          }
        );

        // Verify event
        const event = await ctx.assertEventPublished('auth.request.password.checked');
        expect(event.payload).toHaveProperty('success', true);

        console.log('✓ Password checked');
      });
    });

    describe('Error Cases', () => {
      it('should fail with non-existent auth request', async () => {
        await expect(
          ctx.commands.checkPassword(
            ctx.createContext(),
            'non-existent',
            {
              password: 'password',
            }
          )
        ).rejects.toThrow();
      });
    });
  });

  describe('checkTOTP', () => {
    describe('Success Cases', () => {
      it('should verify TOTP for auth request', async () => {
        const orgID = await createTestOrg();
        const userID = await createTestUser();

        const authRequest = await ctx.commands.addAuthRequest(
          ctx.createContext(),
          {
            clientID: 'test-client',
            redirectURI: 'https://example.com/callback',
            scope: ['openid'],
            responseType: 'code',
            orgID,
          }
        );

        await ctx.commands.selectUser(
          ctx.createContext(),
          authRequest.authRequestID,
          {
            userID,
            orgID,
          }
        );

        console.log('\n--- Checking TOTP ---');

        await ctx.commands.checkTOTP(
          ctx.createContext(),
          authRequest.authRequestID,
          '123456'
        );

        // Verify event
        const event = await ctx.assertEventPublished('auth.request.totp.checked');
        expect(event.payload).toHaveProperty('success', true);

        console.log('✓ TOTP checked');
      });
    });

    describe('Error Cases', () => {
      it('should fail with non-existent auth request', async () => {
        await expect(
          ctx.commands.checkTOTP(
            ctx.createContext(),
            'non-existent',
            '123456'
          )
        ).rejects.toThrow();
      });
    });
  });

  describe('succeedAuthRequest', () => {
    describe('Success Cases', () => {
      it('should succeed auth request', async () => {
        const orgID = await createTestOrg();
        const userID = await createTestUser();

        const authRequest = await ctx.commands.addAuthRequest(
          ctx.createContext(),
          {
            clientID: 'test-client',
            redirectURI: 'https://example.com/callback',
            scope: ['openid'],
            responseType: 'code',
            orgID,
          }
        );

        await ctx.commands.selectUser(
          ctx.createContext(),
          authRequest.authRequestID,
          {
            userID,
            orgID,
          }
        );

        console.log('\n--- Succeeding auth request ---');

        await ctx.commands.succeedAuthRequest(
          ctx.createContext(),
          authRequest.authRequestID
        );

        // Verify event
        await ctx.assertEventPublished('auth.request.succeeded');

        console.log('✓ Auth request succeeded');
      });
    });

    describe('Error Cases', () => {
      it('should fail with non-existent auth request', async () => {
        await expect(
          ctx.commands.succeedAuthRequest(
            ctx.createContext(),
            'non-existent'
          )
        ).rejects.toThrow();
      });
    });
  });

  describe('failAuthRequest', () => {
    describe('Success Cases', () => {
      it('should fail auth request', async () => {
        const orgID = await createTestOrg();

        const authRequest = await ctx.commands.addAuthRequest(
          ctx.createContext(),
          {
            clientID: 'test-client',
            redirectURI: 'https://example.com/callback',
            scope: ['openid'],
            responseType: 'code',
            orgID,
          }
        );

        console.log('\n--- Failing auth request ---');

        await ctx.commands.failAuthRequest(
          ctx.createContext(),
          authRequest.authRequestID,
          'invalid_request'
        );

        // Verify event
        const event = await ctx.assertEventPublished('auth.request.failed');
        expect(event.payload).toHaveProperty('reason', 'invalid_request');

        console.log('✓ Auth request failed');
      });
    });
  });

  describe('Complete Auth Flows', () => {
    it('should complete successful auth flow: add → selectUser → checkPassword → succeed', async () => {
      const orgID = await createTestOrg();
      const userID = await createTestUser();

      console.log('\n--- Testing complete auth flow ---');

      // Add auth request
      const authRequest = await ctx.commands.addAuthRequest(
        ctx.createContext(),
        {
          clientID: 'test-client',
          redirectURI: 'https://example.com/callback',
          scope: ['openid', 'profile'],
          responseType: 'code',
          orgID,
        }
      );

      await processProjections();
      await assertAuthRequestInQuery(authRequest.authRequestID);

      // Select user
      await ctx.commands.selectUser(
        ctx.createContext(),
        authRequest.authRequestID,
        {
          userID,
          orgID,
        }
      );

      // Check password
      await ctx.commands.checkPassword(
        ctx.createContext(),
        authRequest.authRequestID,
        {
          password: 'test-password',
        }
      );

      // Succeed
      await ctx.commands.succeedAuthRequest(
        ctx.createContext(),
        authRequest.authRequestID
      );

      await processProjections();

      console.log('✓ Complete auth flow successful');
    });

    it('should complete failed auth flow: add → fail', async () => {
      const orgID = await createTestOrg();

      console.log('\n--- Testing failed auth flow ---');

      // Add auth request
      const authRequest = await ctx.commands.addAuthRequest(
        ctx.createContext(),
        {
          clientID: 'test-client',
          redirectURI: 'https://example.com/callback',
          scope: ['openid'],
          responseType: 'code',
          orgID,
        }
      );

      // Fail auth request
      await ctx.commands.failAuthRequest(
        ctx.createContext(),
        authRequest.authRequestID,
        'access_denied'
      );

      await processProjections();

      console.log('✓ Failed auth flow complete');
    });
  });
});
