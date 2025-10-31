/**
 * User Queries
 * 
 * Provides query methods for reading user data from projections.
 * Based on Zitadel Go internal/query/user.go
 */

import { DatabasePool } from '../../database/pool';
import {
  User,
  UserState,
  UserType,
  HumanUser,
  MachineUser,
  UserProfile,
  NotifyUser,
  UserSearchOptions,
  UserSearchResult,
  UserUniquenessResult,
  UserSortField,
  UserGrant,
} from './user-types';

/**
 * User query service
 */
export class UserQueries {
  constructor(private database: DatabasePool) {}

  /**
   * Get user by ID
   * 
   * @param userId - User ID
   * @param instanceId - Instance ID for multi-tenant isolation
   * @returns User or null if not found
   */
  async getUserByID(userId: string, instanceId: string): Promise<User | null> {
    const result = await this.database.queryOne<any>(
      `SELECT 
        id, instance_id, resource_owner, username, email, email_verified, email_verified_at,
        phone, phone_verified, phone_verified_at, first_name, last_name, display_name, nickname,
        preferred_language, gender, avatar_url, preferred_login_name, login_names,
        password_hash, password_changed_at, password_change_required, mfa_enabled,
        state, user_type, created_at, updated_at, deleted_at
       FROM projections.users
       WHERE id = $1 AND instance_id = $2`,
      [userId, instanceId]
    );

    if (!result) {
      return null;
    }

    return this.mapRowToUser(result);
  }

  /**
   * Get user by login name
   * 
   * Looks up user by username or email within an organization/instance.
   * 
   * @param loginName - Username or email
   * @param resourceOwner - Organization ID
   * @param instanceId - Instance ID
   * @returns User or null if not found
   */
  async getUserByLoginName(
    loginName: string,
    resourceOwner: string,
    instanceId: string
  ): Promise<User | null> {
    const result = await this.database.queryOne<any>(
      `SELECT 
        id, instance_id, resource_owner, username, email, email_verified, email_verified_at,
        phone, phone_verified, phone_verified_at, first_name, last_name, display_name, nickname,
        preferred_language, gender, avatar_url, preferred_login_name, login_names,
        password_hash, password_changed_at, password_change_required, mfa_enabled,
        state, user_type, created_at, updated_at, deleted_at
       FROM projections.users
       WHERE (username = $1 OR email = $1 OR $1 = ANY(login_names))
         AND resource_owner = $2
         AND instance_id = $3
         AND deleted_at IS NULL
       LIMIT 1`,
      [loginName, resourceOwner, instanceId]
    );

    if (!result) {
      return null;
    }

    return this.mapRowToUser(result);
  }

