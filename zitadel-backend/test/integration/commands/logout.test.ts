/**
 * Logout Commands - Comprehensive Integration Tests
 * 
 * Complete stack testing: Command → Event → Projection → Query
 * Tests global logout, org-wide logout, and backchannel logout
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { UserBuilder, OrganizationBuilder } from '../../helpers/test-data-builders';
import { SessionProjection } from '../../../src/lib/query/projections/session-projection';
import { SessionQueries } from '../../../src/lib/query/session/session-queries';

describe('Logout Commands - Complete Stack', () => {
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

  /**
   * Helper: Create test session
   */
  async function createTestSession(userID: string, orgID: string) {
    const result = await ctx.commands.createSession(
      ctx.createContext(),
      {
        userID,
        orgID,
        userAgent: 'Test Agent',
        clientIP: '127.0.0.1',
      }
    );
    return result.sessionID;
  }

  // ============================================================================
  // TERMINATE ALL USER SESSIONS
  // ============================================================================

  describe('terminateAllUserSessions', () => {
    it('should terminate all user sessions and verify in projection', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();

      // Create multiple sessions for the user
      await createTestSession(userID, orgID);
      await createTestSession(userID, orgID);
      await createTestSession(userID, orgID);

      await processProjections();

      // Verify sessions are active
      let activeSessions = await sessionQueries.getActiveSessionsForUser(
        userID,
        'test-instance'
      );
      expect(activeSessions).toHaveLength(3);

      // Terminate all user sessions
      const result = await ctx.commands.terminateAllUserSessions(
        ctx.createContext(),
        userID,
        'user_logout_all'
      );

      expect(result).toBeDefined();

      // Verify event
      const events = await ctx.getEvents('user', userID);
      const terminateEvent = events.find(e => e.eventType === 'user.sessions.terminated');
      expect(terminateEvent).toBeDefined();
      expect(terminateEvent!.payload).toMatchObject({
        userID,
        reason: 'user_logout_all',
      });

      // Process projection
      await processProjections();

      // Verify all sessions terminated
      activeSessions = await sessionQueries.getActiveSessionsForUser(
        userID,
        'test-instance'
      );
      expect(activeSessions).toHaveLength(0);

      console.log('✓ All user sessions terminated and verified in projection');
    });

    it('should fail with empty userID', async () => {
      await expect(
        ctx.commands.terminateAllUserSessions(
          ctx.createContext(),
          '',
          'test_reason'
        )
      ).rejects.toThrow('userID is required');
    });
  });

  // ============================================================================
  // TERMINATE ALL ORG SESSIONS
  // ============================================================================

  describe('terminateAllSessionsOfOrg', () => {
    it('should terminate all org sessions and verify in projection', async () => {
      const orgID = await createTestOrg();
      
      // Create multiple users and sessions in the org
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const user3 = await createTestUser();

      await createTestSession(user1, orgID);
      await createTestSession(user2, orgID);
      await createTestSession(user3, orgID);

      await processProjections();

      // Verify sessions are active
      let activeCount = await sessionQueries.countActiveSessions({
        orgID,
        instanceID: 'test-instance',
      });
      expect(activeCount).toBe(3);

      // Terminate all org sessions
      const result = await ctx.commands.terminateAllSessionsOfOrg(
        ctx.createContext(),
        orgID,
        'org_security_event'
      );

      expect(result).toBeDefined();

      // Verify event
      const events = await ctx.getEvents('org', orgID);
      const terminateEvent = events.find(e => e.eventType === 'org.sessions.terminated');
      expect(terminateEvent).toBeDefined();
      expect(terminateEvent!.payload).toMatchObject({
        orgID,
        reason: 'org_security_event',
      });

      // Process projection
      await processProjections();

      // Verify all org sessions terminated
      activeCount = await sessionQueries.countActiveSessions({
        orgID,
        instanceID: 'test-instance',
      });
      expect(activeCount).toBe(0);

      console.log('✓ All org sessions terminated and verified in projection');
    });

    it('should fail with empty orgID', async () => {
      await expect(
        ctx.commands.terminateAllSessionsOfOrg(
          ctx.createContext(),
          '',
          'test_reason'
        )
      ).rejects.toThrow('orgID is required');
    });
  });

  // ============================================================================
  // BACKCHANNEL LOGOUT
  // ============================================================================

  describe('handleBackchannelLogout', () => {
    it('should handle backchannel logout and verify in projection', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();
      const sessionID = await createTestSession(userID, orgID);

      await processProjections();

      // Verify session is active
      let session = await sessionQueries.getSessionByID(sessionID, 'test-instance');
      expect(session).not.toBeNull();
      expect(session!.state).toBe('active');

      // Handle backchannel logout
      const result = await ctx.commands.handleBackchannelLogout(
        ctx.createContext(),
        {
          sessionID,
          clientID: 'test-client',
          logoutToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
          sid: 'session-sid-123',
        }
      );

      expect(result).toBeDefined();

      // Verify event
      const events = await ctx.getEvents('session', sessionID);
      const logoutEvent = events.find(e => e.eventType === 'oidc.session.backchannel.logout');
      expect(logoutEvent).toBeDefined();
      expect(logoutEvent!.payload).toMatchObject({
        sessionID,
        clientID: 'test-client',
        method: 'backchannel',
      });

      // Process projection
      await processProjections();

      // Verify session terminated
      session = await sessionQueries.getSessionByID(sessionID, 'test-instance');
      expect(session).not.toBeNull();
      expect(session!.state).toBe('terminated');

      console.log('✓ Backchannel logout processed and verified in projection');
    });

    it('should fail with empty sessionID', async () => {
      await expect(
        ctx.commands.handleBackchannelLogout(
          ctx.createContext(),
          {
            sessionID: '',
            clientID: 'test-client',
            logoutToken: 'token',
          }
        )
      ).rejects.toThrow('sessionID is required');
    });

    it('should fail with empty clientID', async () => {
      await expect(
        ctx.commands.handleBackchannelLogout(
          ctx.createContext(),
          {
            sessionID: 'session-123',
            clientID: '',
            logoutToken: 'token',
          }
        )
      ).rejects.toThrow('clientID is required');
    });

    it('should fail with empty logoutToken', async () => {
      await expect(
        ctx.commands.handleBackchannelLogout(
          ctx.createContext(),
          {
            sessionID: 'session-123',
            clientID: 'test-client',
            logoutToken: '',
          }
        )
      ).rejects.toThrow('logoutToken is required');
    });
  });

  // ============================================================================
  // COMPLETE SCENARIOS
  // ============================================================================

  describe('Complete Logout Scenarios', () => {
    it('should handle user with multiple sessions then global logout', async () => {
      const userID = await createTestUser();
      const orgID = await createTestOrg();

      // Create multiple sessions (simulate different devices)
      const session1 = await createTestSession(userID, orgID);
      const session2 = await createTestSession(userID, orgID);
      const session3 = await createTestSession(userID, orgID);

      await processProjections();

      // Verify 3 active sessions
      let activeSessions = await sessionQueries.getActiveSessionsForUser(
        userID,
        'test-instance'
      );
      expect(activeSessions).toHaveLength(3);
      expect(activeSessions.map(s => s.id).sort()).toEqual([session1, session2, session3].sort());

      // User performs global logout
      await ctx.commands.terminateAllUserSessions(
        ctx.createContext(),
        userID,
        'user_logout_all_devices'
      );

      await processProjections();

      // Verify all sessions terminated
      activeSessions = await sessionQueries.getActiveSessionsForUser(
        userID,
        'test-instance'
      );
      expect(activeSessions).toHaveLength(0);

      // Verify we can still query the terminated sessions
      const session1Data = await sessionQueries.getSessionByID(session1, 'test-instance');
      expect(session1Data).not.toBeNull();
      expect(session1Data!.state).toBe('terminated');

      console.log('✓ Multi-session global logout scenario complete');
    });

    it('should handle org-wide logout affecting multiple users', async () => {
      const orgID = await createTestOrg();
      
      // Create 3 users with sessions
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const user3 = await createTestUser();

      await createTestSession(user1, orgID);
      await createTestSession(user1, orgID); // User 1 has 2 sessions
      await createTestSession(user2, orgID);
      await createTestSession(user3, orgID);

      await processProjections();

      // Verify 4 active sessions in org
      let activeCount = await sessionQueries.countActiveSessions({
        orgID,
        instanceID: 'test-instance',
      });
      expect(activeCount).toBe(4);

      // Org admin terminates all sessions (security incident)
      await ctx.commands.terminateAllSessionsOfOrg(
        ctx.createContext(),
        orgID,
        'security_breach_detected'
      );

      await processProjections();

      // Verify all org sessions terminated
      activeCount = await sessionQueries.countActiveSessions({
        orgID,
        instanceID: 'test-instance',
      });
      expect(activeCount).toBe(0);

      // Verify each user has no active sessions
      const user1Sessions = await sessionQueries.getActiveSessionsForUser(
        user1,
        'test-instance'
      );
      const user2Sessions = await sessionQueries.getActiveSessionsForUser(
        user2,
        'test-instance'
      );
      const user3Sessions = await sessionQueries.getActiveSessionsForUser(
        user3,
        'test-instance'
      );

      expect(user1Sessions).toHaveLength(0);
      expect(user2Sessions).toHaveLength(0);
      expect(user3Sessions).toHaveLength(0);

      console.log('✓ Org-wide logout affecting multiple users complete');
    });
  });
});
