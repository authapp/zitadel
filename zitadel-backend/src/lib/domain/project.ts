/**
 * Project and Application domain models
 */

export enum ProjectState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
}

export interface Project {
  id: string;
  name: string;
  state: ProjectState;
  resourceOwner: string; // Organization ID
  projectRoleAssertion: boolean;
  projectRoleCheck: boolean;
  hasProjectCheck: boolean;
  privateLabelingSetting: PrivateLabelingSetting;
  createdAt: Date;
  changedAt: Date;
  sequence: number;
}

export enum PrivateLabelingSetting {
  UNSPECIFIED = 0,
  ENFORCE_PROJECT_RESOURCE_OWNER_POLICY = 1,
  ALLOW_LOGIN_USER_RESOURCE_OWNER_POLICY = 2,
}

export interface ProjectRole {
  projectId: string;
  key: string;
  displayName: string;
  group?: string;
  createdAt: Date;
  changedAt: Date;
}

export enum AppState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
}

/**
 * Base application interface
 */
export interface Application {
  id: string;
  projectId: string;
  name: string;
  state: AppState;
  createdAt: Date;
  changedAt: Date;
  sequence: number;
}

/**
 * OIDC Application configuration
 */
export interface OIDCApplication extends Application {
  type: 'oidc';
  version: OIDCVersion;
  clientId: string;
  clientSecret?: string;
  redirectUris: string[];
  responseTypes: OIDCResponseType[];
  grantTypes: OIDCGrantType[];
  applicationType: OIDCApplicationType;
  authMethodType: OIDCAuthMethodType;
  postLogoutRedirectUris: string[];
  devMode: boolean;
  accessTokenType: OIDCTokenType;
  accessTokenRoleAssertion: boolean;
  idTokenRoleAssertion: boolean;
  idTokenUserinfoAssertion: boolean;
  clockSkew: number;
  additionalOrigins: string[];
  skipNativeAppSuccessPage: boolean;
}

export enum OIDCVersion {
  UNSPECIFIED = 0,
  V1 = 1,
}

export enum OIDCResponseType {
  CODE = 'code',
  ID_TOKEN = 'id_token',
  ID_TOKEN_TOKEN = 'id_token token',
}

export enum OIDCGrantType {
  AUTHORIZATION_CODE = 'authorization_code',
  IMPLICIT = 'implicit',
  REFRESH_TOKEN = 'refresh_token',
  DEVICE_CODE = 'urn:ietf:params:oauth:grant-type:device_code',
  TOKEN_EXCHANGE = 'urn:ietf:params:oauth:grant-type:token-exchange',
}

export enum OIDCApplicationType {
  WEB = 'web',
  USER_AGENT = 'user_agent',
  NATIVE = 'native',
}

export enum OIDCAuthMethodType {
  BASIC = 'client_secret_basic',
  POST = 'client_secret_post',
  NONE = 'none',
  PRIVATE_KEY_JWT = 'private_key_jwt',
}

export enum OIDCTokenType {
  BEARER = 'bearer',
  JWT = 'jwt',
}

/**
 * API Application (for machine-to-machine)
 */
export interface APIApplication extends Application {
  type: 'api';
  clientId: string;
  clientSecret?: string;
  authMethodType: APIAuthMethodType;
}

export enum APIAuthMethodType {
  BASIC = 'basic',
  PRIVATE_KEY_JWT = 'private_key_jwt',
}

/**
 * SAML Application
 */
export interface SAMLApplication extends Application {
  type: 'saml';
  entityId: string;
  metadataUrl?: string;
  metadata?: Buffer;
}

/**
 * Check if project is active
 */
export function isProjectActive(state: ProjectState): boolean {
  return state === ProjectState.ACTIVE;
}

/**
 * Check if application is active
 */
export function isAppActive(state: AppState): boolean {
  return state === AppState.ACTIVE;
}
