/**
 * OIDC Session Commands - Comprehensive Integration Tests
 * 
 * Complete stack testing: Command → Event → Projection → Query
 * Tests OIDC-specific session management with OAuth/OIDC parameters
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { UserBuilder, OrganizationBuilder } from '../../helpers/test-data-builders';
import { SessionProjection } from '../../../src/lib/query/projections/session-projection';
import { SessionQueries } from '../../../src/lib/query/session/session-queries';

describe('OIDC Session Commands - Complete Stack', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let sessionProjection: SessionProjection;
  let sessionQueries: SessionQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projection
    sessionProjection = new SessionProjection(ctx.eventstore, pool);
    await sessionProjection.init();
    
    // Initialize query layer
    sessionQueries = new SessionQueries(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    await ctx.clearEvents();
    
    // Clear projection data
    await pool.query('TRUNCATE sessions_projection CASCADE');
  });
  
  /**
   * Helper: Process projection with timing intervals
   */
  async function processProjections() {
    const events = await ctx.getEvents('*', '*');
    
    for (const event of events) {
      await sessionProjection.reduce(event);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Create test user
   */
  async function createTestUser() {
    const userData = new UserBuilder()
      .withUsername(`testuser-${Date.now()}`)
      .withEmail(`test-${Date.now()}@example.com`)
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

  // ============================================================================
  // CREATE OIDC SESSION
  // ============================================================================

  describe('createOIDCSession', () => {
    it('should create OIDC session with PKCE and verify in projection', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();

      // Act
      const result = await ctx.commands.createOIDCSession(
        ctx.createContext(),
        {
          userID,
          orgID,
          clientID: 'test-client-123',
          redirectURI: 'https://app.example.com/callback',
          scope: ['openid', 'profile', 'email'],
          codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          codeChallengeMethod: 'S256',
          responseType: ['code'],
          grantType: ['authorization_code'],
          nonce: 'random-nonce-123',
          state: 'random-state-456',
        }
      );

      expect(result).toBeDefined();
      expect(result.sessionID).toBeDefined();

      // Verify event
      const events = await ctx.getEvents('session', result.sessionID);
      const sessionEvent = events.find(e => e.eventType === 'session.created');
      expect(sessionEvent).toBeDefined();
      expect(sessionEvent!.payload).toMatchObject({
        userID,
        orgID,
        clientID: 'test-client-123',
        redirectURI: 'https://app.example.com/callback',
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        codeChallengeMethod: 'S256',
      });

      // Process projection
      await processProjections();

      // Verify in query layer
      const session = await sessionQueries.getOIDCSessionByID(result.sessionID, 'test-instance');
      expect(session).not.toBeNull();
      expect(session!.state).toBe('active');
      expect(session!.userID).toBe(userID);

      console.log('✓ OIDC session created with PKCE and verified in projection');
    });

    it('should create OIDC session with all optional parameters', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();

      const result = await ctx.commands.createOIDCSession(
        ctx.createContext(),
        {
          userID,
          orgID,
          clientID: 'test-client-456',
          redirectURI: 'https://app.example.com/callback',
          scope: ['openid', 'profile', 'email', 'offline_access'],
          audience: ['https://api.example.com'],
          nonce: 'nonce-789',
          state: 'state-101',
          codeChallenge: 'challenge',
          codeChallengeMethod: 'S256',
          responseType: ['code', 'id_token'],
          grantType: ['authorization_code', 'refresh_token'],
          maxAge: 3600,
          userAgent: 'Mozilla/5.0',
          clientIP: '192.168.1.100',
        }
      );

      expect(result.sessionID).toBeDefined();

      const events = await ctx.getEvents('session', result.sessionID);
      const sessionEvent = events.find(e => e.eventType === 'session.created');
      expect(sessionEvent!.payload).toMatchObject({
        audience: ['https://api.example.com'],
        maxAge: 3600,
        userAgent: 'Mozilla/5.0',
        clientIP: '192.168.1.100',
      });

      console.log('✓ OIDC session created with all parameters');
    });

    it('should fail with empty clientID', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();

      await expect(
        ctx.commands.createOIDCSession(ctx.createContext(), {
          userID,
          orgID,
          clientID: '',
          redirectURI: 'https://app.example.com/callback',
          scope: ['openid'],
        })
      ).rejects.toThrow('clientID is required');
    });

    it('should fail with empty redirectURI', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();

      await expect(
        ctx.commands.createOIDCSession(ctx.createContext(), {
          userID,
          orgID,
          clientID: 'test-client',
          redirectURI: '',
          scope: ['openid'],
        })
      ).rejects.toThrow('redirectURI is required');
    });

    it('should fail with empty scope', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();

      await expect(
        ctx.commands.createOIDCSession(ctx.createContext(), {
          userID,
          orgID,
          clientID: 'test-client',
          redirectURI: 'https://app.example.com/callback',
          scope: [],
        })
      ).rejects.toThrow('scope is required');
    });

    it('should fail with PKCE validation error - challenge without method', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();

      await expect(
        ctx.commands.createOIDCSession(ctx.createContext(), {
          userID,
          orgID,
          clientID: 'test-client',
          redirectURI: 'https://app.example.com/callback',
          scope: ['openid'],
          codeChallenge: 'some-challenge',
          // Missing codeChallengeMethod
        })
      ).rejects.toThrow('codeChallengeMethod required with codeChallenge');
    });

    it('should fail with PKCE validation error - method without challenge', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();

      await expect(
        ctx.commands.createOIDCSession(ctx.createContext(), {
          userID,
          orgID,
          clientID: 'test-client',
          redirectURI: 'https://app.example.com/callback',
          scope: ['openid'],
          codeChallengeMethod: 'S256',
          // Missing codeChallenge
        })
      ).rejects.toThrow('codeChallenge required with codeChallengeMethod');
    });
  });

  // ============================================================================
  // UPDATE OIDC SESSION
  // ============================================================================

  describe('updateOIDCSession', () => {
    it('should update OIDC session with token IDs and verify in projection', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();

      // Create session first
      const createResult = await ctx.commands.createOIDCSession(
        ctx.createContext(),
        {
          userID,
          orgID,
          clientID: 'test-client',
          redirectURI: 'https://app.example.com/callback',
          scope: ['openid', 'profile'],
        }
      );

      // Update with token IDs
      await ctx.commands.updateOIDCSession(
        ctx.createContext(),
        createResult.sessionID,
        orgID,
        {
          accessTokenID: 'at_123456789',
          refreshTokenID: 'rt_987654321',
          idTokenID: 'it_111222333',
          authTime: new Date(),
          amr: ['pwd', 'otp'],
          expiresAt: new Date(Date.now() + 3600000),
        }
      );

      // Verify event
      const events = await ctx.getEvents('session', createResult.sessionID);
      const updateEvent = events.find(e => e.eventType === 'session.updated');
      expect(updateEvent).toBeDefined();
      expect(updateEvent!.payload).toMatchObject({
        accessTokenID: 'at_123456789',
        refreshTokenID: 'rt_987654321',
        idTokenID: 'it_111222333',
        amr: ['pwd', 'otp'],
      });

      // Process projection
      await processProjections();

      // Verify in query layer
      const session = await sessionQueries.getOIDCSessionByID(
        createResult.sessionID,
        'test-instance'
      );
      expect(session).not.toBeNull();

      console.log('✓ OIDC session updated with token IDs and verified');
    });

    it('should update OIDC session with AMR metadata', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();

      const createResult = await ctx.commands.createOIDCSession(
        ctx.createContext(),
        {
          userID,
          orgID,
          clientID: 'test-client',
          redirectURI: 'https://app.example.com/callback',
          scope: ['openid'],
        }
      );

      await ctx.commands.updateOIDCSession(
        ctx.createContext(),
        createResult.sessionID,
        orgID,
        {
          authTime: new Date('2025-10-26T12:00:00Z'),
          amr: ['password', 'totp', 'webauthn'],
        }
      );

      const events = await ctx.getEvents('session', createResult.sessionID);
      const updateEvent = events.find(e => e.eventType === 'session.updated');
      expect(updateEvent).toBeDefined();
      expect(updateEvent!.payload).toBeDefined();
      expect(updateEvent!.payload!.amr).toEqual(['password', 'totp', 'webauthn']);

      console.log('✓ OIDC session updated with AMR metadata');
    });

    it('should fail updating non-existent session', async () => {
      const orgID = await createTestOrg();

      await expect(
        ctx.commands.updateOIDCSession(
          ctx.createContext(),
          'non-existent-session',
          orgID,
          { accessTokenID: 'at_123' }
        )
      ).rejects.toThrow('session not found');
    });

    it('should fail updating already terminated session', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();

      const createResult = await ctx.commands.createOIDCSession(
        ctx.createContext(),
        {
          userID,
          orgID,
          clientID: 'test-client',
          redirectURI: 'https://app.example.com/callback',
          scope: ['openid'],
        }
      );

      // Terminate the session
      await ctx.commands.terminateOIDCSession(
        ctx.createContext(),
        createResult.sessionID,
        orgID
      );

      // Try to update terminated session
      await expect(
        ctx.commands.updateOIDCSession(
          ctx.createContext(),
          createResult.sessionID,
          orgID,
          { accessTokenID: 'at_123' }
        )
      ).rejects.toThrow('session already terminated');
    });
  });

  // ============================================================================
  // TERMINATE OIDC SESSION
  // ============================================================================

  describe('terminateOIDCSession', () => {
    it('should terminate OIDC session and verify in projection', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();

      const createResult = await ctx.commands.createOIDCSession(
        ctx.createContext(),
        {
          userID,
          orgID,
          clientID: 'test-client',
          redirectURI: 'https://app.example.com/callback',
          scope: ['openid'],
        }
      );

      // Terminate
      await ctx.commands.terminateOIDCSession(
        ctx.createContext(),
        createResult.sessionID,
        orgID,
        'user_logout'
      );

      // Verify event
      const events = await ctx.getEvents('session', createResult.sessionID);
      const terminateEvent = events.find(e => e.eventType === 'session.terminated');
      expect(terminateEvent).toBeDefined();
      expect(terminateEvent!.payload).toBeDefined();
      expect(terminateEvent!.payload!.reason).toBe('user_logout');

      // Process projection
      await processProjections();

      // Verify in query layer
      const session = await sessionQueries.getOIDCSessionByID(
        createResult.sessionID,
        'test-instance'
      );
      expect(session).not.toBeNull();
      expect(session!.state).toBe('terminated');
      expect(session!.terminatedAt).toBeDefined();

      console.log('✓ OIDC session terminated and verified in projection');
    });

    it('should fail terminating non-existent session', async () => {
      const orgID = await createTestOrg();

      await expect(
        ctx.commands.terminateOIDCSession(
          ctx.createContext(),
          'non-existent-session',
          orgID
        )
      ).rejects.toThrow('session not found');
    });

    it('should fail terminating already terminated session', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();

      const createResult = await ctx.commands.createOIDCSession(
        ctx.createContext(),
        {
          userID,
          orgID,
          clientID: 'test-client',
          redirectURI: 'https://app.example.com/callback',
          scope: ['openid'],
        }
      );

      // Terminate once
      await ctx.commands.terminateOIDCSession(
        ctx.createContext(),
        createResult.sessionID,
        orgID
      );

      // Try to terminate again
      await expect(
        ctx.commands.terminateOIDCSession(
          ctx.createContext(),
          createResult.sessionID,
          orgID
        )
      ).rejects.toThrow('session already terminated');
    });
  });

  // ============================================================================
  // COMPLETE LIFECYCLE
  // ============================================================================

  describe('Complete OIDC Session Lifecycle', () => {
    it('should handle complete lifecycle: create → update → terminate', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();

      // 1. Create OIDC session
      const createResult = await ctx.commands.createOIDCSession(
        ctx.createContext(),
        {
          userID,
          orgID,
          clientID: 'lifecycle-client',
          redirectURI: 'https://app.example.com/callback',
          scope: ['openid', 'profile', 'email'],
          codeChallenge: 'challenge',
          codeChallengeMethod: 'S256',
          nonce: 'nonce',
          state: 'state',
        }
      );

      expect(createResult.sessionID).toBeDefined();

      // 2. Update with tokens
      await ctx.commands.updateOIDCSession(
        ctx.createContext(),
        createResult.sessionID,
        orgID,
        {
          accessTokenID: 'at_lifecycle',
          refreshTokenID: 'rt_lifecycle',
          idTokenID: 'it_lifecycle',
          authTime: new Date(),
          amr: ['pwd'],
        }
      );

      // 3. Terminate
      await ctx.commands.terminateOIDCSession(
        ctx.createContext(),
        createResult.sessionID,
        orgID,
        'user_initiated_logout'
      );

      // Verify all events
      const events = await ctx.getEvents('session', createResult.sessionID);
      expect(events).toHaveLength(3);
      expect(events[0].eventType).toBe('session.created');
      expect(events[1].eventType).toBe('session.updated');
      expect(events[2].eventType).toBe('session.terminated');

      // Process projection
      await processProjections();

      // Verify final state
      const session = await sessionQueries.getOIDCSessionByID(
        createResult.sessionID,
        'test-instance'
      );
      expect(session).not.toBeNull();
      expect(session!.state).toBe('terminated');

      console.log('✓ Complete OIDC session lifecycle verified');
    });
  });
});
