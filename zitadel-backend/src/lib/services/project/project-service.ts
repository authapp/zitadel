/**
 * Project service implementation
 */

import { Project } from '../../domain/project';
import { AuthContext, PermissionBuilder, ActionType } from '../../authz';
import { PermissionChecker } from '../../authz/types';
import { CommandBus } from '../../command/types';
import { Query } from '../../query/types';
import { generateId } from '../../id/snowflake';
import {
  ProjectService,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateApplicationRequest,
  ProjectListOptions,
  ProjectNotFoundError,
} from './types';

/**
 * Default project service implementation
 */
export class DefaultProjectService implements ProjectService {
  constructor(
    _commandBus: CommandBus, // Will be used in production for dispatching commands
    private query: Query,
    private permissionChecker: PermissionChecker
  ) {}

  /**
   * Create new project
   */
  async create(context: AuthContext, request: CreateProjectRequest): Promise<Project> {
    await this.checkPermission(context, PermissionBuilder.project(ActionType.CREATE));

    const projectId = generateId();
    const project: Project = {
      id: projectId,
      name: request.name,
      resourceOwner: request.orgId,
      state: 1, // ProjectState.ACTIVE
      projectRoleAssertion: false,
      projectRoleCheck: false,
      hasProjectCheck: false,
      privateLabelingSetting: 0,
      createdAt: new Date(),
      changedAt: new Date(),
      sequence: 0,
    };

    // In production, dispatch command
    // await this.commandBus.execute({ type: 'project.create', ... });

    return project;
  }

  /**
   * Get project by ID
   */
  async getById(context: AuthContext, projectId: string): Promise<Project | null> {
    await this.checkPermission(context, PermissionBuilder.project(ActionType.READ, projectId));

    const project = await this.query.findById<Project>('projects', projectId);
    return project;
  }

  /**
   * List projects
   */
  async list(context: AuthContext, options?: ProjectListOptions): Promise<Project[]> {
    await this.checkPermission(context, PermissionBuilder.project(ActionType.LIST));

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    let query = 'SELECT * FROM projects WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.filters?.name) {
      query += ` AND name LIKE $${paramIndex}`;
      params.push(`%${options.filters.name}%`);
      paramIndex++;
    }

    if (options?.filters?.orgId) {
      query += ` AND org_id = $${paramIndex}`;
      params.push(options.filters.orgId);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const projects = await this.query.execute<Project>(query, params);
    return projects;
  }

  /**
   * Update project
   */
  async update(
    context: AuthContext,
    projectId: string,
    _request: UpdateProjectRequest
  ): Promise<Project> {
    await this.checkPermission(context, PermissionBuilder.project(ActionType.UPDATE, projectId));

    const project = await this.getById(context, projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    // In production, dispatch command
    // await this.commandBus.execute({ type: 'project.update', ... });

    return this.getById(context, projectId) as Promise<Project>;
  }

  /**
   * Delete project
   */
  async delete(context: AuthContext, projectId: string): Promise<void> {
    await this.checkPermission(context, PermissionBuilder.project(ActionType.DELETE, projectId));

    const project = await this.getById(context, projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    // In production, dispatch command
    // await this.commandBus.execute({ type: 'project.delete', ... });
  }

  /**
   * Create application in project
   */
  async createApplication(
    context: AuthContext,
    projectId: string,
    request: CreateApplicationRequest
  ): Promise<any> {
    await this.checkPermission(context, PermissionBuilder.application(ActionType.CREATE));

    const project = await this.getById(context, projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    const appId = generateId();
    const application = {
      id: appId,
      projectId,
      name: request.name,
      type: request.type,
      redirectUris: request.redirectUris || [],
      postLogoutRedirectUris: request.postLogoutRedirectUris || [],
      clientId: generateId(),
      clientSecret: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: request.metadata,
    };

    // In production, dispatch command
    // await this.commandBus.execute({ type: 'application.create', ... });

    return application;
  }

  /**
   * List applications in project
   */
  async listApplications(context: AuthContext, projectId: string): Promise<any[]> {
    await this.checkPermission(context, PermissionBuilder.application(ActionType.LIST));

    const applications = await this.query.execute<any>(
      'SELECT * FROM applications WHERE project_id = $1',
      [projectId]
    );
    return applications;
  }

  /**
   * Assign role to user in project
   */
  async assignRole(
    context: AuthContext,
    _projectId: string,
    _userId: string,
    _roleId: string
  ): Promise<void> {
    await this.checkPermission(context, PermissionBuilder.grant(ActionType.CREATE));

    // In production, dispatch command
    // await this.commandBus.execute({ type: 'project.assignRole', ... });
  }

  /**
   * Remove role from user in project
   */
  async removeRole(
    context: AuthContext,
    _projectId: string,
    _userId: string,
    _roleId: string
  ): Promise<void> {
    await this.checkPermission(context, PermissionBuilder.grant(ActionType.DELETE));

    // In production, dispatch command
    // await this.commandBus.execute({ type: 'project.removeRole', ... });
  }

  /**
   * Check permission
   */
  private async checkPermission(context: AuthContext, permission: any): Promise<void> {
    const result = await this.permissionChecker.check(context, permission);
    if (!result.allowed) {
      throw new Error(`Permission denied: ${result.reason}`);
    }
  }
}

/**
 * Create project service
 */
export function createProjectService(
  commandBus: CommandBus,
  query: Query,
  permissionChecker: PermissionChecker
): ProjectService {
  return new DefaultProjectService(commandBus, query, permissionChecker);
}
