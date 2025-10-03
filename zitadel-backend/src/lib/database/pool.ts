import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { throwInternal } from '@/zerrors/errors';

/**
 * Database configuration
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  poolMin?: number;
  poolMax?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Query executor interface
 */
export interface QueryExecutor {
  query<T extends QueryResultRow = any>(
    text: string,
    values?: any[],
  ): Promise<QueryResult<T>>;
}

/**
 * Transaction context
 */
export interface Transaction extends QueryExecutor {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}

/**
 * Database connection pool manager
 */
export class DatabasePool implements QueryExecutor {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      min: config.poolMin ?? 2,
      max: config.poolMax ?? 10,
      idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis ?? 2000,
    };

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  /**
   * Execute a query
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    values?: any[],
  ): Promise<QueryResult<T>> {
    try {
      if (typeof values === 'undefined') {
      return await this.pool.query<T>(text);
    }
    return await this.pool.query<T>(text, values);
    } catch (error) {
      throwInternal('Database query failed', 'DB-001', { query: text }, error as Error);
    }
  }

  /**
   * Execute a query and return first row
   */
  async queryOne<T extends QueryResultRow = any>(
    text: string,
    values?: any[],
  ): Promise<T | null> {
    const result = await this.query<T>(text, values);
    return result.rows[0] ?? null;
  }

  /**
   * Execute a query and return all rows
   */
  async queryMany<T extends QueryResultRow = any>(
    text: string,
    values?: any[],
  ): Promise<T[]> {
    const result = await this.query<T>(text, values);
    return result.rows;
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(): Promise<Transaction> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      return {
        query: async <T extends QueryResultRow = any>(
          text: string,
          values?: any[],
        ): Promise<QueryResult<T>> => {
          try {
            return await client.query<T>(text, values);
          } catch (error) {
            throwInternal('Transaction query failed', 'DB-002', { query: text }, error as Error);
          }
        },
        commit: async () => {
          try {
            await client.query('COMMIT');
          } catch (error) {
            throwInternal('Transaction commit failed', 'DB-003', {}, error as Error);
          } finally {
            client.release();
          }
        },
        rollback: async () => {
          try {
            await client.query('ROLLBACK');
          } catch (error) {
            throwInternal('Transaction rollback failed', 'DB-004', {}, error as Error);
          } finally {
            client.release();
          }
        },
        release: () => {
          client.release();
        },
      };
    } catch (error) {
      client.release();
      throwInternal('Failed to begin transaction', 'DB-005', {}, error as Error);
    }
  }

  /**
   * Execute a function within a transaction
   */
  async withTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    const tx = await this.beginTransaction();
    try {
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  /**
   * Health check
   */
  async health(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    idle: number;
    waiting: number;
  } {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Close all connections in the pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Create a database pool from environment variables
 */
export function createDatabasePoolFromEnv(): DatabasePool {
  const config: DatabaseConfig = {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    database: process.env.DATABASE_NAME ?? 'zitadel',
    user: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    ssl: process.env.DATABASE_SSL === 'true',
    poolMin: parseInt(process.env.DATABASE_POOL_MIN ?? '2', 10),
    poolMax: parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
  };

  return new DatabasePool(config);
}
