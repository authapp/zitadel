/**
 * Database Integration Test
 * 
 * Simple test to verify integration test infrastructure works
 */

import { DatabasePool } from '../../src/lib/database';
import {
  createTestDatabase,
  cleanDatabase,
  closeTestDatabase,
  query,
} from './setup';

describe('Integration: Database Setup', () => {
  let pool: DatabasePool;

  beforeAll(async () => {
    pool = await createTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(pool);
  });

  describe('Database Connection', () => {
    it('should connect to test database', async () => {
      const result = await query(pool, 'SELECT 1 as value');
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(1);
    });

    it('should have users_projection table', async () => {
      const result = await query(
        pool,
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'users_projection'`
      );
      expect(result).toHaveLength(1);
      expect(result[0].table_name).toBe('users_projection');
    });

    it('should have projection_states table', async () => {
      const result = await query(
        pool,
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'projection_states'`
      );
      expect(result).toHaveLength(1);
      expect(result[0].table_name).toBe('projection_states');
    });

    it('should have events table', async () => {
      const result = await query(
        pool,
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'events'`
      );
      expect(result).toHaveLength(1);
      expect(result[0].table_name).toBe('events');
    });
  });

  describe('Data Operations', () => {
    it('should insert and retrieve user data', async () => {
      // Insert a user
      await query(
        pool,
        `INSERT INTO users_projection (id, username, email, password_hash, state, instance_id, resource_owner, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        ['test-id', 'testuser', 'test@example.com', 'hash123', 'active', 'test-instance', 'test-org']
      );

      // Retrieve the user
      const users = await query(
        pool,
        'SELECT * FROM users_projection WHERE id = $1',
        ['test-id']
      );

      expect(users).toHaveLength(1);
      expect(users[0].username).toBe('testuser');
      expect(users[0].email).toBe('test@example.com');
    });

    it('should enforce unique username constraint', async () => {
      // Insert first user
      await query(
        pool,
        `INSERT INTO users_projection (id, username, email, password_hash, state, instance_id, resource_owner, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        ['user1', 'duplicate', 'user1@test.com', 'hash1', 'active', 'test-instance', 'test-org']
      );

      // Attempt to insert user with same username
      await expect(
        query(
          pool,
          `INSERT INTO users_projection (id, username, email, password_hash, state, instance_id, resource_owner, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          ['user2', 'duplicate', 'user2@test.com', 'hash2', 'active', 'test-instance', 'test-org']
        )
      ).rejects.toThrow();
    });

    it('should insert and retrieve events', async () => {
      // Insert an event using the actual schema
      await query(
        pool,
        `INSERT INTO events (
          id, aggregate_type, aggregate_id, aggregate_version, event_type, event_data,
          editor_user, resource_owner, instance_id, position, in_position_order,
          creation_date, revision
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), 1)`,
        ['evt-123', 'user', 'user123', 1, 'user.created', JSON.stringify({ username: 'test' }),
         'admin', 'test-org', 'test-instance', '1', 0]
      );

      // Retrieve events
      const events = await query(
        pool,
        'SELECT * FROM events WHERE aggregate_id = $1',
        ['user123']
      );

      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('user.created');
      expect(events[0].event_data.username).toBe('test');
    });

    it('should clean database between tests', async () => {
      // Insert data
      await query(
        pool,
        `INSERT INTO users_projection (id, username, email, password_hash, state, instance_id, resource_owner, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        ['clean-test', 'cleanuser', 'clean@test.com', 'hash', 'active', 'test-instance', 'test-org']
      );

      // Manually clean
      await cleanDatabase(pool);

      // Verify data is gone
      const users = await query(pool, 'SELECT * FROM users_projection');
      expect(users).toHaveLength(0);
    });
  });

  describe('Multi-Tenant Data', () => {
    it('should handle multiple users in different instances', async () => {
      // Insert users in different instances
      await query(
        pool,
        `INSERT INTO users_projection (id, username, email, password_hash, state, instance_id, resource_owner, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        ['user1', 'user1', 'user1@test.com', 'hash1', 'active', 'instance1', 'org1']
      );

      await query(
        pool,
        `INSERT INTO users_projection (id, username, email, password_hash, state, instance_id, resource_owner, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        ['user2', 'user2', 'user2@test.com', 'hash2', 'active', 'instance2', 'org2']
      );

      // Retrieve users by instance
      const users = await query(pool, 'SELECT * FROM users_projection WHERE instance_id = $1', ['instance1']);

      expect(users).toHaveLength(1);
      expect(users[0].username).toBe('user1');
    });

    it('should link users to resource owners', async () => {
      // Create user with resource owner
      await query(
        pool,
        `INSERT INTO users_projection (id, username, email, password_hash, state, resource_owner, instance_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        ['user1', 'orguser', 'orguser@test.com', 'hash', 'active', 'test-org-link', 'test-instance']
      );

      // Retrieve user by resource owner
      const users = await query(
        pool,
        'SELECT * FROM users_projection WHERE resource_owner = $1',
        ['test-org-link']
      );

      expect(users).toHaveLength(1);
      expect(users[0].resource_owner).toBe('test-org-link');
    });
  });
});
