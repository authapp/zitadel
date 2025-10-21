/**
 * Member types for Zitadel query layer
 * Handles membership in different scopes (instance, org, project, project grant)
 * 
 * Members represent user assignments with roles at different levels:
 * - Instance Members: Global admins (IAM level)
 * - Org Members: Organization admins/users
 * - Project Members: Project admins/users
 * - Project Grant Members: Users managing project grants
 */

/**
 * Base member interface with common fields
 */
export interface BaseMember {
  userID: string;
  roles: string[];
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  resourceOwner: string;
  instanceID: string;
  
  // User info (joined from users table)
  userName?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  preferredLoginName?: string;
  avatarURL?: string;
}

/**
 * Instance Member (IAM Member)
 * Global administrator access
 */
export interface InstanceMember extends BaseMember {
  iamID: string; // Instance ID reference
}

/**
 * Organization Member
 * Organization-level access
 */
export interface OrgMember extends BaseMember {
  orgID: string;
  
  // Org info (joined)
  orgName?: string;
  orgDomain?: string;
}

/**
 * Project Member
 * Project-level access
 */
export interface ProjectMember extends BaseMember {
  projectID: string;
  
  // Project info (joined)
  projectName?: string;
  projectOwner?: string;
}

/**
 * Project Grant Member
 * Access to manage specific project grant
 */
export interface ProjectGrantMember extends BaseMember {
  projectID: string;
  grantID: string;
  
  // Project and grant info (joined)
  projectName?: string;
  grantedOrgID?: string;
  grantedOrgName?: string;
}

/**
 * Search query for members
 */
export interface MemberSearchQuery {
  instanceID: string;
  
  // Scope filters (depends on member type)
  iamID?: string;
  orgID?: string;
  projectID?: string;
  grantID?: string;
  
  // User filters
  userID?: string;
  userName?: string;
  email?: string;
  
  // Role filters
  roles?: string[];
  
  // Pagination
  offset?: number;
  limit?: number;
  
  // Sorting
  sortOrder?: 'asc' | 'desc';
}

/**
 * Search result for members
 */
export interface MemberSearchResult<T extends BaseMember> {
  members: T[];
  totalCount: number;
  offset: number;
  limit: number;
}
