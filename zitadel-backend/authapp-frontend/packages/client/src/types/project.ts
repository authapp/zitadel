import { ObjectDetails, ProjectState } from './common';

export interface Project {
  id: string;
  state: ProjectState;
  name: string;
  projectRoleAssertion: boolean;
  projectRoleCheck: boolean;
  hasProjectCheck: boolean;
  privateLabelingSetting: number;
  details: ObjectDetails;
}

export interface ProjectRole {
  key: string;
  displayName: string;
  group?: string;
}

export interface AddProjectRequest {
  name: string;
  projectRoleAssertion?: boolean;
  projectRoleCheck?: boolean;
  hasProjectCheck?: boolean;
  privateLabelingSetting?: number;
}

export interface UpdateProjectRequest {
  projectId: string;
  name: string;
  projectRoleAssertion?: boolean;
  projectRoleCheck?: boolean;
  hasProjectCheck?: boolean;
  privateLabelingSetting?: number;
}

export interface AddProjectRoleRequest {
  projectId: string;
  roleKey: string;
  displayName: string;
  group?: string;
}

export interface AddProjectMemberRequest {
  projectId: string;
  userId: string;
  roles: string[];
}

export interface AddProjectResponse {
  projectId: string;
  details: ObjectDetails;
}

export interface GetProjectByIdResponse {
  project: Project;
}

export interface ListProjectsResponse {
  details: {
    totalResult: string;
    processedSequence: string;
    viewTimestamp: string;
  };
  result: Project[];
}
