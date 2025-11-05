import {
  ObjectDetails,
  AppState,
  AppType,
  OIDCAppType,
  OIDCAuthMethodType,
  OIDCGrantType,
  OIDCResponseType,
} from './common';

export interface Application {
  id: string;
  state: AppState;
  name: string;
  appType: AppType;
  oidcConfig?: OIDCConfig;
  apiConfig?: APIConfig;
  samlConfig?: SAMLConfig;
  details: ObjectDetails;
}

export interface OIDCConfig {
  version: number;
  clientId: string;
  clientSecret?: string;
  redirectUris: string[];
  responseTypes: OIDCResponseType[];
  grantTypes: OIDCGrantType[];
  appType: OIDCAppType;
  authMethodType: OIDCAuthMethodType;
  postLogoutRedirectUris: string[];
  devMode: boolean;
  accessTokenType: number;
  accessTokenRoleAssertion: boolean;
  idTokenRoleAssertion: boolean;
  idTokenUserinfoAssertion: boolean;
  clockSkew: string;
  additionalOrigins: string[];
}

export interface APIConfig {
  clientId: string;
  authMethodType: OIDCAuthMethodType;
}

export interface SAMLConfig {
  entityId: string;
  metadata?: string;
}

export interface AddOIDCAppRequest {
  projectId: string;
  name: string;
  redirectUris: string[];
  responseTypes: OIDCResponseType[];
  grantTypes: OIDCGrantType[];
  appType: OIDCAppType;
  authMethodType: OIDCAuthMethodType;
  postLogoutRedirectUris?: string[];
  version?: number;
  devMode?: boolean;
  accessTokenType?: number;
  accessTokenRoleAssertion?: boolean;
  idTokenRoleAssertion?: boolean;
  idTokenUserinfoAssertion?: boolean;
  clockSkew?: string;
  additionalOrigins?: string[];
}

export interface AddAPIAppRequest {
  projectId: string;
  name: string;
  authMethodType: OIDCAuthMethodType;
}

export interface AddOIDCAppResponse {
  appId: string;
  details: ObjectDetails;
  clientId: string;
  clientSecret?: string;
}

export interface AddAPIAppResponse {
  appId: string;
  details: ObjectDetails;
  clientId: string;
  clientSecret?: string;
}

export interface GetAppByIdResponse {
  app: Application;
}

export interface ListAppsResponse {
  details: {
    totalResult: string;
    processedSequence: string;
    viewTimestamp: string;
  };
  result: Application[];
}
