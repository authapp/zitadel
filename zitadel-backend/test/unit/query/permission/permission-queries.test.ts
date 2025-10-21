/**
 * Unit tests for Permission Queries
 * Tests authorization permission checking and aggregation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PermissionQueries } from '../../../../src/lib/query/permission/permission-queries';
import { SystemPermissionQueries } from '../../../../src/lib/query/permission/system-permission-queries';
import {
  PermissionContext,
  Permission,
  ConditionType,
  ZitadelResource,
  ZitadelAction,
} from '../../../../src/lib/query/permission/permission-types';

describe('Permission Queries', () => {
  let queries: PermissionQueries;
  let systemQueries: SystemPermissionQueries;
  let mockDatabase: any;

  beforeEach(() => {
    jest.useFakeTimers();
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    };
    queries = new PermissionQueries(mockDatabase);
    systemQueries = new SystemPermissionQueries(mockDatabase);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('PermissionQueries', () => {
    describe('checkUserPermissions', () => {
      it('should return true when user has required permissions', async () => {
        const context: PermissionContext = {
          userID: 'user-123',
          instanceID: 'inst-123',
          projectID: 'proj-789',
        };

        // Mock user grants
        mockDatabase.queryOne
          .mockResolvedValueOnce(null) // instance member
          .mockResolvedValueOnce(null) // org member
          .mockResolvedValueOnce(null); // project member
        
        mockDatabase.query.mockResolvedValueOnce({
          rows: [
            {
              roles: ['PROJECT_OWNER'],
              project_id: 'proj-789',
              resource_owner: 'org-123',
            },
          ],
        }).mockResolvedValueOnce({
          rows: [], // project grants
        });

        const requiredPermissions: Permission[] = [
          { resource: 'zitadel.project', action: 'manage' },
        ];

        const result = await queries.checkUserPermissions(context, requiredPermissions);

        expect(result.hasPermission).toBe(true);
        expect(result.matchedPermissions).toHaveLength(1);
      });

      it('should return false when user lacks required permissions', async () => {
        const context: PermissionContext = {
          userID: 'user-123',
          instanceID: 'inst-123',
        };

        mockDatabase.queryOne.mockResolvedValue(null);
        mockDatabase.query.mockResolvedValue({ rows: [] });

        const requiredPermissions: Permission[] = [
          { resource: 'zitadel.instance', action: 'manage' },
        ];

        const result = await queries.checkUserPermissions(context, requiredPermissions);

        expect(result.hasPermission).toBe(false);
        expect(result.reason).toBe('Missing required permissions');
      });
    });

    describe('getMyPermissions', () => {
      it('should aggregate permissions from all sources', async () => {
        const context: PermissionContext = {
          userID: 'user-123',
          instanceID: 'inst-123',
          orgID: 'org-456',
        };

        // Mock instance member
        mockDatabase.queryOne
          .mockResolvedValueOnce({
            roles: ['IAM_OWNER'],
          })
          // Mock org member
          .mockResolvedValueOnce({
            roles: ['ORG_OWNER'],
            org_id: 'org-456',
          })
          // Mock project member
          .mockResolvedValueOnce(null);

        // Mock user grants
        mockDatabase.query
          .mockResolvedValueOnce({ rows: [] })
          // Mock project grants
          .mockResolvedValueOnce({ rows: [] });

        const result = await queries.getMyPermissions(context);

        expect(result.userID).toBe('user-123');
        expect(result.instanceID).toBe('inst-123');
        expect(result.permissions.length).toBeGreaterThan(0);
      });

      it('should cache permissions', async () => {
        const context: PermissionContext = {
          userID: 'user-123',
          instanceID: 'inst-123',
        };

        mockDatabase.queryOne.mockResolvedValue(null);
        mockDatabase.query.mockResolvedValue({ rows: [] });

        // First call
        const result1 = await queries.getMyPermissions(context);
        
        // Clear mock call counts
        mockDatabase.queryOne.mockClear();
        mockDatabase.query.mockClear();
        
        // Second call should use cache (no database queries)
        const result2 = await queries.getMyPermissions(context);

        // Should not query database on second call (cache hit)
        expect(mockDatabase.queryOne).toHaveBeenCalledTimes(0);
        expect(mockDatabase.query).toHaveBeenCalledTimes(0);
        expect(result1.userID).toBe(result2.userID);
      });
    });

    describe('getGlobalPermissions', () => {
      it('should return instance-level permissions', async () => {
        mockDatabase.queryOne.mockResolvedValue({
          roles: ['IAM_OWNER'],
        });

        const result = await queries.getGlobalPermissions('user-123', 'inst-123');

        expect(result.length).toBeGreaterThan(0);
        expect(result.some(p => p.resource === 'zitadel.instance')).toBe(true);
      });

      it('should return empty array for non-instance members', async () => {
        mockDatabase.queryOne.mockResolvedValue(null);

        const result = await queries.getGlobalPermissions('user-123', 'inst-123');

        expect(result).toEqual([]);
      });
    });

    describe('clearCache', () => {
      it('should clear cached permissions for user', async () => {
        const context: PermissionContext = {
          userID: 'user-123',
          instanceID: 'inst-123',
        };

        mockDatabase.queryOne.mockResolvedValue(null);
        mockDatabase.query.mockResolvedValue({ rows: [] });

        // Populate cache
        await queries.getMyPermissions(context);

        // Clear cache
        queries.clearCache('user-123', 'inst-123');

        // Next call should query database again
        mockDatabase.queryOne.mockClear();
        mockDatabase.query.mockClear();
        
        await queries.getMyPermissions(context);

        expect(mockDatabase.queryOne).toHaveBeenCalled();
      });
    });

    describe('permission conditions', () => {
      it('should check project conditions', async () => {
        const context: PermissionContext = {
          userID: 'user-123',
          instanceID: 'inst-123',
          projectID: 'proj-789',
        };

        mockDatabase.queryOne.mockResolvedValue(null);
        mockDatabase.query
          .mockResolvedValueOnce({
            rows: [
              {
                roles: ['PROJECT_OWNER'],
                project_id: 'proj-789',
                resource_owner: 'org-123',
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] });

        const requiredPermissions: Permission[] = [
          {
            resource: 'zitadel.project',
            action: 'manage',
            conditions: [{ type: ConditionType.PROJECT, value: 'proj-789' }],
          },
        ];

        const result = await queries.checkUserPermissions(context, requiredPermissions);

        expect(result.hasPermission).toBe(true);
      });

      it('should reject permissions with mismatched conditions', async () => {
        const context: PermissionContext = {
          userID: 'user-123',
          instanceID: 'inst-123',
          projectID: 'proj-789',
        };

        mockDatabase.queryOne.mockResolvedValue(null);
        mockDatabase.query
          .mockResolvedValueOnce({
            rows: [
              {
                roles: ['PROJECT_OWNER'],
                project_id: 'proj-789',
                resource_owner: 'org-123',
              },
            ],
          })
          .mockResolvedValueOnce({ rows: [] });

        const requiredPermissions: Permission[] = [
          {
            resource: 'zitadel.project',
            action: 'manage',
            conditions: [{ type: ConditionType.PROJECT, value: 'proj-999' }], // Different project
          },
        ];

        const result = await queries.checkUserPermissions(context, requiredPermissions);

        expect(result.hasPermission).toBe(false);
      });
    });
  });

  describe('SystemPermissionQueries', () => {
    describe('getMyZitadelPermissions', () => {
      it('should return system permissions for IAM owner', async () => {
        mockDatabase.queryOne.mockResolvedValue({
          roles: ['IAM_OWNER'],
        });

        const result = await systemQueries.getMyZitadelPermissions('user-123', 'inst-123');

        expect(result.length).toBeGreaterThan(0);
        expect(result.some(p => p.resource === ZitadelResource.INSTANCE)).toBe(true);
      });

      it('should return limited permissions for IAM user', async () => {
        mockDatabase.queryOne.mockResolvedValue({
          roles: ['IAM_USER'],
        });

        const result = await systemQueries.getMyZitadelPermissions('user-123', 'inst-123');

        expect(result.length).toBeGreaterThan(0);
        expect(result.every(p => p.action === ZitadelAction.READ)).toBe(true);
      });

      it('should return empty array for non-instance members', async () => {
        mockDatabase.queryOne.mockResolvedValue(null);

        const result = await systemQueries.getMyZitadelPermissions('user-123', 'inst-123');

        expect(result).toEqual([]);
      });
    });

    describe('hasZitadelPermission', () => {
      it('should return true when user has specific permission', async () => {
        mockDatabase.queryOne.mockResolvedValue({
          roles: ['IAM_OWNER'],
        });

        const result = await systemQueries.hasZitadelPermission(
          'user-123',
          'inst-123',
          ZitadelResource.ORG,
          ZitadelAction.MANAGE
        );

        expect(result).toBe(true);
      });

      it('should return false when user lacks permission', async () => {
        mockDatabase.queryOne.mockResolvedValue({
          roles: ['IAM_USER'],
        });

        const result = await systemQueries.hasZitadelPermission(
          'user-123',
          'inst-123',
          ZitadelResource.INSTANCE,
          ZitadelAction.MANAGE
        );

        expect(result).toBe(false);
      });
    });

    describe('getInstanceOwnerPermissions', () => {
      it('should return all permissions', async () => {
        const result = await systemQueries.getInstanceOwnerPermissions('inst-123');

        expect(result.length).toBeGreaterThan(0);
        expect(result.every(p => p.action === ZitadelAction.MANAGE)).toBe(true);
      });
    });

    describe('permission conversion', () => {
      it('should convert Zitadel permission to generic permission', () => {
        const zitadelPerm = {
          resource: ZitadelResource.ORG,
          action: ZitadelAction.MANAGE,
        };

        const result = systemQueries.toGenericPermission(zitadelPerm);

        expect(result.resource).toBe(ZitadelResource.ORG);
        expect(result.action).toBe(ZitadelAction.MANAGE);
      });

      it('should convert multiple Zitadel permissions', () => {
        const zitadelPerms = [
          { resource: ZitadelResource.ORG, action: ZitadelAction.MANAGE },
          { resource: ZitadelResource.USER, action: ZitadelAction.READ },
        ];

        const result = systemQueries.toGenericPermissions(zitadelPerms);

        expect(result).toHaveLength(2);
        expect(result[0].resource).toBe(ZitadelResource.ORG);
        expect(result[1].resource).toBe(ZitadelResource.USER);
      });
    });
  });
});
