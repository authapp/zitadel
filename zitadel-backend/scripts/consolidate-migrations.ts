#!/usr/bin/env ts-node
/**
 * Migration Consolidation Script
 * Reads all existing migrations and creates consolidated versions
 */

import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = 'src/lib/database/migrations';
const OUTPUT_DIR = 'src/lib/database/migrations/consolidated';

interface MigrationFile {
  filename: string;
  content: string;
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('🚀 Migration Consolidation Script');
console.log('==================================\n');

// Read all migration files
const files = fs.readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`📁 Found ${files.length} migration files\n`);

const migrations: MigrationFile[] = files.map(filename => ({
  filename,
  content: fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8')
}));

// Categorize migrations
const core: string[] = [];
const projections: string[] = [];
const indexes: string[] = [];
const constraints: string[] = [];

console.log('📝 Categorizing migrations...\n');

for (const migration of migrations) {
  const { filename, content } = migration;
  
  // Core infrastructure (events, projection states, etc)
  if (
    filename.startsWith('001_') ||
    filename.includes('projection_states') ||
    filename.includes('projection_locks') ||
    filename.includes('projection_failed') ||
    filename.includes('unique_constraints') ||
    filename.includes('encryption_keys')
  ) {
    core.push(`-- From: ${filename}\n${content}\n`);
    console.log(`  ✓ Core: ${filename}`);
  }
  // Indexes
  else if (
    filename.includes('_index') ||
    filename.includes('_indexes') ||
    content.toLowerCase().includes('create index') ||
    content.toLowerCase().includes('create unique index')
  ) {
    indexes.push(`-- From: ${filename}\n${content}\n`);
    console.log(`  ✓ Index: ${filename}`);
  }
  // Constraints and FK fixes
  else if (
    filename.includes('constraint') ||
    filename.includes('_fk_') ||
    content.toLowerCase().includes('add constraint') ||
    content.toLowerCase().includes('foreign key')
  ) {
    constraints.push(`-- From: ${filename}\n${content}\n`);
    console.log(`  ✓ Constraint: ${filename}`);
  }
  // Projection tables
  else {
    projections.push(`-- From: ${filename}\n${content}\n`);
    console.log(`  ✓ Projection: ${filename}`);
  }
}

console.log('\n📦 Writing consolidated files...\n');

// Write consolidated migration files
fs.writeFileSync(
  path.join(OUTPUT_DIR, '001_core_infrastructure.sql'),
  `-- Consolidated Migration 001: Core Infrastructure
-- Generated: ${new Date().toISOString()}
-- Source: 68 original migrations consolidated
--
-- This migration creates:
-- - Event store (events table with all indexes)
-- - Projection infrastructure (states, locks, failed events)
-- - Utility tables (unique_constraints, encryption_keys)

${core.join('\n')}
`
);

fs.writeFileSync(
  path.join(OUTPUT_DIR, '002_projections_tables.sql'),
  `-- Consolidated Migration 002: Projection Tables
-- Generated: ${new Date().toISOString()}
-- Source: 68 original migrations consolidated
--
-- This migration creates all projection tables with:
-- - Proper multi-tenant isolation (instance_id in all PKs)
-- - Schema: projections.*
-- - All user, org, project, instance, session, policy, and auth tables

-- Create projections schema
CREATE SCHEMA IF NOT EXISTS projections;

${projections.join('\n')}
`
);

fs.writeFileSync(
  path.join(OUTPUT_DIR, '003_indexes.sql'),
  `-- Consolidated Migration 003: Indexes
-- Generated: ${new Date().toISOString()}
-- Source: 68 original migrations consolidated
--
-- This migration creates all indexes for:
-- - Fast querying
-- - Multi-tenant isolation
-- - Performance optimization

${indexes.join('\n')}
`
);

fs.writeFileSync(
  path.join(OUTPUT_DIR, '004_constraints.sql'),
  `-- Consolidated Migration 004: Constraints
-- Generated: ${new Date().toISOString()}
-- Source: 68 original migrations consolidated
--
-- This migration creates:
-- - Foreign key constraints
-- - Check constraints
-- - Other table constraints

${constraints.join('\n')}
`
);

console.log('  ✓ 001_core_infrastructure.sql');
console.log('  ✓ 002_projections_tables.sql');
console.log('  ✓ 003_indexes.sql');
console.log('  ✓ 004_constraints.sql');

console.log('\n📊 Summary:');
console.log(`  Core migrations: ${core.length}`);
console.log(`  Projection tables: ${projections.length}`);
console.log(`  Indexes: ${indexes.length}`);
console.log(`  Constraints: ${constraints.length}`);
console.log(`  Total: ${core.length + projections.length + indexes.length + constraints.length}`);

console.log('\n✅ Consolidation complete!\n');
console.log('📁 Output directory: ' + OUTPUT_DIR);
console.log('\n🧪 Next steps:');
console.log('  1. Review consolidated migration files');
console.log('  2. Create consolidated/index.ts');
console.log('  3. Update migrator to use consolidated migrations');
console.log('  4. Test on fresh database');
console.log('  5. Run integration tests');
