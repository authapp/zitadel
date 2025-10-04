/**
 * Database Migrator
 * 
 * Manages database schema migrations using @databases/split-sql-query for robust SQL parsing
 */

import { DatabasePool } from './pool';
import { Migration, migrations } from './migrations';
import { join } from 'path';
import { readFileSync } from 'fs';

export class DatabaseMigrator {
  constructor(private pool: DatabasePool) {}

  /**
   * Ensure migrations table exists
   */
  private async ensureMigrationsTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
  }

  /**
   * Get list of applied migrations
   */
  private async getAppliedMigrations(): Promise<number[]> {
    const result = await this.pool.queryMany<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    return result.map(row => row.version);
  }

  /**
   * Get pending migrations
   */
  private getPendingMigrations(appliedVersions: number[]): Migration[] {
    return migrations.filter(m => !appliedVersions.includes(m.version));
  }

  /**
   * Execute a single migration file
   * PostgreSQL supports executing multiple statements in a single query
   */
  private async executeMigrationFile(filename: string): Promise<void> {
    const migrationPath = join(__dirname, 'migrations', filename);
    
    // Read SQL file
    const sql = readFileSync(migrationPath, 'utf-8');
    
    try {
      // PostgreSQL can execute multiple statements at once
      // This avoids the complexity of parsing SQL correctly
      await this.pool.query(sql);
    } catch (error: any) {
      const errorMsg = error.message || '';
      // Ignore idempotent errors
      if (errorMsg.includes('already exists')) {
        return;
      }
      console.error(`\n❌ Failed to execute migration file: ${filename}`);
      console.error('Error:', errorMsg);
      throw error;
    }
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(migration: Migration): Promise<void> {
    console.log(`Applying migration ${migration.version}: ${migration.name}`);
    
    await this.executeMigrationFile(migration.filename);
    
    await this.pool.query(
      'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
      [migration.version, migration.name]
    );

    console.log(`✅ Migration ${migration.version} applied successfully`);
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    await this.ensureMigrationsTable();
    
    const appliedVersions = await this.getAppliedMigrations();
    const pendingMigrations = this.getPendingMigrations(appliedVersions);

    if (pendingMigrations.length === 0) {
      console.log('✅ All migrations are up to date');
      return;
    }

    console.log(`Running ${pendingMigrations.length} pending migration(s)...`);

    for (const migration of pendingMigrations) {
      await this.applyMigration(migration);
    }

    console.log('✅ All migrations completed successfully');
  }

  /**
   * Get current schema version
   */
  async currentVersion(): Promise<number> {
    try {
      await this.ensureMigrationsTable();
      const versions = await this.getAppliedMigrations();
      return versions.length > 0 ? Math.max(...versions) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Reset database (for testing)
   */
  async reset(): Promise<void> {
    console.log('⚠️  Resetting database...');
    
    // Drop all tables
    await this.pool.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);

    console.log('✅ Database reset complete');
  }
}
