/**
 * AuthN Key queries for Zitadel query layer
 * Handles machine user authentication key lookups
 */

import { DatabasePool } from '../../database';
import {
  AuthNKey,
  AuthNKeyData,
  AuthNKeySearchQuery,
  AuthNKeySearchResult,
  AuthNKeyDataSearchResult,
  AuthNKeyType,
} from './authn-key-types';

export class AuthNKeyQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Search authentication keys
   * 
   * @param query - Search query parameters
   * @returns Search result with keys
   */
  async searchAuthNKeys(query: AuthNKeySearchQuery): Promise<AuthNKeySearchResult> {
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.instanceID) {
      conditions.push(`instance_id = $${paramIndex++}`);
      params.push(query.instanceID);
    }

    if (query.resourceOwner) {
      conditions.push(`resource_owner = $${paramIndex++}`);
      params.push(query.resourceOwner);
    }

    if (query.aggregateID) {
      conditions.push(`aggregate_id = $${paramIndex++}`);
      params.push(query.aggregateID);
    }

    if (query.objectID) {
      conditions.push(`object_id = $${paramIndex++}`);
      params.push(query.objectID);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.database.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM projections.authn_keys ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.count || '0', 10);

    // Get keys
    const result = await this.database.query(
      `SELECT 
        id, creation_date, change_date, sequence, resource_owner, instance_id,
        aggregate_id, object_id, expiration, type
       FROM projections.authn_keys
       ${whereClause}
       ORDER BY creation_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const keys = result.rows.map(row => this.mapRowToAuthNKey(row));

    return {
      keys,
      total,
      limit,
      offset,
    };
  }

  /**
   * Search authentication keys with public key data
   * 
   * @param query - Search query parameters
   * @returns Search result with key data including public keys
   */
  async searchAuthNKeysData(query: AuthNKeySearchQuery): Promise<AuthNKeyDataSearchResult> {
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.instanceID) {
      conditions.push(`instance_id = $${paramIndex++}`);
      params.push(query.instanceID);
    }

    if (query.resourceOwner) {
      conditions.push(`resource_owner = $${paramIndex++}`);
      params.push(query.resourceOwner);
    }

    if (query.aggregateID) {
      conditions.push(`aggregate_id = $${paramIndex++}`);
      params.push(query.aggregateID);
    }

    if (query.objectID) {
      conditions.push(`object_id = $${paramIndex++}`);
      params.push(query.objectID);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.database.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM projections.authn_keys ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.count || '0', 10);

    // Get keys with public key data
    const result = await this.database.query(
      `SELECT 
        id, creation_date, change_date, sequence, resource_owner, instance_id,
        aggregate_id, object_id, expiration, type, public_key
       FROM projections.authn_keys
       ${whereClause}
       ORDER BY creation_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const keys = result.rows.map(row => this.mapRowToAuthNKeyData(row));

    return {
      keys,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get authentication key by ID with permission check
   * This is a simplified version - full permission checking would be more complex
   * 
   * @param keyID - The key ID
   * @param userID - The user ID for permission check
   * @param instanceID - Optional instance ID filter
   * @returns AuthN key or null if not found or no permission
   */
  async getAuthNKeyByIDWithPermission(
    keyID: string,
    userID: string,
    instanceID?: string
  ): Promise<AuthNKey | null> {
    const conditions = ['k.id = $1'];
    const params: any[] = [keyID];
    let paramIndex = 2;

    if (instanceID) {
      conditions.push(`k.instance_id = $${paramIndex++}`);
      params.push(instanceID);
    }

    // Check that the key belongs to the user (aggregate_id = user ID for machine users)
    conditions.push(`k.aggregate_id = $${paramIndex++}`);
    params.push(userID);

    const result = await this.database.queryOne(
      `SELECT 
        k.id, k.creation_date, k.change_date, k.sequence, k.resource_owner, k.instance_id,
        k.aggregate_id, k.object_id, k.expiration, k.type
       FROM projections.authn_keys k
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    if (!result) {
      return null;
    }

    return this.mapRowToAuthNKey(result);
  }

  /**
   * Get authentication key by ID
   * 
   * @param keyID - The key ID
   * @param instanceID - Optional instance ID filter
   * @returns AuthN key or null if not found
   */
  async getAuthNKeyByID(keyID: string, instanceID?: string): Promise<AuthNKey | null> {
    const conditions = ['id = $1'];
    const params: any[] = [keyID];

    if (instanceID) {
      conditions.push('instance_id = $2');
      params.push(instanceID);
    }

    const result = await this.database.queryOne(
      `SELECT 
        id, creation_date, change_date, sequence, resource_owner, instance_id,
        aggregate_id, object_id, expiration, type
       FROM projections.authn_keys
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    if (!result) {
      return null;
    }

    return this.mapRowToAuthNKey(result);
  }

  /**
   * Get the user (aggregate) ID for an authentication key
   * 
   * @param keyID - The key ID
   * @param instanceID - Optional instance ID filter
   * @returns User ID or null if not found
   */
  async getAuthNKeyUser(keyID: string, instanceID?: string): Promise<string | null> {
    const conditions = ['id = $1'];
    const params: any[] = [keyID];

    if (instanceID) {
      conditions.push('instance_id = $2');
      params.push(instanceID);
    }

    const result = await this.database.queryOne<{ aggregate_id: string }>(
      `SELECT aggregate_id FROM projections.authn_keys WHERE ${conditions.join(' AND ')}`,
      params
    );

    return result?.aggregate_id || null;
  }

  /**
   * Get public key by key ID and identifier
   * Used for JWT validation
   * 
   * @param keyID - The key ID
   * @param identifier - The key identifier (usually the key ID)
   * @param instanceID - Optional instance ID filter
   * @returns Public key buffer or null if not found
   */
  async getAuthNKeyPublicKeyByIDAndIdentifier(
    keyID: string,
    identifier: string,
    instanceID?: string
  ): Promise<Buffer | null> {
    const conditions = ['id = $1', 'object_id = $2'];
    const params: any[] = [keyID, identifier];

    if (instanceID) {
      conditions.push('instance_id = $3');
      params.push(instanceID);
    }

    const result = await this.database.queryOne<{ public_key: Buffer }>(
      `SELECT public_key FROM projections.authn_keys WHERE ${conditions.join(' AND ')}`,
      params
    );

    return result?.public_key || null;
  }

  /**
   * Map database row to AuthNKey
   */
  private mapRowToAuthNKey(row: any): AuthNKey {
    return {
      id: row.id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      resourceOwner: row.resource_owner,
      instanceID: row.instance_id,
      aggregateID: row.aggregate_id,
      objectID: row.object_id,
      expiration: row.expiration,
      type: row.type || AuthNKeyType.UNSPECIFIED,
    };
  }

  /**
   * Map database row to AuthNKeyData (includes public key)
   */
  private mapRowToAuthNKeyData(row: any): AuthNKeyData {
    return {
      ...this.mapRowToAuthNKey(row),
      publicKey: row.public_key,
    };
  }
}
