/**
 * Clean Schema Loader
 * 
 * Loads the final database schema from clean SQL files
 * WITHOUT migration tracking or versioning.
 */

import { DatabasePool } from './pool';
import { readFileSync } from 'fs';
import { join } from 'path';

export class SchemaLoader {
  constructor(private pool: DatabasePool) {}

  /**
   * Load the complete database schema from clean SQL files
   * This replaces the migration system with direct schema loading
   */
  async loadSchema(): Promise<void> {
    console.log('🏗️  Loading clean database schema...\n');

    const schemaDir = join(__dirname, 'schema');
    const files = [
      '01_infrastructure.sql',
      '02_projections.sql',
      '03_indexes.sql',
      '04_constraints.sql'
    ];

    for (const file of files) {
      const filePath = join(schemaDir, file);
      const sql = readFileSync(filePath, 'utf8');
      
      console.log(`📄 Loading ${file}...`);
      
      try {
        await this.pool.query(sql);
        console.log(`   ✅ ${file} loaded successfully`);
      } catch (error: any) {
        console.error(`   ❌ Error loading ${file}:`, error.message);
        throw error;
      }
    }

    console.log('\n✅ Schema loaded successfully!\n');
  }

  /**
   * Check if schema is already loaded
   */
  async isSchemaLoaded(): Promise<boolean> {
    try {
      const result = await this.pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'events'
        ) as exists
      `);
      return result.rows[0]?.exists || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Drop all schemas and start fresh
   * WARNING: This deletes ALL data!
   */
  async dropAllSchemas(): Promise<void> {
    console.log('🗑️  Dropping all schemas...');
    
    // Drop projections schema (cascade removes all tables)
    await this.pool.query('DROP SCHEMA IF EXISTS projections CASCADE');
    console.log('   ✅ Dropped projections schema');
    
    // Drop all tables in public schema
    await this.pool.query(`
      DO $$ 
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
              EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
      END $$;
    `);
    console.log('   ✅ Dropped all public tables');
    
    console.log('✅ All schemas dropped\n');
  }
}

/**
 * Helper function to load schema into a pool
 */
export async function loadCleanSchema(pool: DatabasePool, dropExisting = false): Promise<void> {
  const loader = new SchemaLoader(pool);
  
  if (dropExisting) {
    await loader.dropAllSchemas();
  }
  
  const isLoaded = await loader.isSchemaLoaded();
  if (isLoaded && !dropExisting) {
    console.log('ℹ️  Schema already loaded, skipping...\n');
    return;
  }
  
  await loader.loadSchema();
}
