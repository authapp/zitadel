/**
 * Auth Request types for Zitadel query layer
 * Represents OAuth/OIDC authentication requests
 */

/**
 * Auth request domain object
 */
export interface AuthRequest {
  id: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  resourceOwner: string;
  instanceID: string;
  loginClient: string;
  clientID: string;
  redirectURI: string;
  state?: string;
  nonce?: string;
  scope: string[];
  audience?: string[];
  responseType?: string;
  responseMode?: string;
  codeChallenge?: CodeChallenge;
  prompt: Prompt[];
  uiLocales?: string[];
  maxAge?: number | null;
  loginHint?: string | null;
  hintUserID?: string | null;
  needRefreshToken?: boolean;
  sessionID?: string | null;
  userID?: string | null;
  authTime?: Date | null;
  authMethods?: string[];
  code?: string | null;
  issuer?: string;
}

/**
 * PKCE code challenge
 */
export interface CodeChallenge {
  challenge: string;
  method: 'S256' | 'plain';
}

/**
 * OIDC prompt values
 */
export enum Prompt {
  NONE = 'none',
  LOGIN = 'login',
  CONSENT = 'consent',
  SELECT_ACCOUNT = 'select_account',
}

/**
 * Auth request search query
 */
export interface AuthRequestSearchQuery {
  instanceID?: string;
  clientID?: string;
  userID?: string;
  sessionID?: string;
  state?: string;
  limit?: number;
  offset?: number;
}

/**
 * Auth request search result
 */
export interface AuthRequestSearchResult {
  total: number;
  authRequests: AuthRequest[];
  limit: number;
  offset: number;
}

/**
 * Response types for OAuth/OIDC
 */
export enum ResponseType {
  CODE = 'code',
  ID_TOKEN = 'id_token',
  TOKEN = 'token',
  CODE_ID_TOKEN = 'code id_token',
  CODE_TOKEN = 'code token',
  ID_TOKEN_TOKEN = 'id_token token',
  CODE_ID_TOKEN_TOKEN = 'code id_token token',
}

/**
 * Response modes for OAuth/OIDC
 */
export enum ResponseMode {
  QUERY = 'query',
  FRAGMENT = 'fragment',
  FORM_POST = 'form_post',
}
