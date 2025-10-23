/**
 * User Projection Integration Tests
 * 
 * Tests the user projection using ProjectionRegistry system
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabaseMigrator } from '../../../src/lib/database/migrator';
import { PostgresEventstore } from '../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../src/lib/query/projection/projection-registry';
import { 
  UserProjection, 
  createUserProjection,
  createUserProjectionConfig
} from '../../../src/lib/query/projections/user-projection';
import { generateId as generateSnowflakeId } from '../../../src/lib/id/snowflake';

describe('User Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let projection: UserProjection;

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
    
    // Create and register user projection with fast polling interval
    const config = createUserProjectionConfig();
    config.interval = 50; // Optimized: 50ms for faster projection detection
    projection = createUserProjection(eventstore, pool);
    registry.register(config, projection);
    
    // Start the projection once for all tests
    await registry.start('user_projection');
    
    // Wait a bit for projection to fully start
    await waitForProjection();
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

  // Helper to wait for projection to process (optimized)
  const waitForProjection = (ms: number = 100) => // Optimized: 100ms sufficient for most projections
    new Promise(resolve => setTimeout(resolve, ms));

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
          username: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          displayName: 'Test User',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForProjection();
      
      const result = await pool.queryOne('SELECT * FROM users_projection WHERE id = $1', [userId]);
      expect(result).toBeDefined();
      expect(result!.username).toBe('testuser');
      expect(result!.email).toBe('test@example.com');
      expect(result!.first_name).toBe('Test');
      expect(result!.last_name).toBe('User');
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
          username: 'changeuser',
          email: 'old@example.com',
          firstName: 'Old',
          lastName: 'Name',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForProjection();
      
      // Update user
      await eventstore.push({
        eventType: 'user.changed',
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
      
      await waitForProjection();
      
      const result = await pool.queryOne('SELECT * FROM users_projection WHERE id = $1', [userId]);
      expect(result).toBeDefined();
      expect(result!.email).toBe('new@example.com');
      expect(result!.first_name).toBe('New');
      expect(result!.last_name).toBe('Name'); // Unchanged
    }, 15000);

    it('should process user.email.changed event', async () => {
      const userId = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'user.added',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: 'emailuser',
          email: 'old@example.com',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForProjection();
      
      await eventstore.push({
        eventType: 'user.email.changed',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          email: 'newemail@example.com',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForProjection();
      
      const result = await pool.queryOne('SELECT * FROM users_projection WHERE id = $1', [userId]);
      expect(result).toBeDefined();
      expect(result!.email).toBe('newemail@example.com');
      expect(result!.email_verified).toBe(false); // Reset on change
    }, 15000);

    it('should process user.email.verified event', async () => {
      const userId = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'user.added',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: 'verifyuser',
          email: 'verify@example.com',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForProjection();
      
      await eventstore.push({
        eventType: 'user.email.verified',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {},
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForProjection();
      
      const result = await pool.queryOne('SELECT * FROM users_projection WHERE id = $1', [userId]);
      expect(result).toBeDefined();
      expect(result!.email_verified).toBe(true);
      expect(result!.email_verified_at).toBeDefined();
    }, 15000);

    it('should process user.deactivated event', async () => {
      const userId = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'user.added',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: 'deactivateuser',
          email: 'deactivate@example.com',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForProjection();
      
      let result = await pool.queryOne('SELECT * FROM users_projection WHERE id = $1', [userId]);
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
      
      await waitForProjection();
      
      result = await pool.queryOne('SELECT * FROM users_projection WHERE id = $1', [userId]);
      expect(result!.state).toBe('inactive');
    }, 15000);

    it('should process user.locked event', async () => {
      const userId = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'user.added',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: 'lockuser',
          email: 'lock@example.com',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForProjection();
      
      await eventstore.push({
        eventType: 'user.locked',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {},
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForProjection();
      
      const result = await pool.queryOne('SELECT * FROM users_projection WHERE id = $1', [userId]);
      expect(result!.state).toBe('locked');
    }, 15000);

    it('should process user.removed event', async () => {
      const userId = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'user.added',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {
          username: 'removeuser',
          email: 'remove@example.com',
        },
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForProjection();
      
      await eventstore.push({
        eventType: 'user.removed',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {},
        creator: 'system',
        owner: 'test-org',
        instanceID: 'test-instance',
      });
      
      await waitForProjection();
      
      const result = await pool.queryOne('SELECT * FROM users_projection WHERE id = $1', [userId]);
      expect(result!.state).toBe('inactive');
      expect(result!.deleted_at).toBeDefined();
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
            username: `batchuser${i}`,
            email: `batch${i}@example.com`,
            firstName: 'Batch',
            lastName: `User${i}`,
          },
          creator: 'system',
          owner: 'test-org',
          instanceID: 'test-instance',
        });
      }
      
      await waitForProjection();
      
      for (const userId of userIds) {
        const result = await pool.queryOne('SELECT * FROM users_projection WHERE id = $1', [userId]);
        expect(result).toBeDefined();
      }
    }, 15000);
  });
});
