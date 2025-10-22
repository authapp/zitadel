/**
 * User Metadata Repository
 * 
 * Handles all database operations for user metadata
 */

import { DatabasePool } from '../database';
import { BaseRepository } from './base-repository';
import { generateId as generateSnowflakeId } from '../id/snowflake';

export interface UserMetadataRow {
  id: string;
  user_id: string;
  instance_id: string;
  metadata_key: string;
  metadata_value: any; // JSONB
  metadata_type: string;
  scope?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface CreateMetadataInput {
  userId: string;
  instanceId: string;
  key: string;
  value: any;
  type?: 'custom' | 'system' | 'application';
  scope?: string;
  createdBy?: string;
}

export interface UpdateMetadataInput {
  value?: any;
  type?: string;
  scope?: string;
  updatedBy?: string;
}

export class UserMetadataRepository extends BaseRepository<UserMetadataRow> {
  constructor(pool: DatabasePool) {
    super(pool, 'user_metadata');
  }

  /**
   * Create or update metadata entry (upsert)
   */
  async set(input: CreateMetadataInput): Promise<UserMetadataRow> {
    const id = generateSnowflakeId();
    const scope = input.scope || null;
    
    // Check if metadata already exists and update it, otherwise insert
    const existing = await this.pool.queryOne<UserMetadataRow>(
      scope === null
        ? `SELECT * FROM user_metadata WHERE instance_id = $1 AND user_id = $2 AND metadata_key = $3 AND scope IS NULL`
        : `SELECT * FROM user_metadata WHERE instance_id = $1 AND user_id = $2 AND metadata_key = $3 AND scope = $4`,
      scope === null ? [input.instanceId, input.userId, input.key] : [input.instanceId, input.userId, input.key, scope]
    );

    if (existing) {
      // Update existing metadata
      const result = await this.pool.queryOne<UserMetadataRow>(
        `UPDATE user_metadata 
         SET metadata_value = $1, metadata_type = $2, updated_at = NOW()
         WHERE instance_id = $3 AND id = $4
         RETURNING *`,
        [JSON.stringify(input.value), input.type || 'custom', input.instanceId, existing.id]
      );
      return result!;
    }

    // Insert new metadata
    const result = await this.pool.queryOne<UserMetadataRow>(
      `INSERT INTO user_metadata (
        id, user_id, instance_id, metadata_key, metadata_value, 
        metadata_type, scope, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *`,
      [
        id,
        input.userId,
        input.instanceId,
        input.key,
        JSON.stringify(input.value),
        input.type || 'custom',
        scope,
        input.createdBy || null,
      ]
    );

    if (!result) {
      throw new Error('Failed to set metadata');
    }

    return result;
  }

  /**
   * Get metadata value by key
   */
  async get(userId: string, key: string, scope?: string): Promise<any | null> {
    const query = scope
      ? `SELECT metadata_value FROM user_metadata WHERE user_id = $1 AND metadata_key = $2 AND scope = $3`
      : `SELECT metadata_value FROM user_metadata WHERE user_id = $1 AND metadata_key = $2 AND scope IS NULL`;
    
    const params = scope ? [userId, key, scope] : [userId, key];
    
    const result = await this.pool.queryOne<{ metadata_value: any }>(query, params);
    return result?.metadata_value || null;
  }

  /**
   * Get all metadata for a user
   */
  async findByUserId(userId: string, type?: string): Promise<UserMetadataRow[]> {
    if (type) {
      return this.pool.queryMany<UserMetadataRow>(
        `SELECT * FROM user_metadata 
         WHERE user_id = $1 AND metadata_type = $2 
         ORDER BY metadata_key`,
        [userId, type]
      );
    }
    
    return this.pool.queryMany<UserMetadataRow>(
      `SELECT * FROM user_metadata WHERE user_id = $1 ORDER BY metadata_key`,
      [userId]
    );
  }

