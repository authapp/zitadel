/**
 * Integration tests for User Address Projection
 * Tests user physical address event handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabasePool } from '../../../../src/lib/database';
import { PostgresEventstore } from '../../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { UserAddressProjection, createUserAddressProjectionConfig } from '../../../../src/lib/query/projections/user-address-projection';
import { UserAddressQueries } from '../../../../src/lib/query/user/user-address-queries';
import { generateId } from '../../../../src/lib/id';

describe('User Address Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let userAddressQueries: UserAddressQueries;

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

    const config = createUserAddressProjectionConfig();
    config.interval = 50;
    registry.register(config, new UserAddressProjection(eventstore, pool));

    await registry.start('user_address_projection');

    // Initialize query layer
    userAddressQueries = new UserAddressQueries(pool);
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
    await pool.query('DELETE FROM projections.user_addresses WHERE instance_id = $1', [TEST_INSTANCE_ID]);
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

  const waitForProjection = (ms: number = 300) =>
    new Promise(resolve => setTimeout(resolve, ms));

  describe('Address Changed Events', () => {
    it('should process user.human.address.changed event', async () => {
      const userId = generateId();
      await createTestUser(userId);

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.human.address.changed',
        payload: {
          country: 'USA',
          locality: 'New York',
          postalCode: '10001',
          region: 'NY',
          streetAddress: '123 Main St',
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const result = await userAddressQueries.getUserAddress(userId, TEST_INSTANCE_ID);

      expect(result).toBeDefined();
      expect(result!.country).toBe('USA');
      expect(result!.locality).toBe('New York');
      expect(result!.postalCode).toBe('10001');
      expect(result!.region).toBe('NY');
      expect(result!.streetAddress).toBe('123 Main St');
      expect(result!.isPrimary).toBe(true);
    });

    it('should process user.v1.address.changed event', async () => {
      const userId = generateId();
      await createTestUser(userId);

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.v1.address.changed',
        payload: {
          country: 'Canada',
          city: 'Toronto',
          postal_code: 'M5H 2N2',
          state: 'ON',
          street_address: '789 Queen St',
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const result = await userAddressQueries.getUserAddress(userId, TEST_INSTANCE_ID);

      expect(result).toBeDefined();
      expect(result!.country).toBe('Canada');
      expect(result!.locality).toBe('Toronto');
      expect(result!.postalCode).toBe('M5H 2N2');
      expect(result!.region).toBe('ON');
    });

    it('should format address correctly', async () => {
      const userId = generateId();
      await createTestUser(userId);

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.human.address.changed',
        payload: {
          streetAddress: '456 Oak Ave',
          locality: 'San Francisco',
          region: 'CA',
          postalCode: '94102',
          country: 'USA',
        },
        creator: 'user',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const result = await userAddressQueries.getUserAddress(userId, TEST_INSTANCE_ID);

      expect(result!.formattedAddress).toBe('456 Oak Ave, San Francisco, CA, 94102, USA');
    });

    it('should update existing address', async () => {
      const userId = generateId();
      await createTestUser(userId);

      // First address
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.human.address.changed',
        payload: {
          country: 'USA',
          locality: 'Boston',
          postalCode: '02101',
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      // Updated address
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.human.address.changed',
        payload: {
          country: 'USA',
          locality: 'Cambridge',
          postalCode: '02139',
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const result = await userAddressQueries.getUserAddress(userId, TEST_INSTANCE_ID);

      expect(result!.locality).toBe('Cambridge');
      expect(result!.postalCode).toBe('02139');
    });

    it('should handle address types', async () => {
      const userId = generateId();
      await createTestUser(userId);

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.human.address.changed',
        payload: {
          country: 'UK',
          locality: 'London',
          addressType: 'billing',
          isPrimary: false,
        },
        creator: 'user',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const result = await userAddressQueries.getUserAddress(userId, TEST_INSTANCE_ID);

      expect(result!.addressType).toBe('billing');
      expect(result!.isPrimary).toBe(false);
    });
  });

  describe('Cleanup Events', () => {
    it('should delete address when user is removed', async () => {
      const userId = generateId();
      await createTestUser(userId);

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.human.address.changed',
        payload: { country: 'USA', locality: 'NYC' },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      let result = await userAddressQueries.getUserAddress(userId, TEST_INSTANCE_ID);
      expect(result).toBeDefined();

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

      result = await userAddressQueries.getUserAddress(userId, TEST_INSTANCE_ID);
      expect(result).toBeNull();
    });

    it('should delete addresses when org is removed', async () => {
      const orgId = generateId();
      const userId = generateId();

      // Create user for this org
      await createTestUser(userId, orgId);

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.human.address.changed',
        payload: { country: 'USA' },
        creator: 'admin',
        owner: orgId,
      });

      await waitForProjection();

      let result = await userAddressQueries.getUserAddress(userId, TEST_INSTANCE_ID);
      expect(result).toBeDefined();

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

      result = await userAddressQueries.getUserAddress(userId, TEST_INSTANCE_ID);
      expect(result).toBeNull();

    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate addresses by instance', async () => {
      const userId = generateId();
      await createTestUser(userId);
      const otherInstance = `other-instance-${generateId()}`;

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.human.address.changed',
        payload: { country: 'USA', locality: 'NYC' },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const result = await userAddressQueries.getUserAddress(userId, otherInstance);

      expect(result).toBeNull();
    });
  });

  describe('Data Integrity', () => {
    it('should handle partial address data', async () => {
      const userId = generateId();
      await createTestUser(userId);

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.human.address.changed',
        payload: {
          country: 'USA',
          // Missing other fields
        },
        creator: 'user',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const result = await userAddressQueries.getUserAddress(userId, TEST_INSTANCE_ID);

      expect(result).toBeDefined();
      expect(result!.country).toBe('USA');
      expect(result!.locality).toBeNull();
      expect(result!.postalCode).toBeNull();
    });
  });
});
