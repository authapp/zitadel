/**
 * Project Grant queries for Zitadel query layer
 * Handles cross-organization project sharing queries
 */

import { DatabasePool } from '../../database';
import { 
  ProjectGrant, 
  ProjectGrantSearchQuery, 
  ProjectGrantSearchResult,
  ProjectGrantDetails
} from './project-grant-types';
import { State } from '../converters/state-converter';

export class ProjectGrantQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Search project grants with filters
   * 
   * @param query - Search query with filters
   * @returns Paginated project grant results
   */
  async searchProjectGrants(query: ProjectGrantSearchQuery): Promise<ProjectGrantSearchResult> {
    const conditions: string[] = ['pg.instance_id = $1'];
    const params: any[] = [query.instanceID];
    let paramIndex = 2;

    // Add filters
    if (query.projectID) {
      conditions.push(`pg.project_id = $${paramIndex++}`);
      params.push(query.projectID);
    }

    if (query.grantedOrgID) {
      conditions.push(`pg.granted_org_id = $${paramIndex++}`);
      params.push(query.grantedOrgID);
    }

    if (query.resourceOwner) {
      conditions.push(`pg.resource_owner = $${paramIndex++}`);
      params.push(query.resourceOwner);
    }

    if (query.roleKeys && query.roleKeys.length > 0) {
      conditions.push(`pg.granted_roles && $${paramIndex++}`);
      params.push(query.roleKeys);
    }

    const whereClause = conditions.join(' AND ');

    // Build SELECT with joins
    const selectQuery = `
      SELECT 
        pg.id,
        pg.creation_date,
        pg.change_date,
        pg.sequence,
        pg.resource_owner,
        pg.instance_id,
        pg.project_id,
        pg.granted_org_id,
        pg.state,
        pg.granted_roles,
        p.name as project_name,
        p.resource_owner as project_owner,
        o.name as granted_org_name,
        o.primary_domain as granted_org_domain
      FROM projections.project_grants pg
      LEFT JOIN projections.projects p ON pg.project_id = p.id AND pg.instance_id = p.instance_id
      LEFT JOIN projections.orgs o ON pg.granted_org_id = o.id AND pg.instance_id = o.instance_id
      WHERE ${whereClause}
    `;

    // Get total count
    const countResult = await this.database.queryOne(
      `SELECT COUNT(*) as count FROM projections.project_grants pg WHERE ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult?.count || '0', 10);

    // Add pagination
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    
    const paginatedQuery = `${selectQuery}
      ORDER BY pg.creation_date ${query.sortOrder === 'asc' ? 'ASC' : 'DESC'}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    // Execute query
    const result = await this.database.query(paginatedQuery, params);

    return {
      grants: result.rows.map((row: any) => this.mapRowToProjectGrant(row)),
      totalCount,
      offset,
      limit,
    };
  }

  /**
   * Get project grant by ID
   * 
   * @param grantID - Grant ID
   * @param instanceID - Instance ID
   * @returns Project grant or null
   */
  async getProjectGrantByID(
    grantID: string,
    instanceID: string
  ): Promise<ProjectGrant | null> {
    const row = await this.database.queryOne(
      `SELECT 
        pg.id,
        pg.creation_date,
        pg.change_date,
        pg.sequence,
        pg.resource_owner,
        pg.instance_id,
        pg.project_id,
        pg.granted_org_id,
        pg.state,
        pg.granted_roles,
        p.name as project_name,
        p.resource_owner as project_owner,
        o.name as granted_org_name,
        o.primary_domain as granted_org_domain
      FROM projections.project_grants pg
      LEFT JOIN projections.projects p ON pg.project_id = p.id AND pg.instance_id = p.instance_id
      LEFT JOIN projections.orgs o ON pg.granted_org_id = o.id AND pg.instance_id = o.instance_id
      WHERE pg.id = $1 AND pg.instance_id = $2`,
      [grantID, instanceID]
    );

    return row ? this.mapRowToProjectGrant(row) : null;
  }

  /**
   * Get all project grants for a specific project
   * 
   * @param projectID - Project ID
   * @param instanceID - Instance ID
   * @returns Array of project grants
   */
  async getProjectGrantsByProjectID(
    projectID: string,
    instanceID: string
  ): Promise<ProjectGrant[]> {
    const result = await this.database.query(
      `SELECT 
        pg.id,
        pg.creation_date,
        pg.change_date,
        pg.sequence,
        pg.resource_owner,
        pg.instance_id,
        pg.project_id,
        pg.granted_org_id,
        pg.state,
        pg.granted_roles,
        p.name as project_name,
        p.resource_owner as project_owner,
        o.name as granted_org_name,
        o.primary_domain as granted_org_domain
      FROM projections.project_grants pg
      LEFT JOIN projections.projects p ON pg.project_id = p.id AND pg.instance_id = p.instance_id
      LEFT JOIN projections.orgs o ON pg.granted_org_id = o.id AND pg.instance_id = o.instance_id
      WHERE pg.project_id = $1 AND pg.instance_id = $2
      ORDER BY pg.creation_date DESC`,
      [projectID, instanceID]
    );

    return result.rows.map((row: any) => this.mapRowToProjectGrant(row));
  }

  /**
   * Get all project grants for a specific granted organization
   * Returns all projects that have been shared with this organization
   * 
   * @param grantedOrgID - Granted organization ID
   * @param instanceID - Instance ID
   * @returns Array of project grants
   */
  async getProjectGrantsByGrantedOrgID(
    grantedOrgID: string,
    instanceID: string
  ): Promise<ProjectGrant[]> {
    const result = await this.database.query(
      `SELECT 
        pg.id,
        pg.creation_date,
        pg.change_date,
        pg.sequence,
        pg.resource_owner,
        pg.instance_id,
        pg.project_id,
        pg.granted_org_id,
        pg.state,
        pg.granted_roles,
        p.name as project_name,
        p.resource_owner as project_owner,
        o.name as granted_org_name,
        o.primary_domain as granted_org_domain
      FROM projections.project_grants pg
      LEFT JOIN projections.projects p ON pg.project_id = p.id AND pg.instance_id = p.instance_id
      LEFT JOIN projections.orgs o ON pg.granted_org_id = o.id AND pg.instance_id = o.instance_id
      WHERE pg.granted_org_id = $1 AND pg.instance_id = $2
      ORDER BY pg.creation_date DESC`,
      [grantedOrgID, instanceID]
    );

    return result.rows.map((row: any) => this.mapRowToProjectGrant(row));
  }

  /**
   * Get project grant with details including role and grant count
   * 
   * @param grantID - Grant ID
   * @param instanceID - Instance ID
   * @returns Project grant details or null
   */
  async getProjectGrantDetails(
    grantID: string,
    instanceID: string
  ): Promise<ProjectGrantDetails | null> {
    const grant = await this.getProjectGrantByID(grantID, instanceID);
    if (!grant) {
      return null;
    }

    // Get user grant count for this project grant
    const countResult = await this.database.queryOne(
      `SELECT COUNT(*) as count 
       FROM projections.user_grants 
       WHERE project_grant_id = $1 AND instance_id = $2`,
      [grantID, instanceID]
    );

    // Get all roles from project
    const rolesResult = await this.database.query(
      `SELECT role_key 
       FROM projections.project_roles 
       WHERE project_id = $1 AND instance_id = $2`,
      [grant.projectID, instanceID]
    );

    return {
      ...grant,
      userGrantCount: parseInt(countResult?.count || '0', 10),
      projectRoles: rolesResult.rows.map((row: any) => row.role_key),
    };
  }

  /**
   * Check if project is granted to organization
   * 
   * @param projectID - Project ID
   * @param grantedOrgID - Granted organization ID
   * @param instanceID - Instance ID
   * @returns True if grant exists and is active
   */
  async isProjectGrantedToOrg(
    projectID: string,
    grantedOrgID: string,
    instanceID: string
  ): Promise<boolean> {
    const row = await this.database.queryOne(
      `SELECT 1 FROM projections.project_grants
       WHERE project_id = $1 
         AND granted_org_id = $2 
         AND instance_id = $3
         AND state = $4
       LIMIT 1`,
      [projectID, grantedOrgID, instanceID, State.ACTIVE]
    );

    return row !== null;
  }

  /**
   * Map database row to ProjectGrant
   */
  private mapRowToProjectGrant(row: any): ProjectGrant {
    return {
      id: row.id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      resourceOwner: row.resource_owner,
      instanceID: row.instance_id,
      projectID: row.project_id,
      grantedOrgID: row.granted_org_id,
      state: row.state,
      grantedRoles: Array.isArray(row.granted_roles) ? row.granted_roles : [],
      projectName: row.project_name,
      projectOwner: row.project_owner,
      grantedOrgName: row.granted_org_name,
      grantedOrgDomain: row.granted_org_domain,
    };
  }
}