  /**
   * Get metadata as key-value map
   */
  async getAll(userId: string, scope?: string): Promise<Record<string, any>> {
    const query = scope
      ? `SELECT metadata_key, metadata_value FROM user_metadata WHERE user_id = $1 AND scope = $2`
      : `SELECT metadata_key, metadata_value FROM user_metadata WHERE user_id = $1 AND scope IS NULL`;
    
    const params = scope ? [userId, scope] : [userId];
    const rows = await this.pool.queryMany<{ metadata_key: string; metadata_value: any }>(query, params);
    
    const metadata: Record<string, any> = {};
    for (const row of rows) {
      metadata[row.metadata_key] = row.metadata_value;
    }
    
    return metadata;
  }

  /**
   * Update metadata entry
   */
  async update(id: string, instanceId: string, input: UpdateMetadataInput): Promise<UserMetadataRow | null> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.value !== undefined) {
      setClauses.push(`metadata_value = $${paramIndex++}`);
      values.push(JSON.stringify(input.value));
    }
    if (input.type !== undefined) {
      setClauses.push(`metadata_type = $${paramIndex++}`);
      values.push(input.type);
    }
    if (input.scope !== undefined) {
      setClauses.push(`scope = $${paramIndex++}`);
      values.push(input.scope);
    }
    if (input.updatedBy !== undefined) {
      setClauses.push(`updated_by = $${paramIndex++}`);
      values.push(input.updatedBy);
    }

    if (setClauses.length === 0) {
      // No updates, return existing
      return this.pool.queryOne<UserMetadataRow>(
        `SELECT * FROM user_metadata WHERE instance_id = $1 AND id = $2`,
        [instanceId, id]
      );
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(instanceId);
    values.push(id);

    return this.pool.queryOne<UserMetadataRow>(
      `UPDATE user_metadata 
       SET ${setClauses.join(', ')}
       WHERE instance_id = $${paramIndex++} AND id = $${paramIndex}
       RETURNING *`,
      values
    );
  }

  /**
   * Delete metadata entry by key
   */
  async deleteByKey(userId: string, key: string, scope?: string): Promise<boolean> {
    const query = scope
      ? `DELETE FROM user_metadata WHERE user_id = $1 AND metadata_key = $2 AND scope = $3`
      : `DELETE FROM user_metadata WHERE user_id = $1 AND metadata_key = $2 AND scope IS NULL`;
    
    const params = scope ? [userId, key, scope] : [userId, key];
    const result = await this.pool.query(query, params);
    
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete metadata entry by ID
   */
  async delete(id: string, instanceId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM user_metadata WHERE instance_id = $1 AND id = $2`,
      [instanceId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete all metadata for a user
   */
  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM user_metadata WHERE user_id = $1`,
      [userId]
    );
    return result.rowCount ?? 0;
  }

  /**
   * Search metadata by value (JSONB queries)
   */
  async searchByValue(field: string, value: any, instanceId?: string): Promise<UserMetadataRow[]> {
    if (instanceId) {
      return this.pool.queryMany<UserMetadataRow>(
        `SELECT * FROM user_metadata 
         WHERE metadata_value->$1 = $2 AND instance_id = $3`,
        [field, JSON.stringify(value), instanceId]
      );
    }
    
    return this.pool.queryMany<UserMetadataRow>(
      `SELECT * FROM user_metadata WHERE metadata_value->$1 = $2`,
      [field, JSON.stringify(value)]
    );
  }

  /**
   * Get metadata by scope
   */
  async findByScope(scope: string, instanceId?: string): Promise<UserMetadataRow[]> {
    if (instanceId) {
      return this.pool.queryMany<UserMetadataRow>(
        `SELECT * FROM user_metadata WHERE scope = $1 AND instance_id = $2`,
        [scope, instanceId]
      );
    }
    
    return this.pool.queryMany<UserMetadataRow>(
      `SELECT * FROM user_metadata WHERE scope = $1`,
      [scope]
    );
  }
}
