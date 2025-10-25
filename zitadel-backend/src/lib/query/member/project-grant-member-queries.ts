/**
 * Project Grant Member queries for Zitadel query layer
 * Handles project grant-level memberships
 */

import { DatabasePool } from '../../database';
import { ProjectGrantMember, MemberSearchQuery, MemberSearchResult } from './member-types';

export class ProjectGrantMemberQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Search project grant members with filters
   * 
   * @param query - Search query with filters
   * @returns Paginated project grant member results
   */
  async searchProjectGrantMembers(query: MemberSearchQuery): Promise<MemberSearchResult<ProjectGrantMember>> {
    const conditions: string[] = ['pgm.instance_id = $1'];
    const params: any[] = [query.instanceID];
    let paramIndex = 2;

    // Add filters
    if (query.projectID) {
      conditions.push(`pgm.project_id = $${paramIndex++}`);
      params.push(query.projectID);
    }

    if (query.grantID) {
      conditions.push(`pgm.grant_id = $${paramIndex++}`);
      params.push(query.grantID);
    }

    if (query.userID) {
      conditions.push(`pgm.user_id = $${paramIndex++}`);
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
      conditions.push(`pgm.roles && $${paramIndex++}`);
      params.push(query.roles);
    }

    const whereClause = conditions.join(' AND ');

    // Build SELECT with joins
    const selectQuery = `
      SELECT 
        pgm.project_id,
        pgm.grant_id,
        pgm.user_id,
        pgm.instance_id,
        pgm.creation_date,
        pgm.change_date,
        pgm.sequence,
        pgm.resource_owner,
        pgm.roles,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.display_name,
        u.preferred_login_name,
        u.avatar_url,
        p.name as project_name,
        pg.granted_org_id,
        o.name as granted_org_name
      FROM projections.project_grant_members pgm
      LEFT JOIN users_projection u ON pgm.user_id = u.id AND pgm.instance_id = u.instance_id
      LEFT JOIN projects_projection p ON pgm.project_id = p.id AND pgm.instance_id = p.instance_id
      LEFT JOIN projections.project_grants pg ON pgm.grant_id = pg.id AND pgm.instance_id = pg.instance_id
      LEFT JOIN orgs_projection o ON pg.granted_org_id = o.id AND pg.instance_id = o.instance_id
      WHERE ${whereClause}
    `;

    // Get total count
    const countResult = await this.database.queryOne(
      `SELECT COUNT(*) as count FROM projections.project_grant_members pgm 
       LEFT JOIN users_projection u ON pgm.user_id = u.id AND pgm.instance_id = u.instance_id
       WHERE ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult?.count || '0', 10);

    // Add pagination
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    
    const paginatedQuery = `${selectQuery}
      ORDER BY pgm.creation_date ${query.sortOrder === 'asc' ? 'ASC' : 'DESC'}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    // Execute query
    const result = await this.database.query(paginatedQuery, params);

    return {
      members: result.rows.map((row: any) => this.mapRowToProjectGrantMember(row)),
      totalCount,
      offset,
      limit,
    };
  }

  /**
   * Get project grant member by project ID, grant ID and user ID
   * 
   * @param projectID - Project ID
   * @param grantID - Grant ID
   * @param userID - User ID
   * @param instanceID - Instance ID
   * @returns Project grant member or null
   */
  async getProjectGrantMemberByID(
    projectID: string,
    grantID: string,
    userID: string,
    instanceID: string
  ): Promise<ProjectGrantMember | null> {
    const row = await this.database.queryOne(
      `SELECT 
        pgm.project_id,
        pgm.grant_id,
        pgm.user_id,
        pgm.instance_id,
        pgm.creation_date,
        pgm.change_date,
        pgm.sequence,
        pgm.resource_owner,
        pgm.roles,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.display_name,
        u.preferred_login_name,
        u.avatar_url,
        p.name as project_name,
        pg.granted_org_id,
        o.name as granted_org_name
      FROM projections.project_grant_members pgm
      LEFT JOIN users_projection u ON pgm.user_id = u.id AND pgm.instance_id = u.instance_id
      LEFT JOIN projects_projection p ON pgm.project_id = p.id AND pgm.instance_id = p.instance_id
      LEFT JOIN projections.project_grants pg ON pgm.grant_id = pg.id AND pgm.instance_id = pg.instance_id
      LEFT JOIN orgs_projection o ON pg.granted_org_id = o.id AND pg.instance_id = o.instance_id
      WHERE pgm.project_id = $1 AND pgm.grant_id = $2 AND pgm.user_id = $3 AND pgm.instance_id = $4`,
      [projectID, grantID, userID, instanceID]
    );
    
    return row ? this.mapRowToProjectGrantMember(row) : null;
  }

  /**
   * Map database row to ProjectGrantMember
   */
  private mapRowToProjectGrantMember(row: any): ProjectGrantMember {
    return {
      projectID: row.project_id,
      grantID: row.grant_id,
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
      projectName: row.project_name,
      grantedOrgID: row.granted_org_id,
      grantedOrgName: row.granted_org_name,
    };
  }
}
