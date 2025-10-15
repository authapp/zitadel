/**
 * Application Query Types
 * 
 * Type definitions for application read models (OIDC, SAML, API)
 * Based on Zitadel Go internal/query/app.go
 */

/**
 * Application state enumeration
 */
export enum AppState {
  UNSPECIFIED = 'unspecified',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/**
 * Application type enumeration
 */
export enum AppType {
  OIDC = 'oidc',
  SAML = 'saml',
  API = 'api',
}

/**
 * OIDC Application Type (confidential vs public)
 */
export enum OIDCAppType {
  WEB = 'web',                    // Confidential client (has secret)
  USER_AGENT = 'user_agent',      // Public client (SPA)
  NATIVE = 'native',              // Public client (mobile/desktop)
}

/**
 * OIDC Auth Method Type
 */
export enum OIDCAuthMethodType {
  BASIC = 'basic',
  POST = 'post',
  NONE = 'none',
  PRIVATE_KEY_JWT = 'private_key_jwt',
}

/**
 * OIDC Grant Types
 */
export enum OIDCGrantType {
  AUTHORIZATION_CODE = 'authorization_code',
  IMPLICIT = 'implicit',
  REFRESH_TOKEN = 'refresh_token',
  DEVICE_CODE = 'device_code',
}

/**
 * OIDC Response Types
 */
export enum OIDCResponseType {
  CODE = 'code',
  ID_TOKEN = 'id_token',
  ID_TOKEN_TOKEN = 'id_token_token',
}

/**
 * Base application interface
 */
export interface App {
  id: string;
  projectId: string;
  name: string;
  state: AppState;
  type: AppType;
  createdAt: Date;
  updatedAt: Date;
  sequence: bigint;
}

/**
 * OIDC Application Configuration
 */
export interface OIDCAppConfig {
  clientId: string;
  clientSecret?: string;  // Only for confidential clients
  redirectUris: string[];
  responseTypes: OIDCResponseType[];
  grantTypes: OIDCGrantType[];
  appType: OIDCAppType;
  authMethodType: OIDCAuthMethodType;
  postLogoutRedirectUris: string[];
  version: number;
  devMode: boolean;
  accessTokenType: 'bearer' | 'jwt';
  accessTokenRoleAssertion: boolean;
  idTokenRoleAssertion: boolean;
  idTokenUserinfoAssertion: boolean;
  clockSkew: number;
  additionalOrigins: string[];
  skipNativeAppSuccessPage: boolean;
}

/**
 * OIDC Application (Base + Config)
 */
export interface OIDCApp extends App {
  type: AppType.OIDC;
  config: OIDCAppConfig;
}

/**
 * SAML Application Configuration
 */
export interface SAMLAppConfig {
  entityId: string;
  metadataUrl?: string;
  metadata?: string;  // XML metadata
  acsUrls: string[];  // Assertion Consumer Service URLs
  singleLogoutUrl?: string;
  nameIdFormat?: string;
  attributeStatements?: Array<{
    key: string;
    value: string;
  }>;
}

/**
 * SAML Application (Base + Config)
 */
export interface SAMLApp extends App {
  type: AppType.SAML;
  config: SAMLAppConfig;
}

/**
 * API Application Configuration (Machine-to-Machine)
 */
export interface APIAppConfig {
  clientId: string;
  clientSecret?: string;
  authMethodType: OIDCAuthMethodType;
}

/**
 * API Application (Base + Config)
 */
export interface APIApp extends App {
  type: AppType.API;
  config: APIAppConfig;
}

/**
 * Union type for all app types
 */
export type AnyApp = OIDCApp | SAMLApp | APIApp;

/**
 * Application search filters
 */
export interface AppSearchFilters {
  projectId?: string;
  name?: string;
  state?: AppState;
  type?: AppType;
  limit?: number;
  offset?: number;
}

/**
 * Application search result
 */
export interface AppSearchResult {
  apps: AnyApp[];
  total: number;
}

/**
 * Client ID search result (for lookup)
 */
export interface ClientIDSearchResult {
  clientId: string;
  projectId: string;
  appId: string;
  appType: AppType;
}

/**
 * Database row types for internal mapping
 */
export interface AppRow {
  id: string;
  project_id: string;
  name: string;
  state: string;
  app_type: string;
  created_at: string;
  updated_at: string;
  sequence: string;
}

export interface OIDCAppRow extends AppRow {
  client_id: string;
  client_secret: string | null;
  redirect_uris: string;  // JSON array as string
  response_types: string;  // JSON array as string
  grant_types: string;     // JSON array as string
  oidc_app_type: string;
  auth_method_type: string;
  post_logout_redirect_uris: string;  // JSON array as string
  version: number;
  dev_mode: boolean;
  access_token_type: string;
  access_token_role_assertion: boolean;
  id_token_role_assertion: boolean;
  id_token_userinfo_assertion: boolean;
  clock_skew: number;
  additional_origins: string;  // JSON array as string
  skip_native_app_success_page: boolean;
}

export interface SAMLAppRow extends AppRow {
  entity_id: string;
  metadata_url: string | null;
  metadata: string | null;
  acs_urls: string;  // JSON array as string
  single_logout_url: string | null;
  name_id_format: string | null;
  attribute_statements: string | null;  // JSON array as string
}

export interface APIAppRow extends AppRow {
  client_id: string;
  client_secret: string | null;
  auth_method_type: string;
}
