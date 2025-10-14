/**
 * User Query Types
 * 
 * Type definitions for user queries and results.
 * Based on Zitadel Go internal/query/user.go
 */

/**
 * User read model from projection
 */
export interface User {
  id: string;
  instanceId: string;
  resourceOwner: string;
  username: string;
  email: string;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  phone?: string;
  phoneVerified: boolean;
  phoneVerifiedAt?: Date;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  nickname?: string;
  preferredLanguage?: string;
  gender?: string;
  avatarUrl?: string;
  preferredLoginName?: string;
  loginNames?: string[];
  passwordHash?: string;
  passwordChangedAt?: Date;
  passwordChangeRequired: boolean;
  mfaEnabled: boolean;
  state: UserState;
  userType: UserType;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * User state enum
 */
export enum UserState {
  UNSPECIFIED = 'unspecified',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DELETED = 'deleted',
  LOCKED = 'locked',
}

/**
 * User type enum
 */
export enum UserType {
  UNSPECIFIED = 'unspecified',
  HUMAN = 'human',
  MACHINE = 'machine',
}

/**
 * Human user details
 */
export interface HumanUser extends User {
  userType: UserType.HUMAN;
  profile: HumanProfile;
  email: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
}

/**
 * Human user profile
 */
export interface HumanProfile {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  nickname?: string;
  preferredLanguage?: string;
  gender?: string;
  avatarUrl?: string;
}

/**
 * Machine user details
 */
export interface MachineUser extends User {
  userType: UserType.MACHINE;
  name: string;
  description?: string;
  accessTokenType: AccessTokenType;
}

/**
 * Access token type for machine users
 */
export enum AccessTokenType {
  BEARER = 'bearer',
  JWT = 'jwt',
}

/**
 * User profile (minimal info for display)
 */
export interface UserProfile {
  id: string;
  username: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  preferredLanguage?: string;
}

/**
 * User for notification purposes
 */
export interface NotifyUser {
  id: string;
  username: string;
  email: string;
  preferredLanguage?: string;
  resourceOwner: string;
  lastEmail?: string;
  verifiedEmail?: string;
  lastPhone?: string;
  verifiedPhone?: string;
  passwordSet: boolean;
}

/**
 * User search filters
 */
export interface UserSearchFilter {
  instanceId?: string;
  resourceOwner?: string;
  username?: string;
  email?: string;
  phone?: string;
  state?: UserState;
  userType?: UserType;
  searchString?: string; // Searches across username, email, name
}

/**
 * User search options
 */
export interface UserSearchOptions {
  filter?: UserSearchFilter;
  offset?: number;
  limit?: number;
  sortBy?: UserSortField;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * User sort fields
 */
export enum UserSortField {
  USERNAME = 'username',
  EMAIL = 'email',
  FIRST_NAME = 'first_name',
  LAST_NAME = 'last_name',
  DISPLAY_NAME = 'display_name',
  CREATED_AT = 'created_at',
  UPDATED_AT = 'updated_at',
}

/**
 * User search result
 */
export interface UserSearchResult {
  users: User[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * User uniqueness check result
 */
export interface UserUniquenessResult {
  isUnique: boolean;
  username?: boolean;
  email?: boolean;
}

/**
 * Login name info
 */
export interface LoginName {
  userName: string;
  isPrimary: boolean;
  isDomain: boolean;
}

/**
 * User grant info (for authorization)
 */
export interface UserGrant {
  id: string;
  userId: string;
  projectId: string;
  projectGrantId?: string;
  roles: string[];
  resourceOwner: string;
}
