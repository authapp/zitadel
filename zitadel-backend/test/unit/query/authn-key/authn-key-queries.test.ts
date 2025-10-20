/**
 * Unit tests for AuthNKeyQueries
 * Tests machine user authentication key lookups
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuthNKeyQueries } from '../../../../src/lib/query/authn-key/authn-key-queries';
import { AuthNKeyType } from '../../../../src/lib/query/authn-key/authn-key-types';

describe('AuthNKeyQueries', () => {
  let queries: AuthNKeyQueries;
  let mockDatabase: any;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    };
    queries = new AuthNKeyQueries(mockDatabase);
  });

  describe('searchAuthNKeys', () => {
    it('should search keys without filters', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '2' });
      mockDatabase.query.mockResolvedValue({
        rows: [
          {
            id: 'key-1',
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: 1,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
            aggregate_id: 'user-123',
            object_id: 'key-1',
            expiration: new Date('2025-01-01'),
            type: AuthNKeyType.JSON,
          },
          {
            id: 'key-2',
            creation_date: new Date('2024-01-02'),
            change_date: new Date('2024-01-02'),
            sequence: 2,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
            aggregate_id: 'user-456',
            object_id: 'key-2',
            expiration: new Date('2025-01-02'),
            type: AuthNKeyType.JSON,
          },
        ],
      });

      const result = await queries.searchAuthNKeys({});

      expect(result.total).toBe(2);
      expect(result.keys).toHaveLength(2);
      expect(result.keys[0].id).toBe('key-1');
      expect(result.keys[1].id).toBe('key-2');
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should search keys by instance ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({
        rows: [
          {
            id: 'key-1',
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: 1,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
            aggregate_id: 'user-123',
            object_id: 'key-1',
            expiration: new Date('2025-01-01'),
            type: AuthNKeyType.JSON,
          },
        ],
      });

      const result = await queries.searchAuthNKeys({
        instanceID: 'inst-123',
      });

      expect(result.total).toBe(1);
      expect(result.keys).toHaveLength(1);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE instance_id = $1'),
        expect.arrayContaining(['inst-123'])
      );
    });

    it('should search keys by aggregate ID (user)', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await queries.searchAuthNKeys({
        aggregateID: 'user-123',
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE aggregate_id = $1'),
        expect.arrayContaining(['user-123'])
      );
    });

    it('should search keys with multiple filters', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await queries.searchAuthNKeys({
        instanceID: 'inst-123',
        resourceOwner: 'org-123',
        aggregateID: 'user-123',
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE instance_id = $1 AND resource_owner = $2 AND aggregate_id = $3'),
        expect.arrayContaining(['inst-123', 'org-123', 'user-123'])
      );
    });

    it('should support pagination', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '100' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await queries.searchAuthNKeys({
        limit: 20,
        offset: 40,
      });

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(40);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([20, 40])
      );
    });

    it('should return empty result when no keys found', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '0' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await queries.searchAuthNKeys({
        instanceID: 'non-existent',
      });

      expect(result.total).toBe(0);
      expect(result.keys).toHaveLength(0);
    });
  });

  describe('searchAuthNKeysData', () => {
    it('should search keys with public key data', async () => {
      const publicKey = Buffer.from('test-public-key');
      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({
        rows: [
          {
            id: 'key-1',
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: 1,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
            aggregate_id: 'user-123',
            object_id: 'key-1',
            expiration: new Date('2025-01-01'),
            type: AuthNKeyType.JSON,
            public_key: publicKey,
          },
        ],
      });

      const result = await queries.searchAuthNKeysData({
        instanceID: 'inst-123',
      });

      expect(result.total).toBe(1);
      expect(result.keys).toHaveLength(1);
      expect(result.keys[0].publicKey).toEqual(publicKey);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('public_key'),
        expect.anything()
      );
    });

    it('should include all key fields plus public key', async () => {
      const publicKey = Buffer.from('another-public-key');
      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({
        rows: [
          {
            id: 'key-2',
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: 1,
            resource_owner: 'org-456',
            instance_id: 'inst-456',
            aggregate_id: 'user-456',
            object_id: 'key-2',
            expiration: new Date('2025-01-01'),
            type: AuthNKeyType.JSON,
            public_key: publicKey,
          },
        ],
      });

      const result = await queries.searchAuthNKeysData({
        aggregateID: 'user-456',
      });

      expect(result.keys[0]).toMatchObject({
        id: 'key-2',
        aggregateID: 'user-456',
        publicKey: publicKey,
      });
    });
  });

  describe('getAuthNKeyByIDWithPermission', () => {
    it('should return key when user has permission', async () => {
      mockDatabase.queryOne.mockResolvedValue({
        id: 'key-1',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        aggregate_id: 'user-123',
        object_id: 'key-1',
        expiration: new Date('2025-01-01'),
        type: AuthNKeyType.JSON,
      });

      const result = await queries.getAuthNKeyByIDWithPermission('key-1', 'user-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('key-1');
      expect(result?.aggregateID).toBe('user-123');
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('k.aggregate_id = $2'),
        ['key-1', 'user-123']
      );
    });

    it('should return null when user does not have permission', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getAuthNKeyByIDWithPermission('key-1', 'wrong-user');

      expect(result).toBeNull();
    });

    it('should filter by instance ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({
        id: 'key-1',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        aggregate_id: 'user-123',
        object_id: 'key-1',
        expiration: new Date('2025-01-01'),
        type: AuthNKeyType.JSON,
      });

      const result = await queries.getAuthNKeyByIDWithPermission('key-1', 'user-123', 'inst-123');

      expect(result).toBeDefined();
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('k.instance_id = $2'),
        ['key-1', 'inst-123', 'user-123']
      );
    });
  });

  describe('getAuthNKeyByID', () => {
    it('should return key by ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({
        id: 'key-1',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        aggregate_id: 'user-123',
        object_id: 'key-1',
        expiration: new Date('2025-01-01'),
        type: AuthNKeyType.JSON,
      });

      const result = await queries.getAuthNKeyByID('key-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('key-1');
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['key-1']
      );
    });

    it('should return key by ID with instance filter', async () => {
      mockDatabase.queryOne.mockResolvedValue({
        id: 'key-1',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        aggregate_id: 'user-123',
        object_id: 'key-1',
        expiration: new Date('2025-01-01'),
        type: AuthNKeyType.JSON,
      });

      const result = await queries.getAuthNKeyByID('key-1', 'inst-123');

      expect(result).toBeDefined();
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('instance_id = $2'),
        ['key-1', 'inst-123']
      );
    });

    it('should return null when key not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getAuthNKeyByID('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getAuthNKeyUser', () => {
    it('should return user ID for a key', async () => {
      mockDatabase.queryOne.mockResolvedValue({ aggregate_id: 'user-123' });

      const result = await queries.getAuthNKeyUser('key-1');

      expect(result).toBe('user-123');
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT aggregate_id'),
        ['key-1']
      );
    });

    it('should return user ID with instance filter', async () => {
      mockDatabase.queryOne.mockResolvedValue({ aggregate_id: 'user-456' });

      const result = await queries.getAuthNKeyUser('key-2', 'inst-123');

      expect(result).toBe('user-456');
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('instance_id = $2'),
        ['key-2', 'inst-123']
      );
    });

    it('should return null when key not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getAuthNKeyUser('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getAuthNKeyPublicKeyByIDAndIdentifier', () => {
    it('should return public key buffer', async () => {
      const publicKey = Buffer.from('test-public-key-data');
      mockDatabase.queryOne.mockResolvedValue({ public_key: publicKey });

      const result = await queries.getAuthNKeyPublicKeyByIDAndIdentifier('key-1', 'key-1');

      expect(result).toEqual(publicKey);
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT public_key'),
        ['key-1', 'key-1']
      );
    });

    it('should filter by instance ID', async () => {
      const publicKey = Buffer.from('another-key');
      mockDatabase.queryOne.mockResolvedValue({ public_key: publicKey });

      const result = await queries.getAuthNKeyPublicKeyByIDAndIdentifier('key-2', 'key-2', 'inst-123');

      expect(result).toEqual(publicKey);
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('instance_id = $3'),
        ['key-2', 'key-2', 'inst-123']
      );
    });

    it('should return null when key not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getAuthNKeyPublicKeyByIDAndIdentifier('non-existent', 'non-existent');

      expect(result).toBeNull();
    });

    it('should match by both ID and identifier', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      await queries.getAuthNKeyPublicKeyByIDAndIdentifier('key-1', 'different-id');

      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('id = $1'),
        expect.arrayContaining(['key-1', 'different-id'])
      );
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('object_id = $2'),
        expect.anything()
      );
    });
  });

  describe('mapRowToAuthNKey', () => {
    it('should map all fields correctly', async () => {
      mockDatabase.queryOne.mockResolvedValue({
        id: 'key-123',
        creation_date: new Date('2024-01-01T10:00:00Z'),
        change_date: new Date('2024-01-02T10:00:00Z'),
        sequence: '42',
        resource_owner: 'org-999',
        instance_id: 'inst-999',
        aggregate_id: 'user-999',
        object_id: 'key-123',
        expiration: new Date('2025-01-01T10:00:00Z'),
        type: AuthNKeyType.JSON,
      });

      const result = await queries.getAuthNKeyByID('key-123');

      expect(result).toMatchObject({
        id: 'key-123',
        resourceOwner: 'org-999',
        instanceID: 'inst-999',
        aggregateID: 'user-999',
        objectID: 'key-123',
        type: AuthNKeyType.JSON,
      });
      expect(result?.sequence).toBe(42n);
    });

    it('should handle UNSPECIFIED type', async () => {
      mockDatabase.queryOne.mockResolvedValue({
        id: 'key-1',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        aggregate_id: 'user-123',
        object_id: 'key-1',
        expiration: new Date('2025-01-01'),
        type: null,
      });

      const result = await queries.getAuthNKeyByID('key-1');

      expect(result?.type).toBe(AuthNKeyType.UNSPECIFIED);
    });
  });
});
