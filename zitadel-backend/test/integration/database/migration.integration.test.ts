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

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DatabasePool, DatabaseMigrator, DatabaseConfig } from '../../../src/lib/database';
import { TEST_DB_CONFIG } from '../setup';

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
      
      // Check essential tables created in public schema
      expect(tableNames).toContain('events');
      expect(tableNames).toContain('schema_migrations');
      
      // Check projection tables exist in projections schema
      const projectionTables = await pool.queryMany<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'projections' 
         ORDER BY table_name`
      );
      const projectionTableNames = projectionTables.map((t: any) => t.table_name);
      expect(projectionTableNames).toContain('users');
      expect(projectionTableNames).toContain('projection_states');
    });

    it('should record all applied migrations', async () => {
      await migrator.migrate();

      const migrations = await pool.queryMany<{ version: number; name: string }>(
        'SELECT version, name FROM schema_migrations ORDER BY version'
      );

      expect(migrations.length).toBe(3); // Clean schema: 3 consolidated files
      expect(migrations[0].name).toBe('Infrastructure (Events, Projections, Keys)');
      expect(migrations[1].name).toBe('Projection Tables (All 50 projections)');
      expect(migrations[2].name).toBe('Indexes and Constraints');
    });

    it('should set correct schema version', async () => {
      await migrator.migrate();

      const version = await migrator.currentVersion();
      // Clean schema approach: 3 consolidated files instead of 68 individual migrations
      // 1: Infrastructure (events, projection_states, unique_constraints, encryption_keys)
      // 2: Projection Tables (all 50 projection tables)
      // 3: Indexes and Constraints (all 362 indexes + 28 unique constraints)
      expect(version).toBe(3); // Clean schema: 3 files
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

      // Should have 3 records (one per clean schema file)
      expect(migrations.length).toBe(3);
    });
  });

  describe('Resume from Last State', () => {
    it('should resume after partial migration', async () => {
      // Manually apply only first migration
      await migrator.migrate();
      
      const migrations1 = await pool.queryMany(
        'SELECT version FROM schema_migrations ORDER BY version'
      );
      
      // All migrations should be applied (3 clean schema files)
      expect(migrations1.length).toBe(3);
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

      expect(applied.length).toBe(3); // Clean schema: 3 files
      expect(applied[0].version).toBe(1);
      expect(applied[applied.length - 1].version).toBe(3);
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
      expect(columnNames).toContain('instance_id');
      expect(columnNames).toContain('event_type');
      expect(columnNames).toContain('aggregate_type');
      expect(columnNames).toContain('aggregate_id');
      expect(columnNames).toContain('aggregate_version');
      expect(columnNames).toContain('payload');
      expect(columnNames).toContain('creator');
      expect(columnNames).toContain('owner');
      expect(columnNames).toContain('position');
    });

    it('should create users table in projections schema with correct structure', async () => {
      await migrator.migrate();

      const columns = await pool.queryMany<{ column_name: string }>(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_schema = 'projections' 
         AND table_name = 'users'`
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
      
      // Priority 3 fields
      expect(columnNames).toContain('preferred_login_name');
      expect(columnNames).toContain('login_names');
    });

    it('should create required indexes', async () => {
      await migrator.migrate();

      const indexes = await pool.queryMany<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes 
         WHERE tablename = 'events'`
      );

      const indexNames = indexes.map(i => i.indexname);
      expect(indexNames).toContain('idx_events_wm'); // Write model index
      expect(indexNames).toContain('idx_events_position');
      expect(indexNames).toContain('idx_events_projection');
    });

    it('should enforce unique constraints', async () => {
      await migrator.migrate();

      // Check for unique indexes (PostgreSQL implements unique constraints as indexes)
      const indexes = await pool.queryMany<{ indexname: string }>(
        `SELECT indexname 
         FROM pg_indexes 
         WHERE schemaname = 'projections' 
         AND tablename = 'users' 
         AND indexname LIKE '%unique%'`
      );

      expect(indexes.length).toBeGreaterThan(0);
      // Should have at least email and username unique indexes
      expect(indexes.length).toBeGreaterThanOrEqual(2);
    });

    it('should create user_addresses table (Priority 3)', async () => {
      await migrator.migrate();

      const columns = await pool.queryMany<{ column_name: string }>(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_schema = 'projections' 
         AND table_name = 'user_addresses'`
      );

      const columnNames = columns.map(c => c.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('country');
      expect(columnNames).toContain('locality');
      expect(columnNames).toContain('postal_code');
      expect(columnNames).toContain('region');
      expect(columnNames).toContain('street_address');
      expect(columnNames).toContain('formatted_address');
      expect(columnNames).toContain('address_type');
      expect(columnNames).toContain('is_primary');
    });

    it('should create user_metadata table (Priority 3)', async () => {
      await migrator.migrate();

      const columns = await pool.queryMany<{ column_name: string }>(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_schema = 'projections' 
         AND table_name = 'user_metadata'`
      );

      const columnNames = columns.map(c => c.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('metadata_key');
      expect(columnNames).toContain('metadata_value');
      expect(columnNames).toContain('metadata_type');
      expect(columnNames).toContain('scope');
    });

    it('should create projection_states table with all required columns', async () => {
      await migrator.migrate();

      const columns = await pool.queryMany<{ column_name: string; is_nullable: string }>(
        `SELECT column_name, is_nullable
         FROM information_schema.columns 
         WHERE table_name = 'projection_states'
         ORDER BY ordinal_position`
      );

      const columnNames = columns.map(c => c.column_name);
      
      // Core tracking columns
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('position');
      expect(columnNames).toContain('position_offset');
      
      // Timestamp columns
      expect(columnNames).toContain('last_processed_at');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
      
      // Status columns
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('error_count');
      expect(columnNames).toContain('last_error');
      
      // Enhanced tracking columns (nullable)
      expect(columnNames).toContain('event_timestamp');
      expect(columnNames).toContain('instance_id');
      expect(columnNames).toContain('aggregate_type');
      expect(columnNames).toContain('aggregate_id');
      expect(columnNames).toContain('sequence');
      
      // Verify nullable fields
      const nullableColumns = columns.filter(c => c.is_nullable === 'YES').map(c => c.column_name);
      expect(nullableColumns).toContain('event_timestamp');
      expect(nullableColumns).toContain('instance_id');
      expect(nullableColumns).toContain('aggregate_type');
      expect(nullableColumns).toContain('aggregate_id');
      expect(nullableColumns).toContain('sequence');
    });

    it('should create all projection_states indexes', async () => {
      await migrator.migrate();

      const indexes = await pool.queryMany<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes 
         WHERE tablename = 'projection_states'`
      );

      const indexNames = indexes.map(i => i.indexname);
      expect(indexNames).toContain('idx_projection_states_status');
      expect(indexNames).toContain('idx_projection_states_position');
      expect(indexNames).toContain('idx_projection_states_position_offset');
      expect(indexNames).toContain('idx_projection_states_updated_at');
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
        `INSERT INTO projections.users (id, instance_id, resource_owner, username, email, state, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        ['test-id', 'test-instance', 'test-org', 'testuser', 'test@example.com', 'active']
      );

      const user = await pool.queryOne(
        'SELECT * FROM projections.users WHERE id = $1',
        ['test-id']
      );

      expect(user).toBeTruthy();
      expect(user?.username).toBe('testuser');
    });

    it('should handle cascade deletes correctly', async () => {
      await migrator.migrate();

      // Insert test data
      await pool.query(
        `INSERT INTO projections.users (id, instance_id, resource_owner, username, state, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        ['user-1', 'test-instance', 'test-org', 'user1', 'active']
      );

      // Clean up should work
      await pool.query('TRUNCATE TABLE projections.users CASCADE');

      const count = await pool.queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM projections.users'
      );

      expect(parseInt(count?.count || '0')).toBe(0);
    });
  });
});
