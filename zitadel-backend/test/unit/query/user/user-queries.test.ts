/**
 * User Queries Unit Tests
 * 
 * Comprehensive tests for all user query methods
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UserQueries } from '../../../../src/lib/query/user/user-queries';
import { DatabasePool } from '../../../../src/lib/database/pool';
import { UserState, UserType, UserSortField } from '../../../../src/lib/query/user/user-types';

describe('UserQueries', () => {
  let userQueries: UserQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  beforeEach(() => {
    // Create mock database
    mockDatabase = {
      queryOne: jest.fn(),
      queryMany: jest.fn(),
      query: jest.fn(),
    } as any;

    userQueries = new UserQueries(mockDatabase);
  });

  describe('getUserByID', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 'user-123',
        instance_id: 'inst-1',
        resource_owner: 'org-1',
        username: 'testuser',
        email: 'test@example.com',
        email_verified: true,
        email_verified_at: new Date('2024-01-01'),
        phone: '+1234567890',
        phone_verified: true,
        phone_verified_at: new Date('2024-01-01'),
        first_name: 'Test',
        last_name: 'User',
        display_name: 'Test User',
        nickname: 'tester',
        preferred_language: 'en',
        gender: 'other',
        avatar_url: 'https://example.com/avatar.jpg',
        preferred_login_name: 'testuser@example.com',
        login_names: ['testuser', 'test@example.com'],
        password_hash: 'hashed_password',
        password_changed_at: new Date('2024-01-01'),
        password_change_required: false,
        mfa_enabled: true,
        state: UserState.ACTIVE,
        user_type: UserType.HUMAN,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        deleted_at: null,
      };

      mockDatabase.queryOne.mockResolvedValue(mockUser);

      const result = await userQueries.getUserByID('user-123', 'inst-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('user-123');
      expect(result?.username).toBe('testuser');
      expect(result?.email).toBe('test@example.com');
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('FROM projections.users'),
        ['user-123', 'inst-1']
      );
    });

    it('should return null when user not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await userQueries.getUserByID('nonexistent', 'inst-1');

      expect(result).toBeNull();
    });

    it('should filter by instance ID', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      await userQueries.getUserByID('user-123', 'inst-2');

      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('instance_id = $2'),
        ['user-123', 'inst-2']
      );
    });
  });

  describe('getUserByLoginName', () => {
    it('should find user by username', async () => {
      const mockUser = {
        id: 'user-123',
        instance_id: 'inst-1',
        resource_owner: 'org-1',
        username: 'testuser',
        email: 'test@example.com',
        state: UserState.ACTIVE,
        user_type: UserType.HUMAN,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDatabase.queryOne.mockResolvedValue(mockUser);

      const result = await userQueries.getUserByLoginName('testuser', 'org-1', 'inst-1');

      expect(result).toBeDefined();
      expect(result?.username).toBe('testuser');
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('username = $1 OR email = $1'),
        ['testuser', 'org-1', 'inst-1']
      );
    });

    it('should find user by email', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        state: UserState.ACTIVE,
        user_type: UserType.HUMAN,
      };

      mockDatabase.queryOne.mockResolvedValue(mockUser as any);

      const result = await userQueries.getUserByLoginName('test@example.com', 'org-1', 'inst-1');

      expect(result).toBeDefined();
    });

    it('should filter by resource owner', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      await userQueries.getUserByLoginName('testuser', 'org-2', 'inst-1');

      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('resource_owner = $2'),
        ['testuser', 'org-2', 'inst-1']
      );
    });
  });

  describe('searchUsers', () => {
    it('should search users with filters', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '10' });
      mockDatabase.queryMany.mockResolvedValue([
        {
          id: 'user-1',
          username: 'user1',
          email: 'user1@example.com',
          state: UserState.ACTIVE,
          user_type: UserType.HUMAN,
          created_at: new Date(),
        },
        {
          id: 'user-2',
          username: 'user2',
          email: 'user2@example.com',
          state: UserState.ACTIVE,
          user_type: UserType.HUMAN,
          created_at: new Date(),
        },
      ] as any[]);

      const result = await userQueries.searchUsers(
        {
          filter: {
            username: 'user',
            state: UserState.ACTIVE,
          },
          offset: 0,
          limit: 10,
        },
        'inst-1'
      );

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(10);
    });

    it('should handle search string across multiple fields', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.queryMany.mockResolvedValue([]);

      await userQueries.searchUsers(
        {
          filter: {
            searchString: 'john',
          },
        },
        'inst-1'
      );

      expect(mockDatabase.queryMany).toHaveBeenCalledWith(
        expect.stringContaining('username ILIKE'),
        expect.arrayContaining(['inst-1', '%john%'])
      );
    });

    it('should support sorting by different fields', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '0' });
      mockDatabase.queryMany.mockResolvedValue([]);

      await userQueries.searchUsers(
        {
          sortBy: UserSortField.EMAIL,
          sortOrder: 'ASC',
        },
        'inst-1'
      );

      expect(mockDatabase.queryMany).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY email ASC'),
        expect.any(Array)
      );
    });

    it('should support pagination', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '100' });
      mockDatabase.queryMany.mockResolvedValue([]);

      await userQueries.searchUsers(
        {
          offset: 20,
          limit: 10,
        },
        'inst-1'
      );

      const lastCall = mockDatabase.queryMany.mock.calls[mockDatabase.queryMany.mock.calls.length - 1];
      expect(lastCall[1]).toEqual(expect.arrayContaining([10, 20]));
    });
  });

  describe('getUserProfile', () => {
    it('should return minimal user profile', async () => {
      const mockProfile = {
        id: 'user-123',
        username: 'testuser',
        display_name: 'Test User',
        first_name: 'Test',
        last_name: 'User',
        avatar_url: 'https://example.com/avatar.jpg',
        preferred_language: 'en',
      };

      mockDatabase.queryOne.mockResolvedValue(mockProfile);

      const result = await userQueries.getUserProfile('user-123', 'inst-1');

      expect(result).toBeDefined();
      expect(result?.username).toBe('testuser');
      expect(result?.displayName).toBe('Test User');
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['user-123', 'inst-1']
      );
    });

    it('should return null for non-existent user', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await userQueries.getUserProfile('nonexistent', 'inst-1');

      expect(result).toBeNull();
    });
  });

  describe('isUserUnique', () => {
    it('should return true when username and email are unique', async () => {
      mockDatabase.queryOne.mockResolvedValue({
        username_count: '0',
        email_count: '0',
      });

      const result = await userQueries.isUserUnique(
        'newuser',
        'new@example.com',
        'org-1',
        'inst-1'
      );

      expect(result.isUnique).toBe(true);
      expect(result.username).toBe(true);
      expect(result.email).toBe(true);
    });

    it('should return false when username exists', async () => {
      mockDatabase.queryOne.mockResolvedValue({
        username_count: '1',
        email_count: '0',
      });

      const result = await userQueries.isUserUnique(
        'existinguser',
        'new@example.com',
        'org-1',
        'inst-1'
      );

      expect(result.isUnique).toBe(false);
      expect(result.username).toBe(false);
      expect(result.email).toBe(true);
    });

    it('should exclude specified user from check', async () => {
      mockDatabase.queryOne.mockResolvedValue({
        username_count: '0',
        email_count: '0',
      });

      await userQueries.isUserUnique(
        'testuser',
        'test@example.com',
        'org-1',
        'inst-1',
        'user-123'
      );

      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('AND id !='),
        expect.arrayContaining(['testuser', 'test@example.com', 'org-1', 'inst-1', 'user-123'])
      );
    });
  });

  describe('getHumanProfile', () => {
    it('should return human user', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'humanuser',
        user_type: UserType.HUMAN,
        state: UserState.ACTIVE,
        created_at: new Date(),
      };

      mockDatabase.queryOne.mockResolvedValue(mockUser as any);

      const result = await userQueries.getHumanProfile('user-123', 'inst-1');

      expect(result).toBeDefined();
      expect(result?.userType).toBe(UserType.HUMAN);
    });

    it('should return null for machine user', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'machineuser',
        user_type: UserType.MACHINE,
        state: UserState.ACTIVE,
      };

      mockDatabase.queryOne.mockResolvedValue(mockUser as any);

      const result = await userQueries.getHumanProfile('user-123', 'inst-1');

      expect(result).toBeNull();
    });
  });

  describe('getMachine', () => {
    it('should return machine user', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'machineuser',
        user_type: UserType.MACHINE,
        state: UserState.ACTIVE,
      };

      mockDatabase.queryOne.mockResolvedValue(mockUser as any);

      const result = await userQueries.getMachine('user-123', 'inst-1');

      expect(result).toBeDefined();
      expect(result?.userType).toBe(UserType.MACHINE);
    });

    it('should return null for human user', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'humanuser',
        user_type: UserType.HUMAN,
      };

      mockDatabase.queryOne.mockResolvedValue(mockUser as any);

      const result = await userQueries.getMachine('user-123', 'inst-1');

      expect(result).toBeNull();
    });
  });

  describe('getNotifyUserByID', () => {
    it('should return user with notification info', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        preferred_language: 'en',
        resource_owner: 'org-1',
        last_email: 'test@example.com',
        verified_email: 'test@example.com',
        last_phone: '+1234567890',
        verified_phone: '+1234567890',
        password_set: true,
      };

      mockDatabase.queryOne.mockResolvedValue(mockUser);

      const result = await userQueries.getNotifyUserByID('user-123', 'inst-1');

      expect(result).toBeDefined();
      expect(result?.email).toBe('test@example.com');
      expect(result?.verifiedEmail).toBe('test@example.com');
      expect(result?.passwordSet).toBe(true);
    });

    it('should handle unverified email', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        preferred_language: 'en',
        resource_owner: 'org-1',
        last_email: 'test@example.com',
        verified_email: null, // Not verified
        password_set: false,
      };

      mockDatabase.queryOne.mockResolvedValue(mockUser);

      const result = await userQueries.getNotifyUserByID('user-123', 'inst-1');

      expect(result?.verifiedEmail).toBeNull();
    });
  });

  describe('getUserByLoginNameGlobal', () => {
    it('should find user globally across organizations', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        resource_owner: 'org-1',
        state: UserState.ACTIVE,
      };

      mockDatabase.queryOne.mockResolvedValue(mockUser as any);

      const result = await userQueries.getUserByLoginNameGlobal('testuser', 'inst-1');

      expect(result).toBeDefined();
      expect(result?.username).toBe('testuser');
      // Should only filter by instance, not resource_owner
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('instance_id = $2'),
        ['testuser', 'inst-1']
      );
    });
  });

  describe('getUserByUserSessionID', () => {
    it('should find user by session ID', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        state: UserState.ACTIVE,
      };

      mockDatabase.queryOne.mockResolvedValue(mockUser as any);

      const result = await userQueries.getUserByUserSessionID('session-123', 'inst-1');

      expect(result).toBeDefined();
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('INNER JOIN projections.sessions'),
        ['session-123', 'inst-1']
      );
    });

    it('should return null when session not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await userQueries.getUserByUserSessionID('nonexistent', 'inst-1');

      expect(result).toBeNull();
    });
  });

  describe('getUserGrantsByUserID', () => {
    it('should return all user grants', async () => {
      const mockGrants = [
        {
          id: 'grant-1',
          user_id: 'user-123',
          project_id: 'proj-1',
          project_grant_id: null,
          roles: ['role1', 'role2'],
          resource_owner: 'org-1',
        },
        {
          id: 'grant-2',
          user_id: 'user-123',
          project_id: 'proj-2',
          project_grant_id: 'pg-1',
          roles: ['role3'],
          resource_owner: 'org-1',
        },
      ];

      mockDatabase.queryMany.mockResolvedValue(mockGrants);

      const result = await userQueries.getUserGrantsByUserID('user-123', 'inst-1');

      expect(result).toHaveLength(2);
      expect(result[0].projectId).toBe('proj-1');
      expect(result[0].roles).toEqual(['role1', 'role2']);
    });

    it('should return empty array when no grants', async () => {
      mockDatabase.queryMany.mockResolvedValue([]);

      const result = await userQueries.getUserGrantsByUserID('user-123', 'inst-1');

      expect(result).toEqual([]);
    });
  });

  describe('getUserGrants', () => {
    it('should filter grants by project ID', async () => {
      const mockGrants = [
        {
          id: 'grant-1',
          user_id: 'user-123',
          project_id: 'proj-1',
          roles: ['role1'],
          resource_owner: 'org-1',
        },
      ];

      mockDatabase.queryMany.mockResolvedValue(mockGrants);

      const result = await userQueries.getUserGrants('user-123', 'proj-1', 'inst-1');

      expect(result).toHaveLength(1);
      expect(mockDatabase.queryMany).toHaveBeenCalledWith(
        expect.stringContaining('AND project_id ='),
        expect.arrayContaining(['user-123', 'inst-1', 'proj-1'])
      );
    });

    it('should return all grants when no project filter', async () => {
      mockDatabase.queryMany.mockResolvedValue([]);

      await userQueries.getUserGrants('user-123', undefined, 'inst-1');

      expect(mockDatabase.queryMany).toHaveBeenCalledWith(
        expect.not.stringContaining('AND project_id ='),
        ['user-123', 'inst-1']
      );
    });
  });

  describe('getUserMemberships', () => {
    it('should return organization memberships', async () => {
      const mockMemberships = [
        {
          org_id: 'org-1',
          org_name: 'Organization 1',
          user_id: 'user-123',
          roles: ['owner', 'admin'],
        },
        {
          org_id: 'org-2',
          org_name: 'Organization 2',
          user_id: 'user-123',
          roles: ['member'],
        },
      ];

      mockDatabase.queryMany.mockResolvedValue(mockMemberships);

      const result = await userQueries.getUserMemberships('user-123', 'inst-1');

      expect(result).toHaveLength(2);
      expect(result[0].orgName).toBe('Organization 1');
      expect(result[0].roles).toEqual(['owner', 'admin']);
    });
  });

  describe('getUserAuthMethods', () => {
    it('should return authentication methods', async () => {
      const mockMethods = [
        {
          id: 'method-1',
          user_id: 'user-123',
          method_type: 'password',
          is_default: true,
          created_at: new Date(),
        },
        {
          id: 'method-2',
          user_id: 'user-123',
          method_type: 'totp',
          is_default: false,
          created_at: new Date(),
        },
      ];

      mockDatabase.queryMany.mockResolvedValue(mockMethods);

      const result = await userQueries.getUserAuthMethods('user-123', 'inst-1');

      expect(result).toHaveLength(2);
      expect(result[0].methodType).toBe('password');
      expect(result[0].isDefault).toBe(true);
    });
  });

  describe('getUserMetadata', () => {
    it('should return user metadata', async () => {
      const mockMetadata = [
        {
          key: 'theme',
          value: 'dark',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          key: 'notifications',
          value: 'enabled',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDatabase.queryMany.mockResolvedValue(mockMetadata);

      const result = await userQueries.getUserMetadata('user-123', 'inst-1');

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('theme');
      expect(result[0].value).toBe('dark');
    });

    it('should return empty array when no metadata', async () => {
      mockDatabase.queryMany.mockResolvedValue([]);

      const result = await userQueries.getUserMetadata('user-123', 'inst-1');

      expect(result).toEqual([]);
    });
  });
});
