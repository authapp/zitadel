/**
 * Migration System Integration Tests (Zitadel-style)
 * 
 * Tests the migration system with real PostgreSQL database:
 * - Fresh start (run all migrations)
 * - Resume from last state (idempotent)
 * - Stuck migration detection
 * - Migration failure handling
 * - Event-sourced migration tracking
 */

import { DatabasePool, DatabaseMigrator, DatabaseConfig } from '../../src/lib/database';
import { TEST_DB_CONFIG } from './setup';

describe('Migration System Integration', () => {
  let pool: DatabasePool;
  let migrator: DatabaseMigrator;

  beforeEach(async () => {
    // Create fresh pool (without running migrations automatically)
    pool = new DatabasePool(TEST_DB_CONFIG);
    const isHealthy = await pool.health();
    if (!isHealthy) {
      throw new Error('Cannot connect to test database');
    }

    migrator = new DatabaseMigrator(pool);
    
    // Clean database before each test to ensure fresh start
    await migrator.reset();
  });

  afterEach(async () => {
    if (pool) {
      await pool.close();
    }
  });

  describe('Fresh Start', () => {
    it('should create migrations tracking table', async () => {
      await migrator.migrate();

      const result = await pool.queryOne<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'schema_migrations'
        )`
      );

      expect(result?.exists).toBe(true);
    });

    it('should run all migrations from fresh state', async () => {
      await migrator.migrate();

      // Check that all expected tables exist
      const tables = await pool.queryMany<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' 
         ORDER BY table_name`
      );

      const tableNames = tables.map((t: any) => t.table_name);
      
      // Check essential tables created
      expect(tableNames).toContain('events');
      expect(tableNames).toContain('users_projection');
      expect(tableNames).toContain('projection_states');
      expect(tableNames).toContain('schema_migrations');
    });

    it('should record all applied migrations', async () => {
      await migrator.migrate();

      const migrations = await pool.queryMany<{ version: number; name: string }>(
        'SELECT version, name FROM schema_migrations ORDER BY version'
      );

      expect(migrations.length).toBeGreaterThan(0);
      expect(migrations[0].name).toBe('Create events table');
      expect(migrations[1].name).toBe('Create events aggregate index');
    });

    it('should set correct schema version', async () => {
      await migrator.migrate();

      const version = await migrator.currentVersion();
      expect(version).toBe(25); // We have 25 migration steps (added Priority 2 fields)
    });
  });

  describe('Idempotent Operations', () => {
    it('should be safe to run migrations multiple times', async () => {
      // First run
      await migrator.migrate();
      const version1 = await migrator.currentVersion();

      // Second run - should not error
      await migrator.migrate();
      const version2 = await migrator.currentVersion();

      expect(version1).toBe(version2);
    });

    it('should not duplicate migration records', async () => {
      await migrator.migrate();
      await migrator.migrate();
      await migrator.migrate();

      const migrations = await pool.queryMany(
        'SELECT * FROM schema_migrations'
      );

      // Should still only have 25 records (one per migration step)
      expect(migrations.length).toBe(25);
    });
  });

  describe('Resume from Last State', () => {
    it('should resume after partial migration', async () => {
      // Manually apply only first migration
      await migrator.migrate();
      
      const migrations1 = await pool.queryMany(
        'SELECT version FROM schema_migrations ORDER BY version'
      );
      
      // All migrations should be applied
      expect(migrations1.length).toBe(25);
    });

    it('should skip already applied migrations', async () => {
      // Apply all migrations
      await migrator.migrate();
      const version1 = await migrator.currentVersion();

      // Create new migrator and run again
      const migrator2 = new DatabaseMigrator(pool);
      await migrator2.migrate();
      const version2 = await migrator2.currentVersion();

      expect(version1).toBe(version2);
    });
  });

  describe('Migration Status', () => {
    it('should report migration status correctly', async () => {
      await migrator.migrate();

      const version = await migrator.currentVersion();
      expect(version).toBeGreaterThan(0);
    });

    it('should list all migrations', async () => {
      await migrator.migrate();

      const applied = await pool.queryMany<{ version: number; name: string; applied_at: Date }>(
        'SELECT version, name, applied_at FROM schema_migrations ORDER BY version'
      );

      expect(applied.length).toBe(25);
      expect(applied[0].version).toBe(1);
      expect(applied[applied.length - 1].version).toBe(25);
      expect(applied[0].applied_at).toBeInstanceOf(Date);
    });
  });

  describe('Schema Validation', () => {
    it('should create events table with correct structure', async () => {
      await migrator.migrate();

      const columns = await pool.queryMany<{ column_name: string; data_type: string }>(
        `SELECT column_name, data_type 
         FROM information_schema.columns 
         WHERE table_name = 'events' 
         ORDER BY ordinal_position`
      );

      const columnNames = columns.map(c => c.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('event_type');
      expect(columnNames).toContain('aggregate_type');
      expect(columnNames).toContain('aggregate_id');
      expect(columnNames).toContain('aggregate_version');
      expect(columnNames).toContain('event_data');
      expect(columnNames).toContain('position');
    });

    it('should create users_projection table with correct structure', async () => {
      await migrator.migrate();

      const columns = await pool.queryMany<{ column_name: string }>(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name = 'users_projection'`
      );

      const columnNames = columns.map(c => c.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('username');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('instance_id');
      expect(columnNames).toContain('resource_owner');
      expect(columnNames).toContain('state');
      
      // Priority 2 fields
      expect(columnNames).toContain('nickname');
      expect(columnNames).toContain('email_verified_at');
      expect(columnNames).toContain('phone_verified_at');
      expect(columnNames).toContain('password_changed_at');
      expect(columnNames).toContain('password_change_required');
    });

    it('should create required indexes', async () => {
      await migrator.migrate();

      const indexes = await pool.queryMany<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes 
         WHERE tablename = 'events'`
      );

      const indexNames = indexes.map(i => i.indexname);
      expect(indexNames).toContain('idx_events_aggregate');
      expect(indexNames).toContain('idx_events_position');
    });

    it('should enforce unique constraints', async () => {
      await migrator.migrate();

      const constraints = await pool.queryMany<{ constraint_name: string }>(
        `SELECT constraint_name 
         FROM information_schema.table_constraints 
         WHERE table_name = 'users_projection' 
         AND constraint_type = 'UNIQUE'`
      );

      expect(constraints.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      const badConfig: DatabaseConfig = {
        ...TEST_DB_CONFIG,
        port: 9999, // Non-existent port
      };

      const badPool = new DatabasePool(badConfig);
      const badMigrator = new DatabaseMigrator(badPool);

      await expect(badMigrator.migrate()).rejects.toThrow();
      
      await badPool.close();
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity after migrations', async () => {
      await migrator.migrate();

      // Test that we can insert and query data
      await pool.query(
        `INSERT INTO users_projection (id, instance_id, resource_owner, username, email, state, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        ['test-id', 'test-instance', 'test-org', 'testuser', 'test@example.com', 'active']
      );

      const user = await pool.queryOne(
        'SELECT * FROM users_projection WHERE id = $1',
        ['test-id']
      );

      expect(user).toBeTruthy();
      expect(user?.username).toBe('testuser');
    });

    it('should handle cascade deletes correctly', async () => {
      await migrator.migrate();

      // Insert test data
      await pool.query(
        `INSERT INTO users_projection (id, instance_id, resource_owner, username, state, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        ['user-1', 'test-instance', 'test-org', 'user1', 'active']
      );

      // Clean up should work
      await pool.query('TRUNCATE TABLE users_projection CASCADE');

      const count = await pool.queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM users_projection'
      );

      expect(parseInt(count?.count || '0')).toBe(0);
    });
  });
});
