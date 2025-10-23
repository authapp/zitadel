/**
 * Integration tests for User Metadata Projection
 * Tests user flexible metadata event handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database';
import { PostgresEventstore } from '../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../src/lib/query/projection/projection-registry';
import { UserMetadataProjection, createUserMetadataProjectionConfig } from '../../../src/lib/query/projections/user-metadata-projection';
import { generateId } from '../../../src/lib/id';

describe('User Metadata Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;

  const TEST_INSTANCE_ID = 'test-instance';

  beforeAll(async () => {
    pool = await createTestDatabase();

    eventstore = new PostgresEventstore(pool, {
      instanceID: TEST_INSTANCE_ID,
      maxPushBatchSize: 100,
      enableSubscriptions: false,
    });

    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });

    await registry.init();

    const config = createUserMetadataProjectionConfig();
    config.interval = 50;
    registry.register(config, new UserMetadataProjection(eventstore, pool));

    await registry.start('user_metadata_projection');
  });

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
    await pool.query('DELETE FROM user_metadata WHERE instance_id = $1', [TEST_INSTANCE_ID]);
    await pool.query('DELETE FROM users_projection WHERE instance_id = $1', [TEST_INSTANCE_ID]);
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  const createTestUser = async (userId: string, resourceOwner?: string) => {
    await pool.query(
      `INSERT INTO users_projection (id, instance_id, resource_owner, username, email, state, sequence)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (instance_id, id) DO NOTHING`,
      [userId, TEST_INSTANCE_ID, resourceOwner || TEST_INSTANCE_ID, `user_${userId}`, `${userId}@test.com`, 'active', 1]
    );
  };

  const waitForProjection = (ms: number = 300) =>
    new Promise(resolve => setTimeout(resolve, ms));

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

      await waitForProjection();

      const result = await pool.queryOne(
        'SELECT * FROM user_metadata WHERE instance_id = $1 AND user_id = $2 AND metadata_key = $3',
        [TEST_INSTANCE_ID, userId, 'department']
      );

      expect(result).toBeDefined();
      expect(result.metadata_key).toBe('department');
      expect(result.metadata_value).toBe('Engineering');
      expect(result.metadata_type).toBe('custom');
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

      await waitForProjection();

      const result = await pool.queryOne(
        'SELECT * FROM user_metadata WHERE instance_id = $1 AND user_id = $2 AND metadata_key = $3',
        [TEST_INSTANCE_ID, userId, 'employee_id']
      );

      expect(result).toBeDefined();
      expect(result.metadata_type).toBe('system');
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

      await waitForProjection();

      const result = await pool.queryOne(
        'SELECT metadata_value FROM user_metadata WHERE instance_id = $1 AND user_id = $2 AND metadata_key = $3',
        [TEST_INSTANCE_ID, userId, 'preferences']
      );

      const value = result.metadata_value;
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

      await waitForProjection();

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

      await waitForProjection();

      const result = await pool.queryOne(
        'SELECT * FROM user_metadata WHERE instance_id = $1 AND user_id = $2 AND metadata_key = $3',
        [TEST_INSTANCE_ID, userId, 'status']
      );

      expect(result.metadata_value).toBe('inactive');
      expect(result.updated_by).toBe('admin2');
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

      await waitForProjection();

      const result = await pool.queryOne(
        'SELECT * FROM user_metadata WHERE instance_id = $1 AND user_id = $2 AND metadata_key = $3 AND scope = $4',
        [TEST_INSTANCE_ID, userId, 'app_role', appId]
      );

      expect(result).toBeDefined();
      expect(result.scope).toBe(appId);
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

      await waitForProjection();

      let result = await pool.queryOne(
        'SELECT * FROM user_metadata WHERE instance_id = $1 AND user_id = $2 AND metadata_key = $3',
        [TEST_INSTANCE_ID, userId, 'temp_key']
      );
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

      await waitForProjection();

      result = await pool.queryOne(
        'SELECT * FROM user_metadata WHERE instance_id = $1 AND user_id = $2 AND metadata_key = $3',
        [TEST_INSTANCE_ID, userId, 'temp_key']
      );
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

      await waitForProjection();

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

      await waitForProjection();

      const results = await pool.query(
        'SELECT * FROM user_metadata WHERE instance_id = $1 AND user_id = $2 AND metadata_key = $3',
        [TEST_INSTANCE_ID, userId, 'role']
      );

      expect(results.rows.length).toBe(1);
      expect(results.rows[0].scope).toBe(scope2);
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

      await waitForProjection();

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

      await waitForProjection();

      const results = await pool.query(
        'SELECT * FROM user_metadata WHERE instance_id = $1 AND user_id = $2',
        [TEST_INSTANCE_ID, userId]
      );

      expect(results.rows.length).toBe(0);
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

      await waitForProjection();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.removed',
        payload: {},
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const result = await pool.queryOne(
        'SELECT * FROM user_metadata WHERE instance_id = $1 AND user_id = $2',
        [TEST_INSTANCE_ID, userId]
      );
      expect(result).toBeNull();
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

      await waitForProjection();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'org',
        aggregateID: orgId,
        eventType: 'org.removed',
        payload: {},
        creator: 'admin',
        owner: orgId,
      });

      await waitForProjection();

      const result = await pool.queryOne(
        'SELECT * FROM user_metadata WHERE instance_id = $1 AND user_id = $2',
        [TEST_INSTANCE_ID, userId]
      );
      expect(result).toBeNull();
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

      await waitForProjection();

      const result = await pool.queryOne(
        'SELECT * FROM user_metadata WHERE instance_id = $1 AND user_id = $2',
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

      await waitForProjection();

      const results = await pool.query(
        'SELECT * FROM user_metadata WHERE instance_id = $1 AND user_id = $2',
        [TEST_INSTANCE_ID, userId]
      );

      // Should not create any records
      expect(results.rows.length).toBe(0);
    });
  });
});
