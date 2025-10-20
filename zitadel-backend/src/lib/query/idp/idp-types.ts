/**
 * Identity Provider (IDP) types for Zitadel query layer
 * Supports multiple IDP types: OIDC, OAuth, SAML, LDAP, JWT, Azure, Google, Apple
 */

/**
 * IDP provider type
 */
export enum IDPType {
  UNSPECIFIED = 0,
  OIDC = 1,
  OAUTH = 2,
  LDAP = 3,
  SAML = 4,
  JWT = 5,
  AZURE = 6,
  GOOGLE = 7,
  APPLE = 8,
}

/**
 * IDP state
 */
export enum IDPState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  REMOVED = 3,
}

/**
 * OAuth/OIDC authentication method style
 */
export enum OAuthAuthStyle {
  UNSPECIFIED = 0,
  IN_PARAMS = 1,
  IN_HEADER = 2,
}

/**
 * Base IDP configuration
 */
export interface IDP {
  id: string;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  resourceOwner: string;
  instanceID: string;
  name: string;
  type: IDPType;
  state: IDPState;
  stylingType: number;
  isCreationAllowed: boolean;
  isLinkingAllowed: boolean;
  isAutoCreation: boolean;
  isAutoUpdate: boolean;
}

/**
 * OIDC IDP configuration
 */
export interface OIDCIDP extends IDP {
  type: IDPType.OIDC;
  issuer: string;
  clientID: string;
  clientSecret?: string;
  scopes: string[];
  displayNameMapping?: string;
  usernameMapping?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
}

/**
 * OAuth IDP configuration
 */
export interface OAuthIDP extends IDP {
  type: IDPType.OAUTH;
  clientID: string;
  clientSecret?: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userEndpoint: string;
  scopes: string[];
  idAttribute?: string;
  authStyle: OAuthAuthStyle;
}

/**
 * JWT IDP configuration
 */
export interface JWTIDP extends IDP {
  type: IDPType.JWT;
  issuer: string;
  jwtEndpoint: string;
  keysEndpoint: string;
  headerName: string;
}

/**
 * Azure AD IDP configuration
 */
export interface AzureADIDP extends IDP {
  type: IDPType.AZURE;
  clientID: string;
  clientSecret?: string;
  tenant: string;
  isEmailVerified: boolean;
  scopes: string[];
}

/**
 * Google IDP configuration
 */
export interface GoogleIDP extends IDP {
  type: IDPType.GOOGLE;
  clientID: string;
  clientSecret?: string;
  scopes: string[];
}

/**
 * Apple IDP configuration
 */
export interface AppleIDP extends IDP {
  type: IDPType.APPLE;
  clientID: string;
  teamID: string;
  keyID: string;
  privateKey?: Buffer;
  scopes: string[];
}

/**
 * LDAP IDP configuration
 */
export interface LDAPIDP extends IDP {
  type: IDPType.LDAP;
  host: string;
  port: number;
  tls: boolean;
  baseDN: string;
  userObjectClass: string;
  userUniqueAttribute: string;
  admin?: string;
  password?: string;
  attributes: {
    idAttribute: string;
    firstNameAttribute?: string;
    lastNameAttribute?: string;
    displayNameAttribute?: string;
    nickNameAttribute?: string;
    preferredUsernameAttribute?: string;
    emailAttribute?: string;
    emailVerifiedAttribute?: string;
    phoneAttribute?: string;
    phoneVerifiedAttribute?: string;
    preferredLanguageAttribute?: string;
    avatarURLAttribute?: string;
    profileAttribute?: string;
  };
}

/**
 * SAML IDP configuration
 */
export interface SAMLIDP extends IDP {
  type: IDPType.SAML;
  metadata?: Buffer;
  metadataURL?: string;
  binding: string;
  withSignedRequest: boolean;
  nameIDFormat?: string;
  transientMappingAttributeName?: string;
}

/**
 * IDP template (org or instance level)
 */
export interface IDPTemplate {
  id: string;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  resourceOwner: string;
  instanceID: string;
  name: string;
  type: IDPType;
  ownerType: 'instance' | 'org';
  isCreationAllowed: boolean;
  isLinkingAllowed: boolean;
  isAutoCreation: boolean;
  isAutoUpdate: boolean;
}

/**
 * User-IDP link
 */
export interface IDPUserLink {
  idpID: string;
  userID: string;
  idpName: string;
  providedUserID: string;
  providedUserName: string;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  resourceOwner: string;
  instanceID: string;
}

/**
 * Login policy IDP link (org or instance level)
 */
export interface IDPLoginPolicyLink {
  idpID: string;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  resourceOwner: string;
  instanceID: string;
  ownerType: 'instance' | 'org';
}

/**
 * Search query for IDPs
 */
export interface IDPSearchQuery {
  instanceID?: string;
  resourceOwner?: string;
  name?: string;
  type?: IDPType;
  limit?: number;
  offset?: number;
}

/**
 * Search result for IDPs
 */
export interface IDPSearchResult {
  idps: IDP[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Search query for IDP templates
 */
export interface IDPTemplateSearchQuery {
  instanceID?: string;
  resourceOwner?: string;
  ownerType?: 'instance' | 'org';
  limit?: number;
  offset?: number;
}

/**
 * Search result for IDP templates
 */
export interface IDPTemplateSearchResult {
  templates: IDPTemplate[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Search query for user-IDP links
 */
export interface IDPUserLinkSearchQuery {
  instanceID?: string;
  userID?: string;
  idpID?: string;
  limit?: number;
  offset?: number;
}

/**
 * Search result for user-IDP links
 */
export interface IDPUserLinkSearchResult {
  links: IDPUserLink[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Search query for login policy IDP links
 */
export interface IDPLoginPolicyLinkSearchQuery {
  instanceID?: string;
  resourceOwner?: string;
  ownerType?: 'instance' | 'org';
  limit?: number;
  offset?: number;
}

/**
 * Search result for login policy IDP links
 */
export interface IDPLoginPolicyLinkSearchResult {
  links: IDPLoginPolicyLink[];
  total: number;
  limit: number;
  offset: number;
}
