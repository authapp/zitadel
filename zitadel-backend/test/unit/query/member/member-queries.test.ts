/**
 * Unit tests for all Member Query types
 * Tests instance, org, project, and project grant member retrieval
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InstanceMemberQueries } from '../../../../src/lib/query/member/instance-member-queries';
import { OrgMemberQueries } from '../../../../src/lib/query/member/org-member-queries';
import { ProjectMemberQueries } from '../../../../src/lib/query/member/project-member-queries';
import { ProjectGrantMemberQueries } from '../../../../src/lib/query/member/project-grant-member-queries';

describe('Member Queries', () => {
  let mockDatabase: any;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    };
  });

  describe('InstanceMemberQueries', () => {
    let queries: InstanceMemberQueries;

    beforeEach(() => {
      queries = new InstanceMemberQueries(mockDatabase);
    });

    describe('searchIAMMembers', () => {
      it('should search instance members with filters', async () => {
        const mockMembers = [
          {
            instance_id: 'inst-123',
            user_id: 'user-456',
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: 1,
            resource_owner: 'inst-123',
            roles: ['IAM_OWNER', 'IAM_ADMIN'],
            user_name: 'admin@example.com',
            email: 'admin@example.com',
            first_name: 'Admin',
            last_name: 'User',
            display_name: 'Admin User',
          },
        ];

        mockDatabase.queryOne.mockResolvedValue({ count: '1' });
        mockDatabase.query.mockResolvedValue({ rows: mockMembers });

        const result = await queries.searchIAMMembers({
          instanceID: 'inst-123',
          limit: 50,
          offset: 0,
        });

        expect(result.members).toHaveLength(1);
        expect(result.members[0].userID).toBe('user-456');
        expect(result.members[0].roles).toEqual(['IAM_OWNER', 'IAM_ADMIN']);
        expect(result.totalCount).toBe(1);
      });

      it('should filter by userID', async () => {
        mockDatabase.queryOne.mockResolvedValue({ count: '1' });
        mockDatabase.query.mockResolvedValue({ rows: [] });

        await queries.searchIAMMembers({
          instanceID: 'inst-123',
          userID: 'user-456',
        });

        const queryCall = mockDatabase.query.mock.calls[0];
        expect(queryCall[0]).toContain('im.user_id = $2');
      });

      it('should filter by roles', async () => {
        mockDatabase.queryOne.mockResolvedValue({ count: '1' });
        mockDatabase.query.mockResolvedValue({ rows: [] });

        await queries.searchIAMMembers({
          instanceID: 'inst-123',
          roles: ['IAM_ADMIN'],
        });

        const queryCall = mockDatabase.query.mock.calls[0];
        expect(queryCall[0]).toContain('im.roles &&');
      });
    });

    describe('getIAMMemberByIAMIDAndUserID', () => {
      it('should return instance member by ID', async () => {
        const mockMember = {
          instance_id: 'inst-123',
          user_id: 'user-456',
          creation_date: new Date('2024-01-01'),
          change_date: new Date('2024-01-01'),
          sequence: 1,
          resource_owner: 'inst-123',
          roles: ['IAM_OWNER'],
          user_name: 'admin@example.com',
        };

        mockDatabase.queryOne.mockResolvedValue(mockMember);

        const result = await queries.getIAMMemberByIAMIDAndUserID('inst-123', 'user-456');

        expect(result).toBeDefined();
        expect(result!.iamID).toBe('inst-123');
        expect(result!.userID).toBe('user-456');
      });

      it('should return null when member not found', async () => {
        mockDatabase.queryOne.mockResolvedValue(null);

        const result = await queries.getIAMMemberByIAMIDAndUserID('inst-123', 'user-456');

        expect(result).toBeNull();
      });
    });
  });

  describe('OrgMemberQueries', () => {
    let queries: OrgMemberQueries;

    beforeEach(() => {
      queries = new OrgMemberQueries(mockDatabase);
    });

    describe('searchOrgMembers', () => {
      it('should search org members with filters', async () => {
        const mockMembers = [
          {
            org_id: 'org-123',
            user_id: 'user-456',
            instance_id: 'inst-123',
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: 1,
            resource_owner: 'org-123',
            roles: ['ORG_OWNER'],
            user_name: 'owner@example.com',
            org_name: 'My Org',
            org_domain: 'myorg.com',
          },
        ];

        mockDatabase.queryOne.mockResolvedValue({ count: '1' });
        mockDatabase.query.mockResolvedValue({ rows: mockMembers });

        const result = await queries.searchOrgMembers({
          instanceID: 'inst-123',
          orgID: 'org-123',
        });

        expect(result.members).toHaveLength(1);
        expect(result.members[0].orgID).toBe('org-123');
        expect(result.members[0].orgName).toBe('My Org');
      });

      it('should filter by orgID', async () => {
        mockDatabase.queryOne.mockResolvedValue({ count: '1' });
        mockDatabase.query.mockResolvedValue({ rows: [] });

        await queries.searchOrgMembers({
          instanceID: 'inst-123',
          orgID: 'org-123',
        });

        const queryCall = mockDatabase.query.mock.calls[0];
        expect(queryCall[0]).toContain('om.org_id = $2');
      });
    });

    describe('getOrgMemberByID', () => {
      it('should return org member by ID', async () => {
        const mockMember = {
          org_id: 'org-123',
          user_id: 'user-456',
          instance_id: 'inst-123',
          creation_date: new Date('2024-01-01'),
          change_date: new Date('2024-01-01'),
          sequence: 1,
          resource_owner: 'org-123',
          roles: ['ORG_OWNER'],
        };

        mockDatabase.queryOne.mockResolvedValue(mockMember);

        const result = await queries.getOrgMemberByID('org-123', 'user-456', 'inst-123');

        expect(result).toBeDefined();
        expect(result!.orgID).toBe('org-123');
        expect(result!.userID).toBe('user-456');
      });

      it('should return null when member not found', async () => {
        mockDatabase.queryOne.mockResolvedValue(null);

        const result = await queries.getOrgMemberByID('org-123', 'user-456', 'inst-123');

        expect(result).toBeNull();
      });
    });
  });

  describe('ProjectMemberQueries', () => {
    let queries: ProjectMemberQueries;

    beforeEach(() => {
      queries = new ProjectMemberQueries(mockDatabase);
    });

    describe('searchProjectMembers', () => {
      it('should search project members with filters', async () => {
        const mockMembers = [
          {
            project_id: 'proj-789',
            user_id: 'user-456',
            instance_id: 'inst-123',
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: 1,
            resource_owner: 'org-123',
            roles: ['PROJECT_OWNER'],
            user_name: 'owner@example.com',
            project_name: 'My Project',
            project_owner: 'org-123',
          },
        ];

        mockDatabase.queryOne.mockResolvedValue({ count: '1' });
        mockDatabase.query.mockResolvedValue({ rows: mockMembers });

        const result = await queries.searchProjectMembers({
          instanceID: 'inst-123',
          projectID: 'proj-789',
        });

        expect(result.members).toHaveLength(1);
        expect(result.members[0].projectID).toBe('proj-789');
        expect(result.members[0].projectName).toBe('My Project');
      });

      it('should filter by projectID', async () => {
        mockDatabase.queryOne.mockResolvedValue({ count: '1' });
        mockDatabase.query.mockResolvedValue({ rows: [] });

        await queries.searchProjectMembers({
          instanceID: 'inst-123',
          projectID: 'proj-789',
        });

        const queryCall = mockDatabase.query.mock.calls[0];
        expect(queryCall[0]).toContain('pm.project_id = $2');
      });
    });

    describe('getProjectMemberByID', () => {
      it('should return project member by ID', async () => {
        const mockMember = {
          project_id: 'proj-789',
          user_id: 'user-456',
          instance_id: 'inst-123',
          creation_date: new Date('2024-01-01'),
          change_date: new Date('2024-01-01'),
          sequence: 1,
          resource_owner: 'org-123',
          roles: ['PROJECT_OWNER'],
        };

        mockDatabase.queryOne.mockResolvedValue(mockMember);

        const result = await queries.getProjectMemberByID('proj-789', 'user-456', 'inst-123');

        expect(result).toBeDefined();
        expect(result!.projectID).toBe('proj-789');
        expect(result!.userID).toBe('user-456');
      });

      it('should return null when member not found', async () => {
        mockDatabase.queryOne.mockResolvedValue(null);

        const result = await queries.getProjectMemberByID('proj-789', 'user-456', 'inst-123');

        expect(result).toBeNull();
      });
    });
  });

  describe('ProjectGrantMemberQueries', () => {
    let queries: ProjectGrantMemberQueries;

    beforeEach(() => {
      queries = new ProjectGrantMemberQueries(mockDatabase);
    });

    describe('searchProjectGrantMembers', () => {
      it('should search project grant members with filters', async () => {
        const mockMembers = [
          {
            project_id: 'proj-789',
            grant_id: 'grant-111',
            user_id: 'user-456',
            instance_id: 'inst-123',
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: 1,
            resource_owner: 'org-123',
            roles: ['PROJECT_GRANT_OWNER'],
            user_name: 'owner@example.com',
            project_name: 'My Project',
            granted_org_id: 'org-456',
            granted_org_name: 'Partner Org',
          },
        ];

        mockDatabase.queryOne.mockResolvedValue({ count: '1' });
        mockDatabase.query.mockResolvedValue({ rows: mockMembers });

        const result = await queries.searchProjectGrantMembers({
          instanceID: 'inst-123',
          grantID: 'grant-111',
        });

        expect(result.members).toHaveLength(1);
        expect(result.members[0].grantID).toBe('grant-111');
        expect(result.members[0].grantedOrgName).toBe('Partner Org');
      });

      it('should filter by grantID', async () => {
        mockDatabase.queryOne.mockResolvedValue({ count: '1' });
        mockDatabase.query.mockResolvedValue({ rows: [] });

        await queries.searchProjectGrantMembers({
          instanceID: 'inst-123',
          grantID: 'grant-111',
        });

        const queryCall = mockDatabase.query.mock.calls[0];
        expect(queryCall[0]).toContain('pgm.grant_id = $2');
      });

      it('should filter by projectID', async () => {
        mockDatabase.queryOne.mockResolvedValue({ count: '1' });
        mockDatabase.query.mockResolvedValue({ rows: [] });

        await queries.searchProjectGrantMembers({
          instanceID: 'inst-123',
          projectID: 'proj-789',
        });

        const queryCall = mockDatabase.query.mock.calls[0];
        expect(queryCall[0]).toContain('pgm.project_id = $2');
      });
    });

    describe('getProjectGrantMemberByID', () => {
      it('should return project grant member by ID', async () => {
        const mockMember = {
          project_id: 'proj-789',
          grant_id: 'grant-111',
          user_id: 'user-456',
          instance_id: 'inst-123',
          creation_date: new Date('2024-01-01'),
          change_date: new Date('2024-01-01'),
          sequence: 1,
          resource_owner: 'org-123',
          roles: ['PROJECT_GRANT_OWNER'],
        };

        mockDatabase.queryOne.mockResolvedValue(mockMember);

        const result = await queries.getProjectGrantMemberByID(
          'proj-789',
          'grant-111',
          'user-456',
          'inst-123'
        );

        expect(result).toBeDefined();
        expect(result!.projectID).toBe('proj-789');
        expect(result!.grantID).toBe('grant-111');
        expect(result!.userID).toBe('user-456');
      });

      it('should return null when member not found', async () => {
        mockDatabase.queryOne.mockResolvedValue(null);

        const result = await queries.getProjectGrantMemberByID(
          'proj-789',
          'grant-111',
          'user-456',
          'inst-123'
        );

        expect(result).toBeNull();
      });
    });
  });

  describe('Common Member Features', () => {
    it('should handle array roles correctly', async () => {
      const queries = new OrgMemberQueries(mockDatabase);
      
      const mockMember = {
        org_id: 'org-123',
        user_id: 'user-456',
        instance_id: 'inst-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        roles: ['ORG_OWNER', 'ORG_ADMIN'],
      };

      mockDatabase.queryOne.mockResolvedValue(mockMember);

      const result = await queries.getOrgMemberByID('org-123', 'user-456', 'inst-123');

      expect(Array.isArray(result!.roles)).toBe(true);
      expect(result!.roles).toEqual(['ORG_OWNER', 'ORG_ADMIN']);
    });

    it('should support pagination', async () => {
      const queries = new ProjectMemberQueries(mockDatabase);

      mockDatabase.queryOne.mockResolvedValue({ count: '100' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await queries.searchProjectMembers({
        instanceID: 'inst-123',
        limit: 25,
        offset: 50,
      });

      expect(result.limit).toBe(25);
      expect(result.offset).toBe(50);
    });

    it('should support user info joins', async () => {
      const queries = new InstanceMemberQueries(mockDatabase);

      const mockMember = {
        instance_id: 'inst-123',
        user_id: 'user-456',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'inst-123',
        roles: ['IAM_OWNER'],
        user_name: 'admin@example.com',
        email: 'admin@example.com',
        first_name: 'Admin',
        last_name: 'User',
        display_name: 'Admin User',
        preferred_login_name: 'admin',
        avatar_url: 'https://example.com/avatar.jpg',
      };

      mockDatabase.queryOne.mockResolvedValue(mockMember);

      const result = await queries.getIAMMemberByIAMIDAndUserID('inst-123', 'user-456');

      expect(result!.userName).toBe('admin@example.com');
      expect(result!.email).toBe('admin@example.com');
      expect(result!.firstName).toBe('Admin');
      expect(result!.lastName).toBe('User');
      expect(result!.displayName).toBe('Admin User');
      expect(result!.avatarURL).toBe('https://example.com/avatar.jpg');
    });
  });
});
