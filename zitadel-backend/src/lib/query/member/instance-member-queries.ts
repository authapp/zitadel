/**
 * Instance Member (IAM Member) queries for Zitadel query layer
 * Handles global administrator memberships
 */

import { DatabasePool } from '../../database';
import { InstanceMember, MemberSearchQuery, MemberSearchResult } from './member-types';

export class InstanceMemberQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Search instance members with filters
   * 
   * @param query - Search query with filters
   * @returns Paginated instance member results
   */
  async searchIAMMembers(query: MemberSearchQuery): Promise<MemberSearchResult<InstanceMember>> {
    const conditions: string[] = ['im.instance_id = $1'];
    const params: any[] = [query.instanceID];
    let paramIndex = 2;

    // Add filters
    if (query.userID) {
      conditions.push(`im.user_id = $${paramIndex++}`);
      params.push(query.userID);
    }

    if (query.userName) {
      conditions.push(`u.username ILIKE $${paramIndex++}`);
      params.push(`%${query.userName}%`);
    }

    if (query.email) {
      conditions.push(`u.email ILIKE $${paramIndex++}`);
      params.push(`%${query.email}%`);
    }

    if (query.roles && query.roles.length > 0) {
      conditions.push(`im.roles && $${paramIndex++}`);
      params.push(query.roles);
    }

    const whereClause = conditions.join(' AND ');

    // Build SELECT with joins
    const selectQuery = `
      SELECT 
        im.instance_id,
        im.user_id,
        im.creation_date,
        im.change_date,
        im.sequence,
        im.resource_owner,
        im.roles,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.display_name,
        u.preferred_login_name,
        u.avatar_url
      FROM projections.instance_members im
      LEFT JOIN projections.users u ON im.user_id = u.id AND im.instance_id = u.instance_id
      WHERE ${whereClause}
    `;

    // Get total count
    const countResult = await this.database.queryOne(
      `SELECT COUNT(*) as count FROM projections.instance_members im 
       LEFT JOIN projections.users u ON im.user_id = u.id AND im.instance_id = u.instance_id
       WHERE ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult?.count || '0', 10);

    // Add pagination
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    
    const paginatedQuery = `${selectQuery}
      ORDER BY im.creation_date ${query.sortOrder === 'asc' ? 'ASC' : 'DESC'}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    // Execute query
    const result = await this.database.query(paginatedQuery, params);

    return {
      members: result.rows.map((row: any) => this.mapRowToInstanceMember(row)),
      totalCount,
      offset,
      limit,
    };
  }

  /**
   * Get instance member by instance ID and user ID
   * 
   * @param iamID - Instance ID (IAM ID)
   * @param userID - User ID
   * @returns Instance member or null
   */
  async getIAMMemberByIAMIDAndUserID(
    iamID: string,
    userID: string
  ): Promise<InstanceMember | null> {
    const row = await this.database.queryOne(
      `SELECT 
        im.instance_id,
        im.user_id,
        im.creation_date,
        im.change_date,
        im.sequence,
        im.resource_owner,
        im.roles,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.display_name,
        u.preferred_login_name,
        u.avatar_url
      FROM projections.instance_members im
      LEFT JOIN projections.users u ON im.user_id = u.id AND im.instance_id = u.instance_id
      WHERE im.instance_id = $1 AND im.user_id = $2`,
      [iamID, userID]
    );

    return row ? this.mapRowToInstanceMember(row) : null;
  }

  /**
   * Map database row to InstanceMember
   */
  private mapRowToInstanceMember(row: any): InstanceMember {
    return {
      iamID: row.instance_id,
      userID: row.user_id,
      roles: Array.isArray(row.roles) ? row.roles : [],
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      resourceOwner: row.resource_owner,
      instanceID: row.instance_id,
      userName: row.user_name,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      displayName: row.display_name,
      preferredLoginName: row.preferred_login_name,
      avatarURL: row.avatar_url,
    };
  }
}
