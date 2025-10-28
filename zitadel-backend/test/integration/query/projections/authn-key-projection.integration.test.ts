/**
 * Integration tests for AuthNKeyProjection
 * Tests machine user authentication key event processing with real database
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabasePool } from '../../../../src/lib/database/pool';
import { PostgresEventstore } from '../../../../src/lib/eventstore/postgres/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { AuthNKeyProjection, createAuthNKeyProjectionConfig } from '../../../../src/lib/query/projections/authn-key-projection';
import { AuthNKeyQueries } from '../../../../src/lib/query/authn-key/authn-key-queries';
import { AuthNKeyType } from '../../../../src/lib/query/authn-key/authn-key-types';
import { Command } from '../../../../src/lib/eventstore';
import { generateId } from '../../../../src/lib/id';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';

describe('AuthN Key Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let authNKeyQueries: AuthNKeyQueries;
  let commandCtx: CommandTestContext;

  const TEST_INSTANCE_ID = 'test-instance';

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
    config.interval = 50; // Fast polling for tests
    const authNKeyProjection = new AuthNKeyProjection(eventstore, pool);
    registry.register(config, authNKeyProjection);
    
    // Start projection
    await registry.start('authn_key_projection');

    authNKeyQueries = new AuthNKeyQueries(pool);
    commandCtx = await setupCommandTest(pool);

    // Setup instance for command API
    await eventstore.push({
      eventType: 'instance.setup',
      aggregateType: 'instance',
      aggregateID: TEST_INSTANCE_ID,
      payload: {
        instanceName: 'Test Instance',
        defaultLanguage: 'en',
      },
      creator: 'system',
      owner: TEST_INSTANCE_ID,
      instanceID: TEST_INSTANCE_ID,
    });
    await new Promise(resolve => setTimeout(resolve, 200));
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

  // Cache for setup entities
  const setupOrgs = new Set<string>();
  const setupUsers = new Set<string>();

  // Helper: Setup org (using Command API)
  async function setupOrg(orgId: string): Promise<void> {
    if (setupOrgs.has(orgId)) return;
    
    const ctx = commandCtx.createContext({
      instanceID: TEST_INSTANCE_ID,
      orgID: TEST_INSTANCE_ID,
      userID: 'system-admin',
    });
    
    await commandCtx.commands.addOrg(ctx, {
      orgID: orgId,
      name: 'Test Org',
    });
    await waitForProjection(200);
    setupOrgs.add(orgId);
  }

  // Helper: Setup user (using event push - simplified for machine users)
  async function setupUser(userId: string, orgId: string): Promise<void> {
    if (setupUsers.has(userId)) return;
    
    await eventstore.push({
      instanceID: TEST_INSTANCE_ID,
      aggregateType: 'user',
      aggregateID: userId,
      eventType: 'user.machine.added',
      payload: {
        username: 'machine-user',
        name: 'Machine User',
        description: 'Test machine user',
      },
      creator: 'system',
      owner: orgId,
    });
    await waitForProjection(200);
    setupUsers.add(userId);
  }

  // Helper: Create PEM formatted public key
  function createPEMKey(data: string): string {
    return `-----BEGIN PUBLIC KEY-----\n${Buffer.from(data).toString('base64')}\n-----END PUBLIC KEY-----`;
  }

  describe('Machine Key Events', () => {
    it('should process user.machine.key.added event (using Command API)', async () => {
      const userID = generateId();
      const orgID = generateId();
      
      await setupOrg(orgID);
      await setupUser(userID, orgID);
      
      const ctx = commandCtx.createContext({
        instanceID: TEST_INSTANCE_ID,
        orgID: orgID,
        userID: 'system-admin',
      });

      const publicKey = createPEMKey('test-public-key-data');
      
      const result = await commandCtx.commands.addMachineKey(ctx, userID, orgID, {
        type: AuthNKeyType.JSON,
        expirationDate: new Date('2025-12-31T23:59:59Z'),
        publicKey,
      });

      await waitForProjection();

      // Query to verify
      const keys = await authNKeyQueries.searchAuthNKeys({ aggregateID: userID });
      expect(keys.total).toBeGreaterThan(0);
      expect(keys.keys[0].aggregateID).toBe(userID);
      expect(keys.keys[0].type).toBe(AuthNKeyType.JSON);
    });

    it('should store public key data (using Command API)', async () => {
      const userID = generateId();
      const orgID = generateId();
      const publicKeyData = 'my-test-public-key-12345';
      
      await setupOrg(orgID);
      await setupUser(userID, orgID);
      
      const ctx = commandCtx.createContext({
        instanceID: TEST_INSTANCE_ID,
        orgID: orgID,
        userID: 'system-admin',
      });

      const publicKey = createPEMKey(publicKeyData);
      
      await commandCtx.commands.addMachineKey(ctx, userID, orgID, {
        type: AuthNKeyType.JSON,
        expirationDate: new Date('2025-12-31'),
        publicKey,
      });

      await waitForProjection();

      const result = await authNKeyQueries.searchAuthNKeysData({ aggregateID: userID });
      
      expect(result.keys.length).toBeGreaterThan(0);
      // Verify the public key is stored (will be in base64)
      expect(result.keys[0].publicKey).toBeTruthy();
    });

    it('should retrieve public key by ID and identifier (using Command API)', async () => {
      const userID = generateId();
      const orgID = generateId();
      const publicKeyData = 'jwt-validation-key';
      
      await setupOrg(orgID);
      await setupUser(userID, orgID);
      
      const ctx = commandCtx.createContext({
        instanceID: TEST_INSTANCE_ID,
        orgID: orgID,
        userID: 'system-admin',
      });

      const publicKey = createPEMKey(publicKeyData);
      
      await commandCtx.commands.addMachineKey(ctx, userID, orgID, {
        type: AuthNKeyType.JSON,
        expirationDate: new Date('2025-12-31'),
        publicKey,
      });

      await waitForProjection();

      // Get the key ID from the search results
      const result = await authNKeyQueries.searchAuthNKeys({ aggregateID: userID });
      expect(result.keys.length).toBeGreaterThan(0);
      
      const keyID = result.keys[0].id;
      const retrievedKey = await authNKeyQueries.getAuthNKeyPublicKeyByIDAndIdentifier(
        keyID,
        keyID,
        TEST_INSTANCE_ID
      );
      
      expect(retrievedKey).toBeTruthy();
    });

    it('should get key user (aggregate ID) (using Command API)', async () => {
      const userID = generateId();
      const orgID = generateId();
      
      await setupOrg(orgID);
      await setupUser(userID, orgID);
      
      const ctx = commandCtx.createContext({
        instanceID: TEST_INSTANCE_ID,
        orgID: orgID,
        userID: 'system-admin',
      });

      const publicKey = createPEMKey('test-key');
      
      await commandCtx.commands.addMachineKey(ctx, userID, orgID, {
        type: AuthNKeyType.JSON,
        expirationDate: new Date('2025-12-31'),
        publicKey,
      });

      await waitForProjection();

      // Get the key ID from search results
      const result = await authNKeyQueries.searchAuthNKeys({ aggregateID: userID });
      expect(result.keys.length).toBeGreaterThan(0);
      const keyID = result.keys[0].id;

      const retrievedUserID = await authNKeyQueries.getAuthNKeyUser(keyID, TEST_INSTANCE_ID);
      
      expect(retrievedUserID).toBe(userID);
    });

    it('should delete key on user.machine.key.removed event (using Command API)', async () => {
      const userID = generateId();
      const orgID = generateId();
      
      await setupOrg(orgID);
      await setupUser(userID, orgID);
      
      const ctx = commandCtx.createContext({
        instanceID: TEST_INSTANCE_ID,
        orgID: orgID,
        userID: 'system-admin',
      });

      const publicKey = createPEMKey('test-key');
      
      // Add key
      await commandCtx.commands.addMachineKey(ctx, userID, orgID, {
        type: AuthNKeyType.JSON,
        expirationDate: new Date('2025-12-31'),
        publicKey,
      });

      await waitForProjection();

      // Verify it exists
      let result = await authNKeyQueries.searchAuthNKeys({ aggregateID: userID });
      expect(result.keys.length).toBeGreaterThan(0);
      const keyID = result.keys[0].id;

      // Remove key
      await commandCtx.commands.removeMachineKey(ctx, userID, orgID, keyID);

      await waitForProjection();

      // Verify it's deleted
      const key = await authNKeyQueries.getAuthNKeyByID(keyID, TEST_INSTANCE_ID);
      expect(key).toBeNull();
    });

    it('should delete all keys when user is removed (using Command API)', async () => {
      const userID = generateId();
      const orgID = generateId();
      
      await setupOrg(orgID);
      await setupUser(userID, orgID);
      
      const ctx = commandCtx.createContext({
        instanceID: TEST_INSTANCE_ID,
        orgID: orgID,
        userID: 'system-admin',
      });

      const publicKey1 = createPEMKey('key-1');
      const publicKey2 = createPEMKey('key-2');
      
      // Add two keys
      await commandCtx.commands.addMachineKey(ctx, userID, orgID, {
        type: AuthNKeyType.JSON,
        expirationDate: new Date('2025-12-31'),
        publicKey: publicKey1,
      });

      await commandCtx.commands.addMachineKey(ctx, userID, orgID, {
        type: AuthNKeyType.JSON,
        expirationDate: new Date('2025-12-31'),
        publicKey: publicKey2,
      });

      await waitForProjection();

      // Verify both exist
      const result1 = await authNKeyQueries.searchAuthNKeys({ aggregateID: userID });
      expect(result1.total).toBeGreaterThanOrEqual(2);

      // Remove user (using event push - no removeUser command yet)
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.removed',
        payload: {},
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      // Verify all keys deleted
      const result2 = await authNKeyQueries.searchAuthNKeys({ aggregateID: userID });
      expect(result2.total).toBe(0);
    });
  });

  describe('Permission Checks', () => {
    it('should allow access with correct user ID (using Command API)', async () => {
      const userID = generateId();
      const orgID = generateId();
      
      await setupOrg(orgID);
      await setupUser(userID, orgID);
      
      const ctx = commandCtx.createContext({
        instanceID: TEST_INSTANCE_ID,
        orgID: orgID,
        userID: 'system-admin',
      });

      const publicKey = createPEMKey('test-key');
      
      await commandCtx.commands.addMachineKey(ctx, userID, orgID, {
        type: AuthNKeyType.JSON,
        expirationDate: new Date('2025-12-31'),
        publicKey,
      });

      await waitForProjection();

      // Get the key ID from search results
      const result = await authNKeyQueries.searchAuthNKeys({ aggregateID: userID });
      expect(result.keys.length).toBeGreaterThan(0);
      const keyID = result.keys[0].id;

      const key = await authNKeyQueries.getAuthNKeyByIDWithPermission(keyID, userID, TEST_INSTANCE_ID);
      
      expect(key).toBeTruthy();
      expect(key!.id).toBe(keyID);
    });

    it('should deny access with wrong user ID (using Command API)', async () => {
      const userID = generateId();
      const wrongUserID = generateId();
      const orgID = generateId();
      
      await setupOrg(orgID);
      await setupUser(userID, orgID);
      
      const ctx = commandCtx.createContext({
        instanceID: TEST_INSTANCE_ID,
        orgID: orgID,
        userID: 'system-admin',
      });

      const publicKey = createPEMKey('test-key');
      
      await commandCtx.commands.addMachineKey(ctx, userID, orgID, {
        type: AuthNKeyType.JSON,
        expirationDate: new Date('2025-12-31'),
        publicKey,
      });

      await waitForProjection();

      // Get the key ID from search results
      const result = await authNKeyQueries.searchAuthNKeys({ aggregateID: userID });
      expect(result.keys.length).toBeGreaterThan(0);
      const keyID = result.keys[0].id;

      const key = await authNKeyQueries.getAuthNKeyByIDWithPermission(keyID, wrongUserID, TEST_INSTANCE_ID);
      
      expect(key).toBeNull();
    });
  });

  describe('Search Operations', () => {
    it('should search keys by user (using Command API)', async () => {
      const userID = generateId();
      const orgID = generateId();
      
      await setupOrg(orgID);
      await setupUser(userID, orgID);
      
      const ctx = commandCtx.createContext({
        instanceID: TEST_INSTANCE_ID,
        orgID: orgID,
        userID: 'system-admin',
      });

      const publicKey1 = createPEMKey('key-1');
      const publicKey2 = createPEMKey('key-2');
      
      // Add two keys for same user
      await commandCtx.commands.addMachineKey(ctx, userID, orgID, {
        type: AuthNKeyType.JSON,
        expirationDate: new Date('2025-12-31'),
        publicKey: publicKey1,
      });

      await commandCtx.commands.addMachineKey(ctx, userID, orgID, {
        type: AuthNKeyType.JSON,
        expirationDate: new Date('2025-12-31'),
        publicKey: publicKey2,
      });

      await waitForProjection();

      const result = await authNKeyQueries.searchAuthNKeys({
        aggregateID: userID,
        instanceID: TEST_INSTANCE_ID,
      });

      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.keys.length).toBeGreaterThanOrEqual(2);
    });

    it('should search keys with pagination (using Command API)', async () => {
      const userID = generateId();
      const orgID = generateId();
      
      await setupOrg(orgID);
      await setupUser(userID, orgID);
      
      const ctx = commandCtx.createContext({
        instanceID: TEST_INSTANCE_ID,
        orgID: orgID,
        userID: 'system-admin',
      });

      // Add multiple keys
      for (let i = 0; i < 5; i++) {
        const publicKey = createPEMKey(`key-${i}`);
        await commandCtx.commands.addMachineKey(ctx, userID, orgID, {
          type: AuthNKeyType.JSON,
          expirationDate: new Date('2025-12-31'),
          publicKey,
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
