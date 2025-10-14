/**
 * Base Repository
 * 
 * Provides generic CRUD operations for all repositories.
 * Extend this class to create type-safe repositories.
 */

import { QueryResultRow } from 'pg';
import { DatabasePool, QueryExecutor } from './pool';

/**
 * Base repository with generic CRUD operations
 */
export abstract class BaseRepository<T extends QueryResultRow = any> {
  protected readonly database: DatabasePool;
  protected readonly tableName: string;

  constructor(database: DatabasePool, tableName: string) {
    this.database = database;
    this.tableName = tableName;
  }

  /**
   * Insert a record
   */
  async insert(data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const result = await this.database.queryOne<T>(
      `INSERT INTO ${this.tableName} (${keys.join(', ')}) 
       VALUES (${placeholders}) 
       RETURNING *`,
      values
    );

    if (!result) {
      throw new Error(`Failed to insert into ${this.tableName}`);
    }

    return result;
  }

  /**
   * Update a record by ID
   */
  async update(id: string, data: Partial<T>): Promise<T | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const sets = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    return this.database.queryOne<T>(
      `UPDATE ${this.tableName} 
       SET ${sets} 
       WHERE id = $${values.length + 1} 
       RETURNING *`,
      [...values, id]
    );
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Soft delete a record (sets deleted_at timestamp)
   */
  async softDelete(id: string): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE ${this.tableName} 
       SET deleted_at = NOW() 
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if a record exists by ID
   */
  async exists(id: string): Promise<boolean> {
    const result = await this.database.queryOne<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE id = $1) as exists`,
      [id]
    );
    return result?.exists ?? false;
  }

  /**
   * Find a record by ID
   */
  async findById(id: string): Promise<T | null> {
    return this.database.queryOne<T>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
  }

  /**
   * Find all records
   */
  async findAll(limit?: number, offset?: number): Promise<T[]> {
    let query = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];

    if (limit) {
      query += ` LIMIT $1`;
      params.push(limit);
    }

    if (offset) {
      query += ` OFFSET $${params.length + 1}`;
      params.push(offset);
    }

    return this.database.queryMany<T>(query, params.length > 0 ? params : undefined);
  }

  /**
   * Count records
   */
  async count(): Promise<number> {
    const result = await this.database.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${this.tableName}`
    );
    return parseInt(result?.count ?? '0', 10);
  }

  /**
   * Execute a query within a transaction
   */
  protected async transaction<R>(
    callback: (tx: QueryExecutor) => Promise<R>
  ): Promise<R> {
    return this.database.withTransaction(callback);
  }

  /**
   * Execute a raw query (use with caution)
   */
  protected async query(sql: string, params?: any[]): Promise<any> {
    return this.database.query(sql, params);
  }

  /**
   * Execute a raw query and return one result
   */
  protected async queryOne<R extends QueryResultRow = any>(sql: string, params?: any[]): Promise<R | null> {
    return this.database.queryOne<R>(sql, params);
  }

  /**
   * Execute a raw query and return many results
   */
  protected async queryMany<R extends QueryResultRow = any>(sql: string, params?: any[]): Promise<R[]> {
    return this.database.queryMany<R>(sql, params);
  }
}
