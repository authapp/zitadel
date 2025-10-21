/**
 * User Membership Types
 * Aggregates all user memberships across different scopes
 */

/**
 * Member type enum
 */
export enum MemberType {
  INSTANCE = 'instance',
  ORG = 'org',
  PROJECT = 'project',
  PROJECT_GRANT = 'project_grant',
}

/**
 * User membership - aggregates membership across all scopes
 */
export interface UserMembership {
  userID: string;
  memberType: MemberType;
  aggregateID: string;  // instance/org/project/grant ID
  objectID: string;
  roles: string[];
  displayName: string;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  resourceOwner: string;
  
  // Additional context fields
  orgID?: string;
  projectID?: string;
  grantID?: string;
  
  // Display info
  orgName?: string;
  projectName?: string;
}

/**
 * Search request for user memberships
 */
export interface UserMembershipSearchRequest {
  userID: string;
  instanceID?: string;
  memberTypes?: MemberType[];
  orgID?: string;
  projectID?: string;
  limit?: number;
  offset?: number;
}

/**
 * Search response for user memberships
 */
export interface UserMembershipSearchResponse {
  items: UserMembership[];
  totalCount: number;
  limit: number;
  offset: number;
}
