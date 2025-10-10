/**
 * Application Domain Entity
 * 
 * Complete application entity with OIDC, OAuth, and SAML support
 */

import { ObjectRoot, Stateful } from '../types';
import { throwInvalidArgument } from '@/zerrors/errors';

/**
 * Application state
 */
export enum AppState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  REMOVED = 3,
}

/**
 * Application type
 */
export enum AppType {
  UNSPECIFIED = 0,
  OIDC = 1,
  API = 2,
  SAML = 3,
}

/**
 * Base application interface
 */
export interface Application extends ObjectRoot, Stateful<AppState> {
  appID: string;
  projectID: string;
  name: string;
  type: AppType;
  state: AppState;
  
  getAppID(): string;
  getName(): string;
}

/**
 * OIDC Application
 */
export class OIDCApplication implements Application {
  public type = AppType.OIDC;

  constructor(
    public aggregateID: string,  // projectID
    public resourceOwner: string,
    public appID: string,
    public projectID: string,
    public name: string,
    public state: AppState,
    public clientID: string,
    public clientSecret?: string,
    public redirectUris: string[] = [],
    public postLogoutRedirectUris: string[] = [],
    public responseTypes: OIDCResponseType[] = [],
    public grantTypes: OIDCGrantType[] = [],
    public applicationType: OIDCApplicationType = OIDCApplicationType.WEB,
    public authMethodType: OIDCAuthMethodType = OIDCAuthMethodType.BASIC,
    public version: OIDCVersion = OIDCVersion.OIDC_1_0,
    public clockSkew?: number,
    public devMode: boolean = false,
    public accessTokenType: OIDCTokenType = OIDCTokenType.BEARER,
    public accessTokenRoleAssertion: boolean = false,
    public idTokenRoleAssertion: boolean = false,
    public idTokenUserinfoAssertion: boolean = false,
    public additionalOrigins: string[] = [],
    public skipNativeAppSuccessPage: boolean = false,
    public creationDate?: Date,
    public changeDate?: Date,
    public sequence?: bigint
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throwInvalidArgument('Application name is required', 'APP-OIDC-001');
    }
    if (!this.clientID) {
      throwInvalidArgument('Client ID is required', 'APP-OIDC-002');
    }
    if (this.redirectUris.length === 0 && this.applicationType !== OIDCApplicationType.NATIVE) {
      throwInvalidArgument('At least one redirect URI is required', 'APP-OIDC-003');
    }
  }

  isValid(): boolean {
    return !!this.name && !!this.clientID;
  }

  exists(): boolean {
    return this.state !== AppState.UNSPECIFIED && this.state !== AppState.REMOVED;
  }

  getAppID(): string {
    return this.appID;
  }

  getName(): string {
    return this.name;
  }

  /**
   * Check if response type is allowed
   */
  allowsResponseType(responseType: OIDCResponseType): boolean {
    return this.responseTypes.includes(responseType);
  }

  /**
   * Check if grant type is allowed
   */
  allowsGrantType(grantType: OIDCGrantType): boolean {
    return this.grantTypes.includes(grantType);
  }

  /**
   * Check if redirect URI is allowed
   */
  isRedirectURIValid(uri: string): boolean {
    return this.redirectUris.includes(uri);
  }

  /**
   * Check if origin is allowed
   */
  isOriginAllowed(origin: string): boolean {
    return this.additionalOrigins.includes(origin);
  }
}

/**
 * OIDC Response Type
 */
export enum OIDCResponseType {
  CODE = 0,
  ID_TOKEN = 1,
  ID_TOKEN_TOKEN = 2,
}

/**
 * OIDC Grant Type
 */
export enum OIDCGrantType {
  AUTHORIZATION_CODE = 0,
  IMPLICIT = 1,
  REFRESH_TOKEN = 2,
  DEVICE_CODE = 3,
  TOKEN_EXCHANGE = 4,
}

/**
 * OIDC Application Type
 */
export enum OIDCApplicationType {
  WEB = 0,
  USER_AGENT = 1,
  NATIVE = 2,
}

/**
 * OIDC Auth Method Type
 */
export enum OIDCAuthMethodType {
  BASIC = 0,
  POST = 1,
  NONE = 2,
  PRIVATE_KEY_JWT = 3,
}

/**
 * OIDC Version
 */
export enum OIDCVersion {
  OIDC_1_0 = 0,
}

/**
 * OIDC Token Type
 */
export enum OIDCTokenType {
  BEARER = 0,
  JWT = 1,
}

/**
 * API Application (for machine-to-machine)
 */
export class APIApplication implements Application {
  public type = AppType.API;

  constructor(
    public aggregateID: string,  // projectID
    public resourceOwner: string,
    public appID: string,
    public projectID: string,
    public name: string,
    public state: AppState,
    public clientID: string,
    public clientSecret?: string,
    public authMethodType: APIAuthMethodType = APIAuthMethodType.BASIC,
    public creationDate?: Date,
    public changeDate?: Date,
    public sequence?: bigint
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throwInvalidArgument('Application name is required', 'APP-API-001');
    }
    if (!this.clientID) {
      throwInvalidArgument('Client ID is required', 'APP-API-002');
    }
  }

  isValid(): boolean {
    return !!this.name && !!this.clientID;
  }

  exists(): boolean {
    return this.state !== AppState.UNSPECIFIED && this.state !== AppState.REMOVED;
  }

  getAppID(): string {
    return this.appID;
  }

  getName(): string {
    return this.name;
  }
}

/**
 * API Auth Method Type
 */
export enum APIAuthMethodType {
  BASIC = 0,
  PRIVATE_KEY_JWT = 1,
}

/**
 * SAML Application
 */
export class SAMLApplication implements Application {
  public type = AppType.SAML;

  constructor(
    public aggregateID: string,  // projectID
    public resourceOwner: string,
    public appID: string,
    public projectID: string,
    public name: string,
    public state: AppState,
    public entityID: string,
    public metadata?: string,
    public metadataURL?: string,
    public creationDate?: Date,
    public changeDate?: Date,
    public sequence?: bigint
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throwInvalidArgument('Application name is required', 'APP-SAML-001');
    }
    if (!this.entityID) {
      throwInvalidArgument('Entity ID is required', 'APP-SAML-002');
    }
  }

  isValid(): boolean {
    return !!this.name && !!this.entityID;
  }

  exists(): boolean {
    return this.state !== AppState.UNSPECIFIED && this.state !== AppState.REMOVED;
  }

  getAppID(): string {
    return this.appID;
  }

  getName(): string {
    return this.name;
  }
}

/**
 * Application key (for client authentication)
 */
export class ApplicationKey {
  constructor(
    public keyID: string,
    public appID: string,
    public projectID: string,
    public type: ApplicationKeyType,
    public expirationDate?: Date,
    public publicKey?: string,
    public creationDate?: Date
  ) {}
}

/**
 * Application Key Type
 */
export enum ApplicationKeyType {
  UNSPECIFIED = 0,
  JSON = 1,
}

/**
 * Helper functions
 */
export function isAppStateValid(state: AppState): boolean {
  return state > AppState.UNSPECIFIED && state <= AppState.REMOVED;
}

export function isAppStateExists(state: AppState): boolean {
  return state !== AppState.UNSPECIFIED && state !== AppState.REMOVED;
}
