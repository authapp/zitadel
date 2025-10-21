/**
 * Unit tests for UserGrantQueries
 * Tests user grant retrieval and authorization checks
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UserGrantQueries } from '../../../../src/lib/query/user-grant/user-grant-queries';
import { State } from '../../../../src/lib/query/converters/state-converter';

describe('UserGrantQueries', () => {
  let queries: UserGrantQueries;
  let mockDatabase: any;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    };
    queries = new UserGrantQueries(mockDatabase);
  });

  describe('searchUserGrants', () => {
    it('should search user grants with filters', async () => {
      const mockGrants = [
        {
          id: 'grant-1',
          creation_date: new Date('2024-01-01'),
          change_date: new Date('2024-01-01'),
          sequence: 1,
          resource_owner: 'org-123',
          instance_id: 'inst-123',
          user_id: 'user-456',
          project_id: 'proj-789',
          project_grant_id: null,
          state: State.ACTIVE,
          roles: ['admin', 'viewer'],
          user_name: 'john.doe',
          user_resource_owner: 'org-123',
          user_type: 1,
          project_name: 'My Project',
          project_resource_owner: 'org-123',
          org_name: 'My Org',
          org_primary_domain: 'myorg.com',
        },
      ];

      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({ rows: mockGrants });

      const result = await queries.searchUserGrants({
        instanceID: 'inst-123',
        userID: 'user-456',
        limit: 50,
        offset: 0,
      });

      expect(result.grants).toHaveLength(1);
      expect(result.grants[0].id).toBe('grant-1');
      expect(result.grants[0].roles).toEqual(['admin', 'viewer']);
      expect(result.totalCount).toBe(1);
      expect(mockDatabase.query).toHaveBeenCalled();
    });

    it('should filter by projectID', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '2' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await queries.searchUserGrants({
        instanceID: 'inst-123',
        projectID: 'proj-789',
      });

      const queryCall = mockDatabase.query.mock.calls[0];
      expect(queryCall[0]).toContain('ug.project_id = $2');
    });

    it('should support pagination', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '100' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await queries.searchUserGrants({
        instanceID: 'inst-123',
        limit: 20,
        offset: 40,
      });

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(40);
    });
  });

  describe('getUserGrantByID', () => {
    it('should return user grant by ID', async () => {
      const mockGrant = {
        id: 'grant-1',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        user_id: 'user-456',
        project_id: 'proj-789',
        project_grant_id: null,
        state: State.ACTIVE,
        roles: ['admin'],
      };

      mockDatabase.queryOne.mockResolvedValue(mockGrant);

      const result = await queries.getUserGrantByID('grant-1', 'inst-123');

      expect(result).toBeDefined();
      expect(result!.id).toBe('grant-1');
      expect(result!.userID).toBe('user-456');
      expect(result!.projectID).toBe('proj-789');
    });

    it('should return null when grant not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getUserGrantByID('grant-1', 'inst-123');

      expect(result).toBeNull();
    });
  });

  describe('getUserGrantsByUserID', () => {
    it('should return all grants for a user', async () => {
      const mockGrants = [
        {
          id: 'grant-1',
          creation_date: new Date('2024-01-01'),
          change_date: new Date('2024-01-01'),
          sequence: 1,
          resource_owner: 'org-123',
          instance_id: 'inst-123',
          user_id: 'user-456',
          project_id: 'proj-789',
          project_grant_id: null,
          state: State.ACTIVE,
          roles: ['admin'],
        },
        {
          id: 'grant-2',
          creation_date: new Date('2024-01-02'),
          change_date: new Date('2024-01-02'),
          sequence: 2,
          resource_owner: 'org-123',
          instance_id: 'inst-123',
          user_id: 'user-456',
          project_id: 'proj-890',
          project_grant_id: null,
          state: State.ACTIVE,
          roles: ['viewer'],
        },
      ];

      mockDatabase.query.mockResolvedValue({ rows: mockGrants });

      const result = await queries.getUserGrantsByUserID('user-456', 'inst-123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('grant-1');
      expect(result[1].id).toBe('grant-2');
    });

    it('should return empty array when no grants found', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await queries.getUserGrantsByUserID('user-456', 'inst-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('getUserGrantsByProjectID', () => {
    it('should return all grants for a project', async () => {
      const mockGrants = [
        {
          id: 'grant-1',
          creation_date: new Date('2024-01-01'),
          change_date: new Date('2024-01-01'),
          sequence: 1,
          resource_owner: 'org-123',
          instance_id: 'inst-123',
          user_id: 'user-456',
          project_id: 'proj-789',
          project_grant_id: null,
          state: State.ACTIVE,
          roles: ['admin'],
        },
        {
          id: 'grant-2',
          creation_date: new Date('2024-01-02'),
          change_date: new Date('2024-01-02'),
          sequence: 2,
          resource_owner: 'org-123',
          instance_id: 'inst-123',
          user_id: 'user-789',
          project_id: 'proj-789',
          project_grant_id: null,
          state: State.ACTIVE,
          roles: ['viewer'],
        },
      ];

      mockDatabase.query.mockResolvedValue({ rows: mockGrants });

      const result = await queries.getUserGrantsByProjectID('proj-789', 'inst-123');

      expect(result).toHaveLength(2);
      expect(result[0].projectID).toBe('proj-789');
      expect(result[1].projectID).toBe('proj-789');
    });
  });

  describe('checkUserGrant', () => {
    it('should return exists=true when grant exists', async () => {
      const mockGrant = {
        id: 'grant-1',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        user_id: 'user-456',
        project_id: 'proj-789',
        project_grant_id: null,
        state: State.ACTIVE,
        roles: ['admin', 'viewer'],
      };

      mockDatabase.queryOne.mockResolvedValue(mockGrant);

      const result = await queries.checkUserGrant('user-456', 'proj-789', 'inst-123');

      expect(result.exists).toBe(true);
      expect(result.grant).toBeDefined();
      expect(result.hasRole).toBe(true);
      expect(result.roles).toEqual(['admin', 'viewer']);
    });

    it('should check for specific role', async () => {
      const mockGrant = {
        id: 'grant-1',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        user_id: 'user-456',
        project_id: 'proj-789',
        project_grant_id: null,
        state: State.ACTIVE,
        roles: ['admin', 'viewer'],
      };

      mockDatabase.queryOne.mockResolvedValue(mockGrant);

      const result = await queries.checkUserGrant('user-456', 'proj-789', 'inst-123', 'admin');

      expect(result.exists).toBe(true);
      expect(result.hasRole).toBe(true);
    });

    it('should return hasRole=false when role not found', async () => {
      const mockGrant = {
        id: 'grant-1',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        user_id: 'user-456',
        project_id: 'proj-789',
        project_grant_id: null,
        state: State.ACTIVE,
        roles: ['viewer'],
      };

      mockDatabase.queryOne.mockResolvedValue(mockGrant);

      const result = await queries.checkUserGrant('user-456', 'proj-789', 'inst-123', 'admin');

      expect(result.exists).toBe(true);
      expect(result.hasRole).toBe(false);
    });

    it('should return exists=false when grant not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.checkUserGrant('user-456', 'proj-789', 'inst-123');

      expect(result.exists).toBe(false);
      expect(result.grant).toBeUndefined();
    });

    it('should only check active grants', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      await queries.checkUserGrant('user-456', 'proj-789', 'inst-123');

      const queryCall = mockDatabase.queryOne.mock.calls[0];
      expect(queryCall[1]).toContain(State.ACTIVE);
    });
  });
});
