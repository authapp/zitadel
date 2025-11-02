/**
 * Integration tests for User Metadata Projection
 * Tests user flexible metadata event handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabasePool } from '../../../../src/lib/database';
import { PostgresEventstore } from '../../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { UserMetadataProjection, createUserMetadataProjectionConfig } from '../../../../src/lib/query/projections/user-metadata-projection';
import { UserMetadataQueries } from '../../../../src/lib/query/user/user-metadata-queries';
import { generateId } from '../../../../src/lib/id';
import { waitForProjectionCatchUp, delay } from '../../../helpers/projection-test-helpers';

describe('User Metadata Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let userMetadataQueries: UserMetadataQueries;

  const TEST_INSTANCE_ID = 'test-instance';

  beforeAll(async () => {
    pool = await createTestDatabase();

    eventstore = new PostgresEventstore(pool, {
      instanceID: TEST_INSTANCE_ID,
      maxPushBatchSize: 100,
      enableSubscriptions: true,
    });

    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });

    await registry.init();

    const projection = new UserMetadataProjection(eventstore, pool);
    await projection.init();
    
    const config = createUserMetadataProjectionConfig();
    config.interval = 50;
    registry.register(config, projection);

    await registry.start('user_metadata_projection');

    // Initialize query layer
    userMetadataQueries = new UserMetadataQueries(pool);
    
    // Give projection time to start and establish subscriptions
    await delay(100);
  })

  afterAll(async () => {
    const names = registry.getNames();
    for (const name of names) {
      try {
        await registry.stop(name);
      } catch (e) {
        // Ignore
      }
    }

    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM projections.user_metadata WHERE instance_id = $1', [TEST_INSTANCE_ID]);
    await pool.query('DELETE FROM projections.users WHERE instance_id = $1', [TEST_INSTANCE_ID]);
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  const createTestUser = async (userId: string, resourceOwner?: string) => {
    await pool.query(
      `INSERT INTO projections.users (id, instance_id, resource_owner, username, email, state, sequence)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (instance_id, id) DO NOTHING`,
      [userId, TEST_INSTANCE_ID, resourceOwner || TEST_INSTANCE_ID, `user_${userId}`, `${userId}@test.com`, 'active', 1]
    );
  };

  // Helper to wait for projection to process events
  const waitForEvents = async () => {
    await waitForProjectionCatchUp(registry, eventstore, 'user_metadata_projection', 2000);
  };

  describe('Metadata Set Events', () => {
    it('should process user.metadata.set event', async () => {
      const userId = generateId();
      await createTestUser(userId);

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.set',
        payload: {
          key: 'department',
          value: 'Engineering',
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const result = await userMetadataQueries.getUserMetadata(userId, TEST_INSTANCE_ID, 'department');

      expect(result).toBeDefined();
      expect(result!.metadataKey).toBe('department');
      expect(result!.metadataValue).toBe('Engineering');
      expect(result!.metadataType).toBe('custom');
    });

    it('should process user.v1.metadata.set event', async () => {
      const userId = generateId();
      await createTestUser(userId);

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.v1.metadata.set',
        payload: {
          metadataKey: 'employee_id',
          metadataValue: '12345',
          metadataType: 'system',
        },
        creator: 'system',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const result = await userMetadataQueries.getUserMetadata(userId, TEST_INSTANCE_ID, 'employee_id');

      expect(result).toBeDefined();
      expect(result!.metadataType).toBe('system');
    });

    it('should handle complex JSON values', async () => {
      const userId = generateId();
      await createTestUser(userId);

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.set',
        payload: {
          key: 'preferences',
          value: {
            theme: 'dark',
            language: 'en',
            notifications: {
              email: true,
              sms: false,
            },
          },
        },
        creator: 'user',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const result = await userMetadataQueries.getUserMetadata(userId, TEST_INSTANCE_ID, 'preferences');

      const value = result!.metadataValue;
      expect(value.theme).toBe('dark');
      expect(value.notifications.email).toBe(true);
    });

    it('should update existing metadata', async () => {
      const userId = generateId();
      await createTestUser(userId);

      // First set
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.set',
        payload: {
          key: 'status',
          value: 'active',
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      // Update
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.set',
        payload: {
          key: 'status',
          value: 'inactive',
        },
        creator: 'admin2',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const result = await userMetadataQueries.getUserMetadata(userId, TEST_INSTANCE_ID, 'status');

      expect(result!.metadataValue).toBe('inactive');
      expect(result!.updatedBy).toBe('admin2');
    });

    it('should handle scoped metadata', async () => {
      const userId = generateId();
      await createTestUser(userId);
      const appId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.set',
        payload: {
          key: 'app_role',
          value: 'admin',
          scope: appId,
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const result = await userMetadataQueries.getUserMetadata(userId, TEST_INSTANCE_ID, 'app_role', appId);

      expect(result).toBeDefined();
      expect(result!.scope).toBe(appId);
    });
  });

  describe('Metadata Removed Events', () => {
    it('should remove metadata on user.metadata.removed', async () => {
      const userId = generateId();
      await createTestUser(userId);

      // Set metadata
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.set',
        payload: {
          key: 'temp_key',
          value: 'temp_value',
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      let result = await userMetadataQueries.getUserMetadata(userId, TEST_INSTANCE_ID, 'temp_key');
      expect(result).toBeDefined();

      // Remove metadata
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.removed',
        payload: {
          key: 'temp_key',
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      result = await userMetadataQueries.getUserMetadata(userId, TEST_INSTANCE_ID, 'temp_key');
      expect(result).toBeNull();
    });

    it('should remove scoped metadata correctly', async () => {
      const userId = generateId();
      await createTestUser(userId);
      const scope1 = 'app1';
      const scope2 = 'app2';

      // Set two scoped metadata with same key
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.set',
        payload: { key: 'role', value: 'admin', scope: scope1 },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.set',
        payload: { key: 'role', value: 'user', scope: scope2 },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      // Remove only scope1
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.removed',
        payload: { key: 'role', scope: scope1 },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const results = await userMetadataQueries.getUserMetadataList(userId, TEST_INSTANCE_ID);
      const roleMetadata = results.filter(m => m.metadataKey === 'role');

      expect(roleMetadata.length).toBe(1);
      expect(roleMetadata[0].scope).toBe(scope2);
    });

    it('should remove all metadata on user.metadata.removed.all', async () => {
      const userId = generateId();
      await createTestUser(userId);

      // Set multiple metadata
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.set',
        payload: { key: 'key1', value: 'value1' },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.set',
        payload: { key: 'key2', value: 'value2' },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      // Remove all
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.removed.all',
        payload: {},
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const results = await userMetadataQueries.getUserMetadataList(userId, TEST_INSTANCE_ID);

      expect(results.length).toBe(0);
    });
  });

  describe('Cleanup Events', () => {
    it('should delete metadata when user is removed', async () => {
      const userId = generateId();
      await createTestUser(userId);

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.set',
        payload: { key: 'test', value: 'value' },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.removed',
        payload: {},
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const result = await userMetadataQueries.getUserMetadataList(userId, TEST_INSTANCE_ID);
      expect(result.length).toBe(0);
    });

    it('should delete metadata when org is removed', async () => {
      const orgId = generateId();
      const userId = generateId();

      // Create user for this org
      await createTestUser(userId, orgId);

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.set',
        payload: { key: 'test', value: 'value' },
        creator: 'admin',
        owner: orgId,
      });

      await waitForEvents();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'org',
        aggregateID: orgId,
        eventType: 'org.removed',
        payload: {},
        creator: 'admin',
        owner: orgId,
      });

      await waitForEvents();

      const result = await userMetadataQueries.getUserMetadataList(userId, TEST_INSTANCE_ID);
      expect(result.length).toBe(0);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate metadata by instance', async () => {
      const userId = generateId();
      await createTestUser(userId);
      const otherInstance = `other-instance-${generateId()}`;

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.set',
        payload: { key: 'test', value: 'value' },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const result = await pool.queryOne(
        'SELECT * FROM projections.user_metadata WHERE instance_id = $1 AND user_id = $2',
        [otherInstance, userId]
      );

      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle events with missing key gracefully', async () => {
      const userId = generateId();
      await createTestUser(userId);

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.metadata.set',
        payload: {
          value: 'no key provided',
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const results = await pool.query(
        'SELECT * FROM projections.user_metadata WHERE instance_id = $1 AND user_id = $2',
        [TEST_INSTANCE_ID, userId]
      );

      // Should not create any records
      expect(results.rows.length).toBe(0);
    });
  });
});
