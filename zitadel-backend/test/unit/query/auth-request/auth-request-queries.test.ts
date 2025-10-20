/**
 * Unit tests for AuthRequestQueries
 * Tests auth request lookups for OAuth/OIDC flows
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuthRequestQueries } from '../../../../src/lib/query/auth-request/auth-request-queries';

describe('AuthRequestQueries', () => {
  let queries: AuthRequestQueries;
  let mockDatabase: any;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    };
    queries = new AuthRequestQueries(mockDatabase);
  });

  describe('getAuthRequestByID', () => {
    it('should return auth request by ID', async () => {
      const mockAuthRequest = {
        id: 'auth-req-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        login_client: 'user-123',
        client_id: 'client-123',
        redirect_uri: 'https://example.com/callback',
        state: 'state-123',
        nonce: 'nonce-123',
        scope: ['openid', 'profile', 'email'],
        audience: ['api-123'],
        response_type: 'code',
        response_mode: 'query',
        code_challenge: 'challenge-123',
        code_challenge_method: 'S256',
        prompt: ['login'],
        ui_locales: ['en', 'de'],
        max_age: 3600,
        login_hint: 'user@example.com',
        hint_user_id: 'user-123',
        need_refresh_token: true,
        session_id: 'sess-123',
        user_id: 'user-123',
        auth_time: new Date('2024-01-01T12:00:00Z'),
        auth_methods: ['password', 'totp'],
        code: 'code-123',
        issuer: 'https://issuer.example.com',
      };

      mockDatabase.queryOne.mockResolvedValue(mockAuthRequest);

      const result = await queries.getAuthRequestByID('auth-req-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('auth-req-123');
      expect(result?.clientID).toBe('client-123');
      expect(result?.scope).toEqual(['openid', 'profile', 'email']);
      expect(result?.codeChallenge).toEqual({
        challenge: 'challenge-123',
        method: 'S256',
      });
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['auth-req-123']
      );
    });

    it('should return auth request with instance ID filter', async () => {
      const mockAuthRequest = {
        id: 'auth-req-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        login_client: 'user-123',
        client_id: 'client-123',
        redirect_uri: 'https://example.com/callback',
        scope: [],
        prompt: [],
      };

      mockDatabase.queryOne.mockResolvedValue(mockAuthRequest);

      const result = await queries.getAuthRequestByID('auth-req-123', 'inst-123');

      expect(result).toBeDefined();
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('instance_id = $2'),
        ['auth-req-123', 'inst-123']
      );
    });

    it('should return null when auth request not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getAuthRequestByID('non-existent');

      expect(result).toBeNull();
    });

    it('should handle auth request without optional fields', async () => {
      const mockAuthRequest = {
        id: 'auth-req-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        login_client: 'user-123',
        client_id: 'client-123',
        redirect_uri: 'https://example.com/callback',
        scope: ['openid'],
        prompt: [],
        state: null,
        nonce: null,
        audience: null,
        code_challenge: null,
        code_challenge_method: null,
        ui_locales: null,
        max_age: null,
        login_hint: null,
        hint_user_id: null,
        need_refresh_token: false,
        session_id: null,
        user_id: null,
        auth_time: null,
        auth_methods: null,
        code: null,
      };

      mockDatabase.queryOne.mockResolvedValue(mockAuthRequest);

      const result = await queries.getAuthRequestByID('auth-req-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('auth-req-123');
      expect(result?.state).toBeNull();
      expect(result?.codeChallenge).toBeUndefined();
      expect(result?.sessionID).toBeNull();
    });
  });

  describe('getAuthRequestByCode', () => {
    it('should return auth request by code', async () => {
      const mockAuthRequest = {
        id: 'auth-req-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        login_client: 'user-123',
        client_id: 'client-123',
        redirect_uri: 'https://example.com/callback',
        scope: ['openid'],
        prompt: [],
        code: 'code-123',
      };

      mockDatabase.queryOne.mockResolvedValue(mockAuthRequest);

      const result = await queries.getAuthRequestByCode('code-123', 'inst-123');

      expect(result).toBeDefined();
      expect(result?.code).toBe('code-123');
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ar.code = $1 AND ar.instance_id = $2'),
        ['code-123', 'inst-123']
      );
    });

    it('should return null when code not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getAuthRequestByCode('invalid-code', 'inst-123');

      expect(result).toBeNull();
    });
  });

  describe('searchAuthRequests', () => {
    it('should search auth requests without filters', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '2' });
      mockDatabase.query.mockResolvedValue({
        rows: [
          {
            id: 'auth-req-1',
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: 1,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
            login_client: 'user-1',
            client_id: 'client-123',
            redirect_uri: 'https://example.com/callback',
            scope: ['openid'],
            prompt: [],
          },
          {
            id: 'auth-req-2',
            creation_date: new Date('2024-01-02'),
            change_date: new Date('2024-01-02'),
            sequence: 2,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
            login_client: 'user-2',
            client_id: 'client-456',
            redirect_uri: 'https://example.com/callback',
            scope: ['openid', 'profile'],
            prompt: [],
          },
        ],
      });

      const result = await queries.searchAuthRequests({});

      expect(result.total).toBe(2);
      expect(result.authRequests).toHaveLength(2);
      expect(result.authRequests[0].id).toBe('auth-req-1');
      expect(result.authRequests[1].id).toBe('auth-req-2');
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should search auth requests by instance ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({
        rows: [
          {
            id: 'auth-req-1',
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: 1,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
            login_client: 'user-1',
            client_id: 'client-123',
            redirect_uri: 'https://example.com/callback',
            scope: ['openid'],
            prompt: [],
          },
        ],
      });

      const result = await queries.searchAuthRequests({
        instanceID: 'inst-123',
      });

      expect(result.total).toBe(1);
      expect(result.authRequests).toHaveLength(1);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ar.instance_id = $1'),
        expect.arrayContaining(['inst-123'])
      );
    });

    it('should search auth requests by client ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await queries.searchAuthRequests({
        clientID: 'client-123',
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ar.client_id = $1'),
        expect.arrayContaining(['client-123'])
      );
    });

    it('should search auth requests by user ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '0' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await queries.searchAuthRequests({
        userID: 'user-123',
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ar.user_id = $1'),
        expect.arrayContaining(['user-123'])
      );
    });

    it('should search auth requests by session ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '0' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await queries.searchAuthRequests({
        sessionID: 'sess-123',
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ar.session_id = $1'),
        expect.arrayContaining(['sess-123'])
      );
    });

    it('should search auth requests with multiple filters', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await queries.searchAuthRequests({
        instanceID: 'inst-123',
        clientID: 'client-123',
        userID: 'user-123',
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ar.instance_id = $1 AND ar.client_id = $2 AND ar.user_id = $3'),
        expect.arrayContaining(['inst-123', 'client-123', 'user-123'])
      );
    });

    it('should support pagination', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '100' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await queries.searchAuthRequests({
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

    it('should use default pagination values', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '10' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await queries.searchAuthRequests({});

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should return empty result when no auth requests found', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '0' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await queries.searchAuthRequests({
        instanceID: 'non-existent',
      });

      expect(result.total).toBe(0);
      expect(result.authRequests).toHaveLength(0);
    });
  });

  describe('mapRowToAuthRequest', () => {
    it('should map complete row to AuthRequest', async () => {
      const mockRow = {
        id: 'auth-req-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        login_client: 'user-123',
        client_id: 'client-123',
        redirect_uri: 'https://example.com/callback',
        state: 'state-123',
        nonce: 'nonce-123',
        scope: ['openid', 'profile'],
        audience: ['api-123'],
        response_type: 'code',
        response_mode: 'query',
        code_challenge: 'challenge-123',
        code_challenge_method: 'S256',
        prompt: ['login', 'consent'],
        ui_locales: ['en'],
        max_age: 3600,
        login_hint: 'user@example.com',
        hint_user_id: 'user-123',
        need_refresh_token: true,
        session_id: 'sess-123',
        user_id: 'user-123',
        auth_time: new Date('2024-01-01T12:00:00Z'),
        auth_methods: ['password'],
        code: 'code-123',
        issuer: 'https://issuer.example.com',
      };

      mockDatabase.queryOne.mockResolvedValue(mockRow);

      const result = await queries.getAuthRequestByID('auth-req-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('auth-req-123');
      expect(result?.clientID).toBe('client-123');
      expect(result?.redirectURI).toBe('https://example.com/callback');
      expect(result?.scope).toEqual(['openid', 'profile']);
      expect(result?.codeChallenge).toEqual({
        challenge: 'challenge-123',
        method: 'S256',
      });
      expect(result?.prompt).toEqual(['login', 'consent']);
      expect(result?.needRefreshToken).toBe(true);
    });

    it('should handle plain code challenge method', async () => {
      const mockRow = {
        id: 'auth-req-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        login_client: 'user-123',
        client_id: 'client-123',
        redirect_uri: 'https://example.com/callback',
        scope: ['openid'],
        prompt: [],
        code_challenge: 'challenge-123',
        code_challenge_method: 'plain',
      };

      mockDatabase.queryOne.mockResolvedValue(mockRow);

      const result = await queries.getAuthRequestByID('auth-req-123');

      expect(result?.codeChallenge).toEqual({
        challenge: 'challenge-123',
        method: 'plain',
      });
    });

    it('should default to S256 when challenge method not specified', async () => {
      const mockRow = {
        id: 'auth-req-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        login_client: 'user-123',
        client_id: 'client-123',
        redirect_uri: 'https://example.com/callback',
        scope: ['openid'],
        prompt: [],
        code_challenge: 'challenge-123',
        code_challenge_method: null,
      };

      mockDatabase.queryOne.mockResolvedValue(mockRow);

      const result = await queries.getAuthRequestByID('auth-req-123');

      expect(result?.codeChallenge).toEqual({
        challenge: 'challenge-123',
        method: 'S256',
      });
    });
  });
});
