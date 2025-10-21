/**
 * Project Member queries for Zitadel query layer
 * Handles project-level memberships
 */

import { DatabasePool } from '../../database';
import { ProjectMember, MemberSearchQuery, MemberSearchResult } from './member-types';

export class ProjectMemberQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Search project members with filters
   * 
   * @param query - Search query with filters
   * @returns Paginated project member results
   */
  async searchProjectMembers(query: MemberSearchQuery): Promise<MemberSearchResult<ProjectMember>> {
    const conditions: string[] = ['pm.instance_id = $1'];
    const params: any[] = [query.instanceID];
    let paramIndex = 2;

    // Add filters
    if (query.projectID) {
      conditions.push(`pm.project_id = $${paramIndex++}`);
      params.push(query.projectID);
    }

    if (query.userID) {
      conditions.push(`pm.user_id = $${paramIndex++}`);
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
      conditions.push(`pm.roles && $${paramIndex++}`);
      params.push(query.roles);
    }

    const whereClause = conditions.join(' AND ');

    // Build SELECT with joins
    const selectQuery = `
      SELECT 
        pm.project_id,
        pm.user_id,
        pm.instance_id,
        pm.creation_date,
        pm.change_date,
        pm.sequence,
        pm.resource_owner,
        pm.roles,
        u.user_name,
        u.email,
        u.first_name,
        u.last_name,
        u.display_name,
        u.preferred_login_name,
        u.avatar_url,
        p.name as project_name,
        p.resource_owner as project_owner
      FROM projections.project_members pm
      LEFT JOIN projections.users u ON pm.user_id = u.id AND pm.instance_id = u.instance_id
      LEFT JOIN projections.projects p ON pm.project_id = p.id AND pm.instance_id = p.instance_id
      WHERE ${whereClause}
    `;

    // Get total count
    const countResult = await this.database.queryOne(
      `SELECT COUNT(*) as count FROM projections.project_members pm 
       LEFT JOIN projections.users u ON pm.user_id = u.id AND pm.instance_id = u.instance_id
       WHERE ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult?.count || '0', 10);

    // Add pagination
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    
    const paginatedQuery = `${selectQuery}
      ORDER BY pm.creation_date ${query.sortOrder === 'asc' ? 'ASC' : 'DESC'}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    // Execute query
    const result = await this.database.query(paginatedQuery, params);

    return {
      members: result.rows.map((row: any) => this.mapRowToProjectMember(row)),
      totalCount,
      offset,
      limit,
    };
  }

  /**
   * Get project member by project ID and user ID
   * 
   * @param projectID - Project ID
   * @param userID - User ID
   * @param instanceID - Instance ID
   * @returns Project member or null
   */
  async getProjectMemberByID(
    projectID: string,
    userID: string,
    instanceID: string
  ): Promise<ProjectMember | null> {
    const row = await this.database.queryOne(
      `SELECT 
        pm.project_id,
        pm.user_id,
        pm.instance_id,
        pm.creation_date,
        pm.change_date,
        pm.sequence,
        pm.resource_owner,
        pm.roles,
        u.user_name,
        u.email,
        u.first_name,
        u.last_name,
        u.display_name,
        u.preferred_login_name,
        u.avatar_url,
        p.name as project_name,
        p.resource_owner as project_owner
      FROM projections.project_members pm
      LEFT JOIN projections.users u ON pm.user_id = u.id AND pm.instance_id = u.instance_id
      LEFT JOIN projections.projects p ON pm.project_id = p.id AND pm.instance_id = p.instance_id
      WHERE pm.project_id = $1 AND pm.user_id = $2 AND pm.instance_id = $3`,
      [projectID, userID, instanceID]
    );

    return row ? this.mapRowToProjectMember(row) : null;
  }

  /**
   * Map database row to ProjectMember
   */
  private mapRowToProjectMember(row: any): ProjectMember {
    return {
      projectID: row.project_id,
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
      projectName: row.project_name,
      projectOwner: row.project_owner,
    };
  }
}
