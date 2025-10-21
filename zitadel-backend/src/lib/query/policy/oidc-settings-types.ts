/**
 * OIDC Settings Types
 * OAuth/OIDC token lifetime configuration
 * Based on Zitadel Go internal/query/oidc_settings.go
 */

/**
 * OIDC Settings
 * Token lifetime configuration for OAuth/OIDC
 */
export interface OIDCSettings {
  aggregateID: string;
  instanceID: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  resourceOwner: string;
  
  // Token lifetimes (in seconds)
  accessTokenLifetime: number;
  idTokenLifetime: number;
  refreshTokenIdleExpiration: number;
  refreshTokenExpiration: number;
}
