/**
 * User IDP Link Domain Types
 * 
 * External Identity Provider linking for social login
 * Based on Go: internal/domain/user_idp_link.go
 */

/**
 * User IDP Link State enumeration
 */
export enum UserIDPLinkState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REMOVED = 2,
}

/**
 * User IDP Link
 * Links a user to an external identity provider (Google, GitHub, etc.)
 */
export interface UserIDPLink {
  userID?: string;           // Aggregate ID
  resourceOwner?: string;    // Organization ID
  idpConfigID: string;       // IDP configuration ID
  externalUserID: string;    // User ID from external provider
  displayName: string;       // Username from external provider
}

/**
 * Validate IDP link has required fields
 */
export function isIDPLinkValid(link: UserIDPLink): boolean {
  return !!link.idpConfigID && !!link.externalUserID;
}

/**
 * Check if IDP link state is valid
 */
export function isIDPLinkStateValid(state: UserIDPLinkState): boolean {
  return state >= UserIDPLinkState.UNSPECIFIED && state < 3;
}
