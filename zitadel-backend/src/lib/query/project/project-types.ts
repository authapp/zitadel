/**
 * Project Query Types
 * 
 * Types for project queries and projections
 */

/**
 * Project state enumeration
 */
export enum ProjectState {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  REMOVED = 'removed',
}

/**
 * Project read model
 */
export interface Project {
  id: string;
  name: string;
  resourceOwner: string; // Organization ID
  state: ProjectState;
  projectRoleAssertion: boolean; // Require role grants for access
  projectRoleCheck: boolean; // Check roles on token
  hasProjectCheck: boolean; // Check project membership
  privateLabelingSetting: 'unspecified' | 'enforce' | 'allow';
  createdAt: Date;
  updatedAt: Date;
  sequence: bigint;
}

/**
 * Project role read model
 */
export interface ProjectRole {
  instanceID?: string;
  projectId: string;
  roleKey: string;
  displayName: string;
  group: string | null;
  createdAt: Date;
  updatedAt: Date;
  sequence: bigint;
}

/**
 * Project grant read model (cross-org project sharing)
 */
export interface ProjectGrant {
  id: string;
  projectId: string;
  grantedOrgId: string;
  roleKeys: string[];
  state: ProjectState;
  createdAt: Date;
  updatedAt: Date;
  sequence: bigint;
}

/**
 * Search query for projects
 */
export interface ProjectSearchQuery {
  name?: string;
  resourceOwner?: string; // Filter by organization
  state?: ProjectState;
  projectRoleAssertion?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Search result for projects
 */
export interface ProjectSearchResult {
  projects: Project[];
  total: number;
}

/**
 * Search query for project roles
 */
export interface ProjectRoleSearchQuery {
  projectId: string;
  roleKey?: string;
  displayName?: string;
  group?: string;
  limit?: number;
  offset?: number;
}

/**
 * Search result for project roles
 */
export interface ProjectRoleSearchResult {
  roles: ProjectRole[];
  total: number;
}

/**
 * Project with roles
 */
export interface ProjectWithRoles {
  project: Project;
  roles: ProjectRole[];
}

/**
 * Search query for project grants
 */
export interface ProjectGrantSearchQuery {
  projectId?: string;
  grantedOrgId?: string;
  state?: ProjectState;
  limit?: number;
  offset?: number;
}

/**
 * Search result for project grants
 */
export interface ProjectGrantSearchResult {
  grants: ProjectGrant[];
  total: number;
}
