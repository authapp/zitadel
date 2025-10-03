import { DatabasePool, DatabaseConfig } from './pool';

// Mock pg module
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  const mockConnect = jest.fn();
  const mockEnd = jest.fn();
  const mockOn = jest.fn();

  return {
    Pool: jest.fn().mockImplementation(() => ({
      query: mockQuery,
      connect: mockConnect,
      end: mockEnd,
      on: mockOn,
      totalCount: 5,
      idleCount: 3,
      waitingCount: 0,
    })),
  };
});

describe('DatabasePool', () => {
  let config: DatabaseConfig;

  beforeEach(() => {
    config = {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      user: 'test_user',
      password: 'test_password',
    };
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create pool with provided config', () => {
      const pool = new DatabasePool(config);
      expect(pool).toBeInstanceOf(DatabasePool);
    });

    it('should create pool with SSL enabled', () => {
      const sslConfig = { ...config, ssl: true };
      const pool = new DatabasePool(sslConfig);
      expect(pool).toBeInstanceOf(DatabasePool);
    });

    it('should create pool with custom pool settings', () => {
      const customConfig = {
        ...config,
        poolMin: 5,
        poolMax: 20,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 5000,
      };
      const pool = new DatabasePool(customConfig);
      expect(pool).toBeInstanceOf(DatabasePool);
    });
  });

  describe('query', () => {
    it('should execute query successfully', async () => {
      const pool = new DatabasePool(config);
      const mockResult = { rows: [{ id: 1, name: 'Test' }], rowCount: 1 };

      // Get the mocked Pool instance
      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.query.mockResolvedValue(mockResult);

      // Replace internal pool
      (pool as any).pool = mockPool;

      const result = await pool.query('SELECT * FROM users WHERE id = $1', ['1']);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', ['1']);
      expect(result).toEqual(mockResult);
    });

    it('should throw ZitadelError on query failure', async () => {
      const pool = new DatabasePool(config);
      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.query.mockRejectedValue(new Error('Connection failed'));

      (pool as any).pool = mockPool;

      await expect(pool.query('SELECT * FROM users')).rejects.toThrow('Database query failed');
    });
  });

  describe('queryOne', () => {
    it('should return first row when exists', async () => {
      const pool = new DatabasePool(config);
      const mockResult = { rows: [{ id: 1, name: 'Test' }, { id: 2, name: 'Test2' }] };

      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.query.mockResolvedValue(mockResult);
      (pool as any).pool = mockPool;

      const result = await pool.queryOne('SELECT * FROM users');

      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('should return null when no rows', async () => {
      const pool = new DatabasePool(config);
      const mockResult = { rows: [] };

      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.query.mockResolvedValue(mockResult);
      (pool as any).pool = mockPool;

      const result = await pool.queryOne('SELECT * FROM users WHERE id = $1', ['999']);

      expect(result).toBeNull();
    });
  });

  describe('queryMany', () => {
    it('should return all rows', async () => {
      const pool = new DatabasePool(config);
      const mockRows = [
        { id: 1, name: 'Test1' },
        { id: 2, name: 'Test2' },
        { id: 3, name: 'Test3' },
      ];
      const mockResult = { rows: mockRows };

      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.query.mockResolvedValue(mockResult);
      (pool as any).pool = mockPool;

      const result = await pool.queryMany('SELECT * FROM users');

      expect(result).toEqual(mockRows);
    });

    it('should return empty array when no rows', async () => {
      const pool = new DatabasePool(config);
      const mockResult = { rows: [] };

      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.query.mockResolvedValue(mockResult);
      (pool as any).pool = mockPool;

      const result = await pool.queryMany('SELECT * FROM users WHERE id = $1', ['999']);

      expect(result).toEqual([]);
    });
  });

  describe('beginTransaction', () => {
    it('should begin transaction and return transaction object', async () => {
      const pool = new DatabasePool(config);
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };

      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.connect.mockResolvedValue(mockClient);
      (pool as any).pool = mockPool;

      const tx = await pool.beginTransaction();

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(tx).toHaveProperty('query');
      expect(tx).toHaveProperty('commit');
      expect(tx).toHaveProperty('rollback');
      expect(tx).toHaveProperty('release');
    });

    it('should execute query within transaction', async () => {
      const pool = new DatabasePool(config);
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
        release: jest.fn(),
      };

      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.connect.mockResolvedValue(mockClient);
      (pool as any).pool = mockPool;

      const tx = await pool.beginTransaction();
      const result = await tx.query('INSERT INTO users (name) VALUES ($1)', ['Test']);

      expect(result.rows).toEqual([{ id: 1 }]);
    });

    it('should commit transaction', async () => {
      const pool = new DatabasePool(config);
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };

      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.connect.mockResolvedValue(mockClient);
      (pool as any).pool = mockPool;

      const tx = await pool.beginTransaction();
      await tx.commit();

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction', async () => {
      const pool = new DatabasePool(config);
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };

      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.connect.mockResolvedValue(mockClient);
      (pool as any).pool = mockPool;

      const tx = await pool.beginTransaction();
      await tx.rollback();

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client on transaction release', async () => {
      const pool = new DatabasePool(config);
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };

      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.connect.mockResolvedValue(mockClient);
      (pool as any).pool = mockPool;

      const tx = await pool.beginTransaction();
      tx.release();

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('withTransaction', () => {
    it('should execute function within transaction and commit', async () => {
      const pool = new DatabasePool(config);
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };

      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.connect.mockResolvedValue(mockClient);
      (pool as any).pool = mockPool;

      const result = await pool.withTransaction(async (tx) => {
        await tx.query('INSERT INTO users (name) VALUES ($1)', ['Test']);
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback transaction on error', async () => {
      const pool = new DatabasePool(config);
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };

      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.connect.mockResolvedValue(mockClient);
      (pool as any).pool = mockPool;

      const error = new Error('Query failed');

      await expect(
        pool.withTransaction(async (tx) => {
          await tx.query('INSERT INTO users (name) VALUES ($1)', ['Test']);
          throw error;
        }),
      ).rejects.toThrow('Query failed');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should return value from transaction function', async () => {
      const pool = new DatabasePool(config);
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
        release: jest.fn(),
      };

      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.connect.mockResolvedValue(mockClient);
      (pool as any).pool = mockPool;

      const result = await pool.withTransaction(async (tx) => {
        const res = await tx.query('SELECT * FROM users WHERE id = $1', ['1']);
        return res.rows[0];
      });

      expect(result).toEqual({ id: 1 });
    });
  });

  describe('health', () => {
    it('should return true when database is healthy', async () => {
      const pool = new DatabasePool(config);
      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      (pool as any).pool = mockPool;

      const healthy = await pool.health();

      expect(healthy).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return false when database is unhealthy', async () => {
      const pool = new DatabasePool(config);
      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.query.mockRejectedValue(new Error('Connection failed'));
      (pool as any).pool = mockPool;

      const healthy = await pool.health();

      expect(healthy).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return pool statistics', () => {
      const pool = new DatabasePool(config);

      const stats = pool.getStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('idle');
      expect(stats).toHaveProperty('waiting');
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.idle).toBe('number');
      expect(typeof stats.waiting).toBe('number');
    });
  });

  describe('close', () => {
    it('should close all connections', async () => {
      const pool = new DatabasePool(config);
      const { Pool } = require('pg');
      const mockPool = new Pool();
      mockPool.end.mockResolvedValue(undefined);
      (pool as any).pool = mockPool;

      await pool.close();

      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});

describe('createDatabasePoolFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should create pool from environment variables', () => {
    process.env.DATABASE_HOST = 'db.example.com';
    process.env.DATABASE_PORT = '5433';
    process.env.DATABASE_NAME = 'mydb';
    process.env.DATABASE_USER = 'myuser';
    process.env.DATABASE_PASSWORD = 'mypassword';
    process.env.DATABASE_SSL = 'true';
    process.env.DATABASE_POOL_MIN = '5';
    process.env.DATABASE_POOL_MAX = '20';

    const { createDatabasePoolFromEnv, DatabasePool } = require('./pool');
    const pool = createDatabasePoolFromEnv();

    expect(pool).toBeInstanceOf(DatabasePool);
  });

  it('should use default values when env vars not set', () => {
    delete process.env.DATABASE_HOST;
    delete process.env.DATABASE_PORT;
    delete process.env.DATABASE_NAME;
    delete process.env.DATABASE_USER;
    delete process.env.DATABASE_PASSWORD;

    const { createDatabasePoolFromEnv, DatabasePool } = require('./pool');
    const pool = createDatabasePoolFromEnv();

    expect(pool).toBeInstanceOf(DatabasePool);
  });
});
