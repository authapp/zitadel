#!/bin/bash
# Reset Test Database - Simple Shell Script

set -e

echo "🔄 Resetting test database..."
echo ""

# Database config
DB_HOST="${TEST_DB_HOST:-localhost}"
DB_PORT="${TEST_DB_PORT:-5433}"
DB_NAME="${TEST_DB_NAME:-zitadel_test}"
DB_USER="${TEST_DB_USER:-postgres}"

export PGPASSWORD="${TEST_DB_PASSWORD:-postgres}"

echo "📍 Database: $DB_NAME"
echo "📍 Host: $DB_HOST:$DB_PORT"
echo ""

echo "🗑️  Step 1: Dropping projections schema..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA IF EXISTS projections CASCADE;" 2>/dev/null || echo "   (schema didn't exist)"

echo "🗑️  Step 2: Dropping all public tables..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;
EOF

echo "   ✅ All schemas and tables dropped"
echo ""

echo "📥 Step 3: Loading clean schema..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f src/lib/database/schema/01_infrastructure.sql > /dev/null
echo "   ✅ 01_infrastructure.sql loaded"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f src/lib/database/schema/02_projections.sql > /dev/null
echo "   ✅ 02_projections.sql loaded"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f src/lib/database/schema/03_indexes.sql > /dev/null
echo "   ✅ 03_indexes.sql loaded"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f src/lib/database/schema/04_constraints.sql > /dev/null
echo "   ✅ 04_constraints.sql loaded"

echo ""
echo "🔍 Step 4: Verifying setup..."

# Count tables
PUBLIC_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
PROJ_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'projections';")

echo "   ✅ Public schema: $PUBLIC_COUNT tables"
echo "   ✅ Projections schema: $PROJ_COUNT tables"

echo ""
echo "✅ Test database reset complete!"
echo ""
echo "📊 Database is now fresh with:"
echo "   - Clean schema (no migration tracking)"
echo "   - All tables created"
echo "   - Ready for integration tests"
echo ""
echo "🚀 Run: npm run test:integration"
echo ""
