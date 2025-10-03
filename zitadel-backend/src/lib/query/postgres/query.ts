/**
 * PostgreSQL-based query implementation
 */

import { Pool } from 'pg';
import {
  Query,
  QueryOptions,
  QueryResult,
  FilterCondition,
  FilterGroup,
  ProjectionState,
  QueryError,
} from '../types';
import { filterToSQL } from '../filter';

/**
 * PostgreSQL query implementation
 */
export class PostgresQuery implements Query {
  constructor(private pool: Pool) {}

  /**
   * Find a single entity by ID
   */
  async findById<T>(table: string, id: string): Promise<T | null> {
    try {
      const sql = `
        SELECT * FROM ${this.sanitizeTableName(table)}
        WHERE id = $1 AND deleted_at IS NULL
        LIMIT 1
      `;

      const result = await this.pool.query(sql, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRow<T>(result.rows[0]);
    } catch (error) {
      throw new QueryError(`Failed to find by ID in ${table}: ${error}`, 'FIND_BY_ID_FAILED');
    }
  }

  /**
   * Find entities matching query options
   */
  async find<T>(table: string, options: QueryOptions = {}): Promise<QueryResult<T>> {
    try {
      const { sql, params, countSql } = this.buildQuery(table, options);

      // Execute count query if pagination is requested
      let total: number | undefined;
      if (options.pagination) {
        const countResult = await this.pool.query(countSql, params.slice(0, params.length - 2));
        total = parseInt(countResult.rows[0].count, 10);
      }

      // Execute main query
      const result = await this.pool.query(sql, params);
      const data = result.rows.map(row => this.mapRow<T>(row));

      // Build pagination info
      const pagination = options.pagination
        ? {
            offset: options.pagination.offset,
            limit: options.pagination.limit,
            total: total!,
            hasMore: options.pagination.offset + options.pagination.limit < total!,
          }
        : undefined;

      return {
        data,
        pagination,
      };
    } catch (error) {
      throw new QueryError(`Failed to find in ${table}: ${error}`, 'FIND_FAILED');
    }
  }

  /**
   * Count entities matching filters
   */
  async count(table: string, filters?: FilterGroup | FilterCondition[]): Promise<number> {
    try {
      const tableName = this.sanitizeTableName(table);
      let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
      const params: any[] = [];

      // Add WHERE clause
      const whereParts: string[] = [];
      
      // Add filter conditions
      if (filters) {
        const { sql: filterSql, params: filterParams } = filterToSQL(filters, params.length + 1);
        whereParts.push(filterSql);
        params.push(...filterParams);
      }

      // Always exclude deleted records
      whereParts.push('deleted_at IS NULL');

      if (whereParts.length > 0) {
        sql += ` WHERE ${whereParts.join(' AND ')}`;
      }

      const result = await this.pool.query(sql, params);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      throw new QueryError(`Failed to count in ${table}: ${error}`, 'COUNT_FAILED');
    }
  }

  /**
   * Check if entity exists
   */
  async exists(table: string, id: string): Promise<boolean> {
    try {
      const sql = `
        SELECT 1 FROM ${this.sanitizeTableName(table)}
        WHERE id = $1 AND deleted_at IS NULL
        LIMIT 1
      `;

      const result = await this.pool.query(sql, [id]);
      return result.rows.length > 0;
    } catch (error) {
      throw new QueryError(`Failed to check existence in ${table}: ${error}`, 'EXISTS_FAILED');
    }
  }

  /**
   * Execute custom SQL query
   */
  async execute<T>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows.map(row => this.mapRow<T>(row));
    } catch (error) {
      throw new QueryError(`Failed to execute query: ${error}`, 'EXECUTE_FAILED');
    }
  }

  /**
   * Get projection state
   */
  async getProjectionState(name: string): Promise<ProjectionState | null> {
    try {
      const sql = `
        SELECT * FROM projection_states
        WHERE name = $1
        LIMIT 1
      `;

      const result = await this.pool.query(sql, [name]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRow<ProjectionState>(result.rows[0]);
    } catch (error) {
      throw new QueryError(`Failed to get projection state: ${error}`, 'GET_STATE_FAILED');
    }
  }

  /**
   * Health check
   */
  async health(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Build SQL query from options
   */
  private buildQuery(table: string, options: QueryOptions): {
    sql: string;
    params: any[];
    countSql: string;
  } {
    const tableName = this.sanitizeTableName(table);
    let sql = `SELECT * FROM ${tableName}`;
    let countSql = `SELECT COUNT(*) as count FROM ${tableName}`;
    const params: any[] = [];

    // Build WHERE clause
    const whereParts: string[] = [];

    // Add filter conditions
    if (options.filters) {
      const { sql: filterSql, params: filterParams } = filterToSQL(options.filters, params.length + 1);
      whereParts.push(filterSql);
      params.push(...filterParams);
    }

    // Exclude deleted records unless specified
    if (!options.includeDeleted) {
      whereParts.push('deleted_at IS NULL');
    }

    if (whereParts.length > 0) {
      const whereClause = ` WHERE ${whereParts.join(' AND ')}`;
      sql += whereClause;
      countSql += whereClause;
    }

    // Add ORDER BY clause
    if (options.sorting && options.sorting.length > 0) {
      const orderParts = options.sorting.map(s => 
        `${s.field} ${s.direction.toUpperCase()}`
      );
      sql += ` ORDER BY ${orderParts.join(', ')}`;
    }

    // Add LIMIT and OFFSET
    if (options.pagination) {
      sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(options.pagination.limit, options.pagination.offset);
    }

    return { sql, params, countSql };
  }

  /**
   * Sanitize table name to prevent SQL injection
   */
  private sanitizeTableName(table: string): string {
    // Only allow alphanumeric characters and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(table)) {
      throw new QueryError(`Invalid table name: ${table}`, 'INVALID_TABLE_NAME');
    }
    return table;
  }

  /**
   * Map database row to object, converting types as needed
   */
  private mapRow<T>(row: any): T {
    const mapped: any = {};

    for (const [key, value] of Object.entries(row)) {
      // Convert bigint to string to avoid precision issues
      if (typeof value === 'bigint') {
        mapped[key] = value.toString();
      }
      // Parse JSON columns
      else if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
          mapped[key] = JSON.parse(value);
        } catch {
          mapped[key] = value;
        }
      }
      // Convert dates
      else if (value instanceof Date) {
        mapped[key] = value.toISOString();
      }
      else {
        mapped[key] = value;
      }
    }

    return mapped as T;
  }
}

/**
 * Create a PostgreSQL query instance
 */
export function createPostgresQuery(pool: Pool): Query {
  return new PostgresQuery(pool);
}
