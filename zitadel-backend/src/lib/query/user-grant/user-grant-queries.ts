/**
 * User Grant queries for Zitadel query layer
 * Handles user grant retrieval and authorization checks
 */

import { DatabasePool } from '../../database';
import { 
  UserGrant, 
  UserGrantSearchQuery, 
  UserGrantSearchResult,
  UserGrantCheck 
} from './user-grant-types';
import { State } from '../converters/state-converter';

export class UserGrantQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Search user grants with filters
   * 
   * @param query - Search query with filters
   * @returns Paginated user grant results
   */
  async searchUserGrants(query: UserGrantSearchQuery): Promise<UserGrantSearchResult> {
    const conditions: string[] = ['ug.instance_id = $1'];
    const params: any[] = [query.instanceID];
    let paramIndex = 2;

    // Add filters
    if (query.userID) {
      conditions.push(`ug.user_id = $${paramIndex++}`);
      params.push(query.userID);
    }

    if (query.projectID) {
      conditions.push(`ug.project_id = $${paramIndex++}`);
      params.push(query.projectID);
    }

    if (query.projectGrantID) {
      conditions.push(`ug.project_grant_id = $${paramIndex++}`);
      params.push(query.projectGrantID);
    }

    if (query.resourceOwner) {
      conditions.push(`ug.resource_owner = $${paramIndex++}`);
      params.push(query.resourceOwner);
    }

    if (query.grantedOrgID) {
      conditions.push(`ug.project_grant_id IN (
        SELECT id FROM projections.project_grants 
        WHERE granted_org_id = $${paramIndex} AND instance_id = $1
      )`);
      params.push(query.grantedOrgID);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Build SELECT with joins
    let selectQuery = `
      SELECT 
        ug.id,
        ug.creation_date,
        ug.change_date,
        ug.sequence,
        ug.resource_owner,
        ug.instance_id,
        ug.user_id,
        ug.project_id,
        ug.project_grant_id,
        ug.state,
        ug.roles,
        u.username,
        u.resource_owner as user_resource_owner,
        u.user_type,
        p.name as project_name,
        p.resource_owner as project_resource_owner,
        o.name as org_name,
        o.primary_domain as org_primary_domain
    `;

    if (query.withGranted) {
      selectQuery += `,
        pg.granted_org_id,
        go.name as granted_org_name
      `;
    }

    selectQuery += `
      FROM projections.user_grants ug
      LEFT JOIN projections.users u ON ug.user_id = u.id AND ug.instance_id = u.instance_id
      LEFT JOIN projections.projects p ON ug.project_id = p.id AND ug.instance_id = p.instance_id
      LEFT JOIN projections.orgs o ON ug.resource_owner = o.id AND ug.instance_id = o.instance_id
    `;

    if (query.withGranted) {
      selectQuery += `
        LEFT JOIN projections.project_grants pg ON ug.project_grant_id = pg.id AND ug.instance_id = pg.instance_id
        LEFT JOIN projections.orgs go ON pg.granted_org_id = go.id AND pg.instance_id = go.instance_id
      `;
    }

    selectQuery += ` WHERE ${whereClause}`;

    // Get total count
    const countResult = await this.database.queryOne(
      `SELECT COUNT(*) as count FROM projections.user_grants ug WHERE ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult?.count || '0', 10);

    // Add pagination
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    
    selectQuery += ` ORDER BY ug.creation_date ${query.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    selectQuery += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    // Execute query
    const result = await this.database.query(selectQuery, params);

    return {
      grants: result.rows.map((row: any) => this.mapRowToUserGrant(row)),
      totalCount,
      offset,
      limit,
    };
  }

  /**
   * Get user grant by ID
   * 
   * @param grantID - Grant ID
   * @param instanceID - Instance ID
   * @returns User grant or null
   */
  async getUserGrantByID(
    grantID: string,
    instanceID: string
  ): Promise<UserGrant | null> {
    const row = await this.database.queryOne(
      `SELECT 
        ug.id,
        ug.creation_date,
        ug.change_date,
        ug.sequence,
        ug.resource_owner,
        ug.instance_id,
        ug.user_id,
        ug.project_id,
        ug.project_grant_id,
        ug.state,
        ug.roles,
        u.username,
        u.resource_owner as user_resource_owner,
        u.user_type,
        p.name as project_name,
        p.resource_owner as project_resource_owner,
        o.name as org_name,
        o.primary_domain as org_primary_domain
      FROM projections.user_grants ug
      LEFT JOIN projections.users u ON ug.user_id = u.id AND ug.instance_id = u.instance_id
      LEFT JOIN projections.projects p ON ug.project_id = p.id AND ug.instance_id = p.instance_id
      LEFT JOIN projections.orgs o ON ug.resource_owner = o.id AND ug.instance_id = o.instance_id
      WHERE ug.id = $1 AND ug.instance_id = $2`,
      [grantID, instanceID]
    );

    return row ? this.mapRowToUserGrant(row) : null;
  }

  /**
   * Get all user grants for a specific user
   * 
   * @param userID - User ID
   * @param instanceID - Instance ID
   * @returns Array of user grants
   */
  async getUserGrantsByUserID(
    userID: string,
    instanceID: string
  ): Promise<UserGrant[]> {
    const result = await this.database.query(
      `SELECT 
        ug.id,
        ug.creation_date,
        ug.change_date,
        ug.sequence,
        ug.resource_owner,
        ug.instance_id,
        ug.user_id,
        ug.project_id,
        ug.project_grant_id,
        ug.state,
        ug.roles,
        u.username,
        u.resource_owner as user_resource_owner,
        u.user_type,
        p.name as project_name,
        p.resource_owner as project_resource_owner,
        o.name as org_name,
        o.primary_domain as org_primary_domain
      FROM projections.user_grants ug
      LEFT JOIN projections.users u ON ug.user_id = u.id AND ug.instance_id = u.instance_id
      LEFT JOIN projections.projects p ON ug.project_id = p.id AND ug.instance_id = p.instance_id
      LEFT JOIN projections.orgs o ON ug.resource_owner = o.id AND ug.instance_id = o.instance_id
      WHERE ug.user_id = $1 AND ug.instance_id = $2
      ORDER BY ug.creation_date DESC`,
      [userID, instanceID]
    );

    return result.rows.map((row: any) => this.mapRowToUserGrant(row));
  }

  /**
   * Get all user grants for a specific project
   * 
   * @param projectID - Project ID
   * @param instanceID - Instance ID
   * @returns Array of user grants
   */
  async getUserGrantsByProjectID(
    projectID: string,
    instanceID: string
  ): Promise<UserGrant[]> {
    const result = await this.database.query(
      `SELECT 
        ug.id,
        ug.creation_date,
        ug.change_date,
        ug.sequence,
        ug.resource_owner,
        ug.instance_id,
        ug.user_id,
        ug.project_id,
        ug.project_grant_id,
        ug.state,
        ug.roles,
        u.username,
        u.resource_owner as user_resource_owner,
        u.user_type,
        p.name as project_name,
        p.resource_owner as project_resource_owner,
        o.name as org_name,
        o.primary_domain as org_primary_domain
      FROM projections.user_grants ug
      LEFT JOIN projections.users u ON ug.user_id = u.id AND ug.instance_id = u.instance_id
      LEFT JOIN projections.projects p ON ug.project_id = p.id AND ug.instance_id = p.instance_id
      LEFT JOIN projections.orgs o ON ug.resource_owner = o.id AND ug.instance_id = o.instance_id
      WHERE ug.project_id = $1 AND ug.instance_id = $2
      ORDER BY ug.creation_date DESC`,
      [projectID, instanceID]
    );

    return result.rows.map((row: any) => this.mapRowToUserGrant(row));
  }

  /**
   * Check if user has grant for project
   * Optionally check for specific role
   * 
   * @param userID - User ID
   * @param projectID - Project ID
   * @param instanceID - Instance ID
   * @param role - Optional role to check
   * @returns Grant check result
   */
  async checkUserGrant(
    userID: string,
    projectID: string,
    instanceID: string,
    role?: string
  ): Promise<UserGrantCheck> {
    const row = await this.database.queryOne(
      `SELECT 
        ug.id,
        ug.creation_date,
        ug.change_date,
        ug.sequence,
        ug.resource_owner,
        ug.instance_id,
        ug.user_id,
        ug.project_id,
        ug.project_grant_id,
        ug.state,
        ug.roles
      FROM projections.user_grants ug
      WHERE ug.user_id = $1 
        AND ug.project_id = $2 
        AND ug.instance_id = $3
        AND ug.state = $4`,
      [userID, projectID, instanceID, State.ACTIVE]
    );

    if (!row) {
      return {
        exists: false,
      };
    }

    const grant = this.mapRowToUserGrant(row);
    const roles = grant.roles || [];
    
    let hasRole = true;
    if (role) {
      hasRole = roles.includes(role);
    }

    return {
      exists: true,
      grant,
      hasRole,
      roles,
    };
  }

  /**
   * Map database row to UserGrant
   */
  private mapRowToUserGrant(row: any): UserGrant {
    return {
      id: row.id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      resourceOwner: row.resource_owner,
      instanceID: row.instance_id,
      userID: row.user_id,
      projectID: row.project_id,
      projectGrantID: row.project_grant_id,
      state: row.state,
      roles: Array.isArray(row.roles) ? row.roles : [],
      userName: row.username,
      userResourceOwner: row.user_resource_owner,
      userType: row.user_type,
      projectName: row.project_name,
      projectResourceOwner: row.project_resource_owner,
      orgName: row.org_name,
      orgPrimaryDomain: row.org_primary_domain,
      grantedOrgID: row.granted_org_id,
      grantedOrgName: row.granted_org_name,
    };
  }
}
