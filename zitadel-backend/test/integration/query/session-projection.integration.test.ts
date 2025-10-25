import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database/pool';
import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { ProjectionRegistry } from '../../../src/lib/query/projection/projection-registry';
import { SessionProjection, createSessionProjectionConfig } from '../../../src/lib/query/projections/session-projection';
import { SessionQueries } from '../../../src/lib/query/session/session-queries';
import { SessionState } from '../../../src/lib/query/session/session-types';
import { Command } from '../../../src/lib/eventstore';
import { generateId } from '../../../src/lib/id';

describe('Session Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let sessionQueries: SessionQueries;

  beforeAll(async () => {
    // Setup database and run migrations (automatically provides clean state)
    pool = await createTestDatabase();
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
      enableSubscriptions: false,
    });

    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register session projection with fast polling
    const sessionConfig = createSessionProjectionConfig();
    sessionConfig.interval = 50; // Fast polling for tests
    const sessionProjection = new SessionProjection(eventstore, pool);
    registry.register(sessionConfig, sessionProjection);
    
    // Start projection once for all tests
    await registry.start('session_projection');

    sessionQueries = new SessionQueries(pool);
  });

  afterAll(async () => {
    // Stop projections
    const names = registry.getNames();
    for (const name of names) {
      try {
        await registry.stop(name);
      } catch (e) {
        // Ignore if already stopped
      }
    }
    
    await closeTestDatabase();
  });

  // Helper to wait for projection to process (fast with 100ms polling)
  const waitForProjection = (ms: number = 300) => 
    new Promise(resolve => setTimeout(resolve, ms));

  describe('Session Events', () => {
    it('should process session.created event', async () => {
      const sessionID = generateId();
      const userID = generateId();
      const instanceID = 'test-instance';
      
      const command: Command = {
        instanceID,
        aggregateType: 'session',
        aggregateID: sessionID,
        eventType: 'session.created',
        payload: {
          userID,
          userAgent: 'Mozilla/5.0',
          clientIP: '192.168.1.1',
          metadata: {
            origin: 'web',
            device: 'desktop',
          },
        },
        creator: 'system',
        owner: instanceID,
      };

      await eventstore.push(command);

      await waitForProjection();

      const session = await sessionQueries.getSessionByID(sessionID, instanceID);
      
      expect(session).toBeTruthy();
      expect(session!.id).toBe(sessionID);
      expect(session!.userID).toBe(userID);
      expect(session!.state).toBe(SessionState.ACTIVE);
      expect(session!.userAgent).toBe('Mozilla/5.0');
      expect(session!.clientIP).toBe('192.168.1.1');
      expect(session!.metadata).toEqual({
        origin: 'web',
        device: 'desktop',
      });
    }, 5000);

    it('should process session.updated event', async () => {
      const sessionID = generateId();
      const userID = generateId();
      const instanceID = 'test-instance';
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: sessionID,
          eventType: 'session.created',
          payload: {
            userID,
            userAgent: 'Old Agent',
            clientIP: '192.168.1.1',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: sessionID,
          eventType: 'session.updated',
          payload: {
            userAgent: 'New Agent',
            clientIP: '192.168.1.2',
            metadata: {
              updated: 'true',
            },
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      for (const cmd of commands) {
        await eventstore.push(cmd);
      }

      await waitForProjection();

      const session = await sessionQueries.getSessionByID(sessionID, instanceID);
      
      expect(session).toBeTruthy();
      expect(session!.userAgent).toBe('New Agent');
      expect(session!.clientIP).toBe('192.168.1.2');
      expect(session!.metadata).toEqual({ updated: 'true' });
    }, 5000);

    it('should process session.terminated event', async () => {
      const sessionID = generateId();
      const userID = generateId();
      const instanceID = 'test-instance';
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: sessionID,
          eventType: 'session.created',
          payload: {
            userID,
            userAgent: 'Mozilla/5.0',
            clientIP: '192.168.1.1',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: sessionID,
          eventType: 'session.terminated',
          payload: {},
          creator: 'system',
          owner: instanceID,
        },
      ];

      for (const cmd of commands) {
        await eventstore.push(cmd);
      }

      await waitForProjection();

      const session = await sessionQueries.getSessionByID(sessionID, instanceID);
      
      expect(session).toBeTruthy();
      expect(session!.state).toBe(SessionState.TERMINATED);
      expect(session!.terminatedAt).toBeTruthy();
    }, 5000);

    it('should process session.token.set event', async () => {
      const sessionID = generateId();
      const userID = generateId();
      const instanceID = 'test-instance';
      const tokenID = generateId();
      const expiry = new Date(Date.now() + 3600000); // 1 hour from now
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: sessionID,
          eventType: 'session.created',
          payload: {
            userID,
            userAgent: 'Mozilla/5.0',
            clientIP: '192.168.1.1',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: sessionID,
          eventType: 'session.token.set',
          payload: {
            tokenID,
            token: 'secret-token-value',
            expiry: expiry.toISOString(),
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      for (const cmd of commands) {
        await eventstore.push(cmd);
      }

      await waitForProjection();

      const session = await sessionQueries.getSessionByID(sessionID, instanceID);
      
      expect(session).toBeTruthy();
      expect(session!.tokens).toHaveLength(1);
      expect(session!.tokens[0].tokenID).toBe(tokenID);
      expect(session!.tokens[0].token).toBe('secret-token-value');
      expect(session!.tokens[0].expiry.getTime()).toBeCloseTo(expiry.getTime(), -2);
    }, 5000);

    it('should process session.factor.set event', async () => {
      const sessionID = generateId();
      const userID = generateId();
      const instanceID = 'test-instance';
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: sessionID,
          eventType: 'session.created',
          payload: {
            userID,
            userAgent: 'Mozilla/5.0',
            clientIP: '192.168.1.1',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: sessionID,
          eventType: 'session.factor.set',
          payload: {
            type: 'password',
            verified: true,
            verifiedAt: new Date().toISOString(),
            metadata: {
              strength: 'strong',
            },
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      for (const cmd of commands) {
        await eventstore.push(cmd);
      }

      await waitForProjection();

      const session = await sessionQueries.getSessionByID(sessionID, instanceID);
      
      expect(session).toBeTruthy();
      expect(session!.factors).toHaveLength(1);
      expect(session!.factors[0].type).toBe('password');
      expect(session!.factors[0].verified).toBe(true);
      expect(session!.factors[0].metadata.strength).toBe('strong');
    }, 5000);

    it('should process session.metadata.set event', async () => {
      const sessionID = generateId();
      const userID = generateId();
      const instanceID = 'test-instance';
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: sessionID,
          eventType: 'session.created',
          payload: {
            userID,
            userAgent: 'Mozilla/5.0',
            clientIP: '192.168.1.1',
            metadata: {
              initial: 'value',
            },
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: sessionID,
          eventType: 'session.metadata.set',
          payload: {
            key: 'custom',
            value: 'metadata-value',
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      for (const cmd of commands) {
        await eventstore.push(cmd);
      }

      await waitForProjection();

      const session = await sessionQueries.getSessionByID(sessionID, instanceID);
      
      expect(session).toBeTruthy();
      expect(session!.metadata.initial).toBe('value');
      expect(session!.metadata.custom).toBe('metadata-value');
    }, 5000);

    it('should process session.metadata.deleted event', async () => {
      const sessionID = generateId();
      const userID = generateId();
      const instanceID = 'test-instance';
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: sessionID,
          eventType: 'session.created',
          payload: {
            userID,
            userAgent: 'Mozilla/5.0',
            clientIP: '192.168.1.1',
            metadata: {
              keep: 'this',
              delete: 'that',
            },
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: sessionID,
          eventType: 'session.metadata.deleted',
          payload: {
            key: 'delete',
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      for (const cmd of commands) {
        await eventstore.push(cmd);
      }

      await waitForProjection();

      const session = await sessionQueries.getSessionByID(sessionID, instanceID);
      
      expect(session).toBeTruthy();
      expect(session!.metadata.keep).toBe('this');
      expect(session!.metadata.delete).toBeUndefined();
    }, 5000);
  });

  describe('Query Methods', () => {
    it('should search sessions with filters', async () => {
      const instanceID = 'test-instance';
      const userID = generateId();
      const session1ID = generateId();
      const session2ID = generateId();
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: session1ID,
          eventType: 'session.created',
          payload: {
            userID,
            userAgent: 'Agent1',
            clientIP: '192.168.1.1',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: session2ID,
          eventType: 'session.created',
          payload: {
            userID,
            userAgent: 'Agent2',
            clientIP: '192.168.1.2',
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      for (const cmd of commands) {
        await eventstore.push(cmd);
      }

      await waitForProjection();

      const result = await sessionQueries.searchSessions({
        instanceID,
        userID,
        state: SessionState.ACTIVE,
      });
      
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.sessions.length).toBeGreaterThanOrEqual(2);
      
      const foundSession1 = result.sessions.find(s => s.id === session1ID);
      const foundSession2 = result.sessions.find(s => s.id === session2ID);
      expect(foundSession1).toBeTruthy();
      expect(foundSession2).toBeTruthy();
    }, 5000);

    it('should get active sessions count', async () => {
      const instanceID = 'test-instance';
      const userID = generateId();
      const session1ID = generateId();
      const session2ID = generateId();
      const session3ID = generateId();
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: session1ID,
          eventType: 'session.created',
          payload: {
            userID,
            userAgent: 'Agent1',
            clientIP: '192.168.1.1',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: session2ID,
          eventType: 'session.created',
          payload: {
            userID,
            userAgent: 'Agent2',
            clientIP: '192.168.1.2',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: session3ID,
          eventType: 'session.created',
          payload: {
            userID,
            userAgent: 'Agent3',
            clientIP: '192.168.1.3',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: session3ID,
          eventType: 'session.terminated',
          payload: {},
          creator: 'system',
          owner: instanceID,
        },
      ];

      for (const cmd of commands) {
        await eventstore.push(cmd);
      }

      await waitForProjection();

      const result = await sessionQueries.getActiveSessionsCount({
        instanceID,
        userID,
      });
      
      expect(result.count).toBeGreaterThanOrEqual(2);
    }, 5000);

    it('should get user active sessions', async () => {
      const instanceID = 'test-instance';
      const userID = generateId();
      const session1ID = generateId();
      const session2ID = generateId();
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: session1ID,
          eventType: 'session.created',
          payload: {
            userID,
            userAgent: 'Agent1',
            clientIP: '192.168.1.1',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: session2ID,
          eventType: 'session.created',
          payload: {
            userID,
            userAgent: 'Agent2',
            clientIP: '192.168.1.2',
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      for (const cmd of commands) {
        await eventstore.push(cmd);
      }

      await waitForProjection();

      const sessions = await sessionQueries.getUserActiveSessions(userID, instanceID);
      
      expect(sessions.length).toBeGreaterThanOrEqual(2);
      sessions.forEach(session => {
        expect(session.userID).toBe(userID);
        expect(session.state).toBe(SessionState.ACTIVE);
      });
    }, 5000);

    it('should check if session is active', async () => {
      const sessionID = generateId();
      const userID = generateId();
      const instanceID = 'test-instance';
      
      const command: Command = {
        instanceID,
        aggregateType: 'session',
        aggregateID: sessionID,
        eventType: 'session.created',
        payload: {
          userID,
          userAgent: 'Mozilla/5.0',
          clientIP: '192.168.1.1',
        },
        creator: 'system',
        owner: instanceID,
      };

      await eventstore.push(command);

      await waitForProjection();

      const isActive = await sessionQueries.isSessionActive(sessionID, instanceID);
      
      expect(isActive).toBe(true);
    }, 5000);

    it('should get session summary', async () => {
      const sessionID = generateId();
      const userID = generateId();
      const instanceID = 'test-instance';
      const tokenID = generateId();
      const expiry = new Date(Date.now() + 3600000);
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: sessionID,
          eventType: 'session.created',
          payload: {
            userID,
            userAgent: 'Mozilla/5.0',
            clientIP: '192.168.1.1',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: sessionID,
          eventType: 'session.token.set',
          payload: {
            tokenID,
            token: 'secret-token',
            expiry: expiry.toISOString(),
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'session',
          aggregateID: sessionID,
          eventType: 'session.factor.set',
          payload: {
            type: 'password',
            verified: true,
            verifiedAt: new Date().toISOString(),
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      for (const cmd of commands) {
        await eventstore.push(cmd);
      }

      await waitForProjection();

      const summary = await sessionQueries.getSessionSummary(sessionID, instanceID);
      
      expect(summary).toBeTruthy();
      expect(summary!.id).toBe(sessionID);
      expect(summary!.userID).toBe(userID);
      expect(summary!.verifiedFactors).toContain('password');
      expect(summary!.validTokenCount).toBe(1);
    }, 5000);
  });
});
