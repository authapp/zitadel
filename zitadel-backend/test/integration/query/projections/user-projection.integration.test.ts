/**
 * User Projection Integration Tests
 * 
 * Tests the user projection using ProjectionRegistry system
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabaseMigrator } from '../../../../src/lib/database/migrator';
import { PostgresEventstore } from '../../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { 
  UserProjection, 
  createUserProjection,
  createUserProjectionConfig
} from '../../../../src/lib/query/projections/user-projection';
import { UserQueries } from '../../../../src/lib/query/user/user-queries';
import { generateId as generateSnowflakeId } from '../../../../src/lib/id/snowflake';
import { waitForProjectionCatchUp, delay } from '../../../helpers/projection-test-helpers';

describe('User Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let projection: UserProjection;
  let userQueries: UserQueries;

  beforeAll(async () => {
    // Setup database and run migrations (automatically provides clean state)
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
    
    // Create eventstore
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
    });
    
    // Create projection registry
    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Create and register user projection
    const config = createUserProjectionConfig();
    config.interval = 50; // Fast polling for tests
    projection = createUserProjection(eventstore, pool);
    registry.register(config, projection);
    
    // Start the projection once for all tests
    await registry.start('user_projection');
    
    // Initialize query layer
    userQueries = new UserQueries(pool);
    
    // Give projection time to start and establish subscription
    await delay(100);
  });

  afterAll(async () => {
    // Stop projections
    const names = registry.getNames();
    for (const name of names) {
      try {
        await registry.stop(name);
      } catch (e) {
        // Ignore errors if already stopped
      }
    }
    
    await closeTestDatabase();
  });

  // Helper to wait for projection to process events
  const waitForEvents = async () => {
    // Wait for projection to catch up with all events in eventstore
    await waitForProjectionCatchUp(registry, eventstore, 'user_projection', 2000);
  };

  describe('Projection Registration', () => {
    it('should register user projection successfully', () => {
      const names = registry.getNames();
      expect(names).toContain('user_projection');
    });

    it('should have handler for user projection', () => {
      const handler = registry.get('user_projection');
      expect(handler).toBeDefined();
    });
  });

  describe('Event Processing', () => {
    it('should process user.added event', async () => {
      const userId = generateSnowflakeId();
      await eventstore.push({
        eventType: 'user.added',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: `testuser-${userId}`,
          email: `test-${userId}@example.com`,
          firstName: 'Test',
          lastName: 'User',
          displayName: 'Test User',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForEvents();
      
      const result = await userQueries.getUserByID(userId, 'test-instance');
      expect(result).toBeDefined();
      expect(result!.username).toBe(`testuser-${userId}`);
      expect(result!.email).toBe(`test-${userId}@example.com`);
      expect(result!.firstName).toBe('Test');
      expect(result!.lastName).toBe('User');
      expect(result!.state).toBe('active');
    }, 10000);

    it('should process user.changed event', async () => {
      const userId = generateSnowflakeId();
      
      // Create user
      await eventstore.push({
        eventType: 'user.added',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: `changeuser-${userId}`,
          email: `change-${userId}@example.com`,
          firstName: 'Old',
          lastName: 'Name',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForEvents();
      
      // Update user
      await eventstore.push({
        eventType: 'user.changed',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          email: `new-${userId}@example.com`,
          firstName: 'New',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForEvents();
      
      const result = await userQueries.getUserByID(userId, 'test-instance');
      expect(result).toBeDefined();
      expect(result!.email).toBe(`new-${userId}@example.com`);
      expect(result!.firstName).toBe('New');
      expect(result!.lastName).toBe('Name'); // Unchanged
    }, 15000);

    it('should process user.email.changed event', async () => {
      const userId = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'user.added',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: `emailuser-${userId}`,
          email: `old-${userId}@example.com`,
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForEvents();
      
      await eventstore.push({
        eventType: 'user.email.changed',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          email: `newemail-${userId}@example.com`,
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForEvents();
      
      const result = await userQueries.getUserByID(userId, 'test-instance');
      expect(result).toBeDefined();
      expect(result!.email).toBe(`newemail-${userId}@example.com`);
      expect(result!.emailVerified).toBe(false); // Reset on change
    }, 15000);

    it('should process user.email.verified event', async () => {
      const userId = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'user.added',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: `verifyuser-${userId}`,
          email: `verify-${userId}@example.com`,
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForEvents();
      
      await eventstore.push({
        eventType: 'user.email.verified',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {},
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForEvents();
      
      const result = await userQueries.getUserByID(userId, 'test-instance');
      expect(result).toBeDefined();
      expect(result!.emailVerified).toBe(true);
      expect(result!.emailVerifiedAt).toBeDefined();
    }, 15000);

    it('should process user.deactivated event', async () => {
      const userId = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'user.added',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: `deactivateuser-${userId}`,
          email: `deactivate-${userId}@example.com`,
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForEvents();
      
      let result = await userQueries.getUserByID(userId, 'test-instance');
      expect(result).toBeDefined();
      expect(result!.state).toBe('active');
      
      await eventstore.push({
        eventType: 'user.deactivated',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {},
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForEvents();
      
      result = await userQueries.getUserByID(userId, 'test-instance');
      expect(result).toBeDefined();
      expect(result!.state).toBe('inactive');
    }, 15000);

    it('should process user.locked event', async () => {
      const userId = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'user.added',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: `lockuser-${userId}`,
          email: `lock-${userId}@example.com`,
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForEvents();
      
      await eventstore.push({
        eventType: 'user.locked',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {},
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForEvents();
      
      const result = await userQueries.getUserByID(userId, 'test-instance');
      expect(result).toBeDefined();
      expect(result!.state).toBe('locked');
    }, 15000);

    it('should process user.removed event', async () => {
      const userId = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'user.added',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: `removeuser-${userId}`,
          email: `remove-${userId}@example.com`,
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForEvents();
      
      await eventstore.push({
        eventType: 'user.removed',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {},
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForEvents();
      
      // Note: getUserByID() returns deleted users so the API can show deletion status
      // Only search/list operations filter out deleted users
      const result = await userQueries.getUserByID(userId, 'test-instance');
      expect(result).not.toBeNull();
      expect(result!.state).toBe('deleted');
      expect(result!.deletedAt).toBeTruthy();
      console.log('✓ Removed user returned with deleted state');
    }, 15000);
  });

  describe('Projection Health', () => {
    it('should report health status', async () => {
      const health = await registry.getProjectionHealth('user_projection');
      
      expect(health).toBeDefined();
      expect(health.name).toBe('user_projection');
      expect(health.currentPosition).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple user events', async () => {
      const userIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const userId = generateSnowflakeId();
        userIds.push(userId);
        
        await eventstore.push({
          eventType: 'user.added',
          aggregateType: 'user',
          aggregateID: userId,
          payload: {
            username: `batchuser-${userId}-${i}`,
            email: `batchuser-${userId}-${i}@example.com`,
            firstName: 'Batch',
            lastName: `User${i}`,
          },
          creator: 'system',
          owner: 'test-org',
          instanceID: 'test-instance',
        });
      }
      
      await waitForEvents();
      
      for (const userId of userIds) {
        const result = await userQueries.getUserByID(userId, 'test-instance');
        expect(result).toBeDefined();
      }
    }, 15000);
  });
});
