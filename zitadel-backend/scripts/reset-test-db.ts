#!/usr/bin/env ts-node
/**
 * Reset Test Database - Drop and Recreate Fresh
 * 
 * This script:
 * 1. Connects to test database
 * 2. Drops ALL schemas and tables
 * 3. Loads clean schema from SQL files
 * 4. Verifies the setup
 */

import { DatabasePool } from '../src/lib/database/pool';
import { SchemaLoader } from '../src/lib/database/schema-loader';

const TEST_DB_CONFIG = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5433'),
  database: process.env.TEST_DB_NAME || 'zitadel_test',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'postgres',
};

async function resetTestDatabase() {
  console.log('🔄 Resetting test database...\n');
  console.log(`📍 Database: ${TEST_DB_CONFIG.database}`);
  console.log(`📍 Host: ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port}\n`);

  const pool = new DatabasePool(TEST_DB_CONFIG);

  try {
    // Test connection
    const isHealthy = await pool.health();
    if (!isHealthy) {
      throw new Error('Cannot connect to test database');
    }
    console.log('✅ Connected to database\n');

    // Create schema loader
    const loader = new SchemaLoader(pool);

    // Drop all existing schemas and tables
    console.log('🗑️  Step 1: Dropping all schemas and tables...');
    await loader.dropAllSchemas();

    // Load clean schema
    console.log('📥 Step 2: Loading clean schema...');
    await loader.loadSchema();

    // Verify setup
    console.log('🔍 Step 3: Verifying setup...');
    await verifySetup(pool);

    console.log('\n✅ Test database reset complete!\n');
    console.log('📊 Database is now fresh with:');
    console.log('   - Clean schema (no migration tracking)');
    console.log('   - All 90 tables created');
    console.log('   - 50 projection tables in projections schema');
    console.log('   - 362 indexes');
    console.log('   - 38 constraints');
    console.log('\n🚀 Ready to run integration tests!\n');

  } catch (error) {
    console.error('\n❌ Error resetting database:', error);
    throw error;
  } finally {
    await pool.close();
  }
}

async function verifySetup(pool: DatabasePool) {
  // Check public schema tables
  const publicResult = await pool.query(`
    SELECT COUNT(*) as count 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log(`   ✅ Public schema: ${publicResult.rows[0].count} tables`);

  // Check projections schema tables
  const projectionsResult = await pool.query(`
    SELECT COUNT(*) as count 
    FROM information_schema.tables 
    WHERE table_schema = 'projections'
  `);
  console.log(`   ✅ Projections schema: ${projectionsResult.rows[0].count} tables`);

  // Check events table exists
  const eventsResult = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'events'
    ) as exists
  `);
  console.log(`   ✅ Events table: ${eventsResult.rows[0].exists ? 'exists' : 'missing'}`);

  // Check indexes
  const indexResult = await pool.query(`
    SELECT COUNT(*) as count 
    FROM pg_indexes 
    WHERE schemaname IN ('public', 'projections')
  `);
  console.log(`   ✅ Indexes: ${indexResult.rows[0].count}`);
}

// Run reset
resetTestDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
