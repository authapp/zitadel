/**
 * Login Name Types
 * 
 * Domain types for login name queries
 */

/**
 * Login Name
 * Represents a login name entry for a user
 */
export interface LoginName {
  userId: string;
  instanceId: string;
  loginName: string;
  domainName: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Login Name Search Options
 */
export interface LoginNameSearchOptions {
  userId?: string;
  instanceId?: string;
  domainName?: string;
  isPrimary?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Login Name Search Result
 */
export interface LoginNameSearchResult {
  loginNames: LoginName[];
  total: number;
}
