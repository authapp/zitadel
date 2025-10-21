/**
 * Unit tests for User Membership Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UserMembershipQueries } from '../../../../src/lib/query/user-membership/user-membership-queries';
import { MemberType } from '../../../../src/lib/query/user-membership/user-membership-types';
import { DatabasePool } from '../../../../src/lib/database';

describe('UserMembershipQueries', () => {
  let queries: UserMembershipQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_USER_ID = 'user-123';
  const TEST_INSTANCE_ID = 'inst-456';
  const TEST_ORG_ID = 'org-789';
  const TEST_PROJECT_ID = 'proj-999';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new UserMembershipQueries(mockDatabase);
  });

  describe('getUserMemberships', () => {
    it('should aggregate memberships from all scopes', async () => {
      // Mock instance membership
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{
            user_id: TEST_USER_ID,
            instance_id: TEST_INSTANCE_ID,
            roles: ['IAM_OWNER'],
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: '1',
            resource_owner: TEST_INSTANCE_ID,
          }],
        } as any)
        // Mock org memberships
        .mockResolvedValueOnce({
          rows: [{
            user_id: TEST_USER_ID,
            org_id: TEST_ORG_ID,
            instance_id: TEST_INSTANCE_ID,
            roles: ['ORG_OWNER'],
            creation_date: new Date('2024-01-02'),
            change_date: new Date('2024-01-02'),
            sequence: '2',
            resource_owner: TEST_ORG_ID,
            org_name: 'Test Org',
          }],
        } as any)
        // Mock project memberships
        .mockResolvedValueOnce({ rows: [] } as any)
        // Mock project grant memberships
        .mockResolvedValueOnce({ rows: [] } as any);

      const memberships = await queries.getUserMemberships(TEST_USER_ID, TEST_INSTANCE_ID);

      expect(memberships).toHaveLength(2);
      expect(memberships[0].memberType).toBe(MemberType.ORG); // Newer first
      expect(memberships[1].memberType).toBe(MemberType.INSTANCE);
      expect(mockDatabase.query).toHaveBeenCalledTimes(4);
    });

    it('should sort memberships by creation date (newest first)', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{
            user_id: TEST_USER_ID,
            instance_id: TEST_INSTANCE_ID,
            roles: ['IAM_OWNER'],
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: '1',
            resource_owner: TEST_INSTANCE_ID,
          }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            user_id: TEST_USER_ID,
            org_id: TEST_ORG_ID,
            instance_id: TEST_INSTANCE_ID,
            roles: ['ORG_OWNER'],
            creation_date: new Date('2024-01-05'),
            change_date: new Date('2024-01-05'),
            sequence: '2',
            resource_owner: TEST_ORG_ID,
            org_name: 'Test Org',
          }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            user_id: TEST_USER_ID,
            project_id: TEST_PROJECT_ID,
            instance_id: TEST_INSTANCE_ID,
            roles: ['PROJECT_OWNER'],
            creation_date: new Date('2024-01-03'),
            change_date: new Date('2024-01-03'),
            sequence: '3',
            resource_owner: TEST_ORG_ID,
            project_name: 'Test Project',
          }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const memberships = await queries.getUserMemberships(TEST_USER_ID, TEST_INSTANCE_ID);

      expect(memberships).toHaveLength(3);
      expect(memberships[0].creationDate.getTime()).toBeGreaterThan(
        memberships[1].creationDate.getTime()
      );
      expect(memberships[1].creationDate.getTime()).toBeGreaterThan(
        memberships[2].creationDate.getTime()
      );
    });

    it('should return empty array when user has no memberships', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const memberships = await queries.getUserMemberships(TEST_USER_ID, TEST_INSTANCE_ID);

      expect(memberships).toEqual([]);
    });
  });

  describe('searchUserMemberships', () => {
    it('should search memberships with no filters', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{
            user_id: TEST_USER_ID,
            instance_id: TEST_INSTANCE_ID,
            roles: ['IAM_OWNER'],
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: '1',
            resource_owner: TEST_INSTANCE_ID,
          }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await queries.searchUserMemberships({
        userID: TEST_USER_ID,
        instanceID: TEST_INSTANCE_ID,
      });

      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.limit).toBe(100);
      expect(result.offset).toBe(0);
    });

    it('should filter by member types', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{
            user_id: TEST_USER_ID,
            instance_id: TEST_INSTANCE_ID,
            roles: ['IAM_OWNER'],
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: '1',
            resource_owner: TEST_INSTANCE_ID,
          }],
        } as any);

      const result = await queries.searchUserMemberships({
        userID: TEST_USER_ID,
        instanceID: TEST_INSTANCE_ID,
        memberTypes: [MemberType.INSTANCE],
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].memberType).toBe(MemberType.INSTANCE);
      expect(mockDatabase.query).toHaveBeenCalledTimes(1);
    });

    it('should apply pagination', async () => {
      const mockRows = Array.from({ length: 10 }, (_, i) => ({
        user_id: TEST_USER_ID,
        org_id: `org-${i}`,
        instance_id: TEST_INSTANCE_ID,
        roles: ['ORG_OWNER'],
        creation_date: new Date(`2024-01-${i + 1}`),
        change_date: new Date(`2024-01-${i + 1}`),
        sequence: `${i}`,
        resource_owner: `org-${i}`,
        org_name: `Org ${i}`,
      }));

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: mockRows } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await queries.searchUserMemberships({
        userID: TEST_USER_ID,
        instanceID: TEST_INSTANCE_ID,
        limit: 5,
        offset: 2,
      });

      expect(result.items).toHaveLength(5);
      expect(result.totalCount).toBe(10);
      expect(result.limit).toBe(5);
      expect(result.offset).toBe(2);
    });

    it('should filter by orgID', async () => {
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          user_id: TEST_USER_ID,
          org_id: TEST_ORG_ID,
          instance_id: TEST_INSTANCE_ID,
          roles: ['ORG_OWNER'],
          creation_date: new Date('2024-01-01'),
          change_date: new Date('2024-01-01'),
          sequence: '1',
          resource_owner: TEST_ORG_ID,
          org_name: 'Test Org',
        }],
      } as any);

      const result = await queries.searchUserMemberships({
        userID: TEST_USER_ID,
        instanceID: TEST_INSTANCE_ID,
        memberTypes: [MemberType.ORG],
        orgID: TEST_ORG_ID,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].orgID).toBe(TEST_ORG_ID);
    });

    it('should filter by projectID', async () => {
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          user_id: TEST_USER_ID,
          project_id: TEST_PROJECT_ID,
          instance_id: TEST_INSTANCE_ID,
          roles: ['PROJECT_OWNER'],
          creation_date: new Date('2024-01-01'),
          change_date: new Date('2024-01-01'),
          sequence: '1',
          resource_owner: TEST_ORG_ID,
          project_name: 'Test Project',
        }],
      } as any);

      const result = await queries.searchUserMemberships({
        userID: TEST_USER_ID,
        instanceID: TEST_INSTANCE_ID,
        memberTypes: [MemberType.PROJECT],
        projectID: TEST_PROJECT_ID,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].projectID).toBe(TEST_PROJECT_ID);
    });
  });

  describe('Membership Types', () => {
    it('should correctly identify instance membership', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{
            user_id: TEST_USER_ID,
            instance_id: TEST_INSTANCE_ID,
            roles: ['IAM_OWNER'],
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: '1',
            resource_owner: TEST_INSTANCE_ID,
          }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const memberships = await queries.getUserMemberships(TEST_USER_ID, TEST_INSTANCE_ID);

      expect(memberships[0].memberType).toBe(MemberType.INSTANCE);
      expect(memberships[0].displayName).toBe('Instance');
    });

    it('should correctly identify org membership with display name', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({
          rows: [{
            user_id: TEST_USER_ID,
            org_id: TEST_ORG_ID,
            instance_id: TEST_INSTANCE_ID,
            roles: ['ORG_OWNER'],
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: '1',
            resource_owner: TEST_ORG_ID,
            org_name: 'Test Organization',
          }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const memberships = await queries.getUserMemberships(TEST_USER_ID, TEST_INSTANCE_ID);

      expect(memberships[0].memberType).toBe(MemberType.ORG);
      expect(memberships[0].displayName).toBe('Test Organization');
      expect(memberships[0].orgName).toBe('Test Organization');
    });

    it('should correctly identify project membership', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({
          rows: [{
            user_id: TEST_USER_ID,
            project_id: TEST_PROJECT_ID,
            instance_id: TEST_INSTANCE_ID,
            roles: ['PROJECT_OWNER'],
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: '1',
            resource_owner: TEST_ORG_ID,
            project_name: 'Test Project',
            project_org_id: TEST_ORG_ID,
          }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const memberships = await queries.getUserMemberships(TEST_USER_ID, TEST_INSTANCE_ID);

      expect(memberships[0].memberType).toBe(MemberType.PROJECT);
      expect(memberships[0].displayName).toBe('Test Project');
      expect(memberships[0].projectName).toBe('Test Project');
    });

    it('should correctly identify project grant membership', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({
          rows: [{
            user_id: TEST_USER_ID,
            project_id: TEST_PROJECT_ID,
            grant_id: 'grant-123',
            instance_id: TEST_INSTANCE_ID,
            roles: ['PROJECT_GRANT_MEMBER'],
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: '1',
            resource_owner: TEST_ORG_ID,
            project_name: 'Test Project',
            granted_org_id: TEST_ORG_ID,
          }],
        } as any);

      const memberships = await queries.getUserMemberships(TEST_USER_ID, TEST_INSTANCE_ID);

      expect(memberships[0].memberType).toBe(MemberType.PROJECT_GRANT);
      expect(memberships[0].displayName).toContain('(Grant)');
      expect(memberships[0].grantID).toBe('grant-123');
    });
  });
});
