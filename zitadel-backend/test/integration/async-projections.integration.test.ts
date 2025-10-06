/**
 * Async Projection System Integration Tests
 * 
 * Tests the asynchronous projection system that runs in the background
 * like Zitadel's projection handlers
 * 
 * This validates:
 * - Events are consumed asynchronously
 * - Projections are updated in the background
 * - Position tracking works correctly
 * - Error recovery handles failures
 * - Projection rebuild works
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../src/lib/database';
import { createTestDatabase, closeTestDatabase, cleanDatabase } from './setup';
import { DatabaseMigrator } from '../../src/lib/database/migrator';
import { PostgresEventstore } from '../../src/lib/eventstore';
import { PostgresProjectionManager } from '../../src/lib/query/postgres/projection-manager';
import { createUserProjectionConfig } from '../../src/lib/query/projections/user-projection';
import { UserRepository } from '../../src/lib/repositories/user-repository';
import { generateId as generateSnowflakeId } from '../../src/lib/id/snowflake';

describe('Async Projection System Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let projectionManager: PostgresProjectionManager;
  let userRepo: UserRepository;

  beforeAll(async () => {
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(pool);
    
    // Create fresh instances
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
    });
    
    projectionManager = new PostgresProjectionManager(pool, eventstore);
    userRepo = new UserRepository(pool);
  });

  afterEach(async () => {
    // Clean up projection manager
    await projectionManager.close();
  });

  // Helper to wait for projection to process
  // Projections poll every 1s, so we wait 2s to ensure processing
  const waitForProjection = (ms: number = 2000) => 
    new Promise(resolve => setTimeout(resolve, ms));

  describe('Projection Registration', () => {
    it('should register a projection successfully', async () => {
      const config = createUserProjectionConfig(pool);
      
      await projectionManager.register(config);
      
      const status = await projectionManager.getStatus('users');
      expect(status).not.toBeNull();
      expect(status!.name).toBe('users');
      expect(status!.status).toBe('stopped');
      expect(status!.position).toBe(0);
    });

    it('should initialize projection state in database', async () => {
      const config = createUserProjectionConfig(pool);
      
      await projectionManager.register(config);
      
      // Check projection_states table
      const result = await pool.query(
        'SELECT * FROM projection_states WHERE name = $1',
        ['users']
      );
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].name).toBe('users');
      expect(result.rows[0].status).toBe('stopped');
    });

    it('should list all registered projections', async () => {
      const config = createUserProjectionConfig(pool);
      await projectionManager.register(config);
      
      const projections = await projectionManager.list();
      
      expect(projections.length).toBeGreaterThanOrEqual(1);
      const userProjection = projections.find(p => p.name === 'users');
      expect(userProjection).toBeDefined();
    });
  });

  describe('Async Event Consumption', () => {
    it('should process events asynchronously after they are written', async () => {
      // 1. Register and start projection
      const config = createUserProjectionConfig(pool);
      await projectionManager.register(config);
      await projectionManager.start('users');
      
      // 2. Write an event to eventstore
      const userId = generateSnowflakeId();
      await eventstore.push({
        eventType: 'user.created',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: 'async.user',
          email: 'async.user@example.com',
          firstName: 'Async',
          lastName: 'User',
          displayName: 'Async User',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      // 3. Wait for projection to process (polls every 1s)
      await waitForProjection();
      
      // 4. Verify projection was updated
      const user = await userRepo.findById(userId);
      expect(user).toBeDefined();
      expect(user!.username).toBe('async.user');
      expect(user!.email).toBe('async.user@example.com');
    }, 10000); // Longer timeout for async operations

    it('should update projection when user is updated', async () => {
      const config = createUserProjectionConfig(pool);
      await projectionManager.register(config);
      await projectionManager.start('users');
      
      const userId = generateSnowflakeId();
      
      // Create user
      await eventstore.push({
        eventType: 'user.created',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: 'update.test',
          email: 'old@example.com',
          firstName: 'Old',
          lastName: 'Name',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      // Wait for create to be processed and verify
      await waitForProjection(3000);
      let user = await userRepo.findById(userId);
      expect(user).not.toBeNull();
      expect(user!.email).toBe('old@example.com');
      
      // Update user
      await eventstore.push({
        eventType: 'user.updated',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          email: 'new@example.com',
          firstName: 'New',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      // Wait for update to be processed
      await waitForProjection(3000);
      
      // Verify update
      user = await userRepo.findById(userId);
      expect(user).not.toBeNull();
      expect(user!.email).toBe('new@example.com');
      expect(user!.first_name).toBe('New');
      expect(user!.last_name).toBe('Name'); // Unchanged
    }, 20000);

    it('should deactivate user when deactivated event received', async () => {
      const config = createUserProjectionConfig(pool);
      await projectionManager.register(config);
      await projectionManager.start('users');
      
      const userId = generateSnowflakeId();
      
      // Create user
      await eventstore.push({
        eventType: 'user.created',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: 'deactivate.test',
          email: 'deactivate@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      // Wait for create and verify
      await waitForProjection(3000);
      let user = await userRepo.findById(userId);
      expect(user).not.toBeNull();
      expect(user!.state).toBe('active');
      
      // Deactivate user
      await eventstore.push({
        eventType: 'user.deactivated',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {},
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForProjection(3000);
      
      // Verify deactivation
      user = await userRepo.findById(userId);
      expect(user).not.toBeNull();
      expect(user!.state).toBe('inactive');
    }, 20000);
  });

  describe('Position Tracking', () => {
    it('should track last processed event position', async () => {
      const config = createUserProjectionConfig(pool);
      await projectionManager.register(config);
      await projectionManager.start('users');
      
      const userId = generateSnowflakeId();
      
      // Write event
      await eventstore.push({
        eventType: 'user.created',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: 'position.test',
          email: 'position@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForProjection(3000);
      
      // Verify user was created
      const user = await userRepo.findById(userId);
      expect(user).not.toBeNull();
      
      // Check position was updated
      const status = await projectionManager.getStatus('users');
      expect(status).not.toBeNull();
      expect(status!.position).toBeGreaterThan(0);
      expect(status!.lastProcessedAt).toBeDefined();
    }, 15000);

    it('should only process events after current position', async () => {
      const config = createUserProjectionConfig(pool);
      await projectionManager.register(config);
      
      // Create first event
      const userId1 = generateSnowflakeId();
      await eventstore.push({
        eventType: 'user.created',
        aggregateType: 'user',
        aggregateID: userId1,
        payload: {
          username: 'first.user',
          email: 'first@example.com',
          firstName: 'First',
          lastName: 'User',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      // Start projection (will process first event)
      await projectionManager.start('users');
      await waitForProjection();
      
      // Create second event
      const userId2 = generateSnowflakeId();
      await eventstore.push({
        eventType: 'user.created',
        aggregateType: 'user',
        aggregateID: userId2,
        payload: {
          username: 'second.user',
          email: 'second@example.com',
          firstName: 'Second',
          lastName: 'User',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForProjection();
      
      // Both users should exist
      const user1 = await userRepo.findById(userId1);
      const user2 = await userRepo.findById(userId2);
      
      expect(user1).toBeDefined();
      expect(user2).toBeDefined();
    }, 10000);
  });

  describe('Projection Control', () => {
    it('should start and stop projection', async () => {
      const config = createUserProjectionConfig(pool);
      await projectionManager.register(config);
      
      // Start
      await projectionManager.start('users');
      let status = await projectionManager.getStatus('users');
      expect(status!.status).toBe('running');
      
      // Stop
      await projectionManager.stop('users');
      status = await projectionManager.getStatus('users');
      expect(status!.status).toBe('stopped');
    });

    it('should not process events when stopped', async () => {
      const config = createUserProjectionConfig(pool);
      await projectionManager.register(config);
      // Don't start projection
      
      const userId = generateSnowflakeId();
      await eventstore.push({
        eventType: 'user.created',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: 'stopped.user',
          email: 'stopped@example.com',
          firstName: 'Stopped',
          lastName: 'User',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForProjection();
      
      // User should NOT exist (projection not started)
      const user = await userRepo.findById(userId);
      expect(user).toBeNull();
    }, 10000);
  });

  describe('Projection Rebuild', () => {
    it('should rebuild projection from scratch', async () => {
      const config = createUserProjectionConfig(pool);
      await projectionManager.register(config);
      
      // Create some events first
      const userId1 = generateSnowflakeId();
      const userId2 = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'user.created',
        aggregateType: 'user',
        aggregateID: userId1,
        payload: {
          username: 'rebuild.user1',
          email: 'rebuild1@example.com',
          firstName: 'Rebuild',
          lastName: 'User1',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await eventstore.push({
        eventType: 'user.created',
        aggregateType: 'user',
        aggregateID: userId2,
        payload: {
          username: 'rebuild.user2',
          email: 'rebuild2@example.com',
          firstName: 'Rebuild',
          lastName: 'User2',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      // Rebuild projection (this processes all events synchronously)
      await projectionManager.rebuild('users');
      
      // Give a small buffer for database writes to complete
      await waitForProjection(500);
      
      // Both users should exist
      const user1 = await userRepo.findById(userId1);
      const user2 = await userRepo.findById(userId2);
      
      expect(user1).not.toBeNull();
      expect(user2).not.toBeNull();
      expect(user1!.username).toBe('rebuild.user1');
      expect(user2!.username).toBe('rebuild.user2');
    }, 15000); // Rebuild can take longer
  });

  describe('Batch Processing', () => {
    it('should process multiple events in batches', async () => {
      const config = createUserProjectionConfig(pool);
      await projectionManager.register(config);
      await projectionManager.start('users');
      
      // Create 5 users
      const userIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const userId = generateSnowflakeId();
        userIds.push(userId);
        
        await eventstore.push({
          eventType: 'user.created',
          aggregateType: 'user',
          aggregateID: userId,
          payload: {
            username: `batch.user${i}`,
            email: `batch${i}@example.com`,
            firstName: 'Batch',
            lastName: `User${i}`,
          },
          creator: 'system',
          owner: 'test-org',
          instanceID: 'test-instance',
        });
      }
      
      await waitForProjection(2000); // Wait a bit longer for batch
      
      // All users should be processed
      for (const userId of userIds) {
        const user = await userRepo.findById(userId);
        expect(user).toBeDefined();
      }
    }, 15000);
  });
});
