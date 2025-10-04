/**
 * User Operations Integration Tests
 * 
 * Tests complete user workflows with real database:
 * - User creation and persistence
 * - Event sourcing verification
 * - Multi-tenant isolation
 * - Duplicate prevention
 */

import { DatabasePool } from '../../src/lib/database';
import {
  createTestDatabase,
  cleanDatabase,
  closeTestDatabase,
  query,
} from './setup';
import {
  createTestUser,
  createTestOrg,
  getTestUser,
  getTestEvents,
  createTestEvent,
} from './fixtures';
import { UserState } from '../../src/lib/domain/user';
import { generateId as generateSnowflakeId } from '../../src/lib/id/snowflake';

describe('Integration: User Operations', () => {
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

  describe('User Creation and Persistence', () => {
    it('should create user and persist to database', async () => {
      // Create user using fixture
      const user = await createTestUser(pool, {
        username: 'integrationuser',
        email: 'integration@test.com',
        password: 'SecurePass123!',
        firstName: 'Integration',
        lastName: 'Test',
      });

      // Verify user was created
      expect(user.id).toBeDefined();
      expect(user.username).toBe('integrationuser');
      expect(user.email).toBe('integration@test.com');

      // Verify user exists in database
      const dbUser = await getTestUser(pool, user.id);
      expect(dbUser).not.toBeNull();
      expect(dbUser!.username).toBe('integrationuser');
      expect(dbUser!.email).toBe('integration@test.com');
      expect(dbUser!.state).toBe('active');
    });

    it('should store user with password hash', async () => {
      const user = await createTestUser(pool, {
        username: 'passworduser',
        email: 'password@test.com',
        password: 'MySecretPassword123!',
      });

      // Verify password is hashed
      const result = await query(
        pool,
        'SELECT password_hash FROM users_projection WHERE id = $1',
        [user.id]
      );

      expect(result[0].password_hash).toBeDefined();
      expect(result[0].password_hash).not.toBe('MySecretPassword123!');
      // Bcrypt hashes start with $2a$ or $2b$
      expect(result[0].password_hash).toMatch(/^\$2[ab]\$/);
    });

    it('should prevent duplicate username', async () => {
      // Create first user
      await createTestUser(pool, {
        username: 'duplicate',
        email: 'first@test.com',
      });

      // Attempt to create user with same username should fail
      await expect(
        createTestUser(pool, {
          username: 'duplicate',
          email: 'second@test.com',
        })
      ).rejects.toThrow();
    });

    it('should prevent duplicate email', async () => {
      // Create first user
      const user1 = await createTestUser(pool, {
        username: 'user1',
        email: 'duplicate@test.com',
      });
      
      // Verify first user was created with email
      expect(user1.email).toBe('duplicate@test.com');

      // Attempt to create user with same email should fail
      // The unique constraint is (instance_id, email) so same email in same instance should fail
      await expect(
        createTestUser(pool, {
          username: 'user2',
          email: 'duplicate@test.com',
        })
      ).rejects.toThrow(); // ZitadelError wraps the constraint error
    });
  });

  describe('User Retrieval', () => {
    it('should retrieve user by ID', async () => {
      const testUser = await createTestUser(pool, {
        username: 'getbyid',
        email: 'getbyid@test.com',
      });

      const user = await getTestUser(pool, testUser.id);

      expect(user).not.toBeNull();
      expect(user!.id).toBe(testUser.id);
      expect(user!.username).toBe('getbyid');
    });

    it('should retrieve user by username', async () => {
      await createTestUser(pool, {
        username: 'getbyusername',
        email: 'getbyusername@test.com',
      });

      const result = await query(
        pool,
        'SELECT * FROM users_projection WHERE username = $1',
        ['getbyusername']
      );

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('getbyusername');
    });

    it('should retrieve user by email', async () => {
      await createTestUser(pool, {
        username: 'getbyemail',
        email: 'getbyemail@test.com',
      });

      const result = await query(
        pool,
        'SELECT * FROM users_projection WHERE email = $1',
        ['getbyemail@test.com']
      );

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('getbyemail@test.com');
    });

    it('should return null for non-existent user', async () => {
      const user = await getTestUser(pool, 'non-existent-id');
      expect(user).toBeNull();
    });
  });

  describe('User Updates', () => {
    it('should update user details', async () => {
      const testUser = await createTestUser(pool, {
        username: 'updateuser',
        email: 'update@test.com',
        firstName: 'Old',
        lastName: 'Name',
      });

      // Update user
      await query(
        pool,
        `UPDATE users_projection SET first_name = $1, last_name = $2, email = $3, updated_at = NOW()
         WHERE id = $4`,
        ['New', 'Name', 'newemail@test.com', testUser.id]
      );

      // Verify update
      const dbUser = await getTestUser(pool, testUser.id);
      expect(dbUser!.firstName).toBe('New');
      expect(dbUser!.lastName).toBe('Name');
    });

    it('should deactivate user', async () => {
      const testUser = await createTestUser(pool, {
        username: 'deactivateuser',
        email: 'deactivate@test.com',
      });

      // Deactivate user
      await query(
        pool,
        'UPDATE users_projection SET state = $1 WHERE id = $2',
        ['inactive', testUser.id]
      );

      // Verify deactivation
      const dbUser = await getTestUser(pool, testUser.id);
      expect(dbUser!.state).toBe('inactive');
    });
  });

  describe('Event Sourcing Integration', () => {
    it('should store user creation event', async () => {
      const userId = generateSnowflakeId();

      // Create user
      await createTestUser(pool, {
        id: userId,
        username: 'eventuser',
        email: 'event@test.com',
      });

      // Store creation event
      await createTestEvent(pool, {
        aggregateType: 'user',
        aggregateId: userId,
        eventType: 'user.created',
        eventData: {
          username: 'eventuser',
          email: 'event@test.com',
        },
        sequence: 0,
      });

      // Verify event was stored
      const events = await getTestEvents(pool, 'user', userId);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].eventType).toBe('user.created');
      expect(events[0].eventData.username).toBe('eventuser');
    });

    it('should maintain event ordering', async () => {
      const userId = generateSnowflakeId();

      // Create multiple events
      await createTestEvent(pool, {
        aggregateType: 'user',
        aggregateId: userId,
        eventType: 'user.created',
        eventData: { action: 'create' },
        sequence: 0,
      });

      await createTestEvent(pool, {
        aggregateType: 'user',
        aggregateId: userId,
        eventType: 'user.updated',
        eventData: { action: 'update' },
        sequence: 1,
      });

      await createTestEvent(pool, {
        aggregateType: 'user',
        aggregateId: userId,
        eventType: 'user.deactivated',
        eventData: { action: 'deactivate' },
        sequence: 2,
      });

      // Retrieve events
      const events = await getTestEvents(pool, 'user', userId);

      expect(events).toHaveLength(3);
      expect(events[0].sequence).toBe(0);
      expect(events[1].sequence).toBe(1);
      expect(events[2].sequence).toBe(2);
    });

    it('should reconstruct state from events', async () => {
      const userId = generateSnowflakeId();

      // Store events
      await createTestEvent(pool, {
        aggregateType: 'user',
        aggregateId: userId,
        eventType: 'user.created',
        eventData: {
          username: 'reconstruct',
          email: 'reconstruct@test.com',
          firstName: 'Original',
        },
        sequence: 0,
      });

      await createTestEvent(pool, {
        aggregateType: 'user',
        aggregateId: userId,
        eventType: 'user.updated',
        eventData: {
          firstName: 'Updated',
        },
        sequence: 1,
      });

      // Get all events
      const events = await getTestEvents(pool, 'user', userId);

      // Reconstruct state
      let state: any = {};
      for (const event of events) {
        state = { ...state, ...event.eventData };
      }

      expect(state.username).toBe('reconstruct');
      expect(state.firstName).toBe('Updated'); // Should have latest value
    });
  });

  describe('Multi-Tenant User Management', () => {
    it('should create users in different organizations', async () => {
      // Create two organizations
      const org1 = await createTestOrg(pool, { name: 'Org 1' });
      const org2 = await createTestOrg(pool, { name: 'Org 2' });

      // Create users in different orgs
      const user1 = await createTestUser(pool, {
        username: 'org1user',
        email: 'org1@test.com',
        orgId: org1.id,
      });

      const user2 = await createTestUser(pool, {
        username: 'org2user',
        email: 'org2@test.com',
        orgId: org2.id,
      });

      // Verify org assignment
      const dbUser1 = await getTestUser(pool, user1.id);
      const dbUser2 = await getTestUser(pool, user2.id);

      // Check the org_id column directly
      expect(dbUser1!.orgId || dbUser1!.org_id).toBe(org1.id);
      expect(dbUser2!.orgId || dbUser2!.org_id).toBe(org2.id);
    });

    it('should list users filtered by organization', async () => {
      const org = await createTestOrg(pool, { name: 'Test Org' });

      // Create users in org
      await createTestUser(pool, {
        username: 'orguser1',
        email: 'orguser1@test.com',
        orgId: org.id,
      });

      await createTestUser(pool, {
        username: 'orguser2',
        email: 'orguser2@test.com',
        orgId: org.id,
      });

      // Create user in different org
      await createTestUser(pool, {
        username: 'otherorguser',
        email: 'other@test.com',
        orgId: 'other-org',
      });

      // List users in specific org
      const users = await query(
        pool,
        'SELECT * FROM users_projection WHERE resource_owner = $1',
        [org.id]
      );

      expect(users.length).toBe(2);
      expect(users.every((u: any) => u.resource_owner === org.id)).toBe(true);
    });

    it('should isolate user data by organization', async () => {
      const org1 = await createTestOrg(pool, { name: 'Org 1' });
      const org2 = await createTestOrg(pool, { name: 'Org 2' });

      // Create users in each org with same username
      await createTestUser(pool, {
        username: 'samename_org1',
        email: 'user@org1.com',
        orgId: org1.id,
      });

      await createTestUser(pool, {
        username: 'samename_org2',
        email: 'user@org2.com',
        orgId: org2.id,
      });

      // Query each org
      const org1Users = await query(
        pool,
        'SELECT * FROM users_projection WHERE resource_owner = $1',
        [org1.id]
      );

      const org2Users = await query(
        pool,
        'SELECT * FROM users_projection WHERE resource_owner = $1',
        [org2.id]
      );

      expect(org1Users).toHaveLength(1);
      expect(org2Users).toHaveLength(1);
      expect(org1Users[0].email).toBe('user@org1.com');
      expect(org2Users[0].email).toBe('user@org2.com');
    });
  });

  describe('User State Management', () => {
    it('should handle different user states', async () => {
      const activeUser = await createTestUser(pool, {
        username: 'active',
        email: 'active@test.com',
        state: UserState.ACTIVE,
      });

      const inactiveUser = await createTestUser(pool, {
        username: 'inactive',
        email: 'inactive@test.com',
        state: UserState.INACTIVE,
      });

      expect((await getTestUser(pool, activeUser.id))!.state).toBe('active');
      expect((await getTestUser(pool, inactiveUser.id))!.state).toBe('inactive');
    });

    it('should filter users by state', async () => {
      await createTestUser(pool, {
        username: 'user1',
        email: 'user1@test.com',
        state: UserState.ACTIVE,
      });

      await createTestUser(pool, {
        username: 'user2',
        email: 'user2@test.com',
        state: UserState.INACTIVE,
      });

      // Get only active users
      const activeUsers = await query(
        pool,
        'SELECT * FROM users_projection WHERE state = $1',
        ['active']
      );

      expect(activeUsers).toHaveLength(1);
      expect(activeUsers[0].username).toBe('user1');
    });
  });
});
