#!/bin/bash
# Migration Consolidation Script
# Dumps current schema and creates consolidated migration files

set -e

echo "🚀 Migration Consolidation Script"
echo "=================================="
echo ""

# Configuration
DB_NAME=${DB_NAME:-"zitadel_test"}
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}
DB_USER=${DB_USER:-"postgres"}
OUTPUT_DIR="src/lib/database/migrations/consolidated"

echo "📋 Configuration:"
echo "   Database: $DB_NAME"
echo "   Host: $DB_HOST:$DB_PORT"
echo "   User: $DB_USER"
echo "   Output: $OUTPUT_DIR"
echo ""

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo "❌ Error: pg_dump not found. Please install PostgreSQL client tools."
    exit 1
fi

echo "🔍 Step 1: Dumping current schema..."
pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  --format=plain \
  --dbname=$DB_NAME \
  --host=$DB_HOST \
  --port=$DB_PORT \
  --username=$DB_USER \
  > /tmp/zitadel_full_schema.sql

echo "✅ Schema dumped to /tmp/zitadel_full_schema.sql"
echo ""

echo "📝 Step 2: Creating consolidated migration files..."
echo "   This will create 4 consolidated files:"
echo "   - 001_core_infrastructure.sql"
echo "   - 002_projections_tables.sql"
echo "   - 003_indexes.sql"
echo "   - 004_constraints.sql"
echo ""

# Create a Node.js script to parse and organize the SQL
cat > /tmp/organize_schema.js << 'EOF'
const fs = require('fs');

const schema = fs.readFileSync('/tmp/zitadel_full_schema.sql', 'utf8');
const lines = schema.split('\n');

let core = [];
let projections = [];
let indexes = [];
let constraints = [];

let currentSection = null;
let currentStatement = [];

for (const line of lines) {
  // Skip comments and empty lines at start
  if (line.startsWith('--') || line.trim() === '') {
    continue;
  }
  
  currentStatement.push(line);
  
  // Check if statement is complete (ends with semicolon)
  if (line.trim().endsWith(';')) {
    const statement = currentStatement.join('\n');
    
    // Categorize the statement
    if (statement.includes('CREATE TABLE events') || 
        statement.includes('CREATE TABLE unique_constraints') ||
        statement.includes('CREATE TABLE projection_states') ||
        statement.includes('CREATE TABLE projection_locks') ||
        statement.includes('CREATE TABLE projection_failed_events') ||
        statement.includes('CREATE TABLE encryption_keys')) {
      core.push(statement);
    } else if (statement.includes('CREATE INDEX') || 
               statement.includes('CREATE UNIQUE INDEX')) {
      indexes.push(statement);
    } else if (statement.includes('ALTER TABLE') && 
               (statement.includes('ADD CONSTRAINT') || 
                statement.includes('ADD FOREIGN KEY'))) {
      constraints.push(statement);
    } else if (statement.includes('CREATE TABLE') || 
               statement.includes('CREATE SCHEMA')) {
      projections.push(statement);
    }
    
    currentStatement = [];
  }
}

// Write consolidated files
const outputDir = 'src/lib/database/migrations/consolidated';

fs.writeFileSync(`${outputDir}/001_core_infrastructure.sql`, 
  '-- Consolidated Migration 001: Core Infrastructure\n' +
  '-- Event store, projection infrastructure, and utility tables\n\n' +
  core.join('\n\n') + '\n'
);

fs.writeFileSync(`${outputDir}/002_projections_tables.sql`,
  '-- Consolidated Migration 002: Projection Tables\n' +
  '-- All projection tables with proper multi-tenant isolation\n\n' +
  projections.join('\n\n') + '\n'
);

fs.writeFileSync(`${outputDir}/003_indexes.sql`,
  '-- Consolidated Migration 003: Indexes\n' +
  '-- All indexes for optimal query performance\n\n' +
  indexes.join('\n\n') + '\n'
);

fs.writeFileSync(`${outputDir}/004_constraints.sql`,
  '-- Consolidated Migration 004: Constraints\n' +
  '-- Foreign keys and other constraints\n\n' +
  constraints.join('\n\n') + '\n'
);

console.log('✅ Consolidated migration files created');
EOF

node /tmp/organize_schema.js

echo ""
echo "✅ Consolidated migrations created successfully!"
echo ""
echo "📁 Files created:"
ls -lh $OUTPUT_DIR/*.sql
echo ""
echo "🧪 Next steps:"
echo "   1. Review the consolidated migration files"
echo "   2. Create consolidated/index.ts"
echo "   3. Test on a fresh database"
echo "   4. Run integration tests"
echo ""
