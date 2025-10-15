/**
 * Project Queries
 * 
 * Query methods for projects and project roles
 */

import { DatabasePool } from '../../database/pool';
import {
  Project,
  ProjectRole,
  ProjectSearchQuery,
  ProjectSearchResult,
  ProjectRoleSearchQuery,
  ProjectRoleSearchResult,
  ProjectWithRoles,
  ProjectState,
} from './project-types';

/**
 * Project query service
 */
export class ProjectQueries {
  constructor(private database: DatabasePool) {}

  /**
   * Get project by ID
   */
  async getProjectByID(projectID: string): Promise<Project | null> {
    const result = await this.database.query(
      'SELECT * FROM projects_projection WHERE id = $1 AND state != $2',
      [projectID, 'removed']
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToProject(result.rows[0]);
  }

  /**
   * Search projects with filters
   */
  async searchProjects(query: ProjectSearchQuery): Promise<ProjectSearchResult> {
    const conditions: string[] = ['state != $1'];
    const values: any[] = ['removed'];
    let paramIndex = 2;

    if (query.name) {
      conditions.push(`name ILIKE $${paramIndex}`);
      values.push(`%${query.name}%`);
      paramIndex++;
    }

    if (query.resourceOwner) {
      conditions.push(`resource_owner = $${paramIndex}`);
      values.push(query.resourceOwner);
      paramIndex++;
    }

    if (query.state) {
      conditions.push(`state = $${paramIndex}`);
      values.push(query.state);
      paramIndex++;
    }

    if (query.projectRoleAssertion !== undefined) {
      conditions.push(`project_role_assertion = $${paramIndex}`);
      values.push(query.projectRoleAssertion);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.database.query(
      `SELECT COUNT(*) as count FROM projects_projection ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const limit = query.limit || 20;
    const offset = query.offset || 0;
    
    const result = await this.database.query(
      `SELECT * FROM projects_projection 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      projects: result.rows.map(row => this.mapToProject(row)),
      total,
    };
  }

  /**
   * Get project with all its roles
   */
  async getProjectWithRoles(projectID: string): Promise<ProjectWithRoles | null> {
    const project = await this.getProjectByID(projectID);
    if (!project) {
      return null;
    }

    const rolesResult = await this.database.query(
      'SELECT * FROM project_roles_projection WHERE project_id = $1 ORDER BY role_key',
      [projectID]
    );

    return {
      project,
      roles: rolesResult.rows.map(row => this.mapToProjectRole(row)),
    };
  }

  /**
   * Search project roles
   */
  async searchProjectRoles(query: ProjectRoleSearchQuery): Promise<ProjectRoleSearchResult> {
    const conditions: string[] = ['project_id = $1'];
    const values: any[] = [query.projectId];
    let paramIndex = 2;

    if (query.roleKey) {
      conditions.push(`role_key ILIKE $${paramIndex}`);
      values.push(`%${query.roleKey}%`);
      paramIndex++;
    }

    if (query.displayName) {
      conditions.push(`display_name ILIKE $${paramIndex}`);
      values.push(`%${query.displayName}%`);
      paramIndex++;
    }

    if (query.group) {
      conditions.push(`role_group = $${paramIndex}`);
      values.push(query.group);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await this.database.query(
      `SELECT COUNT(*) as count FROM project_roles_projection WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    
    const result = await this.database.query(
      `SELECT * FROM project_roles_projection 
       WHERE ${whereClause}
       ORDER BY role_key
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      roles: result.rows.map(row => this.mapToProjectRole(row)),
      total,
    };
  }

  /**
   * Get all roles for a project
   */
  async getProjectRoles(projectID: string): Promise<ProjectRole[]> {
    const result = await this.database.query(
      'SELECT * FROM project_roles_projection WHERE project_id = $1 ORDER BY role_key',
      [projectID]
    );

    return result.rows.map(row => this.mapToProjectRole(row));
  }

  /**
   * Check if a role exists in a project
   */
  async hasProjectRole(projectID: string, roleKey: string): Promise<boolean> {
    const result = await this.database.query(
      'SELECT 1 FROM project_roles_projection WHERE project_id = $1 AND role_key = $2',
      [projectID, roleKey]
    );

    return result.rows.length > 0;
  }

  /**
   * Get projects by organization (resource owner)
   */
  async getProjectsByOrg(orgID: string): Promise<Project[]> {
    const result = await this.database.query(
      `SELECT * FROM projects_projection 
       WHERE resource_owner = $1 AND state != $2
       ORDER BY created_at DESC`,
      [orgID, 'removed']
    );

    return result.rows.map(row => this.mapToProject(row));
  }

  /**
   * Count active projects for an organization
   */
  async countProjectsByOrg(orgID: string): Promise<number> {
    const result = await this.database.query(
      'SELECT COUNT(*) as count FROM projects_projection WHERE resource_owner = $1 AND state = $2',
      [orgID, 'active']
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * Map database row to Project
   */
  private mapToProject(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      resourceOwner: row.resource_owner,
      state: row.state as ProjectState,
      projectRoleAssertion: row.project_role_assertion,
      projectRoleCheck: row.project_role_check,
      hasProjectCheck: row.has_project_check,
      privateLabelingSetting: row.private_labeling_setting,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      sequence: BigInt(row.sequence),
    };
  }

  /**
   * Map database row to ProjectRole
   */
  private mapToProjectRole(row: any): ProjectRole {
    return {
      projectId: row.project_id,
      roleKey: row.role_key,
      displayName: row.display_name,
      group: row.role_group,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      sequence: BigInt(row.sequence),
    };
  }
}
