/**
 * Project Grant types for Zitadel query layer
 * Handles cross-organization project sharing
 * 
 * ProjectGrant allows a project from one organization to be shared
 * with another organization, enabling cross-org collaboration.
 */

import { State } from '../converters/state-converter';

/**
 * Project Grant - represents project shared to another organization
 */
export interface ProjectGrant {
  id: string;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  resourceOwner: string;
  instanceID: string;
  
  // Grant details
  projectID: string;
  grantedOrgID: string;
  
  // State management
  state: State;
  
  // Role grants - which roles from project can be assigned
  grantedRoles: string[];
  
  // Project information (joined)
  projectName?: string;
  projectOwner?: string;
  
  // Granted organization information (joined)
  grantedOrgName?: string;
  grantedOrgDomain?: string;
}

/**
 * Search query for project grants
 */
export interface ProjectGrantSearchQuery {
  instanceID: string;
  
  // Filters
  projectID?: string;
  grantedOrgID?: string;
  resourceOwner?: string;
  roleKeys?: string[];
  
  // Pagination
  offset?: number;
  limit?: number;
  
  // Sorting
  sortOrder?: 'asc' | 'desc';
}

/**
 * Search result for project grants
 */
export interface ProjectGrantSearchResult {
  grants: ProjectGrant[];
  totalCount: number;
  offset: number;
  limit: number;
}

/**
 * Project grant with full details
 */
export interface ProjectGrantDetails extends ProjectGrant {
  // All available roles in the project
  projectRoles?: string[];
  
  // Number of user grants created via this project grant
  userGrantCount?: number;
}
