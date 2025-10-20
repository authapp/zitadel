/**
 * Integration tests for AuthNKeyProjection
 * Tests machine user authentication key event processing with real database
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database/pool';
import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { ProjectionRegistry } from '../../../src/lib/query/projection/projection-registry';
import { AuthNKeyProjection, createAuthNKeyProjectionConfig } from '../../../src/lib/query/projections/authn-key-projection';
import { AuthNKeyQueries } from '../../../src/lib/query/authn-key/authn-key-queries';
import { AuthNKeyType } from '../../../src/lib/query/authn-key/authn-key-types';
import { Command } from '../../../src/lib/eventstore';
import { generateId } from '../../../src/lib/id';

describe('AuthN Key Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let authNKeyQueries: AuthNKeyQueries;

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
    
    // Register authn key projection with fast polling
    const config = createAuthNKeyProjectionConfig();
    config.interval = 100; // Fast polling for tests
    const authNKeyProjection = new AuthNKeyProjection(eventstore, pool);
    registry.register(config, authNKeyProjection);
    
    // Start projection
    await registry.start('authn_key_projection');

    authNKeyQueries = new AuthNKeyQueries(pool);
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

  const waitForProjection = (ms: number = 500) => 
    new Promise(resolve => setTimeout(resolve, ms));

  describe('Machine Key Events', () => {
    it('should process user.machine.key.added event', async () => {
      const userID = generateId();
      const keyID = generateId();
      const instanceID = 'test-instance';
      const publicKey = Buffer.from('test-public-key-data');
      
      const command: Command = {
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.machine.key.added',
        payload: {
          keyID,
          type: AuthNKeyType.JSON,
          expiration: new Date('2025-12-31T23:59:59Z'),
          publicKey: publicKey.toString('base64'),
        },
        creator: userID,
        owner: 'org-123',
      };

      await eventstore.push(command);
      await waitForProjection();

      const key = await authNKeyQueries.getAuthNKeyByID(keyID, instanceID);
      
      expect(key).toBeTruthy();
      expect(key!.id).toBe(keyID);
      expect(key!.aggregateID).toBe(userID);
      expect(key!.type).toBe(AuthNKeyType.JSON);
      expect(key!.objectID).toBe(keyID);
    });

    it('should store public key data', async () => {
      const userID = generateId();
      const keyID = generateId();
      const instanceID = 'test-instance';
      const publicKeyData = 'my-test-public-key-12345';
      const publicKey = Buffer.from(publicKeyData);
      
      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.machine.key.added',
        payload: {
          keyID,
          type: AuthNKeyType.JSON,
          expiration: new Date('2025-12-31'),
          publicKey: publicKey.toString('base64'),
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      const result = await authNKeyQueries.searchAuthNKeysData({ aggregateID: userID });
      
      expect(result.keys.length).toBeGreaterThan(0);
      const key = result.keys.find(k => k.id === keyID);
      expect(key).toBeTruthy();
      expect(key!.publicKey.toString()).toBe(publicKeyData);
    });

    it('should retrieve public key by ID and identifier', async () => {
      const userID = generateId();
      const keyID = generateId();
      const instanceID = 'test-instance';
      const publicKeyData = 'jwt-validation-key';
      const publicKey = Buffer.from(publicKeyData);
      
      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.machine.key.added',
        payload: {
          keyID,
          type: AuthNKeyType.JSON,
          expiration: new Date('2025-12-31'),
          publicKey: publicKey.toString('base64'),
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      const retrievedKey = await authNKeyQueries.getAuthNKeyPublicKeyByIDAndIdentifier(
        keyID,
        keyID,
        instanceID
      );
      
      expect(retrievedKey).toBeTruthy();
      expect(retrievedKey!.toString()).toBe(publicKeyData);
    });

    it('should get key user (aggregate ID)', async () => {
      const userID = generateId();
      const keyID = generateId();
      const instanceID = 'test-instance';
      
      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.machine.key.added',
        payload: {
          keyID,
          type: AuthNKeyType.JSON,
          expiration: new Date('2025-12-31'),
          publicKey: Buffer.from('test-key').toString('base64'),
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      const retrievedUserID = await authNKeyQueries.getAuthNKeyUser(keyID, instanceID);
      
      expect(retrievedUserID).toBe(userID);
    });

    it('should delete key on user.machine.key.removed event', async () => {
      const userID = generateId();
      const keyID = generateId();
      const instanceID = 'test-instance';
      
      // Add key
      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.machine.key.added',
        payload: {
          keyID,
          type: AuthNKeyType.JSON,
          expiration: new Date('2025-12-31'),
          publicKey: Buffer.from('test-key').toString('base64'),
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      // Verify it exists
      let key = await authNKeyQueries.getAuthNKeyByID(keyID, instanceID);
      expect(key).toBeTruthy();

      // Remove key
      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.machine.key.removed',
        payload: {
          keyID,
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      // Verify it's deleted
      key = await authNKeyQueries.getAuthNKeyByID(keyID, instanceID);
      expect(key).toBeNull();
    });

    it('should delete all keys when user is removed', async () => {
      const userID = generateId();
      const keyID1 = generateId();
      const keyID2 = generateId();
      const instanceID = 'test-instance';
      
      // Add two keys
      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.machine.key.added',
        payload: {
          keyID: keyID1,
          type: AuthNKeyType.JSON,
          expiration: new Date('2025-12-31'),
          publicKey: Buffer.from('key-1').toString('base64'),
        },
        creator: userID,
        owner: 'org-123',
      });

      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.machine.key.added',
        payload: {
          keyID: keyID2,
          type: AuthNKeyType.JSON,
          expiration: new Date('2025-12-31'),
          publicKey: Buffer.from('key-2').toString('base64'),
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      // Verify both exist
      const result1 = await authNKeyQueries.searchAuthNKeys({ aggregateID: userID });
      expect(result1.total).toBeGreaterThanOrEqual(2);

      // Remove user
      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.removed',
        payload: {},
        creator: 'admin',
        owner: 'org-123',
      });

      await waitForProjection();

      // Verify all keys deleted
      const result2 = await authNKeyQueries.searchAuthNKeys({ aggregateID: userID });
      expect(result2.total).toBe(0);
    });
  });

  describe('Permission Checks', () => {
    it('should allow access with correct user ID', async () => {
      const userID = generateId();
      const keyID = generateId();
      const instanceID = 'test-instance';
      
      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.machine.key.added',
        payload: {
          keyID,
          type: AuthNKeyType.JSON,
          expiration: new Date('2025-12-31'),
          publicKey: Buffer.from('test-key').toString('base64'),
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      const key = await authNKeyQueries.getAuthNKeyByIDWithPermission(keyID, userID, instanceID);
      
      expect(key).toBeTruthy();
      expect(key!.id).toBe(keyID);
    });

    it('should deny access with wrong user ID', async () => {
      const userID = generateId();
      const wrongUserID = generateId();
      const keyID = generateId();
      const instanceID = 'test-instance';
      
      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.machine.key.added',
        payload: {
          keyID,
          type: AuthNKeyType.JSON,
          expiration: new Date('2025-12-31'),
          publicKey: Buffer.from('test-key').toString('base64'),
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      const key = await authNKeyQueries.getAuthNKeyByIDWithPermission(keyID, wrongUserID, instanceID);
      
      expect(key).toBeNull();
    });
  });

  describe('Search Operations', () => {
    it('should search keys by user', async () => {
      const userID = generateId();
      const keyID1 = generateId();
      const keyID2 = generateId();
      const instanceID = 'test-instance';
      
      // Add two keys for same user
      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.machine.key.added',
        payload: {
          keyID: keyID1,
          type: AuthNKeyType.JSON,
          expiration: new Date('2025-12-31'),
          publicKey: Buffer.from('key-1').toString('base64'),
        },
        creator: userID,
        owner: 'org-123',
      });

      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.machine.key.added',
        payload: {
          keyID: keyID2,
          type: AuthNKeyType.JSON,
          expiration: new Date('2025-12-31'),
          publicKey: Buffer.from('key-2').toString('base64'),
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      const result = await authNKeyQueries.searchAuthNKeys({
        aggregateID: userID,
        instanceID,
      });

      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.keys.some(k => k.id === keyID1)).toBe(true);
      expect(result.keys.some(k => k.id === keyID2)).toBe(true);
    });

    it('should search keys with pagination', async () => {
      const userID = generateId();
      const instanceID = 'test-instance';
      
      // Add multiple keys
      for (let i = 0; i < 5; i++) {
        await eventstore.push({
          instanceID,
          aggregateType: 'user',
          aggregateID: userID,
          eventType: 'user.machine.key.added',
          payload: {
            keyID: generateId(),
            type: AuthNKeyType.JSON,
            expiration: new Date('2025-12-31'),
            publicKey: Buffer.from(`key-${i}`).toString('base64'),
          },
          creator: userID,
          owner: 'org-123',
        });
      }

      await waitForProjection();

      const result = await authNKeyQueries.searchAuthNKeys({
        aggregateID: userID,
        limit: 2,
        offset: 0,
      });

      expect(result.keys.length).toBeLessThanOrEqual(2);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(0);
    });
  });
});
