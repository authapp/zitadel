import { HttpClient } from '../lib/http-client';
import {
  AddProjectRequest,
  AddProjectResponse,
  AddProjectRoleRequest,
  AddProjectMemberRequest,
  GetProjectByIdResponse,
  ListProjectsResponse,
  UpdateProjectRequest,
} from '../types/project';
import { ObjectDetails } from '../types/common';

export class ProjectService {
  constructor(private client: HttpClient) {}

  /**
   * Get project by ID
   */
  async getProjectById(projectId: string): Promise<GetProjectByIdResponse> {
    return this.client.post('/zitadel.project.v2.ProjectService/GetProjectByID', {
      projectId,
    });
  }

  /**
   * List projects
   */
  async listProjects(request: {
    query?: { offset?: number; limit?: number; asc?: boolean };
  } = {}): Promise<ListProjectsResponse> {
    return this.client.post('/zitadel.project.v2.ProjectService/ListProjects', request);
  }

  /**
   * Add project
   */
  async addProject(request: AddProjectRequest): Promise<AddProjectResponse> {
    return this.client.post('/zitadel.project.v2.ProjectService/AddProject', request);
  }

  /**
   * Update project
   */
  async updateProject(request: UpdateProjectRequest): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.project.v2.ProjectService/UpdateProject', request);
  }

  /**
   * Deactivate project
   */
  async deactivateProject(projectId: string): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.project.v2.ProjectService/DeactivateProject', {
      projectId,
    });
  }

  /**
   * Reactivate project
   */
  async reactivateProject(projectId: string): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.project.v2.ProjectService/ReactivateProject', {
      projectId,
    });
  }

  /**
   * Remove project
   */
  async removeProject(projectId: string): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.project.v2.ProjectService/RemoveProject', {
      projectId,
    });
  }

  /**
   * Add project role
   */
  async addProjectRole(request: AddProjectRoleRequest): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.project.v2.ProjectService/AddProjectRole', request);
  }

  /**
   * Update project role
   */
  async updateProjectRole(
    projectId: string,
    roleKey: string,
    displayName: string,
    group?: string
  ): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.project.v2.ProjectService/UpdateProjectRole', {
      projectId,
      roleKey,
      displayName,
      group,
    });
  }

  /**
   * Remove project role
   */
  async removeProjectRole(projectId: string, roleKey: string): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.project.v2.ProjectService/RemoveProjectRole', {
      projectId,
      roleKey,
    });
  }

  /**
   * Add project member
   */
  async addProjectMember(request: AddProjectMemberRequest): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.project.v2.ProjectService/AddProjectMember', request);
  }

  /**
   * Update project member
   */
  async updateProjectMember(
    projectId: string,
    userId: string,
    roles: string[]
  ): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.project.v2.ProjectService/UpdateProjectMember', {
      projectId,
      userId,
      roles,
    });
  }

  /**
   * Remove project member
   */
  async removeProjectMember(
    projectId: string,
    userId: string
  ): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.project.v2.ProjectService/RemoveProjectMember', {
      projectId,
      userId,
    });
  }
}
