/**
 * Application Service Proto Definitions (v2)
 * 
 * TypeScript type definitions for ApplicationService RPCs
 * Based on: proto/zitadel/app/v2/app_service.proto
 */

import { Details } from '../../object/v2/object';

// ====================================================================
// APPLICATION CRUD
// ====================================================================

/**
 * AddOIDCApp Request
 */
export interface AddOIDCAppRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** App name */
  name: string;
  
  /** OIDC app type (WEB, USER_AGENT, NATIVE) */
  oidcAppType: string;
  
  /** Redirect URIs */
  redirectUris: string[];
  
  /** Response types */
  responseTypes?: string[];
  
  /** Grant types */
  grantTypes?: string[];
  
  /** Auth method type */
  authMethodType?: string;
  
  /** Post logout redirect URIs */
  postLogoutRedirectUris?: string[];
  
  /** Dev mode */
  devMode?: boolean;
  
  /** Access token type */
  accessTokenType?: number;
  
  /** Access token role assertion */
  accessTokenRoleAssertion?: boolean;
  
  /** ID token role assertion */
  idTokenRoleAssertion?: boolean;
  
  /** ID token userinfo assertion */
  idTokenUserinfoAssertion?: boolean;
  
  /** Clock skew */
  clockSkew?: number;
  
  /** Additional origins */
  additionalOrigins?: string[];
}

/**
 * AddOIDCApp Response
 */
export interface AddOIDCAppResponse {
  /** Object details */
  details?: Details;
  
  /** App ID */
  appId: string;
  
  /** Client ID */
  clientId?: string;
  
  /** Client secret (for confidential clients) */
  clientSecret?: string;
}

/**
 * AddAPIApp Request
 */
export interface AddAPIAppRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** App name */
  name: string;
  
  /** Auth method type */
  authMethodType: string;
}

/**
 * AddAPIApp Response
 */
export interface AddAPIAppResponse {
  /** Object details */
  details?: Details;
  
  /** App ID */
  appId: string;
  
  /** Client ID */
  clientId?: string;
  
  /** Client secret */
  clientSecret?: string;
}

/**
 * AddSAMLApp Request
 */
export interface AddSAMLAppRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** App name */
  name: string;
  
  /** Entity ID */
  entityId?: string;
  
  /** Metadata URL */
  metadataUrl?: string;
}

/**
 * AddSAMLApp Response
 */
export interface AddSAMLAppResponse {
  /** Object details */
  details?: Details;
  
  /** App ID */
  appId: string;
}

/**
 * UpdateOIDCApp Request
 */
export interface UpdateOIDCAppRequest {
  /** App ID */
  appId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Redirect URIs */
  redirectUris?: string[];
  
  /** Response types */
  responseTypes?: string[];
  
  /** Grant types */
  grantTypes?: string[];
  
  /** Auth method type */
  authMethodType?: string;
  
  /** Post logout redirect URIs */
  postLogoutRedirectUris?: string[];
  
  /** Dev mode */
  devMode?: boolean;
  
  /** Access token type */
  accessTokenType?: number;
  
  /** Access token role assertion */
  accessTokenRoleAssertion?: boolean;
  
  /** ID token role assertion */
  idTokenRoleAssertion?: boolean;
  
  /** ID token userinfo assertion */
  idTokenUserinfoAssertion?: boolean;
  
  /** Clock skew */
  clockSkew?: number;
  
  /** Additional origins */
  additionalOrigins?: string[];
}

/**
 * UpdateOIDCApp Response
 */
export interface UpdateOIDCAppResponse {
  /** Object details */
  details?: Details;
}

/**
 * UpdateAPIApp Request
 */
export interface UpdateAPIAppRequest {
  /** App ID */
  appId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Auth method type */
  authMethodType: string;
}

/**
 * UpdateAPIApp Response
 */
export interface UpdateAPIAppResponse {
  /** Object details */
  details?: Details;
}

/**
 * DeactivateApp Request
 */
export interface DeactivateAppRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** App ID */
  appId: string;
}

/**
 * DeactivateApp Response
 */
export interface DeactivateAppResponse {
  /** Object details */
  details?: Details;
}

/**
 * ReactivateApp Request
 */
export interface ReactivateAppRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** App ID */
  appId: string;
}

/**
 * ReactivateApp Response
 */
export interface ReactivateAppResponse {
  /** Object details */
  details?: Details;
}

/**
 * RemoveApp Request
 */
export interface RemoveAppRequest {
  /** Project ID */
  projectId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** App ID */
  appId: string;
}

/**
 * RemoveApp Response
 */
export interface RemoveAppResponse {
  /** Object details */
  details?: Details;
}

/**
 * RegenerateAppSecret Request
 */
export interface RegenerateAppSecretRequest {
  /** App ID */
  appId: string;
  
  /** Organization ID */
  organizationId: string;
}

/**
 * RegenerateAppSecret Response
 */
export interface RegenerateAppSecretResponse {
  /** Object details */
  details?: Details;
  
  /** New client secret */
  clientSecret: string;
}