  /**
   * Search users with filters and pagination
   * 
   * @param options - Search options with filters, pagination, and sorting
   * @param instanceId - Instance ID for multi-tenant isolation
   * @returns Search result with users and pagination info
   */
  async searchUsers(
    options: UserSearchOptions,
    instanceId: string
  ): Promise<UserSearchResult> {
    const { filter = {}, offset = 0, limit = 50, sortBy = UserSortField.CREATED_AT, sortOrder = 'DESC' } = options;

    // Build WHERE clause
    const whereClauses: string[] = ['instance_id = $1', 'deleted_at IS NULL'];
    const params: any[] = [instanceId];
    let paramIndex = 2;

    if (filter.resourceOwner) {
      whereClauses.push(`resource_owner = $${paramIndex++}`);
      params.push(filter.resourceOwner);
    }

    if (filter.username) {
      whereClauses.push(`username ILIKE $${paramIndex++}`);
      params.push(`%${filter.username}%`);
    }

    if (filter.email) {
      whereClauses.push(`email ILIKE $${paramIndex++}`);
      params.push(`%${filter.email}%`);
    }

    if (filter.phone) {
      whereClauses.push(`phone ILIKE $${paramIndex++}`);
      params.push(`%${filter.phone}%`);
    }

    if (filter.state) {
      whereClauses.push(`state = $${paramIndex++}`);
      params.push(filter.state);
    }

    if (filter.userType) {
      whereClauses.push(`user_type = $${paramIndex++}`);
      params.push(filter.userType);
    }

    // Search string searches across multiple fields
    if (filter.searchString) {
      whereClauses.push(`(
        username ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex} OR
        first_name ILIKE $${paramIndex} OR
        last_name ILIKE $${paramIndex} OR
        display_name ILIKE $${paramIndex}
      )`);
      params.push(`%${filter.searchString}%`);
      paramIndex++;
    }

    const whereClause = whereClauses.join(' AND ');

    // Count total matching users
    const countResult = await this.database.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM projections.users WHERE ${whereClause}`,
      params
    );

    const total = parseInt(countResult?.count || '0', 10);

    // Get users with pagination and sorting
    const sortColumn = this.getSortColumn(sortBy);
    const users = await this.database.queryMany<any>(
      `SELECT 
        id, instance_id, resource_owner, username, email, email_verified, email_verified_at,
        phone, phone_verified, phone_verified_at, first_name, last_name, display_name, nickname,
        preferred_language, gender, avatar_url, preferred_login_name, login_names,
        password_hash, password_changed_at, password_change_required, mfa_enabled,
        state, user_type, created_at, updated_at, deleted_at
       FROM projections.users
       WHERE ${whereClause}
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      users: users.map(row => this.mapRowToUser(row)),
      total,
      offset,
      limit,
    };
  }

  /**
   * Get user profile (minimal user info for display)
   * 
   * @param userId - User ID
   * @param instanceId - Instance ID
   * @returns User profile or null if not found
   */
  async getUserProfile(userId: string, instanceId: string): Promise<UserProfile | null> {
    const result = await this.database.queryOne<any>(
      `SELECT 
        id, username, display_name, first_name, last_name, avatar_url, preferred_language
       FROM projections.users
       WHERE id = $1 AND instance_id = $2 AND deleted_at IS NULL`,
      [userId, instanceId]
    );

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      username: result.username,
      displayName: result.display_name,
      firstName: result.first_name,
      lastName: result.last_name,
      avatarUrl: result.avatar_url,
      preferredLanguage: result.preferred_language,
    };
  }

  /**
   * Check if user is unique
   * 
   * Checks if username and email are unique within an organization.
   * 
   * @param username - Username to check
   * @param email - Email to check
   * @param resourceOwner - Organization ID
   * @param instanceId - Instance ID
   * @param excludeUserId - User ID to exclude from check (for updates)
   * @returns Uniqueness result
   */
  async isUserUnique(
    username: string,
    email: string,
    resourceOwner: string,
    instanceId: string,
    excludeUserId?: string
  ): Promise<UserUniquenessResult> {
    const params: any[] = [username, email, resourceOwner, instanceId];
    let paramIndex = 5;
    
    let excludeClause = '';
    if (excludeUserId) {
      excludeClause = `AND id != $${paramIndex}`;
      params.push(excludeUserId);
    }

    const result = await this.database.queryOne<any>(
      `SELECT 
        COUNT(*) FILTER (WHERE username = $1) as username_count,
        COUNT(*) FILTER (WHERE email = $2) as email_count
       FROM projections.users
       WHERE resource_owner = $3 
         AND instance_id = $4
         AND deleted_at IS NULL
         ${excludeClause}`,
      params
    );

    const usernameCount = parseInt(result?.username_count || '0', 10);
    const emailCount = parseInt(result?.email_count || '0', 10);

    return {
      isUnique: usernameCount === 0 && emailCount === 0,
      username: usernameCount === 0,
      email: emailCount === 0,
    };
  }

  /**
   * Get human user (user with profile)
   * 
   * @param userId - User ID
   * @param instanceId - Instance ID
   * @returns Human user or null if not found
   */
  async getHumanProfile(userId: string, instanceId: string): Promise<HumanUser | null> {
    const user = await this.getUserByID(userId, instanceId);
    
    if (!user || user.userType !== UserType.HUMAN) {
      return null;
    }

    return user as HumanUser;
  }

  /**
   * Get machine user
   * 
   * @param userId - User ID
   * @param instanceId - Instance ID
   * @returns Machine user or null if not found
   */
  async getMachine(userId: string, instanceId: string): Promise<MachineUser | null> {
    const user = await this.getUserByID(userId, instanceId);
    
    if (!user || user.userType !== UserType.MACHINE) {
      return null;
    }

    return user as MachineUser;
  }

  /**
   * Get user for notification purposes
   * 
   * Returns user with email/phone info for sending notifications.
   * 
   * @param userId - User ID
   * @param instanceId - Instance ID
   * @returns Notify user or null if not found
   */
  async getNotifyUserByID(userId: string, instanceId: string): Promise<NotifyUser | null> {
    const result = await this.database.queryOne<any>(
      `SELECT 
        id, username, email, preferred_language, resource_owner,
        email as last_email,
        CASE WHEN email_verified THEN email ELSE NULL END as verified_email,
        phone as last_phone,
        CASE WHEN phone_verified THEN phone ELSE NULL END as verified_phone,
        CASE WHEN password_hash IS NOT NULL THEN true ELSE false END as password_set
       FROM projections.users
       WHERE id = $1 AND instance_id = $2 AND deleted_at IS NULL`,
      [userId, instanceId]
    );

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      username: result.username,
      email: result.email,
      preferredLanguage: result.preferred_language,
      resourceOwner: result.resource_owner,
      lastEmail: result.last_email,
      verifiedEmail: result.verified_email,
      lastPhone: result.last_phone,
      verifiedPhone: result.verified_phone,
      passwordSet: result.password_set,
    };
  }

  /**
   * Get user by login name globally (across all organizations)
   * 
   * Used for login where organization is not yet known.
   * 
   * @param loginName - Username or email
   * @param instanceId - Instance ID
   * @returns User or null if not found
   */
  async getUserByLoginNameGlobal(loginName: string, instanceId: string): Promise<User | null> {
    const result = await this.database.queryOne<any>(
      `SELECT 
        id, instance_id, resource_owner, username, email, email_verified, email_verified_at,
        phone, phone_verified, phone_verified_at, first_name, last_name, display_name, nickname,
        preferred_language, gender, avatar_url, preferred_login_name, login_names,
        password_hash, password_changed_at, password_change_required, mfa_enabled,
        state, user_type, created_at, updated_at, deleted_at
       FROM projections.users
       WHERE (username = $1 OR email = $1 OR $1 = ANY(login_names))
         AND instance_id = $2
         AND deleted_at IS NULL
       LIMIT 1`,
      [loginName, instanceId]
    );

    if (!result) {
      return null;
    }

    return this.mapRowToUser(result);
  }

  /**
   * Get user by session ID
   * 
   * Finds user associated with a specific session.
   * 
   * @param sessionId - Session ID
   * @param instanceId - Instance ID
   * @returns User or null if not found
   */
  async getUserByUserSessionID(sessionId: string, instanceId: string): Promise<User | null> {
    // Note: This requires sessions table with user_id foreign key
    const result = await this.database.queryOne<any>(
      `SELECT 
        u.id, u.instance_id, u.resource_owner, u.username, u.email, u.email_verified, u.email_verified_at,
        u.phone, u.phone_verified, u.phone_verified_at, u.first_name, u.last_name, u.display_name, u.nickname,
        u.preferred_language, u.gender, u.avatar_url, u.preferred_login_name, u.login_names,
        u.password_hash, u.password_changed_at, u.password_change_required, u.mfa_enabled,
        u.state, u.user_type, u.created_at, u.updated_at, u.deleted_at
       FROM projections.users u
       INNER JOIN projections.sessions s ON s.user_id = u.id
       WHERE s.id = $1 AND u.instance_id = $2 AND u.deleted_at IS NULL
       LIMIT 1`,
      [sessionId, instanceId]
    );

    if (!result) {
      return null;
    }

    return this.mapRowToUser(result);
  }

  /**
   * Get user grants by user ID
   * 
   * Returns all project/role grants for a user (for authorization).
   * 
   * @param userId - User ID
   * @param instanceId - Instance ID
   * @returns Array of user grants
   */
  async getUserGrantsByUserID(userId: string, instanceId: string): Promise<UserGrant[]> {
    // Note: This requires user_grants table
    const results = await this.database.queryMany<any>(
      `SELECT 
        id, user_id, project_id, project_grant_id, roles, resource_owner
       FROM user_grants_projection
       WHERE user_id = $1 AND instance_id = $2
       ORDER BY created_at DESC`,
      [userId, instanceId]
    );

    return results.map(row => ({
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      projectGrantId: row.project_grant_id,
      roles: row.roles,
      resourceOwner: row.resource_owner,
    }));
  }

  /**
   * Get user grants by filter
   * 
   * Returns user grants matching specific criteria.
   * 
   * @param userId - User ID
   * @param projectId - Optional project ID filter
   * @param instanceId - Instance ID
   * @returns Array of user grants
   */
  async getUserGrants(
    userId: string,
    projectId: string | undefined,
    instanceId: string
  ): Promise<UserGrant[]> {
    const params: any[] = [userId, instanceId];
    let paramIndex = 3;
    
    let projectFilter = '';
    if (projectId) {
      projectFilter = `AND project_id = $${paramIndex}`;
      params.push(projectId);
    }

    const results = await this.database.queryMany<any>(
      `SELECT 
        id, user_id, project_id, project_grant_id, roles, resource_owner
       FROM user_grants_projection
       WHERE user_id = $1 AND instance_id = $2 ${projectFilter}
       ORDER BY created_at DESC`,
      params
    );

    return results.map(row => ({
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      projectGrantId: row.project_grant_id,
      roles: row.roles,
      resourceOwner: row.resource_owner,
    }));
  }

  /**
   * Get user organization memberships
   * 
   * Returns all organizations where user is a member.
   * 
   * @param userId - User ID
   * @param instanceId - Instance ID
   * @returns Array of organization memberships
   */
  async getUserMemberships(userId: string, instanceId: string): Promise<any[]> {
    // Note: This requires org_members table
    const results = await this.database.queryMany<any>(
      `SELECT 
        m.org_id, m.user_id, m.roles, o.name as org_name
       FROM projections.org_members m
       INNER JOIN projections.orgs o ON o.id = m.org_id
       WHERE m.user_id = $1 AND m.instance_id = $2
       ORDER BY o.name ASC`,
      [userId, instanceId]
    );

    return results.map(row => ({
      orgId: row.org_id,
      orgName: row.org_name,
      userId: row.user_id,
      roles: row.roles,
    }));
  }

  /**
   * Get user authentication methods (MFA)
   * 
   * Returns configured auth methods for the user.
   * 
   * @param userId - User ID
   * @param instanceId - Instance ID
   * @returns Array of auth methods
   */
  async getUserAuthMethods(userId: string, instanceId: string): Promise<any[]> {
    // Note: This requires user_auth_methods table
    const results = await this.database.queryMany<any>(
      `SELECT 
        id, user_id, method_type, is_default, created_at
       FROM user_auth_methods_projection
       WHERE user_id = $1 AND instance_id = $2
       ORDER BY is_default DESC, created_at DESC`,
      [userId, instanceId]
    );

    return results.map(row => ({
      id: row.id,
      userId: row.user_id,
      methodType: row.method_type,
      isDefault: row.is_default,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get user metadata
   * 
   * Returns custom metadata key-value pairs for the user.
   * 
   * @param userId - User ID
   * @param instanceId - Instance ID
   * @returns Array of metadata entries
   */
  async getUserMetadata(userId: string, instanceId: string): Promise<any[]> {
    // Note: This requires user_metadata table
    const results = await this.database.queryMany<any>(
      `SELECT 
        key, value, created_at, updated_at
       FROM projections.user_metadata
       WHERE user_id = $1 AND instance_id = $2
       ORDER BY key ASC`,
      [userId, instanceId]
    );

    return results.map(row => ({
      key: row.key,
      value: row.value,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Map database row to User object
   */
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      instanceId: row.instance_id,
      resourceOwner: row.resource_owner,
      username: row.username,
      email: row.email,
      emailVerified: row.email_verified,
      emailVerifiedAt: row.email_verified_at,
      phone: row.phone,
      phoneVerified: row.phone_verified,
      phoneVerifiedAt: row.phone_verified_at,
      firstName: row.first_name,
      lastName: row.last_name,
      displayName: row.display_name,
      nickname: row.nickname,
      preferredLanguage: row.preferred_language,
      gender: row.gender,
      avatarUrl: row.avatar_url,
      preferredLoginName: row.preferred_login_name,
      loginNames: row.login_names,
      passwordHash: row.password_hash,
      passwordChangedAt: row.password_changed_at,
      passwordChangeRequired: row.password_change_required,
      mfaEnabled: row.mfa_enabled,
      state: row.state as UserState,
      userType: row.user_type as UserType,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }

  /**
   * Get SQL sort column from sort field enum
   */
  private getSortColumn(sortBy: UserSortField): string {
    switch (sortBy) {
      case UserSortField.USERNAME:
        return 'username';
      case UserSortField.EMAIL:
        return 'email';
      case UserSortField.FIRST_NAME:
        return 'first_name';
      case UserSortField.LAST_NAME:
        return 'last_name';
      case UserSortField.DISPLAY_NAME:
        return 'display_name';
      case UserSortField.CREATED_AT:
        return 'created_at';
      case UserSortField.UPDATED_AT:
        return 'updated_at';
      default:
        return 'created_at';
    }
  }
}
