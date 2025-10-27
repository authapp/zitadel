/**
 * User Metadata Queries
 * 
 * Query layer for user metadata projection.
 * Provides methods to retrieve user metadata (key-value pairs).
 */

import { DatabasePool } from '../../database/pool';

export interface UserMetadata {
  id: string;
  userId: string;
  instanceId: string;
  metadataKey: string;
  metadataValue: any; // JSONB
  metadataType: string;
  scope: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export class UserMetadataQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get specific metadata by key for a user
   * @param userId - User ID
   * @param instanceId - Instance ID for multi-tenant isolation
   * @param key - Metadata key
   * @param scope - Optional scope filter
   * @returns User metadata or null if not found
   */
  async getUserMetadata(
    userId: string, 
    instanceId: string, 
    key: string,
    scope?: string | null
  ): Promise<UserMetadata | null> {
    const query = scope !== undefined
      ? `SELECT 
          id, user_id, instance_id, metadata_key, metadata_value, 
          metadata_type, scope, created_at, updated_at, created_by, updated_by
         FROM projections.user_metadata
         WHERE user_id = $1 AND instance_id = $2 AND metadata_key = $3 AND scope IS NOT DISTINCT FROM $4`
      : `SELECT 
          id, user_id, instance_id, metadata_key, metadata_value, 
          metadata_type, scope, created_at, updated_at, created_by, updated_by
         FROM projections.user_metadata
         WHERE user_id = $1 AND instance_id = $2 AND metadata_key = $3`;

    const params = scope !== undefined 
      ? [userId, instanceId, key, scope] 
      : [userId, instanceId, key];

    const result = await this.database.queryOne<any>(query, params);

    if (!result) {
      return null;
    }

    return this.mapRowToUserMetadata(result);
  }

  /**
   * Get all metadata for a user
   * @param userId - User ID
   * @param instanceId - Instance ID for multi-tenant isolation
   * @param scope - Optional scope filter
   * @returns Array of user metadata
   */
  async getUserMetadataList(
    userId: string, 
    instanceId: string,
    scope?: string | null
  ): Promise<UserMetadata[]> {
    const query = scope !== undefined
      ? `SELECT 
          id, user_id, instance_id, metadata_key, metadata_value, 
          metadata_type, scope, created_at, updated_at, created_by, updated_by
         FROM projections.user_metadata
         WHERE user_id = $1 AND instance_id = $2 AND scope IS NOT DISTINCT FROM $3
         ORDER BY metadata_key ASC`
      : `SELECT 
          id, user_id, instance_id, metadata_key, metadata_value, 
          metadata_type, scope, created_at, updated_at, created_by, updated_by
         FROM projections.user_metadata
         WHERE user_id = $1 AND instance_id = $2
         ORDER BY metadata_key ASC`;

    const params = scope !== undefined 
      ? [userId, instanceId, scope] 
      : [userId, instanceId];

    const results = await this.database.queryMany<any>(query, params);

    return results.map(row => this.mapRowToUserMetadata(row));
  }

  /**
   * Get metadata by type
   * @param userId - User ID
   * @param instanceId - Instance ID for multi-tenant isolation
   * @param metadataType - Type filter (custom, system, application)
   * @returns Array of user metadata
   */
  async getUserMetadataByType(
    userId: string,
    instanceId: string,
    metadataType: string
  ): Promise<UserMetadata[]> {
    const results = await this.database.queryMany<any>(
      `SELECT 
        id, user_id, instance_id, metadata_key, metadata_value, 
        metadata_type, scope, created_at, updated_at, created_by, updated_by
       FROM projections.user_metadata
       WHERE user_id = $1 AND instance_id = $2 AND metadata_type = $3
       ORDER BY metadata_key ASC`,
      [userId, instanceId, metadataType]
    );

    return results.map(row => this.mapRowToUserMetadata(row));
  }

  /**
   * Map database row to UserMetadata
   */
  private mapRowToUserMetadata(row: any): UserMetadata {
    return {
      id: row.id,
      userId: row.user_id,
      instanceId: row.instance_id,
      metadataKey: row.metadata_key,
      metadataValue: row.metadata_value,
      metadataType: row.metadata_type,
      scope: row.scope,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    };
  }
}
