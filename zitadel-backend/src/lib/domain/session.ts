/**
 * Session and authentication domain models
 */

export enum SessionState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  TERMINATED = 2,
}

export interface Session {
  id: string;
  userId: string;
  state: SessionState;
  createdAt: Date;
  changedAt: Date;
  expiresAt?: Date;
  userAgent?: string;
  ipAddress?: string;
  sequence: number;
}

/**
 * Authentication request
 */
export interface AuthRequest {
  id: string;
  clientId: string;
  redirectUri: string;
  responseType: string;
  scopes: string[];
  state?: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: CodeChallengeMethod;
  prompt: Prompt[];
  createdAt: Date;
  expiresAt: Date;
}

export enum CodeChallengeMethod {
  PLAIN = 'plain',
  S256 = 'S256',
}

export enum Prompt {
  UNSPECIFIED = 0,
  NONE = 1,
  LOGIN = 2,
  CONSENT = 3,
  SELECT_ACCOUNT = 4,
  CREATE = 5,
}

/**
 * Token types
 */
export enum TokenType {
  ACCESS_TOKEN = 'access_token',
  REFRESH_TOKEN = 'refresh_token',
  ID_TOKEN = 'id_token',
}

export interface Token {
  id: string;
  userId: string;
  applicationId: string;
  type: TokenType;
  expiresAt: Date;
  scopes: string[];
  audience: string[];
  createdAt: Date;
}

/**
 * Refresh token
 */
export interface RefreshToken extends Token {
  type: TokenType.REFRESH_TOKEN;
  idleExpiresAt: Date;
  amr: string[];
}

/**
 * Check if session is active
 */
export function isSessionActive(session: Session): boolean {
  return session.state === SessionState.ACTIVE && 
    (!session.expiresAt || session.expiresAt > new Date());
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: Token): boolean {
  return token.expiresAt < new Date();
}

/**
 * Check if refresh token is idle expired
 */
export function isRefreshTokenIdleExpired(token: RefreshToken): boolean {
  return token.idleExpiresAt < new Date();
}
