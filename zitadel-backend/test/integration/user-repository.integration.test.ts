/**
 * User Repository Integration Tests
 * 
 * Consolidated repository-level tests for:
 * - User CRUD operations
 * - User addresses
 * - User metadata
 * - Multi-tenant isolation
 * - Event sourcing integration
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
import { UserRepository } from '../../src/lib/repositories/user-repository';
import { UserAddressRepository } from '../../src/lib/repositories/user-address-repository';
import { UserMetadataRepository } from '../../src/lib/repositories/user-metadata-repository';

describe('User Repository Integration Tests', () => {
  let pool: DatabasePool;
  let userRepo: UserRepository;
  let addressRepo: UserAddressRepository;
  let metadataRepo: UserMetadataRepository;

  beforeAll(async () => {
    pool = await createTestDatabase();
    userRepo = new UserRepository(pool);
    addressRepo = new UserAddressRepository(pool);
    metadataRepo = new UserMetadataRepository(pool);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(pool);
  });

  // ========================================
  // SECTION 1: User CRUD Operations
  // ========================================

  describe('User Creation and Persistence', () => {
    it('should create user and persist to database', async () => {
      const user = await createTestUser(pool, {
        username: 'integrationuser',
        email: 'integration@test.com',
        password: 'SecurePass123!',
        firstName: 'Integration',
        lastName: 'Test',
      });

      expect(user.id).toBeDefined();
      expect(user.username).toBe('integrationuser');
      expect(user.email).toBe('integration@test.com');

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

      const result = await query(
        pool,
        'SELECT password_hash FROM users_projection WHERE id = $1',
        [user.id]
      );

      expect(result[0].password_hash).toBeDefined();
      expect(result[0].password_hash).not.toBe('MySecretPassword123!');
      expect(result[0].password_hash).toMatch(/^\$2[ab]\$/);
    });

    it('should prevent duplicate username', async () => {
      await createTestUser(pool, {
        username: 'duplicate',
        email: 'first@test.com',
      });

      await expect(
        createTestUser(pool, {
          username: 'duplicate',
          email: 'second@test.com',
        })
      ).rejects.toThrow();
    });

    it('should prevent duplicate email', async () => {
      await createTestUser(pool, {
        username: 'first',
        email: 'duplicate@test.com',
      });

      await expect(
        createTestUser(pool, {
          username: 'second',
          email: 'duplicate@test.com',
        })
      ).rejects.toThrow();
    });
  });

  describe('User Retrieval', () => {
    it('should retrieve user by ID', async () => {
      const testUser = await createTestUser(pool, {
        username: 'getbyid',
        email: 'getbyid@test.com',
      });

      const retrieved = await getTestUser(pool, testUser.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(testUser.id);
      expect(retrieved!.username).toBe('getbyid');
    });

    it('should retrieve user by username', async () => {
      await createTestUser(pool, {
        username: 'getbyusername',
        email: 'username@test.com',
      });

      const user = await userRepo.findByUsername('getbyusername');
      expect(user).not.toBeNull();
      expect(user!.username).toBe('getbyusername');
    });

    it('should retrieve user by email', async () => {
      await createTestUser(pool, {
        username: 'emailuser',
        email: 'findbyme@test.com',
      });

      const user = await userRepo.findByEmail('findbyme@test.com');
      expect(user).not.toBeNull();
      expect(user!.email).toBe('findbyme@test.com');
    });

    it('should return null for non-existent user', async () => {
      const user = await userRepo.findById('non-existent-id');
      expect(user).toBeNull();
    });
  });

  describe('User Updates', () => {
    it('should update user details', async () => {
      const testUser = await createTestUser(pool, {
        username: 'updateuser',
        email: 'old@test.com',
      });

      const updated = await userRepo.update(testUser.id, {
        email: 'new@test.com',
        firstName: 'Updated',
      });

      expect(updated).not.toBeNull();
      expect(updated!.email).toBe('new@test.com');
      expect(updated!.first_name).toBe('Updated');
    });

    it('should update user state', async () => {
      const testUser = await createTestUser(pool, {
        username: 'stateuser',
        email: 'state@test.com',
      });

      await userRepo.update(testUser.id, {
        state: 'inactive',
      });

      const updated = await userRepo.findById(testUser.id);
      expect(updated!.state).toBe('inactive');
    });
  });

  describe('User State Management', () => {
    it('should handle different user states', async () => {
      const activeUser = await createTestUser(pool, {
        username: 'active',
        state: UserState.ACTIVE,
      });

      const inactiveUser = await createTestUser(pool, {
        username: 'inactive',
        state: UserState.INACTIVE,
      });

      const lockedUser = await createTestUser(pool, {
        username: 'locked',
        state: UserState.LOCKED,
      });

      expect((await getTestUser(pool, activeUser.id))!.state).toBe('active');
      expect((await getTestUser(pool, inactiveUser.id))!.state).toBe('inactive');
      expect((await getTestUser(pool, lockedUser.id))!.state).toBe('locked');
    });
  });

  // ========================================
  // SECTION 2: Login Names Support
  // ========================================

  describe('Login Names Support', () => {
    it('should store preferred login name', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      const updated = await userRepo.update(user.id, {
        preferredLoginName: 'test@example.com',
      });

      expect(updated).toBeTruthy();
      expect(updated?.preferred_login_name).toBe('test@example.com');
    });

    it('should store login names array', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      const loginNames = ['testuser@org1.com', 'testuser@org2.com', 'testuser'];
      const updated = await userRepo.update(user.id, {
        loginNames: loginNames,
      });

      expect(updated).toBeTruthy();
      expect(updated?.login_names).toEqual(loginNames);
      expect(updated?.login_names?.length).toBe(3);
    });

    it('should support multi-org login scenarios', async () => {
      const user = await createTestUser(pool, {
        username: 'john.doe',
        email: 'john@example.com',
      });

      const loginNames = [
        'john.doe@acme.com',
        'jdoe@subsidiary.com',
        'john.doe',
        'john@example.com',
      ];

      await userRepo.update(user.id, {
        loginNames: loginNames,
        preferredLoginName: 'john.doe@acme.com',
      });

      const retrieved = await userRepo.findById(user.id);
      expect(retrieved?.preferred_login_name).toBe('john.doe@acme.com');
      expect(retrieved?.login_names).toContain('jdoe@subsidiary.com');
    });
  });

  // ========================================
  // SECTION 3: User Addresses
  // ========================================

  describe('User Addresses', () => {
    it('should create address for user', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      const address = await addressRepo.create({
        userId: user.id,
        instanceId: 'test-instance',
        country: 'US',
        locality: 'San Francisco',
        postalCode: '94102',
        region: 'CA',
        streetAddress: '123 Main St',
        addressType: 'primary',
        isPrimary: true,
      });

      expect(address).toBeTruthy();
      expect(address.user_id).toBe(user.id);
      expect(address.country).toBe('US');
      expect(address.locality).toBe('San Francisco');
      expect(address.is_primary).toBe(true);
    });

    it('should find all addresses for user', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      await addressRepo.create({
        userId: user.id,
        instanceId: 'test-instance',
        country: 'US',
        locality: 'San Francisco',
        addressType: 'primary',
        isPrimary: true,
      });

      await addressRepo.create({
        userId: user.id,
        instanceId: 'test-instance',
        country: 'US',
        locality: 'New York',
        addressType: 'billing',
        isPrimary: false,
      });

      const addresses = await addressRepo.findByUserId(user.id);
      expect(addresses.length).toBe(2);
      expect(addresses[0].is_primary).toBe(true);
    });

    it('should ensure only one primary address', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      await addressRepo.create({
        userId: user.id,
        instanceId: 'test-instance',
        country: 'US',
        locality: 'San Francisco',
        isPrimary: true,
      });

      const address2 = await addressRepo.create({
        userId: user.id,
        instanceId: 'test-instance',
        country: 'US',
        locality: 'New York',
        isPrimary: true,
      });

      const addresses = await addressRepo.findByUserId(user.id);
      const primaryAddresses = addresses.filter(a => a.is_primary);
      
      expect(primaryAddresses.length).toBe(1);
      expect(primaryAddresses[0].id).toBe(address2.id);
    });

    it('should find primary address', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      await addressRepo.create({
        userId: user.id,
        instanceId: 'test-instance',
        country: 'US',
        locality: 'San Francisco',
        isPrimary: true,
      });

      const primary = await addressRepo.findPrimaryAddress(user.id, 'test-instance');
      expect(primary).toBeTruthy();
      expect(primary?.is_primary).toBe(true);
      expect(primary?.locality).toBe('San Francisco');
    });

    it('should update address', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      const address = await addressRepo.create({
        userId: user.id,
        instanceId: 'test-instance',
        country: 'US',
        locality: 'San Francisco',
      });

      const updated = await addressRepo.update(address.id, {
        postalCode: '94103',
        streetAddress: '456 Oak Ave',
      });

      expect(updated?.postal_code).toBe('94103');
      expect(updated?.street_address).toBe('456 Oak Ave');
      expect(updated?.locality).toBe('San Francisco');
    });

    it('should delete address', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      const address = await addressRepo.create({
        userId: user.id,
        instanceId: 'test-instance',
        country: 'US',
      });

      const deleted = await addressRepo.delete(address.id);
      expect(deleted).toBe(true);

      const found = await addressRepo.findById(address.id);
      expect(found).toBeNull();
    });

    it('should support formatted address', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      const formattedAddress = '123 Main St\nSan Francisco, CA 94102\nUnited States';
      
      const address = await addressRepo.create({
        userId: user.id,
        instanceId: 'test-instance',
        streetAddress: '123 Main St',
        locality: 'San Francisco',
        region: 'CA',
        postalCode: '94102',
        country: 'US',
        formattedAddress: formattedAddress,
      });

      expect(address.formatted_address).toBe(formattedAddress);
    });
  });

  // ========================================
  // SECTION 4: User Metadata
  // ========================================

  describe('User Metadata', () => {
    it('should set metadata for user', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      const metadata = await metadataRepo.set({
        userId: user.id,
        instanceId: 'test-instance',
        key: 'department',
        value: { name: 'Engineering', code: 'ENG' },
      });

      expect(metadata).toBeTruthy();
      expect(metadata.user_id).toBe(user.id);
      expect(metadata.metadata_key).toBe('department');
      expect(metadata.metadata_value).toMatchObject({ name: 'Engineering', code: 'ENG' });
    });

    it('should get metadata by key', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      await metadataRepo.set({
        userId: user.id,
        instanceId: 'test-instance',
        key: 'employee_id',
        value: 'EMP12345',
      });

      const value = await metadataRepo.get(user.id, 'employee_id');
      expect(value).toBe('EMP12345');
    });

    it('should get all metadata for user', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      await metadataRepo.set({
        userId: user.id,
        instanceId: 'test-instance',
        key: 'department',
        value: 'Engineering',
      });

      await metadataRepo.set({
        userId: user.id,
        instanceId: 'test-instance',
        key: 'employee_id',
        value: 'EMP12345',
      });

      const allMetadata = await metadataRepo.getAll(user.id);
      expect(allMetadata).toHaveProperty('department');
      expect(allMetadata).toHaveProperty('employee_id');
      expect(allMetadata.department).toBe('Engineering');
      expect(allMetadata.employee_id).toBe('EMP12345');
    });

    it('should upsert metadata (update existing)', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      await metadataRepo.set({
        userId: user.id,
        instanceId: 'test-instance',
        key: 'status',
        value: 'active',
      });

      await metadataRepo.set({
        userId: user.id,
        instanceId: 'test-instance',
        key: 'status',
        value: 'inactive',
      });

      const value = await metadataRepo.get(user.id, 'status');
      expect(value).toBe('inactive');

      const allMetadata = await metadataRepo.findByUserId(user.id);
      const statusEntries = allMetadata.filter(m => m.metadata_key === 'status');
      expect(statusEntries.length).toBe(1);
    });

    it('should support metadata types', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      await metadataRepo.set({
        userId: user.id,
        instanceId: 'test-instance',
        key: 'custom_field',
        value: 'custom_value',
        type: 'custom',
      });

      await metadataRepo.set({
        userId: user.id,
        instanceId: 'test-instance',
        key: 'system_field',
        value: 'system_value',
        type: 'system',
      });

      const customMetadata = await metadataRepo.findByUserId(user.id, 'custom');
      const systemMetadata = await metadataRepo.findByUserId(user.id, 'system');

      expect(customMetadata.length).toBe(1);
      expect(systemMetadata.length).toBe(1);
      expect(customMetadata[0].metadata_type).toBe('custom');
      expect(systemMetadata[0].metadata_type).toBe('system');
    });

    it('should support scoped metadata', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      await metadataRepo.set({
        userId: user.id,
        instanceId: 'test-instance',
        key: 'role',
        value: 'admin',
        scope: 'app-123',
      });

      await metadataRepo.set({
        userId: user.id,
        instanceId: 'test-instance',
        key: 'role',
        value: 'viewer',
        scope: 'app-456',
      });

      const adminRole = await metadataRepo.get(user.id, 'role', 'app-123');
      const viewerRole = await metadataRepo.get(user.id, 'role', 'app-456');

      expect(adminRole).toBe('admin');
      expect(viewerRole).toBe('viewer');
    });

    it('should delete metadata by key', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      await metadataRepo.set({
        userId: user.id,
        instanceId: 'test-instance',
        key: 'temp_key',
        value: 'temp_value',
      });

      const deleted = await metadataRepo.deleteByKey(user.id, 'temp_key');
      expect(deleted).toBe(true);

      const value = await metadataRepo.get(user.id, 'temp_key');
      expect(value).toBeNull();
    });

    it('should store complex JSON metadata', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      const complexValue = {
        preferences: {
          theme: 'dark',
          language: 'en',
          notifications: {
            email: true,
            sms: false,
          },
        },
        tags: ['developer', 'senior', 'backend'],
      };

      await metadataRepo.set({
        userId: user.id,
        instanceId: 'test-instance',
        key: 'user_preferences',
        value: complexValue,
      });

      const retrieved = await metadataRepo.get(user.id, 'user_preferences');
      expect(retrieved).toMatchObject(complexValue);
      expect(retrieved.preferences.theme).toBe('dark');
      expect(retrieved.tags).toContain('developer');
    });
  });

  // ========================================
  // SECTION 5: Cascade Deletes & Multi-Tenant
  // ========================================

  describe('Cascade Deletes', () => {
    it('should delete addresses when user is deleted', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      await addressRepo.create({
        userId: user.id,
        instanceId: 'test-instance',
        country: 'US',
      });

      await pool.query('DELETE FROM users_projection WHERE id = $1', [user.id]);

      const addresses = await addressRepo.findByUserId(user.id);
      expect(addresses.length).toBe(0);
    });

    it('should delete metadata when user is deleted', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      await metadataRepo.set({
        userId: user.id,
        instanceId: 'test-instance',
        key: 'test_key',
        value: 'test_value',
      });

      await pool.query('DELETE FROM users_projection WHERE id = $1', [user.id]);

      const metadata = await metadataRepo.findByUserId(user.id);
      expect(metadata.length).toBe(0);
    });
  });

  // ========================================
  // SECTION 6: Multi-Tenant Support
  // ========================================

  describe('Multi-Tenant User Management', () => {
    it('should create users in different organizations', async () => {
      const org1 = await createTestOrg(pool, { name: 'Org 1' });
      const org2 = await createTestOrg(pool, { name: 'Org 2' });

      const user1 = await createTestUser(pool, {
        username: 'user1',
        email: 'user1@org1.com',
        orgId: org1.id,
      });

      const user2 = await createTestUser(pool, {
        username: 'user2',
        email: 'user2@org2.com',
        orgId: org2.id,
      });

      const dbUser1 = await getTestUser(pool, user1.id);
      const dbUser2 = await getTestUser(pool, user2.id);

      expect(dbUser1!.resource_owner).toBe(org1.id);
      expect(dbUser2!.resource_owner).toBe(org2.id);
    });

    it('should allow same username in different orgs', async () => {
      const org1 = await createTestOrg(pool, { name: 'Org 1' });
      const org2 = await createTestOrg(pool, { name: 'Org 2' });

      await createTestUser(pool, {
        username: 'sameuser',
        email: 'user1@test.com',
        orgId: org1.id,
      });

      await createTestUser(pool, {
        username: 'sameuser',
        email: 'user2@test.com',
        orgId: org2.id,
      });

      const users = await query(
        pool,
        'SELECT * FROM users_projection WHERE username = $1',
        ['sameuser']
      );

      expect(users.length).toBe(2);
      expect(users[0].resource_owner).not.toBe(users[1].resource_owner);
    });
  });

  // ========================================
  // SECTION 7: Event Sourcing Integration
  // ========================================

  describe('Event Sourcing Integration', () => {
    it('should store user creation event', async () => {
      const userId = generateSnowflakeId();

      await createTestEvent(pool, {
        aggregateType: 'user',
        aggregateId: userId,
        eventType: 'user.created',
        eventData: {
          username: 'eventuser',
          email: 'event@test.com',
        },
      });

      const events = await getTestEvents(pool, 'user', userId);
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('user.created');
      expect(events[0].aggregateType).toBe('user');
    });

    it('should store multiple events for same aggregate', async () => {
      const userId = generateSnowflakeId();

      await createTestEvent(pool, {
        aggregateType: 'user',
        aggregateId: userId,
        eventType: 'user.created',
        eventData: { username: 'user' },
        sequence: 0,
      });

      await createTestEvent(pool, {
        aggregateType: 'user',
        aggregateId: userId,
        eventType: 'user.updated',
        eventData: { email: 'new@test.com' },
        sequence: 1,
      });

      const events = await getTestEvents(pool, 'user', userId);
      expect(events.length).toBe(2);
      expect(events[0].eventType).toBe('user.created');
      expect(events[1].eventType).toBe('user.updated');
    });
  });

});
