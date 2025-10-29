/**
 * Project Queries Unit Tests
 * 
 * Comprehensive tests for all project query methods
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProjectQueries } from '../../../../src/lib/query/project/project-queries';
import { DatabasePool } from '../../../../src/lib/database/pool';
import { ProjectState } from '../../../../src/lib/query/project/project-types';

describe('ProjectQueries', () => {
  let projectQueries: ProjectQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  beforeEach(() => {
    // Create mock database
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
      queryMany: jest.fn(),
    } as any;

    projectQueries = new ProjectQueries(mockDatabase);
  });

  describe('getProjectByID', () => {
    it('should return project when found', async () => {
      const mockProject = {
        id: 'project-123',
        instance_id: 'inst-1',
        resource_owner: 'org-1',
        name: 'Test Project',
        state: ProjectState.ACTIVE,
        project_role_assertion: false,
        project_role_check: true,
        has_project_check: false,
        private_labeling_setting: 'ENFORCE_PROJECT_RESOURCE_OWNER_POLICY',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        sequence: 1,
      };

      mockDatabase.query.mockResolvedValue({ rows: [mockProject] } as any);

      const result = await projectQueries.getProjectByID('project-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('project-123');
      expect(result?.name).toBe('Test Project');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM projections.projects'),
        ['project-123', 'removed']
      );
    });

    it('should return null when project not found', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] } as any);

      const result = await projectQueries.getProjectByID('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('searchProjects', () => {
    it('should return all projects when no filters', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          instance_id: 'inst-1',
          resource_owner: 'org-1',
          name: 'Project 1',
          state: ProjectState.ACTIVE,
          project_role_assertion: false,
          project_role_check: true,
          has_project_check: false,
          private_labeling_setting: 'ENFORCE_PROJECT_RESOURCE_OWNER_POLICY',
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
          sequence: 1,
        },
      ];

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] } as any)
        .mockResolvedValueOnce({ rows: mockProjects } as any);

      const result = await projectQueries.searchProjects({});

      expect(result.total).toBe(1);
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].id).toBe('project-1');
    });

    it('should filter by name', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await projectQueries.searchProjects({ name: 'Test' });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('name ILIKE'),
        expect.arrayContaining(['%Test%'])
      );
    });

    it('should filter by resource owner', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await projectQueries.searchProjects({ resourceOwner: 'org-1' });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('resource_owner ='),
        expect.arrayContaining(['org-1'])
      );
    });

    it('should filter by state', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await projectQueries.searchProjects({ state: ProjectState.ACTIVE });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('state ='),
        expect.arrayContaining([ProjectState.ACTIVE])
      );
    });

    it('should apply pagination', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '100' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await projectQueries.searchProjects({ limit: 10, offset: 20 });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 20])
      );
    });
  });

  describe('getProjectsByOrg', () => {
    it('should return projects for organization', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          resource_owner: 'org-1',
          name: 'Project 1',
          state: ProjectState.ACTIVE,
          created_at: new Date(),
          updated_at: new Date(),
          sequence: 1,
        },
      ];

      mockDatabase.query.mockResolvedValue({ rows: mockProjects } as any);

      const result = await projectQueries.getProjectsByOrg('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('project-1');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('resource_owner = $1'),
        ['org-1', 'removed']
      );
    });
  });

  describe('searchProjectRoles', () => {
    it('should return project roles', async () => {
      const mockRoles = [
        {
          project_id: 'project-1',
          role_key: 'admin',
          display_name: 'Administrator',
          role_group: 'management',
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
          sequence: 1,
        },
      ];

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] } as any)
        .mockResolvedValueOnce({ rows: mockRoles } as any);

      const result = await projectQueries.searchProjectRoles({ projectId: 'project-1' });

      expect(result.total).toBe(1);
      expect(result.roles).toHaveLength(1);
      expect(result.roles[0].roleKey).toBe('admin');
    });

    it('should filter roles by key', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await projectQueries.searchProjectRoles({
        projectId: 'project-1',
        roleKey: 'admin',
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('role_key ILIKE'),
        expect.arrayContaining(['%admin%'])
      );
    });
  });

  describe('hasProjectRole', () => {
    it('should return true when role exists', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [{ dummy: 1 }] } as any);

      const result = await projectQueries.hasProjectRole('project-1', 'admin');

      expect(result).toBe(true);
    });

    it('should return false when role does not exist', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] } as any);

      const result = await projectQueries.hasProjectRole('project-1', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getProjectWithRoles', () => {
    it('should return project with roles', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        state: ProjectState.ACTIVE,
        created_at: new Date(),
        updated_at: new Date(),
        sequence: 1,
        resource_owner: 'org-1',
      };

      const mockRoles = [
        { project_id: 'project-1', role_key: 'admin', display_name: 'Admin', created_at: new Date(), updated_at: new Date(), sequence: 1 },
        { project_id: 'project-1', role_key: 'viewer', display_name: 'Viewer', created_at: new Date(), updated_at: new Date(), sequence: 1 },
      ];

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [mockProject] } as any)
        .mockResolvedValueOnce({ rows: mockRoles } as any);

      const result = await projectQueries.getProjectWithRoles('project-1');

      expect(result).toBeDefined();
      expect(result?.project.id).toBe('project-1');
      expect(result?.roles).toHaveLength(2);
    });

    it('should return null when project not found', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] } as any);

      const result = await projectQueries.getProjectWithRoles('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('countProjectsByOrg', () => {
    it('should return project count for organization', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [{ count: '42' }] } as any);

      const result = await projectQueries.countProjectsByOrg('org-1');

      expect(result).toBe(42);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        ['org-1', 'active']
      );
    });

    it('should return 0 when no projects', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [{ count: '0' }] } as any);

      const result = await projectQueries.countProjectsByOrg('org-1');

      expect(result).toBe(0);
    });
  });
});
