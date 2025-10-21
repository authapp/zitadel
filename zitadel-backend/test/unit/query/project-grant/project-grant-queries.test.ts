/**
 * Unit tests for ProjectGrantQueries
 * Tests cross-organization project grant retrieval
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProjectGrantQueries } from '../../../../src/lib/query/project-grant/project-grant-queries';
import { State } from '../../../../src/lib/query/converters/state-converter';

describe('ProjectGrantQueries', () => {
  let queries: ProjectGrantQueries;
  let mockDatabase: any;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    };
    queries = new ProjectGrantQueries(mockDatabase);
  });

  describe('searchProjectGrants', () => {
    it('should search project grants with filters', async () => {
      const mockGrants = [
        {
          id: 'grant-1',
          creation_date: new Date('2024-01-01'),
          change_date: new Date('2024-01-01'),
          sequence: 1,
          resource_owner: 'org-123',
          instance_id: 'inst-123',
          project_id: 'proj-789',
          granted_org_id: 'org-456',
          state: State.ACTIVE,
          granted_roles: ['admin', 'viewer'],
          project_name: 'My Project',
          project_owner: 'org-123',
          granted_org_name: 'Partner Org',
          granted_org_domain: 'partner.com',
        },
      ];

      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({ rows: mockGrants });

      const result = await queries.searchProjectGrants({
        instanceID: 'inst-123',
        projectID: 'proj-789',
        limit: 50,
        offset: 0,
      });

      expect(result.grants).toHaveLength(1);
      expect(result.grants[0].id).toBe('grant-1');
      expect(result.grants[0].grantedRoles).toEqual(['admin', 'viewer']);
      expect(result.totalCount).toBe(1);
      expect(mockDatabase.query).toHaveBeenCalled();
    });

    it('should filter by grantedOrgID', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '2' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await queries.searchProjectGrants({
        instanceID: 'inst-123',
        grantedOrgID: 'org-456',
      });

      const queryCall = mockDatabase.query.mock.calls[0];
      expect(queryCall[0]).toContain('pg.granted_org_id = $2');
    });

    it('should filter by roleKeys', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await queries.searchProjectGrants({
        instanceID: 'inst-123',
        roleKeys: ['admin', 'editor'],
      });

      const queryCall = mockDatabase.query.mock.calls[0];
      expect(queryCall[0]).toContain('pg.granted_roles &&');
    });

    it('should support pagination', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '100' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await queries.searchProjectGrants({
        instanceID: 'inst-123',
        limit: 20,
        offset: 40,
      });

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(40);
    });
  });

  describe('getProjectGrantByID', () => {
    it('should return project grant by ID', async () => {
      const mockGrant = {
        id: 'grant-1',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        project_id: 'proj-789',
        granted_org_id: 'org-456',
        state: State.ACTIVE,
        granted_roles: ['admin'],
        project_name: 'My Project',
        project_owner: 'org-123',
        granted_org_name: 'Partner Org',
        granted_org_domain: 'partner.com',
      };

      mockDatabase.queryOne.mockResolvedValue(mockGrant);

      const result = await queries.getProjectGrantByID('grant-1', 'inst-123');

      expect(result).toBeDefined();
      expect(result!.id).toBe('grant-1');
      expect(result!.projectID).toBe('proj-789');
      expect(result!.grantedOrgID).toBe('org-456');
      expect(result!.grantedOrgName).toBe('Partner Org');
    });

    it('should return null when grant not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getProjectGrantByID('grant-1', 'inst-123');

      expect(result).toBeNull();
    });
  });

  describe('getProjectGrantsByProjectID', () => {
    it('should return all grants for a project', async () => {
      const mockGrants = [
        {
          id: 'grant-1',
          creation_date: new Date('2024-01-01'),
          change_date: new Date('2024-01-01'),
          sequence: 1,
          resource_owner: 'org-123',
          instance_id: 'inst-123',
          project_id: 'proj-789',
          granted_org_id: 'org-456',
          state: State.ACTIVE,
          granted_roles: ['admin'],
        },
        {
          id: 'grant-2',
          creation_date: new Date('2024-01-02'),
          change_date: new Date('2024-01-02'),
          sequence: 2,
          resource_owner: 'org-123',
          instance_id: 'inst-123',
          project_id: 'proj-789',
          granted_org_id: 'org-999',
          state: State.ACTIVE,
          granted_roles: ['viewer'],
        },
      ];

      mockDatabase.query.mockResolvedValue({ rows: mockGrants });

      const result = await queries.getProjectGrantsByProjectID('proj-789', 'inst-123');

      expect(result).toHaveLength(2);
      expect(result[0].projectID).toBe('proj-789');
      expect(result[1].projectID).toBe('proj-789');
      expect(result[0].grantedOrgID).toBe('org-456');
      expect(result[1].grantedOrgID).toBe('org-999');
    });

    it('should return empty array when no grants found', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await queries.getProjectGrantsByProjectID('proj-789', 'inst-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('getProjectGrantsByGrantedOrgID', () => {
    it('should return all grants for an organization', async () => {
      const mockGrants = [
        {
          id: 'grant-1',
          creation_date: new Date('2024-01-01'),
          change_date: new Date('2024-01-01'),
          sequence: 1,
          resource_owner: 'org-123',
          instance_id: 'inst-123',
          project_id: 'proj-789',
          granted_org_id: 'org-456',
          state: State.ACTIVE,
          granted_roles: ['admin'],
        },
        {
          id: 'grant-2',
          creation_date: new Date('2024-01-02'),
          change_date: new Date('2024-01-02'),
          sequence: 2,
          resource_owner: 'org-999',
          instance_id: 'inst-123',
          project_id: 'proj-888',
          granted_org_id: 'org-456',
          state: State.ACTIVE,
          granted_roles: ['viewer'],
        },
      ];

      mockDatabase.query.mockResolvedValue({ rows: mockGrants });

      const result = await queries.getProjectGrantsByGrantedOrgID('org-456', 'inst-123');

      expect(result).toHaveLength(2);
      expect(result[0].grantedOrgID).toBe('org-456');
      expect(result[1].grantedOrgID).toBe('org-456');
      expect(result[0].projectID).toBe('proj-789');
      expect(result[1].projectID).toBe('proj-888');
    });

    it('should return empty array when no grants for org', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await queries.getProjectGrantsByGrantedOrgID('org-456', 'inst-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('getProjectGrantDetails', () => {
    it('should return grant with user count and roles', async () => {
      const mockGrant = {
        id: 'grant-1',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        project_id: 'proj-789',
        granted_org_id: 'org-456',
        state: State.ACTIVE,
        granted_roles: ['admin'],
      };

      mockDatabase.queryOne
        .mockResolvedValueOnce(mockGrant) // First call: getProjectGrantByID
        .mockResolvedValueOnce({ count: '5' }); // Second call: user grant count

      mockDatabase.query.mockResolvedValue({
        rows: [{ role_key: 'admin' }, { role_key: 'viewer' }, { role_key: 'editor' }],
      });

      const result = await queries.getProjectGrantDetails('grant-1', 'inst-123');

      expect(result).toBeDefined();
      expect(result!.userGrantCount).toBe(5);
      expect(result!.projectRoles).toEqual(['admin', 'viewer', 'editor']);
    });

    it('should return null when grant not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getProjectGrantDetails('grant-1', 'inst-123');

      expect(result).toBeNull();
    });
  });

  describe('isProjectGrantedToOrg', () => {
    it('should return true when active grant exists', async () => {
      mockDatabase.queryOne.mockResolvedValue({ exists: 1 });

      const result = await queries.isProjectGrantedToOrg('proj-789', 'org-456', 'inst-123');

      expect(result).toBe(true);
      expect(mockDatabase.queryOne).toHaveBeenCalled();
    });

    it('should return false when no grant exists', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.isProjectGrantedToOrg('proj-789', 'org-456', 'inst-123');

      expect(result).toBe(false);
    });

    it('should only check active grants', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      await queries.isProjectGrantedToOrg('proj-789', 'org-456', 'inst-123');

      const queryCall = mockDatabase.queryOne.mock.calls[0];
      expect(queryCall[1]).toContain(State.ACTIVE);
    });
  });

  describe('mapRowToProjectGrant', () => {
    it('should handle array granted_roles', async () => {
      const mockGrant = {
        id: 'grant-1',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        project_id: 'proj-789',
        granted_org_id: 'org-456',
        state: State.ACTIVE,
        granted_roles: ['admin', 'viewer'],
      };

      mockDatabase.queryOne.mockResolvedValue(mockGrant);

      const result = await queries.getProjectGrantByID('grant-1', 'inst-123');

      expect(Array.isArray(result!.grantedRoles)).toBe(true);
      expect(result!.grantedRoles).toEqual(['admin', 'viewer']);
    });

    it('should handle empty granted_roles', async () => {
      const mockGrant = {
        id: 'grant-1',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        project_id: 'proj-789',
        granted_org_id: 'org-456',
        state: State.ACTIVE,
        granted_roles: [],
      };

      mockDatabase.queryOne.mockResolvedValue(mockGrant);

      const result = await queries.getProjectGrantByID('grant-1', 'inst-123');

      expect(result!.grantedRoles).toEqual([]);
    });
  });
});
