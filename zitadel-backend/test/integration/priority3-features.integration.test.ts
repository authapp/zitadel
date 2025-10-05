/**
 * Priority 3 Features Integration Tests
 * 
 * Tests for login names, addresses, and metadata support
 */

import { DatabasePool } from '../../src/lib/database';
import { createTestDatabase, cleanDatabase, closeTestDatabase } from './setup';
import { createTestUser } from './fixtures';
import { UserRepository } from '../../src/lib/repositories/user-repository';
import { UserAddressRepository } from '../../src/lib/repositories/user-address-repository';
import { UserMetadataRepository } from '../../src/lib/repositories/user-metadata-repository';

describe('Integration: Priority 3 Features', () => {
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

  describe('Login Names Support', () => {
    it('should store preferred login name', async () => {
      const user = await createTestUser(pool, {
        username: 'testuser',
        email: 'test@example.com',
      });

      // Update with preferred login name
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

      // Update with login names array
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

      // User can have different login names in different orgs
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
      expect(addresses[0].is_primary).toBe(true); // Primary comes first
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

      // Create second primary address - should unset first
      const address2 = await addressRepo.create({
        userId: user.id,
        instanceId: 'test-instance',
        country: 'US',
        locality: 'New York',
        isPrimary: true,
      });

      // Check that only address2 is primary
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
      expect(updated?.locality).toBe('San Francisco'); // Unchanged
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

      // Set initial value
      await metadataRepo.set({
        userId: user.id,
        instanceId: 'test-instance',
        key: 'status',
        value: 'active',
      });

      // Update value
      await metadataRepo.set({
        userId: user.id,
        instanceId: 'test-instance',
        key: 'status',
        value: 'inactive',
      });

      const value = await metadataRepo.get(user.id, 'status');
      expect(value).toBe('inactive');

      // Should only have one entry
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

      // Set metadata for different scopes
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

      // Delete user
      await pool.query('DELETE FROM users_projection WHERE id = $1', [user.id]);

      // Addresses should be deleted (cascade)
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

      // Delete user
      await pool.query('DELETE FROM users_projection WHERE id = $1', [user.id]);

      // Metadata should be deleted (cascade)
      const metadata = await metadataRepo.findByUserId(user.id);
      expect(metadata.length).toBe(0);
    });
  });
});
