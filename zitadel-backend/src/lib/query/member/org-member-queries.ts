/**
 * Organization Member queries for Zitadel query layer
 * Handles organization-level memberships
 */

import { DatabasePool } from '../../database';
import { OrgMember, MemberSearchQuery, MemberSearchResult } from './member-types';

export class OrgMemberQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Search organization members with filters
   * 
   * @param query - Search query with filters
   * @returns Paginated org member results
   */
  async searchOrgMembers(query: MemberSearchQuery): Promise<MemberSearchResult<OrgMember>> {
    const conditions: string[] = ['om.instance_id = $1'];
    const params: any[] = [query.instanceID];
    let paramIndex = 2;

    // Add filters
    if (query.orgID) {
      conditions.push(`om.org_id = $${paramIndex++}`);
      params.push(query.orgID);
    }

    if (query.userID) {
      conditions.push(`om.user_id = $${paramIndex++}`);
      params.push(query.userID);
    }

    if (query.userName) {
      conditions.push(`u.user_name ILIKE $${paramIndex++}`);
      params.push(`%${query.userName}%`);
    }

    if (query.email) {
      conditions.push(`u.email ILIKE $${paramIndex++}`);
      params.push(`%${query.email}%`);
    }

    if (query.roles && query.roles.length > 0) {
      conditions.push(`om.roles && $${paramIndex++}`);
      params.push(query.roles);
    }

    const whereClause = conditions.join(' AND ');

    // Build SELECT with joins
    const selectQuery = `
      SELECT 
        om.org_id,
        om.user_id,
        om.instance_id,
        om.creation_date,
        om.change_date,
        om.sequence,
        om.resource_owner,
        om.roles,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.display_name,
        u.preferred_login_name,
        u.avatar_url,
        o.name as org_name,
        o.primary_domain as org_domain
      FROM projections.org_members om
      LEFT JOIN projections.users u ON om.user_id = u.id AND om.instance_id = u.instance_id
      LEFT JOIN projections.orgs o ON om.org_id = o.id AND om.instance_id = o.instance_id
      WHERE ${whereClause}
    `;

    // Get total count
    const countResult = await this.database.queryOne(
      `SELECT COUNT(*) as count FROM projections.org_members om 
       LEFT JOIN projections.users u ON om.user_id = u.id AND om.instance_id = u.instance_id
       WHERE ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult?.count || '0', 10);

    // Add pagination
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    
    const paginatedQuery = `${selectQuery}
      ORDER BY om.creation_date ${query.sortOrder === 'asc' ? 'ASC' : 'DESC'}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    // Execute query
    const result = await this.database.query(paginatedQuery, params);

    return {
      members: result.rows.map((row: any) => this.mapRowToOrgMember(row)),
      totalCount,
      offset,
      limit,
    };
  }

  /**
   * Get organization member by org ID and user ID
   * 
   * @param orgID - Organization ID
   * @param userID - User ID
   * @param instanceID - Instance ID
   * @returns Org member or null
   */
  async getOrgMemberByID(
    orgID: string,
    userID: string,
    instanceID: string
  ): Promise<OrgMember | null> {
    const row = await this.database.queryOne(
      `SELECT 
        om.org_id,
        om.user_id,
        om.instance_id,
        om.creation_date,
        om.change_date,
        om.sequence,
        om.resource_owner,
        om.roles,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.display_name,
        u.preferred_login_name,
        u.avatar_url,
        o.name as org_name,
        o.primary_domain as org_domain
      FROM projections.org_members om
      LEFT JOIN projections.users u ON om.user_id = u.id AND om.instance_id = u.instance_id
      LEFT JOIN projections.orgs o ON om.org_id = o.id AND om.instance_id = o.instance_id
      WHERE om.org_id = $1 AND om.user_id = $2 AND om.instance_id = $3`,
      [orgID, userID, instanceID]
    );

    return row ? this.mapRowToOrgMember(row) : null;
  }

  /**
   * Map database row to OrgMember
   */
  private mapRowToOrgMember(row: any): OrgMember {
    return {
      orgID: row.org_id,
      userID: row.user_id,
      roles: Array.isArray(row.roles) ? row.roles : [],
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      resourceOwner: row.resource_owner,
      instanceID: row.instance_id,
      userName: row.username,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      displayName: row.display_name,
      preferredLoginName: row.preferred_login_name,
      avatarURL: row.avatar_url,
      orgName: row.org_name,
      orgDomain: row.org_domain,
    };
  }
}
