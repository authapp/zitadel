#!/usr/bin/env ts-node
/**
 * Export Clean Schema SQL
 * 
 * This script connects to the database and exports the schema as clean SQL files
 * WITHOUT migration tracking - just the final state.
 */

import { DatabasePool } from '../src/lib/database/pool';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = 'src/lib/database/schema';

async function exportSchema() {
  const pool = new DatabasePool({
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433'),
    database: process.env.TEST_DB_NAME || 'zitadel_test',
    user: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'postgres'
  });

  try {
    console.log('🔄 Exporting schema from database...\n');

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Export table definitions for projections schema
    await exportProjectionsTables(pool);
    
    // Export indexes
    await exportIndexes(pool);
    
    // Export constraints
    await exportConstraints(pool);

    console.log('\n✅ Schema export complete!');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    await pool.close();
  }
}

async function exportProjectionsTables(pool: DatabasePool) {
  console.log('📊 Exporting projections schema tables...');
  
  const result = await pool.query<{ tablename: string }>(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'projections'
    ORDER BY tablename
  `);

  const tables = result.rows.map(r => r.tablename);
  console.log(`   Found ${tables.length} projection tables`);

  let sql = `-- =============================================================================
-- ZITADEL Backend - Projections Schema
-- =============================================================================
-- Description: All CQRS read-model projections
-- Schema: projections
-- Tables: ${tables.length} projection tables
-- =============================================================================

-- Create projections schema
CREATE SCHEMA IF NOT EXISTS projections;

COMMENT ON SCHEMA projections IS 'CQRS read model projections - query-side tables built from events';

`;

  // Get CREATE TABLE statement for each table
  for (const table of tables) {
    console.log(`   - ${table}`);
    
    const columnsResult = await pool.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'projections' AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    sql += `-- Table: projections.${table}\n`;
    sql += `CREATE TABLE IF NOT EXISTS projections.${table} (\n`;
    
    const columns = columnsResult.rows;
    columns.forEach((col: any, idx: number) => {
      let colDef = `    ${col.column_name} ${col.data_type}`;
      
      if (col.character_maximum_length) {
        colDef += `(${col.character_maximum_length})`;
      }
      
      if (col.is_nullable === 'NO') {
        colDef += ' NOT NULL';
      }
      
      if (col.column_default) {
        colDef += ` DEFAULT ${col.column_default}`;
      }
      
      if (idx < columns.length - 1) {
        colDef += ',';
      }
      
      sql += colDef + '\n';
    });
    
    sql += `);\n\n`;
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, '02_projections.sql'), sql);
  console.log(`   ✅ Written to 02_projections.sql`);
}

async function exportIndexes(pool: DatabasePool) {
  console.log('\n📇 Exporting indexes...');
  
  const result = await pool.query(`
    SELECT
      schemaname,
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname IN ('public', 'projections')
      AND indexname NOT LIKE '%_pkey'
    ORDER BY schemaname, tablename, indexname
  `);

  let sql = `-- =============================================================================
-- ZITADEL Backend - Indexes
-- =============================================================================
-- Description: All performance indexes for events and projections
-- =============================================================================

`;

  result.rows.forEach((row: any) => {
    sql += `-- Index: ${row.indexname} on ${row.schemaname}.${row.tablename}\n`;
    sql += `${row.indexdef};\n\n`;
  });

  fs.writeFileSync(path.join(OUTPUT_DIR, '03_indexes.sql'), sql);
  console.log(`   ✅ Found ${result.rows.length} indexes`);
  console.log(`   ✅ Written to 03_indexes.sql`);
}

async function exportConstraints(pool: DatabasePool) {
  console.log('\n🔗 Exporting constraints...');
  
  const result = await pool.query(`
    SELECT
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type,
      pg_get_constraintdef(c.oid) as constraint_def
    FROM information_schema.table_constraints tc
    JOIN pg_constraint c ON c.conname = tc.constraint_name
    WHERE tc.table_schema IN ('public', 'projections')
      AND tc.constraint_type IN ('FOREIGN KEY', 'CHECK', 'UNIQUE')
    ORDER BY tc.table_schema, tc.table_name, tc.constraint_name
  `);

  let sql = `-- =============================================================================
-- ZITADEL Backend - Constraints
-- =============================================================================
-- Description: All foreign keys, checks, and unique constraints
-- =============================================================================

`;

  result.rows.forEach((row: any) => {
    sql += `-- ${row.constraint_type}: ${row.constraint_name} on ${row.table_schema}.${row.table_name}\n`;
    sql += `ALTER TABLE ${row.table_schema}.${row.table_name}\n`;
    sql += `  ADD CONSTRAINT ${row.constraint_name} ${row.constraint_def};\n\n`;
  });

  fs.writeFileSync(path.join(OUTPUT_DIR, '04_constraints.sql'), sql);
  console.log(`   ✅ Found ${result.rows.length} constraints`);
  console.log(`   ✅ Written to 04_constraints.sql`);
}

// Run export
exportSchema().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
