/**
 * AuthN Key types for machine user authentication
 * Used for service accounts and machine-to-machine auth
 */

/**
 * Authentication key type
 */
export enum AuthNKeyType {
  UNSPECIFIED = 0,
  JSON = 1,
}

/**
 * Authentication key
 */
export interface AuthNKey {
  id: string;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  resourceOwner: string;
  instanceID: string;
  aggregateID: string;
  objectID: string;
  expiration: Date;
  type: AuthNKeyType;
}

/**
 * Authentication key with public key data
 */
export interface AuthNKeyData extends AuthNKey {
  publicKey: Buffer;
}

/**
 * Search query for authentication keys
 */
export interface AuthNKeySearchQuery {
  instanceID?: string;
  resourceOwner?: string;
  aggregateID?: string;
  objectID?: string;
  limit?: number;
  offset?: number;
}

/**
 * Search result for authentication keys
 */
export interface AuthNKeySearchResult {
  keys: AuthNKey[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Search result for authentication key data
 */
export interface AuthNKeyDataSearchResult {
  keys: AuthNKeyData[];
  total: number;
  limit: number;
  offset: number;
}
