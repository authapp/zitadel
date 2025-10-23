/**
 * Organization Queries Unit Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { OrgQueries } from '../../../src/lib/query/org/org-queries';
import { OrgState } from '../../../src/lib/query/org/org-types';
import { DatabasePool } from '../../../src/lib/database/pool';

describe('OrgQueries', () => {
  let orgQueries: OrgQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      withTransaction: jest.fn(),
    } as any;

    orgQueries = new OrgQueries(mockDatabase);
  });

  describe('getOrgByID', () => {
    it('should return organization when found', async () => {
      const mockOrg = {
        id: 'org-123',
        name: 'Test Org',
        state: 'active',
        primaryDomain: 'test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({
        rows: [mockOrg],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getOrgByID('org-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('org-123');
      expect(result?.name).toBe('Test Org');
      expect(result?.state).toBe(OrgState.ACTIVE);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['org-123']
      );
    });

    it('should return null when organization not found', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getOrgByID('non-existent');

      expect(result).toBeNull();
    });

    it('should filter by instanceID when provided', async () => {
      const mockOrg = {
        id: 'org-123',
        instanceID: 'instance-456',  // SQL returns AS "instanceID"
        name: 'Test Org',
        state: 'active',
        primaryDomain: 'test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({
        rows: [mockOrg],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getOrgByID('org-123', 'instance-456');

      expect(result).toBeDefined();
      expect(result?.id).toBe('org-123');
      expect(result?.instanceID).toBe('instance-456');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('instance_id'),
        ['instance-456', 'org-123']
      );
    });

    it('should return null when org exists but wrong instanceID', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getOrgByID('org-123', 'wrong-instance');

      expect(result).toBeNull();
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('instance_id'),
        ['wrong-instance', 'org-123']
      );
    });
  });

  describe('getOrgByDomainGlobal', () => {
    it('should return organization when domain found and verified', async () => {
      const mockOrg = {
        id: 'org-123',
        name: 'Test Org',
        state: 'active',
        primaryDomain: 'test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({
        rows: [mockOrg],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getOrgByDomainGlobal('test.com');

      expect(result).toBeDefined();
      expect(result?.id).toBe('org-123');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INNER JOIN org_domains_projection'),
        ['test.com']
      );
    });

    it('should return null when domain not found', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getOrgByDomainGlobal('nonexistent.com');

      expect(result).toBeNull();
    });

    it('should filter JOIN by instanceID when provided', async () => {
      const mockOrg = {
        id: 'org-123',
        instanceID: 'instance-456',  // SQL returns AS "instanceID"
        name: 'Test Org',
        state: 'active',
        primaryDomain: 'test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({
        rows: [mockOrg],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getOrgByDomainGlobal('test.com', 'instance-456');

      expect(result).toBeDefined();
      expect(result?.id).toBe('org-123');
      expect(result?.instanceID).toBe('instance-456');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('o.instance_id = $1'),
        ['instance-456', 'test.com']
      );
    });

    it('should return null for domain in wrong instance', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getOrgByDomainGlobal('test.com', 'wrong-instance');

      expect(result).toBeNull();
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('instance_id'),
        ['wrong-instance', 'test.com']
      );
    });
  });

  describe('searchOrgs', () => {
    it('should search organizations without filters', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{ count: '2' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'org-1',
              name: 'Org 1',
              state: 'active',
              primaryDomain: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              sequence: 1,
            },
            {
              id: 'org-2',
              name: 'Org 2',
              state: 'active',
              primaryDomain: 'org2.com',
              createdAt: new Date(),
              updatedAt: new Date(),
              sequence: 1,
            },
          ],
          rowCount: 2,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await orgQueries.searchOrgs({});

      expect(result.total).toBe(2);
      expect(result.orgs).toHaveLength(2);
      expect(result.orgs[0].id).toBe('org-1');
      expect(result.orgs[1].id).toBe('org-2');
    });

    it('should search organizations with name filter', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{ count: '1' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'org-1',
              name: 'Test Org',
              state: 'active',
              primaryDomain: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              sequence: 1,
            },
          ],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await orgQueries.searchOrgs({ name: 'Test' });

      expect(result.total).toBe(1);
      expect(result.orgs).toHaveLength(1);
      expect(result.orgs[0].name).toBe('Test Org');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('name ILIKE'),
        expect.arrayContaining(['%Test%'])
      );
    });

    it('should search organizations with state filter', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{ count: '1' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'org-1',
              name: 'Inactive Org',
              state: 'inactive',
              primaryDomain: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              sequence: 1,
            },
          ],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await orgQueries.searchOrgs({ state: OrgState.INACTIVE });

      expect(result.total).toBe(1);
      expect(result.orgs[0].state).toBe(OrgState.INACTIVE);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('state ='),
        expect.arrayContaining(['inactive'])
      );
    });

    it('should handle pagination', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{ count: '100' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      await orgQueries.searchOrgs({ limit: 10, offset: 20 });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 20])
      );
    });

    it('should filter by instanceID when provided', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{ count: '1' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'org-1',
              instanceID: 'instance-456',  // SQL returns AS "instanceID"
              name: 'Instance Org',
              state: 'active',
              primaryDomain: 'test.com',
              createdAt: new Date(),
              updatedAt: new Date(),
              sequence: 1,
            },
          ],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await orgQueries.searchOrgs({ instanceID: 'instance-456' });

      expect(result.total).toBe(1);
      expect(result.orgs).toHaveLength(1);
      expect(result.orgs[0].instanceID).toBe('instance-456');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('instance_id'),
        expect.arrayContaining(['instance-456'])
      );
    });

    it('should return empty result for wrong instanceID', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{ count: '0' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await orgQueries.searchOrgs({ instanceID: 'wrong-instance' });

      expect(result.total).toBe(0);
      expect(result.orgs).toHaveLength(0);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('instance_id'),
        expect.arrayContaining(['wrong-instance'])
      );
    });
  });

  describe('getOrgDomainsByID', () => {
    it('should return all domains for an organization', async () => {
      const mockDomains = [
        {
          orgID: 'org-123',
          domain: 'primary.com',
          isVerified: true,
          isPrimary: true,
          validationType: 'dns',
          validationCode: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          sequence: 1,
        },
        {
          orgID: 'org-123',
          domain: 'secondary.com',
          isVerified: true,
          isPrimary: false,
          validationType: 'dns',
          validationCode: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          sequence: 2,
        },
      ];

      mockDatabase.query.mockResolvedValue({
        rows: mockDomains,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getOrgDomainsByID('org-123');

      expect(result).toHaveLength(2);
      expect(result[0].domain).toBe('primary.com');
      expect(result[0].isPrimary).toBe(true);
      expect(result[1].domain).toBe('secondary.com');
      expect(result[1].isPrimary).toBe(false);
    });

    it('should return empty array when no domains found', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getOrgDomainsByID('org-123');

      expect(result).toEqual([]);
    });

    it('should filter domains by instanceID when provided', async () => {
      const mockDomains = [
        {
          instanceID: 'instance-456',  // SQL returns AS "instanceID"
          orgID: 'org-123',
          domain: 'test.com',
          isVerified: true,
          isPrimary: true,
          validationType: 'dns',
          validationCode: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          sequence: 1,
        },
      ];

      mockDatabase.query.mockResolvedValue({
        rows: mockDomains,
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getOrgDomainsByID('org-123', 'instance-456');

      expect(result).toHaveLength(1);
      expect(result[0].instanceID).toBe('instance-456');
      expect(result[0].domain).toBe('test.com');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('instance_id = $1'),
        ['instance-456', 'org-123']
      );
    });

    it('should return empty array for wrong instanceID', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getOrgDomainsByID('org-123', 'wrong-instance');

      expect(result).toEqual([]);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('instance_id'),
        ['wrong-instance', 'org-123']
      );
    });
  });

  describe('searchOrgDomains', () => {
    it('should search domains without filters', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{ count: '2' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              orgID: 'org-1',
              domain: 'domain1.com',
              isVerified: true,
              isPrimary: true,
              validationType: 'dns',
              validationCode: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              sequence: 1,
            },
            {
              orgID: 'org-2',
              domain: 'domain2.com',
              isVerified: false,
              isPrimary: false,
              validationType: 'dns',
              validationCode: 'code123',
              createdAt: new Date(),
              updatedAt: new Date(),
              sequence: 1,
            },
          ],
          rowCount: 2,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await orgQueries.searchOrgDomains({});

      expect(result.total).toBe(2);
      expect(result.domains).toHaveLength(2);
    });

    it('should search domains with verified filter', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{ count: '1' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              orgID: 'org-1',
              domain: 'verified.com',
              isVerified: true,
              isPrimary: false,
              validationType: 'dns',
              validationCode: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              sequence: 1,
            },
          ],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await orgQueries.searchOrgDomains({ isVerified: true });

      expect(result.total).toBe(1);
      expect(result.domains[0].isVerified).toBe(true);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('is_verified ='),
        expect.arrayContaining([true])
      );
    });
  });

  describe('isDomainAvailable', () => {
    it('should return true when domain is available', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [{ count: '0' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.isDomainAvailable('available.com');

      expect(result).toBe(true);
    });

    it('should return false when domain is taken', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [{ count: '1' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.isDomainAvailable('taken.com');

      expect(result).toBe(false);
    });
  });

  describe('getPrimaryDomainByOrgID', () => {
    it('should return primary domain when exists', async () => {
      const mockDomain = {
        orgID: 'org-123',
        domain: 'primary.com',
        isVerified: true,
        isPrimary: true,
        validationType: 'dns',
        validationCode: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({
        rows: [mockDomain],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getPrimaryDomainByOrgID('org-123');

      expect(result).toBeDefined();
      expect(result?.domain).toBe('primary.com');
      expect(result?.isPrimary).toBe(true);
    });

    it('should return null when no primary domain', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getPrimaryDomainByOrgID('org-123');

      expect(result).toBeNull();
    });

    it('should filter by instanceID when provided', async () => {
      const mockDomain = {
        instanceID: 'instance-456',  // SQL returns AS "instanceID"
        orgID: 'org-123',
        domain: 'primary.com',
        isVerified: true,
        isPrimary: true,
        validationType: 'dns',
        validationCode: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({
        rows: [mockDomain],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getPrimaryDomainByOrgID('org-123', 'instance-456');

      expect(result).toBeDefined();
      expect(result?.instanceID).toBe('instance-456');
      expect(result?.domain).toBe('primary.com');
      expect(result?.isPrimary).toBe(true);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('instance_id'),
        ['instance-456', 'org-123']
      );
    });

    it('should return null for wrong instanceID', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getPrimaryDomainByOrgID('org-123', 'wrong-instance');

      expect(result).toBeNull();
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('instance_id'),
        ['wrong-instance', 'org-123']
      );
    });
  });

  describe('getOrgWithDomains', () => {
    it('should return organization with its domains', async () => {
      const mockOrg = {
        id: 'org-123',
        name: 'Test Org',
        state: 'active',
        primaryDomain: 'test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        sequence: 1,
      };

      const mockDomains = [
        {
          orgID: 'org-123',
          domain: 'test.com',
          isVerified: true,
          isPrimary: true,
          validationType: 'dns',
          validationCode: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          sequence: 1,
        },
      ];

      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [mockOrg],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: mockDomains,
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await orgQueries.getOrgWithDomains('org-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('org-123');
      expect(result?.domains).toHaveLength(1);
      expect(result?.domains[0].domain).toBe('test.com');
    });

    it('should return null when organization not found', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await orgQueries.getOrgWithDomains('non-existent');

      expect(result).toBeNull();
    });
  });
});
