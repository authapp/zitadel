/**
 * Project Service Proto Definitions (v2)
 * 
 * TypeScript type definitions for ProjectService RPCs
 * Based on: proto/zitadel/project/v2/project_service.proto
 */

import { Details } from '../../object/v2/object';

// ====================================================================
// PROJECT CRUD
// ====================================================================

/**
 * AddProject Request
 */
export interface AddProjectRequest {
  /** Organization ID */
  organizationId: string;
  
  /** Project name (required, 1-200 chars) */
  name: string;
  
  /** Project role assertion */
  projectRoleAssertion?: boolean;
  
  /** Project role check */
  projectRoleCheck?: boolean;
  
  /** Has project check */
  hasProjectCheck?: boolean;
  
  /** Private labeling setting */
  privateLabelingSetting?: number;
}

/**
 * AddProject Response
 */
export interface AddProjectResponse {
  /** Object details with metadata */
  details?: Details;
  
  /** Created project ID */
  projectId: string;
}

/**
 * GetProject Request
 */
export interface GetProjectRequest {
  /** Project ID */
  projectId: string;
}

/**
 * GetProject Response
 */
export interface GetProjectResponse {
  /** Project details */
  project?: Project;
}

/**
 * Project type
 */
export interface Project {
  /** Project ID */
  id: string;
  
  /** Project name */
  name: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Project role assertion */
  projectRoleAssertion: boolean;
  
  /** Project role check */
  projectRoleCheck: boolean;
  
  /** Has project check */
  hasProjectCheck: boolean;
  
  /** Private labeling setting */
  privateLabelingSetting: number;
  
  /** Project state */
  state: string;
}

/**
 * UpdateProject Request
 */
export interface UpdateProjectRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** New project name */
  name?: string;
  
  /** Project role assertion */
  projectRoleAssertion?: boolean;
  
  /** Project role check */
  projectRoleCheck?: boolean;
  
  /** Has project check */
  hasProjectCheck?: boolean;
  
  /** Private labeling setting */
  privateLabelingSetting?: number;
}

/**
 * UpdateProject Response
 */
export interface UpdateProjectResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * DeactivateProject Request
 */
export interface DeactivateProjectRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
}

/**
 * DeactivateProject Response
 */
export interface DeactivateProjectResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * ReactivateProject Request
 */
export interface ReactivateProjectRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
}

/**
 * ReactivateProject Response
 */
export interface ReactivateProjectResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * RemoveProject Request
 */
export interface RemoveProjectRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
}

/**
 * RemoveProject Response
 */
export interface RemoveProjectResponse {
  /** Object details with metadata */
  details?: Details;
}

// ====================================================================
// PROJECT ROLES
// ====================================================================

/**
 * AddProjectRole Request
 */
export interface AddProjectRoleRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Role key */
  roleKey: string;
  
  /** Display name */
  displayName: string;
  
  /** Group */
  group?: string;
}

/**
 * AddProjectRole Response
 */
export interface AddProjectRoleResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * UpdateProjectRole Request
 */
export interface UpdateProjectRoleRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Role key */
  roleKey: string;
  
  /** Display name */
  displayName: string;
  
  /** Group */
  group?: string;
}

/**
 * UpdateProjectRole Response
 */
export interface UpdateProjectRoleResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * RemoveProjectRole Request
 */
export interface RemoveProjectRoleRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Role key */
  roleKey: string;
}

/**
 * RemoveProjectRole Response
 */
export interface RemoveProjectRoleResponse {
  /** Object details with metadata */
  details?: Details;
}

// ====================================================================
// PROJECT MEMBERS
// ====================================================================

/**
 * AddProjectMember Request
 */
export interface AddProjectMemberRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** User ID */
  userId: string;
  
  /** Project roles */
  roles: string[];
}

/**
 * AddProjectMember Response
 */
export interface AddProjectMemberResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * UpdateProjectMember Request
 */
export interface UpdateProjectMemberRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** User ID */
  userId: string;
  
  /** Project roles */
  roles: string[];
}

/**
 * UpdateProjectMember Response
 */
export interface UpdateProjectMemberResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * RemoveProjectMember Request
 */
export interface RemoveProjectMemberRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** User ID */
  userId: string;
}

/**
 * RemoveProjectMember Response
 */
export interface RemoveProjectMemberResponse {
  /** Object details with metadata */
  details?: Details;
}

// ====================================================================
// PROJECT GRANTS
// ====================================================================

/**
 * AddProjectGrant Request
 */
export interface AddProjectGrantRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID (owner of project) */
  organizationId: string;
  
  /** Granted organization ID (receiving grant) */
  grantedOrgId: string;
  
  /** Role keys to grant */
  roleKeys: string[];
}

/**
 * AddProjectGrant Response
 */
export interface AddProjectGrantResponse {
  /** Object details with metadata */
  details?: Details;
  
  /** Grant ID */
  grantId: string;
}

/**
 * UpdateProjectGrant Request
 */
export interface UpdateProjectGrantRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Grant ID */
  grantId: string;
  
  /** Role keys to grant */
  roleKeys: string[];
}

/**
 * UpdateProjectGrant Response
 */
export interface UpdateProjectGrantResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * DeactivateProjectGrant Request
 */
export interface DeactivateProjectGrantRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Grant ID */
  grantId: string;
}

/**
 * DeactivateProjectGrant Response
 */
export interface DeactivateProjectGrantResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * ReactivateProjectGrant Request
 */
export interface ReactivateProjectGrantRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Grant ID */
  grantId: string;
}

/**
 * ReactivateProjectGrant Response
 */
export interface ReactivateProjectGrantResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * RemoveProjectGrant Request
 */
export interface RemoveProjectGrantRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Grant ID */
  grantId: string;
}

/**
 * RemoveProjectGrant Response
 */
export interface RemoveProjectGrantResponse {
  /** Object details with metadata */
  details?: Details;
}
