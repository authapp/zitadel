/**
 * Access Token types for Zitadel query layer
 * Handles OAuth/OIDC access token validation and retrieval
 */

/**
 * Access token information
 */
export interface AccessToken {
  id: string;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  resourceOwner: string;
  instanceID: string;
  
  // Token details
  userID: string;
  applicationID: string;
  token: string;
  
  // OAuth/OIDC details
  scopes: string[];
  audience: string[];
  
  // Expiration
  expiration: Date;
  
  // Refresh token
  refreshTokenID?: string;
  
  // Actor (for delegation)
  actorUserID?: string;
  actorIssuer?: string;
  
  // Reason (for revocation)
  reason?: number;
}

/**
 * Active access token (not expired, not revoked)
 */
export interface ActiveAccessToken extends AccessToken {
  isActive: true;
}
