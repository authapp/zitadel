/**
 * Unit tests for AccessTokenQueries
 * Tests OAuth/OIDC access token validation and retrieval
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AccessTokenQueries } from '../../../../src/lib/query/access-token/access-token-queries';

describe('AccessTokenQueries', () => {
  let queries: AccessTokenQueries;
  let mockDatabase: any;
  let mockEventstore: any;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    };
    mockEventstore = {
      query: jest.fn(),
    };
    // Set defaults
    mockDatabase.queryOne.mockResolvedValue(null);
    mockEventstore.query.mockResolvedValue([]);
    
    queries = new AccessTokenQueries(mockDatabase, mockEventstore);
  });

  describe('getActiveAccessTokenByID', () => {
    it('should return active token when valid and not expired', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      
      const tokenData = {
        id: 'token-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        user_id: 'user-456',
        application_id: 'app-789',
        token: 'access_token_xyz',
        scopes: JSON.stringify(['openid', 'profile']),
        audience: JSON.stringify(['api.example.com']),
        expiration: futureDate,
        refresh_token_id: null,
        actor_user_id: null,
        actor_issuer: null,
        reason: undefined, // Changed from null to undefined
      };
      
      // Set mock return value
      mockDatabase.queryOne.mockResolvedValue(tokenData);

      const result = await queries.getActiveAccessTokenByID('token-123', 'inst-123');
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.isActive).toBe(true);
        expect(result.id).toBe('token-123');
        expect(result.userID).toBe('user-456');
        expect(result.scopes).toEqual(['openid', 'profile']);
      }
    });

    it('should return null for expired token', async () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      
      mockDatabase.queryOne.mockResolvedValue({
        id: 'token-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        user_id: 'user-456',
        application_id: 'app-789',
        token: 'access_token_xyz',
        scopes: JSON.stringify([]),
        audience: JSON.stringify([]),
        expiration: pastDate,
      });

      const result = await queries.getActiveAccessTokenByID('token-123', 'inst-123');

      expect(result).toBeNull();
    });

    it('should return null for revoked token', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      
      mockDatabase.queryOne.mockResolvedValue({
        id: 'token-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        user_id: 'user-456',
        application_id: 'app-789',
        token: 'access_token_xyz',
        scopes: JSON.stringify([]),
        audience: JSON.stringify([]),
        expiration: futureDate,
        reason: 1, // Revoked
      });

      const result = await queries.getActiveAccessTokenByID('token-123', 'inst-123');

      expect(result).toBeNull();
    });

    it('should return null when token not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);
      mockEventstore.query.mockResolvedValue([]);

      const result = await queries.getActiveAccessTokenByID('token-123', 'inst-123');

      expect(result).toBeNull();
    });
  });

  describe('getAccessTokenByID', () => {
    it('should return token even if expired', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      
      mockDatabase.queryOne.mockResolvedValue({
        id: 'token-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        user_id: 'user-456',
        application_id: 'app-789',
        token: 'access_token_xyz',
        scopes: JSON.stringify(['openid']),
        audience: JSON.stringify([]),
        expiration: pastDate,
      });

      const result = await queries.getAccessTokenByID('token-123', 'inst-123');

      expect(result).toBeDefined();
      expect(result!.id).toBe('token-123');
      expect(result!.expiration).toEqual(pastDate);
    });

    it('should return token even if revoked', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      
      mockDatabase.queryOne.mockResolvedValue({
        id: 'token-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        user_id: 'user-456',
        application_id: 'app-789',
        token: 'access_token_xyz',
        scopes: JSON.stringify([]),
        audience: JSON.stringify([]),
        expiration: futureDate,
        reason: 1,
      });

      const result = await queries.getAccessTokenByID('token-123', 'inst-123');

      expect(result).toBeDefined();
      expect(result!.reason).toBe(1);
    });

    it('should return null when token not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);
      mockEventstore.query.mockResolvedValue([]);

      const result = await queries.getAccessTokenByID('token-123', 'inst-123');

      expect(result).toBeNull();
    });
  });

  describe('getAccessTokenByToken', () => {
    it('should return active token by token string', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      
      mockDatabase.queryOne.mockResolvedValue({
        id: 'token-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        user_id: 'user-456',
        application_id: 'app-789',
        token: 'access_token_xyz',
        scopes: JSON.stringify(['openid', 'profile', 'email']),
        audience: JSON.stringify(['api.example.com']),
        expiration: futureDate,
      });

      const result = await queries.getAccessTokenByToken('access_token_xyz', 'inst-123');

      expect(result).toBeDefined();
      expect(result!.isActive).toBe(true);
      expect(result!.token).toBe('access_token_xyz');
      expect(result!.scopes).toHaveLength(3);
    });

    it('should return null for expired token by string', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      
      mockDatabase.queryOne.mockResolvedValue({
        id: 'token-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        user_id: 'user-456',
        application_id: 'app-789',
        token: 'access_token_xyz',
        scopes: JSON.stringify([]),
        audience: JSON.stringify([]),
        expiration: pastDate,
      });

      const result = await queries.getAccessTokenByToken('access_token_xyz', 'inst-123');

      expect(result).toBeNull();
    });

    it('should return null for revoked token by string', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      
      mockDatabase.queryOne.mockResolvedValue({
        id: 'token-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        user_id: 'user-456',
        application_id: 'app-789',
        token: 'access_token_xyz',
        scopes: JSON.stringify([]),
        audience: JSON.stringify([]),
        expiration: futureDate,
        reason: 1,
      });

      const result = await queries.getAccessTokenByToken('access_token_xyz', 'inst-123');

      expect(result).toBeNull();
    });

    it('should return null when token not found by string', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getAccessTokenByToken('access_token_xyz', 'inst-123');

      expect(result).toBeNull();
    });
  });

  describe('Token parsing', () => {
    it('should parse scopes as array from JSON string', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      
      mockDatabase.queryOne.mockResolvedValue({
        id: 'token-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        user_id: 'user-456',
        application_id: 'app-789',
        token: 'access_token_xyz',
        scopes: '["openid","profile","email"]',
        audience: '["api1","api2"]',
        expiration: futureDate,
      });

      const result = await queries.getAccessTokenByID('token-123', 'inst-123');

      expect(result).toBeDefined();
      expect(Array.isArray(result!.scopes)).toBe(true);
      expect(result!.scopes).toEqual(['openid', 'profile', 'email']);
      expect(result!.audience).toEqual(['api1', 'api2']);
    });

    it('should handle already parsed arrays', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      
      mockDatabase.queryOne.mockResolvedValue({
        id: 'token-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        user_id: 'user-456',
        application_id: 'app-789',
        token: 'access_token_xyz',
        scopes: ['openid', 'profile'],
        audience: ['api1'],
        expiration: futureDate,
      });

      const result = await queries.getAccessTokenByID('token-123', 'inst-123');

      expect(result).toBeDefined();
      expect(result!.scopes).toEqual(['openid', 'profile']);
      expect(result!.audience).toEqual(['api1']);
    });
  });
});
