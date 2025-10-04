/**
 * Base Repository
 * 
 * Provides common database operations for all repositories
 */

import { QueryResultRow } from 'pg';
import { DatabasePool } from '../database';

export abstract class BaseRepository<T extends QueryResultRow> {
  constructor(
    protected pool: DatabasePool,
    protected tableName: string
  ) {}

  /**
   * Find by ID
   */
  async findById(id: string): Promise<T | null> {
    return this.pool.queryOne<T>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
  }

  /**
   * Find all
   */
  async findAll(): Promise<T[]> {
    return this.pool.queryMany<T>(
      `SELECT * FROM ${this.tableName}`
    );
  }

  /**
   * Find by condition
   */
  async findBy(column: string, value: any): Promise<T[]> {
    return this.pool.queryMany<T>(
      `SELECT * FROM ${this.tableName} WHERE ${column} = $1`,
      [value]
    );
  }

  /**
   * Find one by condition
   */
  async findOneBy(column: string, value: any): Promise<T | null> {
    return this.pool.queryOne<T>(
      `SELECT * FROM ${this.tableName} WHERE ${column} = $1`,
      [value]
    );
  }

  /**
   * Delete by ID
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Count all records
   */
  async count(): Promise<number> {
    const result = await this.pool.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${this.tableName}`
    );
    return parseInt(result?.count || '0', 10);
  }
}
