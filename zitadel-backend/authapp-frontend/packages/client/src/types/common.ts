// Common types used across all API clients

export interface ObjectDetails {
  sequence: string;
  creationDate: string;
  changeDate: string;
  resourceOwner: string;
}

export interface ListQuery {
  offset?: number;
  limit?: number;
  asc?: boolean;
}

export interface ListDetails {
  totalResult: string;
  processedSequence: string;
  viewTimestamp: string;
}

export interface ListResponse<T> {
  result: T[];
  details: ListDetails;
}

export enum UserState {
  USER_STATE_UNSPECIFIED = 0,
  USER_STATE_ACTIVE = 1,
  USER_STATE_INACTIVE = 2,
  USER_STATE_DELETED = 3,
  USER_STATE_LOCKED = 4,
  USER_STATE_SUSPEND = 5,
  USER_STATE_INITIAL = 6,
}

export enum Gender {
  GENDER_UNSPECIFIED = 0,
  GENDER_FEMALE = 1,
  GENDER_MALE = 2,
  GENDER_DIVERSE = 3,
}

export enum OrgState {
  ORG_STATE_UNSPECIFIED = 0,
  ORG_STATE_ACTIVE = 1,
  ORG_STATE_INACTIVE = 2,
}

export enum ProjectState {
  PROJECT_STATE_UNSPECIFIED = 0,
  PROJECT_STATE_ACTIVE = 1,
  PROJECT_STATE_INACTIVE = 2,
}

export enum AppState {
  APP_STATE_UNSPECIFIED = 0,
  APP_STATE_ACTIVE = 1,
  APP_STATE_INACTIVE = 2,
}

export enum AppType {
  APP_TYPE_UNSPECIFIED = 0,
  APP_TYPE_OIDC = 1,
  APP_TYPE_API = 2,
  APP_TYPE_SAML = 3,
}

export enum OIDCAppType {
  OIDC_APP_TYPE_UNSPECIFIED = 0,
  OIDC_APP_TYPE_WEB = 1,
  OIDC_APP_TYPE_USER_AGENT = 2,
  OIDC_APP_TYPE_NATIVE = 3,
}

export enum OIDCAuthMethodType {
  OIDC_AUTH_METHOD_TYPE_UNSPECIFIED = 0,
  OIDC_AUTH_METHOD_TYPE_BASIC = 1,
  OIDC_AUTH_METHOD_TYPE_POST = 2,
  OIDC_AUTH_METHOD_TYPE_NONE = 3,
  OIDC_AUTH_METHOD_TYPE_PRIVATE_KEY_JWT = 4,
}

export enum OIDCGrantType {
  OIDC_GRANT_TYPE_UNSPECIFIED = 0,
  OIDC_GRANT_TYPE_AUTHORIZATION_CODE = 1,
  OIDC_GRANT_TYPE_IMPLICIT = 2,
  OIDC_GRANT_TYPE_REFRESH_TOKEN = 3,
  OIDC_GRANT_TYPE_DEVICE_CODE = 4,
}

export enum OIDCResponseType {
  OIDC_RESPONSE_TYPE_UNSPECIFIED = 0,
  OIDC_RESPONSE_TYPE_CODE = 1,
  OIDC_RESPONSE_TYPE_ID_TOKEN = 2,
  OIDC_RESPONSE_TYPE_ID_TOKEN_TOKEN = 3,
}
