/**
 * Project service types
 */

import { Project } from '../../domain/project';
import { AuthContext } from '../../authz/types';

/**
 * Create project request
 */
export interface CreateProjectRequest {
  name: string;
  orgId: string;
  metadata?: Record<string, any>;
}

/**
 * Update project request
 */
export interface UpdateProjectRequest {
  name?: string;
  metadata?: Record<string, any>;
}

/**
 * Create application request
 */
export interface CreateApplicationRequest {
  name: string;
  type: 'web' | 'native' | 'api';
  redirectUris?: string[];
  postLogoutRedirectUris?: string[];
  metadata?: Record<string, any>;
}

/**
 * Project search filters
 */
export interface ProjectSearchFilters {
  name?: string;
  orgId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Project list options
 */
export interface ProjectListOptions {
  filters?: ProjectSearchFilters;
  limit?: number;
  offset?: number;
}

/**
 * Project service interface
 */
export interface ProjectService {
  /**
   * Create new project
   */
  create(context: AuthContext, request: CreateProjectRequest): Promise<Project>;

  /**
   * Get project by ID
   */
  getById(context: AuthContext, projectId: string): Promise<Project | null>;

  /**
   * List projects
   */
  list(context: AuthContext, options?: ProjectListOptions): Promise<Project[]>;

  /**
   * Update project
   */
  update(context: AuthContext, projectId: string, request: UpdateProjectRequest): Promise<Project>;

  /**
   * Delete project
   */
  delete(context: AuthContext, projectId: string): Promise<void>;

  /**
   * Create application in project
   */
  createApplication(
    context: AuthContext,
    projectId: string,
    request: CreateApplicationRequest
  ): Promise<any>;

  /**
   * List applications in project
   */
  listApplications(context: AuthContext, projectId: string): Promise<any[]>;

  /**
   * Assign role to user in project
   */
  assignRole(context: AuthContext, projectId: string, userId: string, roleId: string): Promise<void>;

  /**
   * Remove role from user in project
   */
  removeRole(context: AuthContext, projectId: string, userId: string, roleId: string): Promise<void>;
}

/**
 * Project service errors
 */
export class ProjectServiceError extends Error {
  constructor(message: string, public code: string = 'PROJECT_SERVICE_ERROR') {
    super(message);
    this.name = 'ProjectServiceError';
  }
}

export class ProjectNotFoundError extends ProjectServiceError {
  constructor(projectId: string) {
    super(`Project not found: ${projectId}`, 'PROJECT_NOT_FOUND');
    this.name = 'ProjectNotFoundError';
  }
}

export class ProjectAlreadyExistsError extends ProjectServiceError {
  constructor(identifier: string) {
    super(`Project already exists: ${identifier}`, 'PROJECT_ALREADY_EXISTS');
    this.name = 'ProjectAlreadyExistsError';
  }
}
