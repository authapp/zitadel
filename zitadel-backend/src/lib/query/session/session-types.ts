/**
 * Session types for Zitadel query layer
 * Defines types for session queries and results
 */

/**
 * Session state enum
 */
export enum SessionState {
  UNSPECIFIED = 'unspecified',
  ACTIVE = 'active',
  TERMINATED = 'terminated',
}

/**
 * Authentication factor type
 */
export type AuthFactorType = 'password' | 'otp' | 'webauthn' | 'idp';

/**
 * Authentication factor interface
 */
export interface AuthFactor {
  type: AuthFactorType;
  verified: boolean;
  verifiedAt?: Date;
  metadata: Record<string, any>;
}

/**
 * Session token interface
 */
export interface SessionToken {
  tokenID: string;
  token: string;
  expiry: Date;
}

/**
 * Session interface
 */
export interface Session {
  id: string;
  instanceID: string;
  state: SessionState;
  userID?: string;
  userAgent?: string;
  clientIP?: string;
  createdAt: Date;
  updatedAt: Date;
  terminatedAt?: Date;
  sequence: bigint;
  
  // Related data
  metadata: Record<string, string>;
  tokens: SessionToken[];
  factors: AuthFactor[];
}

/**
 * Session search query
 */
export interface SessionSearchQuery {
  instanceID?: string;
  userID?: string;
  state?: SessionState;
  active?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'updated_at' | 'terminated_at';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Session search result
 */
export interface SessionSearchResult {
  sessions: Session[];
  total: number;
}

/**
 * Active sessions count query
 */
export interface ActiveSessionsCountQuery {
  instanceID?: string;
  userID?: string;
}

/**
 * Active sessions count result
 */
export interface ActiveSessionsCountResult {
  count: number;
}

/**
 * Session summary for lightweight queries
 */
export interface SessionSummary {
  id: string;
  instanceID: string;
  state: SessionState;
  userID?: string;
  userAgent?: string;
  clientIP?: string;
  createdAt: Date;
  updatedAt: Date;
  terminatedAt?: Date;
  verifiedFactors: AuthFactorType[];
  validTokenCount: number;
}
