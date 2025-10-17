/**
 * Login Name Queries
 * 
 * Query methods for login names from the login_names_projection table.
 * Based on Zitadel's CQRS query pattern.
 */

import { DatabasePool } from '../../database/pool';
import {
  LoginName,
  LoginNameSearchOptions,
  LoginNameSearchResult,
} from './login-name-types';

/**
 * Login Name query service
 */
export class LoginNameQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get all login names for a user
   * 
   * @param userId - User ID
   * @param instanceId - Instance ID for multi-tenant isolation
   * @returns Array of login names
   */
  async getLoginNamesByUserID(userId: string, instanceId: string): Promise<LoginName[]> {
    const result = await this.database.query(
      `SELECT 
        user_id as "userId",
        instance_id as "instanceId",
        login_name as "loginName",
        domain_name as "domainName",
        is_primary as "isPrimary",
        created_at as "createdAt",
        updated_at as "updatedAt"
       FROM login_names_projection
       WHERE user_id = $1 AND instance_id = $2
       ORDER BY is_primary DESC, login_name ASC`,
      [userId, instanceId]
    );

    return result.rows.map(row => this.mapRowToLoginName(row));
  }

  /**
   * Get user ID by login name
   * 
   * Used for login scenarios where we need to find which user owns a login name.
   * 
   * @param loginName - The login name to search for
   * @param instanceId - Instance ID
   * @returns User ID or null if not found
   */
  async getUserIdByLoginName(loginName: string, instanceId: string): Promise<string | null> {
    const result = await this.database.queryOne<{ user_id: string }>(
      `SELECT user_id 
       FROM login_names_projection
       WHERE login_name = $1 AND instance_id = $2
       LIMIT 1`,
      [loginName, instanceId]
    );

    return result?.user_id ?? null;
  }

  /**
   * Get a specific login name entry
   * 
   * @param loginName - The login name
   * @param instanceId - Instance ID
   * @returns LoginName or null if not found
   */
  async getLoginName(loginName: string, instanceId: string): Promise<LoginName | null> {
    const result = await this.database.queryOne<any>(
      `SELECT 
        user_id as "userId",
        instance_id as "instanceId",
        login_name as "loginName",
        domain_name as "domainName",
        is_primary as "isPrimary",
        created_at as "createdAt",
        updated_at as "updatedAt"
       FROM login_names_projection
       WHERE login_name = $1 AND instance_id = $2`,
      [loginName, instanceId]
    );

    if (!result) {
      return null;
    }

    return this.mapRowToLoginName(result);
  }

  /**
   * Check if login name exists
   * 
   * @param loginName - The login name to check
   * @param instanceId - Instance ID
   * @returns True if exists, false otherwise
   */
  async loginNameExists(loginName: string, instanceId: string): Promise<boolean> {
    const userId = await this.getUserIdByLoginName(loginName, instanceId);
    return userId !== null;
  }

  /**
   * Get all login names for a domain
   * 
   * @param domainName - Domain name
   * @param instanceId - Instance ID
   * @returns Array of login names
   */
  async getLoginNamesByDomain(domainName: string, instanceId: string): Promise<LoginName[]> {
    const result = await this.database.query(
      `SELECT 
        user_id as "userId",
        instance_id as "instanceId",
        login_name as "loginName",
        domain_name as "domainName",
        is_primary as "isPrimary",
        created_at as "createdAt",
        updated_at as "updatedAt"
       FROM login_names_projection
       WHERE domain_name = $1 AND instance_id = $2
       ORDER BY login_name ASC`,
      [domainName, instanceId]
    );

    return result.rows.map(row => this.mapRowToLoginName(row));
  }

  /**
   * Search login names
   * 
   * @param options - Search options
   * @returns Search result with login names and total count
   */
  async searchLoginNames(options: LoginNameSearchOptions): Promise<LoginNameSearchResult> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (options.instanceId) {
      conditions.push(`instance_id = $${paramIndex++}`);
      params.push(options.instanceId);
    }

    if (options.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(options.userId);
    }

    if (options.domainName) {
      conditions.push(`domain_name = $${paramIndex++}`);
      params.push(options.domainName);
    }

    if (options.isPrimary !== undefined) {
      conditions.push(`is_primary = $${paramIndex++}`);
      params.push(options.isPrimary);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.database.query(
      `SELECT COUNT(*) as count FROM login_names_projection ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    params.push(limit, offset);

    const result = await this.database.query(
      `SELECT 
        user_id as "userId",
        instance_id as "instanceId",
        login_name as "loginName",
        domain_name as "domainName",
        is_primary as "isPrimary",
        created_at as "createdAt",
        updated_at as "updatedAt"
       FROM login_names_projection
       ${whereClause}
       ORDER BY is_primary DESC, login_name ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    return {
      loginNames: result.rows.map(row => this.mapRowToLoginName(row)),
      total,
    };
  }

  /**
   * Map database row to LoginName domain object
   */
  private mapRowToLoginName(row: any): LoginName {
    return {
      userId: row.userId,
      instanceId: row.instanceId,
      loginName: row.loginName,
      domainName: row.domainName,
      isPrimary: row.isPrimary,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
