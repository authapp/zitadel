/**
 * Integration tests for AuthRequestProjection
 * Tests OAuth/OIDC auth request event processing with real database
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database/pool';
import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { ProjectionRegistry } from '../../../src/lib/query/projection/projection-registry';
import { AuthRequestProjection } from '../../../src/lib/query/projections/auth-request-projection';
import { AuthRequestQueries } from '../../../src/lib/query/auth-request/auth-request-queries';
import { Command } from '../../../src/lib/eventstore';
import { generateId } from '../../../src/lib/id';

describe('Auth Request Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let authRequestQueries: AuthRequestQueries;

  beforeAll(async () => {
    // Setup database and run migrations
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
    
    // Register auth request projection with fast polling
    const authRequestProjection = new AuthRequestProjection(eventstore, pool);
    registry.register(
      {
        name: 'auth_request_projection',
        tables: ['auth_requests'],
        eventTypes: [
          'auth_request.added',
          'auth_request.code.added',
          'auth_request.session.linked',
          'auth_request.succeeded',
          'auth_request.failed',
          'instance.removed',
        ],
        aggregateTypes: ['auth_request', 'instance'],
        interval: 100, // Fast polling for tests
        enableLocking: false,
      },
      authRequestProjection
    );
    
    // Start projection
    await registry.start('auth_request_projection');

    authRequestQueries = new AuthRequestQueries(pool);
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

  const waitForProjection = (ms: number = 300) => 
    new Promise(resolve => setTimeout(resolve, ms));

  describe('Auth Request Events', () => {
    it('should process auth_request.added event', async () => {
      const authRequestID = generateId();
      const instanceID = 'test-instance';
      const clientID = generateId();
      
      const command: Command = {
        instanceID,
        aggregateType: 'auth_request',
        aggregateID: authRequestID,
        eventType: 'auth_request.added',
        payload: {
          loginClient: 'user-123',
          clientID,
          redirectURI: 'https://example.com/callback',
          state: 'state-123',
          nonce: 'nonce-123',
          scope: ['openid', 'profile', 'email'],
          audience: ['api-123'],
          responseType: 'code',
          responseMode: 'query',
          codeChallenge: {
            challenge: 'challenge-123',
            method: 'S256',
          },
          prompt: ['login'],
          uiLocales: ['en', 'de'],
          maxAge: 3600,
          loginHint: 'user@example.com',
          hintUserID: 'user-123',
          needRefreshToken: true,
          issuer: 'https://issuer.example.com',
        },
        creator: 'user-123',
        owner: 'org-123',
      };

      await eventstore.push(command);
      await waitForProjection();

      const authRequest = await authRequestQueries.getAuthRequestByID(authRequestID, instanceID);
      
      expect(authRequest).toBeTruthy();
      expect(authRequest!.id).toBe(authRequestID);
      expect(authRequest!.clientID).toBe(clientID);
      expect(authRequest!.scope).toEqual(['openid', 'profile', 'email']);
      expect(authRequest!.codeChallenge).toEqual({
        challenge: 'challenge-123',
        method: 'S256',
      });
      expect(authRequest!.maxAge).toBe(3600);
    });

    it('should update auth request with code', async () => {
      const authRequestID = generateId();
      const authCode = `auth-code-${generateId()}`;
      const instanceID = 'test-instance';
      
      // Create auth request
      await eventstore.push({
        instanceID,
        aggregateType: 'auth_request',
        aggregateID: authRequestID,
        eventType: 'auth_request.added',
        payload: {
          loginClient: 'user-123',
          clientID: 'client-123',
          redirectURI: 'https://example.com/callback',
          scope: ['openid'],
        },
        creator: 'user-123',
        owner: 'org-123',
      });

      await waitForProjection();

      // Add code
      await eventstore.push({
        instanceID,
        aggregateType: 'auth_request',
        aggregateID: authRequestID,
        eventType: 'auth_request.code.added',
        payload: {
          code: authCode,
        },
        creator: 'user-123',
        owner: 'org-123',
      });

      await waitForProjection();

      const authRequest = await authRequestQueries.getAuthRequestByCode(authCode, instanceID);
      
      expect(authRequest).toBeTruthy();
      expect(authRequest!.id).toBe(authRequestID);
      expect(authRequest!.code).toBe(authCode);
    });

    it('should link session to auth request', async () => {
      const authRequestID = generateId();
      const sessionID = generateId();
      const userID = generateId();
      const instanceID = 'test-instance';
      
      // Create auth request
      await eventstore.push({
        instanceID,
        aggregateType: 'auth_request',
        aggregateID: authRequestID,
        eventType: 'auth_request.added',
        payload: {
          loginClient: 'user-123',
          clientID: 'client-123',
          redirectURI: 'https://example.com/callback',
          scope: ['openid'],
        },
        creator: 'user-123',
        owner: 'org-123',
      });

      await waitForProjection();

      // Link session
      await eventstore.push({
        instanceID,
        aggregateType: 'auth_request',
        aggregateID: authRequestID,
        eventType: 'auth_request.session.linked',
        payload: {
          sessionID,
          userID,
          authTime: new Date('2024-01-01T10:00:00Z'),
          authMethods: ['password', 'totp'],
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      const authRequest = await authRequestQueries.getAuthRequestByID(authRequestID, instanceID);
      
      expect(authRequest).toBeTruthy();
      expect(authRequest!.sessionID).toBe(sessionID);
      expect(authRequest!.userID).toBe(userID);
      expect(authRequest!.authMethods).toEqual(['password', 'totp']);
    });

    it('should delete auth request on success', async () => {
      const authRequestID = generateId();
      const instanceID = 'test-instance';
      
      // Create auth request
      await eventstore.push({
        instanceID,
        aggregateType: 'auth_request',
        aggregateID: authRequestID,
        eventType: 'auth_request.added',
        payload: {
          loginClient: 'user-123',
          clientID: 'client-123',
          redirectURI: 'https://example.com/callback',
          scope: ['openid'],
        },
        creator: 'user-123',
        owner: 'org-123',
      });

      await waitForProjection();

      // Verify it exists
      let authRequest = await authRequestQueries.getAuthRequestByID(authRequestID, instanceID);
      expect(authRequest).toBeTruthy();

      // Mark as succeeded
      await eventstore.push({
        instanceID,
        aggregateType: 'auth_request',
        aggregateID: authRequestID,
        eventType: 'auth_request.succeeded',
        payload: {},
        creator: 'user-123',
        owner: 'org-123',
      });

      await waitForProjection();

      // Verify it's deleted
      authRequest = await authRequestQueries.getAuthRequestByID(authRequestID, instanceID);
      expect(authRequest).toBeNull();
    });

    it('should delete auth request on failure', async () => {
      const authRequestID = generateId();
      const instanceID = 'test-instance';
      
      // Create auth request
      await eventstore.push({
        instanceID,
        aggregateType: 'auth_request',
        aggregateID: authRequestID,
        eventType: 'auth_request.added',
        payload: {
          loginClient: 'user-123',
          clientID: 'client-123',
          redirectURI: 'https://example.com/callback',
          scope: ['openid'],
        },
        creator: 'user-123',
        owner: 'org-123',
      });

      await waitForProjection();

      // Mark as failed
      await eventstore.push({
        instanceID,
        aggregateType: 'auth_request',
        aggregateID: authRequestID,
        eventType: 'auth_request.failed',
        payload: {
          reason: 'user_cancelled',
        },
        creator: 'user-123',
        owner: 'org-123',
      });

      await waitForProjection();

      // Verify it's deleted
      const authRequest = await authRequestQueries.getAuthRequestByID(authRequestID, instanceID);
      expect(authRequest).toBeNull();
    });
  });

  describe('Complete OAuth Flow', () => {
    it('should handle complete authorization code flow', async () => {
      const authRequestID = generateId();
      const sessionID = generateId();
      const userID = generateId();
      const authCode = `auth-code-${generateId()}`;
      const instanceID = 'test-instance';
      
      // 1. Auth request added
      await eventstore.push({
        instanceID,
        aggregateType: 'auth_request',
        aggregateID: authRequestID,
        eventType: 'auth_request.added',
        payload: {
          loginClient: userID,
          clientID: 'client-123',
          redirectURI: 'https://example.com/callback',
          state: 'state-123',
          scope: ['openid', 'profile'],
          responseType: 'code',
          codeChallenge: {
            challenge: 'challenge-123',
            method: 'S256',
          },
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      let authRequest = await authRequestQueries.getAuthRequestByID(authRequestID, instanceID);
      expect(authRequest).toBeTruthy();
      expect(authRequest!.code).toBeNull();
      expect(authRequest!.sessionID).toBeNull();

      // 2. Session linked
      await eventstore.push({
        instanceID,
        aggregateType: 'auth_request',
        aggregateID: authRequestID,
        eventType: 'auth_request.session.linked',
        payload: {
          sessionID,
          userID,
          authTime: new Date(),
          authMethods: ['password'],
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      authRequest = await authRequestQueries.getAuthRequestByID(authRequestID, instanceID);
      expect(authRequest!.sessionID).toBe(sessionID);
      expect(authRequest!.userID).toBe(userID);

      // 3. Code added
      await eventstore.push({
        instanceID,
        aggregateType: 'auth_request',
        aggregateID: authRequestID,
        eventType: 'auth_request.code.added',
        payload: {
          code: authCode,
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      authRequest = await authRequestQueries.getAuthRequestByCode(authCode, instanceID);
      expect(authRequest).toBeTruthy();
      expect(authRequest!.id).toBe(authRequestID);

      // 4. Request succeeded
      await eventstore.push({
        instanceID,
        aggregateType: 'auth_request',
        aggregateID: authRequestID,
        eventType: 'auth_request.succeeded',
        payload: {},
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      // Verify cleanup
      authRequest = await authRequestQueries.getAuthRequestByID(authRequestID, instanceID);
      expect(authRequest).toBeNull();
    });
  });

  describe('Search Operations', () => {
    it('should search auth requests by client ID', async () => {
      const clientID = generateId();
      const instanceID = 'test-instance';
      const authRequestID1 = generateId();
      const authRequestID2 = generateId();
      
      // Create two auth requests for same client
      await eventstore.push({
        instanceID,
        aggregateType: 'auth_request',
        aggregateID: authRequestID1,
        eventType: 'auth_request.added',
        payload: {
          loginClient: 'user-1',
          clientID,
          redirectURI: 'https://example.com/callback',
          scope: ['openid'],
        },
        creator: 'user-1',
        owner: 'org-123',
      });

      await eventstore.push({
        instanceID,
        aggregateType: 'auth_request',
        aggregateID: authRequestID2,
        eventType: 'auth_request.added',
        payload: {
          loginClient: 'user-2',
          clientID,
          redirectURI: 'https://example.com/callback',
          scope: ['openid', 'profile'],
        },
        creator: 'user-2',
        owner: 'org-123',
      });

      await waitForProjection();

      const result = await authRequestQueries.searchAuthRequests({
        clientID,
        instanceID,
      });

      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.authRequests.length).toBeGreaterThanOrEqual(2);
      expect(result.authRequests.some(ar => ar.id === authRequestID1)).toBe(true);
      expect(result.authRequests.some(ar => ar.id === authRequestID2)).toBe(true);
    });
  });
});
