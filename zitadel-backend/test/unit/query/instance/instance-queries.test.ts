/**
 * Instance Queries Unit Tests
 * 
 * Comprehensive tests for all instance query methods
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InstanceQueries } from '../../../../src/lib/query/instance/instance-queries';
import { DatabasePool } from '../../../../src/lib/database/pool';

describe('InstanceQueries', () => {
  let instanceQueries: InstanceQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  beforeEach(() => {
    // Create mock database
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
      queryMany: jest.fn(),
    } as any;

    instanceQueries = new InstanceQueries(mockDatabase);
  });

  describe('getInstanceByID', () => {
    it('should return instance when found', async () => {
      const mockInstance = {
        id: 'inst-123',
        name: 'Test Instance',
        default_org_id: 'org-1',
        default_language: 'en',
        state: 'active',
        domains: [],
        trusted_domains: [],
        features: {},
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        sequence: 1,
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [mockInstance] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await instanceQueries.getInstanceByID('inst-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('inst-123');
      expect(result?.name).toBe('Test Instance');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM instances_projection'),
        ['inst-123']
      );
    });

    it('should return null when instance not found', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] } as any);

      const result = await instanceQueries.getInstanceByID('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getInstanceByHost', () => {
    it('should return instance by domain', async () => {
      const mockInstanceId = 'inst-123';
      const mockInstance = {
        id: mockInstanceId,
        name: 'Test Instance',
        state: 'active',
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ instance_id: mockInstanceId }] } as any)
        .mockResolvedValueOnce({ rows: [mockInstance] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await instanceQueries.getInstanceByHost('app.example.com');

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockInstanceId);
    });

    it('should return null when domain not found', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] } as any);

      const result = await instanceQueries.getInstanceByHost('unknown.example.com');

      expect(result).toBeNull();
    });
  });

  describe('getDefaultInstance', () => {
    it('should return first active instance', async () => {
      const mockInstance = {
        id: 'inst-1',
        name: 'Default Instance',
        state: 'active',
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [mockInstance] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await instanceQueries.getDefaultInstance();

      expect(result).toBeDefined();
      expect(result?.id).toBe('inst-1');
      expect(mockDatabase.query).toHaveBeenCalled();
    });

    it('should return first instance when no active instances', async () => {
      const mockInstance = {
        id: 'inst-1',
        name: 'Inactive Instance',
        state: 'inactive',
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [mockInstance] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await instanceQueries.getDefaultInstance();

      expect(result).toBeDefined();
      expect(result?.id).toBe('inst-1');
    });

    it('should return null when no instances exist', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] } as any);

      const result = await instanceQueries.getDefaultInstance();

      expect(result).toBeNull();
    });
  });

  describe('searchInstanceDomains', () => {
    it('should return instance domains', async () => {
      const mockDomains = [
        {
          instance_id: 'inst-1',
          domain: 'app.example.com',
          is_primary: true,
          is_generated: false,
          created_at: new Date('2024-01-01'),
        },
      ];

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] } as any)
        .mockResolvedValueOnce({ rows: mockDomains } as any);

      const result = await instanceQueries.searchInstanceDomains({ instanceID: 'inst-1' });

      expect(result.total).toBe(1);
      expect(result.domains).toHaveLength(1);
      expect(result.domains[0].domain).toBe('app.example.com');
    });

    it('should filter by domain name', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await instanceQueries.searchInstanceDomains({
        instanceID: 'inst-1',
        domain: 'example.com',
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('domain ILIKE'),
        expect.arrayContaining(['%example.com%'])
      );
    });

    it('should filter by is_primary', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await instanceQueries.searchInstanceDomains({
        instanceID: 'inst-1',
        isPrimary: true,
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('is_primary ='),
        expect.arrayContaining([true])
      );
    });

    it('should apply pagination', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '50' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await instanceQueries.searchInstanceDomains({
        instanceID: 'inst-1',
        limit: 10,
        offset: 20,
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 20])
      );
    });
  });

  describe('getInstanceFeatures', () => {
    it('should return instance features', async () => {
      const mockFeatures = {
        loginDefaultOrg: true,
        triggerIntrospectionProjections: false,
        legacyIntrospection: false,
      };

      mockDatabase.query.mockResolvedValue({
        rows: [{ features: mockFeatures }],
      } as any);

      const result = await instanceQueries.getInstanceFeatures('inst-1');

      expect(result).toBeDefined();
      expect(result?.loginDefaultOrg).toBe(true);
    });

    it('should return null when instance has no features', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] } as any);

      const result = await instanceQueries.getInstanceFeatures('inst-1');

      expect(result).toBeNull();
    });
  });

  describe('searchInstanceTrustedDomains', () => {
    it('should return trusted domains', async () => {
      const mockDomains = [
        {
          instance_id: 'inst-1',
          domain: 'trusted.example.com',
          created_at: new Date('2024-01-01'),
        },
      ];

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] } as any)
        .mockResolvedValueOnce({ rows: mockDomains } as any);

      const result = await instanceQueries.searchInstanceTrustedDomains({
        instanceID: 'inst-1',
      });

      expect(result.total).toBe(1);
      expect(result.domains).toHaveLength(1);
      expect(result.domains[0].domain).toBe('trusted.example.com');
    });

    it('should filter by domain', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await instanceQueries.searchInstanceTrustedDomains({
        instanceID: 'inst-1',
        domain: 'trusted',
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('domain ILIKE'),
        expect.arrayContaining(['%trusted%'])
      );
    });
  });
});
