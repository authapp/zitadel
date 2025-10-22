/**
 * Application Queries Unit Tests
 * 
 * Comprehensive tests for all application query methods
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AppQueries } from '../../../../src/lib/query/app/app-queries';
import { DatabasePool } from '../../../../src/lib/database/pool';
import { AppState, AppType } from '../../../../src/lib/query/app/app-types';

describe('AppQueries', () => {
  let appQueries: AppQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  beforeEach(() => {
    // Create mock database
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
      queryMany: jest.fn(),
    } as any;

    appQueries = new AppQueries(mockDatabase);
  });

  describe('getAppByID', () => {
    it('should return OIDC app when found', async () => {
      const mockApp = {
        id: 'app-123',
        project_id: 'project-1',
        name: 'Test OIDC App',
        state: AppState.ACTIVE,
        app_type: AppType.OIDC,
        client_id: 'client-123',
        client_secret: 'encrypted-secret',
        redirect_uris: ['https://app.example.com/callback'],
        response_types: ['code'],
        grant_types: ['authorization_code'],
        application_type: 'web',
        auth_method_type: 'client_secret_post',
        post_logout_redirect_uris: ['https://app.example.com/logout'],
        is_dev_mode: false,
        access_token_type: 'bearer',
        access_token_role_assertion: false,
        id_token_role_assertion: false,
        id_token_userinfo_assertion: false,
        clock_skew: 0,
        additional_origins: [],
        skip_native_app_success_page: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({ rows: [mockApp] } as any);

      const result = await appQueries.getAppByID('app-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('app-123');
      expect(result?.name).toBe('Test OIDC App');
    });

    it('should return null when app not found', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] } as any);

      const result = await appQueries.getAppByID('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('searchApps', () => {
    it('should return all apps when no filters', async () => {
      const mockApps = [
        {
          id: 'app-1',
          project_id: 'project-1',
          name: 'App 1',
          state: AppState.ACTIVE,
          app_type: AppType.OIDC,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
          sequence: 1,
        },
      ];

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] } as any)
        .mockResolvedValueOnce({ rows: mockApps } as any);

      const result = await appQueries.searchApps({});

      expect(result.total).toBe(1);
      expect(result.apps).toHaveLength(1);
      expect(result.apps[0].id).toBe('app-1');
    });

    it('should filter by project ID', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await appQueries.searchApps({ projectId: 'project-1' });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('project_id ='),
        expect.arrayContaining(['project-1'])
      );
    });

    it('should filter by name', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await appQueries.searchApps({ name: 'Test' });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('name ILIKE'),
        expect.arrayContaining(['%Test%'])
      );
    });

    it('should filter by state', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await appQueries.searchApps({ state: AppState.ACTIVE });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('state ='),
        expect.arrayContaining([AppState.ACTIVE])
      );
    });

    it('should filter by app type', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await appQueries.searchApps({ type: AppType.OIDC });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('app_type ='),
        expect.arrayContaining([AppType.OIDC])
      );
    });

    it('should apply pagination', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '100' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await appQueries.searchApps({ limit: 10, offset: 20 });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 20])
      );
    });
  });

  describe('existsApp', () => {
    it('should return true when app exists', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [{ exists: true }] } as any);

      const result = await appQueries.existsApp('app-1');

      expect(result).toBe(true);
    });

    it('should return false when app does not exist', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [{ exists: false }] } as any);

      const result = await appQueries.existsApp('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getAppByClientID', () => {
    it('should return app by client ID', async () => {
      const mockApp = {
        id: 'app-1',
        project_id: 'project-1',
        name: 'App 1',
        state: AppState.ACTIVE,
        app_type: AppType.OIDC,
        client_id: 'client-123',
        created_at: new Date(),
        updated_at: new Date(),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({ rows: [mockApp] } as any);

      const result = await appQueries.getAppByClientID('client-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('app-1');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('client_id = $1'),
        ['client-123']
      );
    });

    it('should return null when app not found by client ID', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] } as any);

      const result = await appQueries.getAppByClientID('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getOIDCAppConfig', () => {
    it('should return OIDC app', async () => {
      const mockApp = {
        id: 'app-1',
        project_id: 'project-1',
        name: 'OIDC App',
        app_type: AppType.OIDC,
        client_id: 'client-123',
        redirect_uris: ['https://app.example.com/callback'],
        response_types: ['code'],
        grant_types: ['authorization_code'],
        created_at: new Date(),
        updated_at: new Date(),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({ rows: [mockApp] } as any);

      const result = await appQueries.getOIDCAppConfig('app-1');

      expect(result).toBeDefined();
    });

    it('should return null when app is not OIDC type', async () => {
      const mockApp = {
        id: 'app-1',
        app_type: AppType.SAML,
        created_at: new Date(),
        updated_at: new Date(),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({ rows: [mockApp] } as any);

      const result = await appQueries.getOIDCAppConfig('app-1');

      expect(result).toBeNull();
    });
  });

  describe('getSAMLAppConfig', () => {
    it('should return SAML app', async () => {
      const mockApp = {
        id: 'app-1',
        project_id: 'project-1',
        name: 'SAML App',
        app_type: AppType.SAML,
        entity_id: 'https://sp.example.com',
        metadata_url: 'https://sp.example.com/metadata',
        created_at: new Date(),
        updated_at: new Date(),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({ rows: [mockApp] } as any);

      const result = await appQueries.getSAMLAppConfig('app-1');

      expect(result).toBeDefined();
    });

    it('should return null when app is not SAML type', async () => {
      const mockApp = {
        id: 'app-1',
        app_type: AppType.OIDC,
        created_at: new Date(),
        updated_at: new Date(),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({ rows: [mockApp] } as any);

      const result = await appQueries.getSAMLAppConfig('app-1');

      expect(result).toBeNull();
    });
  });

  describe('getAPIAppConfig', () => {
    it('should return API app', async () => {
      const mockApp = {
        id: 'app-1',
        project_id: 'project-1',
        name: 'API App',
        app_type: AppType.API,
        client_id: 'api-client-123',
        created_at: new Date(),
        updated_at: new Date(),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({ rows: [mockApp] } as any);

      const result = await appQueries.getAPIAppConfig('app-1');

      expect(result).toBeDefined();
    });

    it('should return null when app is not API type', async () => {
      const mockApp = {
        id: 'app-1',
        app_type: AppType.OIDC,
        created_at: new Date(),
        updated_at: new Date(),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({ rows: [mockApp] } as any);

      const result = await appQueries.getAPIAppConfig('app-1');

      expect(result).toBeNull();
    });
  });

  describe('getProjectByClientID', () => {
    it('should return project ID by client ID', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [{ project_id: 'project-1' }] } as any);

      const result = await appQueries.getProjectByClientID('client-123');

      expect(result).toBe('project-1');
    });

    it('should return null when client ID not found', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] } as any);

      const result = await appQueries.getProjectByClientID('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('searchClientIDs', () => {
    it('should return matching client IDs', async () => {
      const mockResults = [
        {
          client_id: 'client-123',
          project_id: 'project-1',
          id: 'app-1',
          app_type: 'oidc',
        },
      ];

      mockDatabase.query.mockResolvedValue({ rows: mockResults } as any);

      const result = await appQueries.searchClientIDs('client');

      expect(result).toHaveLength(1);
      expect(result[0].clientId).toBe('client-123');
      expect(result[0].projectId).toBe('project-1');
    });
  });

  describe('getAPIAppByClientID', () => {
    it('should return API app by client ID', async () => {
      const mockApp = {
        id: 'app-1',
        project_id: 'project-1',
        name: 'API App',
        app_type: AppType.API,
        client_id: 'api-client-123',
        created_at: new Date(),
        updated_at: new Date(),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({ rows: [mockApp] } as any);

      const result = await appQueries.getAPIAppByClientID('api-client-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('app-1');
    });

    it('should return null when not found', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] } as any);

      const result = await appQueries.getAPIAppByClientID('nonexistent');

      expect(result).toBeNull();
    });
  });
});
