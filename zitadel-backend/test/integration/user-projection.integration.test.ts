/**
 * User Projection Integration Tests
 * 
 * Tests the user projection using ProjectionRegistry system
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { DatabasePool } from '../../src/lib/database';
import { createTestDatabase, closeTestDatabase, cleanDatabase } from './setup';
import { DatabaseMigrator } from '../../src/lib/database/migrator';
import { PostgresEventstore } from '../../src/lib/eventstore';
import { ProjectionRegistry } from '../../src/lib/query/projection/projection-registry';
import { 
  UserProjection, 
  createUserProjection,
  createUserProjectionConfig
} from '../../src/lib/query/projections/user-projection';
import { UserRepository } from '../../src/lib/repositories/user-repository';
import { generateId as generateSnowflakeId } from '../../src/lib/id/snowflake';

describe('User Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let userRepo: UserRepository;
  let projection: UserProjection;

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
    
    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Create and register user projection with separate config
    const config = createUserProjectionConfig();
    projection = createUserProjection(eventstore, pool);
    registry.register(config, projection);
    
    userRepo = new UserRepository(pool);
  });

  afterEach(async () => {
    // Stop all projections
    const names = registry.getNames();
    for (const name of names) {
      try {
        await registry.stop(name);
      } catch (e) {
        // Ignore errors if already stopped
      }
    }
  });

  // Helper to wait for projection to process
  // Projections poll every 1s, so we wait longer to ensure processing
  const waitForProjection = (ms: number = 4000) => 
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
      await registry.start('user_projection');
      
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
      
      const user = await userRepo.findById(userId);
      expect(user).toBeDefined();
      expect(user!.username).toBe('testuser');
      expect(user!.email).toBe('test@example.com');
      expect(user!.first_name).toBe('Test');
      expect(user!.last_name).toBe('User');
      expect(user!.state).toBe('active');
    }, 10000);

    it('should process user.changed event', async () => {
      await registry.start('user_projection');
      
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
      
      const user = await userRepo.findById(userId);
      expect(user).toBeDefined();
      expect(user!.email).toBe('new@example.com');
      expect(user!.first_name).toBe('New');
      expect(user!.last_name).toBe('Name'); // Unchanged
    }, 15000);

    it('should process user.email.changed event', async () => {
      await registry.start('user_projection');
      
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
      
      const user = await userRepo.findById(userId);
      expect(user).toBeDefined();
      expect(user!.email).toBe('newemail@example.com');
      expect(user!.email_verified).toBe(false); // Reset on change
    }, 15000);

    it('should process user.email.verified event', async () => {
      await registry.start('user_projection');
      
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
      
      const user = await userRepo.findById(userId);
      expect(user).toBeDefined();
      expect(user!.email_verified).toBe(true);
      expect(user!.email_verified_at).toBeDefined();
    }, 15000);

    it('should process user.deactivated event', async () => {
      await registry.start('user_projection');
      
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
      
      let user = await userRepo.findById(userId);
      expect(user!.state).toBe('active');
      
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
      
      user = await userRepo.findById(userId);
      expect(user!.state).toBe('inactive');
    }, 15000);

    it('should process user.locked event', async () => {
      await registry.start('user_projection');
      
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
      
      const user = await userRepo.findById(userId);
      expect(user!.state).toBe('locked');
    }, 15000);

    it('should process user.removed event', async () => {
      await registry.start('user_projection');
      
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
      
      const user = await userRepo.findById(userId);
      expect(user!.state).toBe('inactive');
      expect(user!.deleted_at).toBeDefined();
    }, 15000);
  });

  describe('Projection Health', () => {
    it('should report health status', async () => {
      await registry.start('user_projection');
      
      const health = await registry.getProjectionHealth('user_projection');
      
      expect(health).toBeDefined();
      expect(health.name).toBe('user_projection');
      expect(health.currentPosition).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple user events', async () => {
      await registry.start('user_projection');
      
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
      
      await waitForProjection(3000);
      
      for (const userId of userIds) {
        const user = await userRepo.findById(userId);
        expect(user).toBeDefined();
      }
    }, 15000);
  });
});
