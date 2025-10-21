/**
 * User Grant types for Zitadel query layer
 * Handles user access grants to projects with role assignments
 */

import { State } from '../converters/state-converter';

/**
 * User Grant - represents user access to a project with specific roles
 * UserGrant is the core authorization mechanism linking users to projects
 */
export interface UserGrant {
  id: string;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  resourceOwner: string;
  instanceID: string;
  
  // Grant details
  userID: string;
  projectID: string;
  projectGrantID?: string; // If granted via project grant (cross-org access)
  
  // State management
  state: State;
  
  // Role assignments
  roles: string[];
  
  // User information (joined from users table)
  userName?: string;
  userResourceOwner?: string;
  userType?: number;
  
  // Project information (joined from projects table)
  projectName?: string;
  projectResourceOwner?: string;
  
  // Organization information
  orgName?: string;
  orgPrimaryDomain?: string;
  
  // Project grant information (if applicable)
  grantedOrgID?: string;
  grantedOrgName?: string;
}

/**
 * Search query for user grants
 */
export interface UserGrantSearchQuery {
  instanceID: string;
  
  // Filters
  userID?: string;
  projectID?: string;
  projectGrantID?: string;
  resourceOwner?: string;
  grantedOrgID?: string;
  
  // State filters
  withGranted?: boolean; // Include granted org info
  queries?: UserGrantQuery[];
  
  // Pagination
  offset?: number;
  limit?: number;
  
  // Sorting
  sortOrder?: 'asc' | 'desc';
}

/**
 * Individual query filter for user grants
 */
export interface UserGrantQuery {
  userIDQuery?: string;
  projectIDQuery?: string;
  projectGrantIDQuery?: string;
  resourceOwnerQuery?: string;
  userNameQuery?: string;
  roleKeyQuery?: string;
  orgNameQuery?: string;
  orgDomainQuery?: string;
  projectNameQuery?: string;
  grantedOrgIDQuery?: string;
  withGranted?: boolean;
}

/**
 * Search result for user grants
 */
export interface UserGrantSearchResult {
  grants: UserGrant[];
  totalCount: number;
  offset: number;
  limit: number;
}

/**
 * User grant check result
 */
export interface UserGrantCheck {
  exists: boolean;
  grant?: UserGrant;
  hasRole?: boolean;
  roles?: string[];
}
