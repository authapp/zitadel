/**
 * Integration Test Setup (Production Ready)
 * 
 * ARCHITECTURE OVERVIEW:
 * ----------------------
 * This test suite uses actual production code:
 * - DatabasePool: Connection management
 * - DatabaseMigrator: Schema management (24 migrations)
 * - Repositories: Data access layer (read-side)
 * - Commands: Business logic (write-side) [available via createUserViaCommand]
 * 
 * CQRS + EVENT SOURCING PATTERN:
 * ------------------------------
 * Write Side (Commands):
 *   User Action → Command → Event Store → Projection Manager → Read Model
 * 
 * Read Side (Queries):
 *   User Query → Repository → Database → Result
 * 
 * TEST DATA APPROACHES:
 * --------------------
 * 1. Repository-based (fixtures.ts - createTestUser):
 *    - Fast, direct DB writes for test setup
 *    - Bypasses events and business rules
 *    - Use for: General test data setup
 * 
 * 2. Command-based (fixtures.ts - createUserViaCommand):
 *    - Full CQRS flow with events
 *    - Enforces business rules and validation
 *    - Use for: Testing the command layer itself
 */

import { DatabasePool, DatabaseConfig } from '../../src/lib/database';
import { DatabaseMigrator } from '../../src/lib/database/migrator';
import type { QueryResultRow } from 'pg';

/**
 * Test database configuration
 */
export const TEST_DB_CONFIG: DatabaseConfig = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5433'),
  database: process.env.TEST_DB_NAME || 'zitadel_test',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'postgres',
  ssl: false,
  poolMin: 2,
  poolMax: 10,
};

/**
 * Global test database pool (using source code DatabasePool class)
 */
let testPool: DatabasePool | null = null;

/**
 * Create and initialize test database using source code modules
 * Always provides a clean database with fresh schema and no data
 */
export async function createTestDatabase(): Promise<DatabasePool> {
  if (testPool) {
    // Clean all data from existing pool to provide fresh state
    await cleanDatabase(testPool);
    return testPool;
  }

  // Use the actual DatabasePool class from source code
  testPool = new DatabasePool(TEST_DB_CONFIG);

  // Test connection using the health() method from source code
  const isHealthy = await testPool.health();
  if (!isHealthy) {
    throw new Error(
      `Cannot connect to test database. Make sure PostgreSQL is running on ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port}`
    );
  }

  console.log('✅ Test database connected (using DatabasePool from source code)');

  // Initialize schema using DatabaseMigrator
  await initializeSchemaWithMigrator(testPool);
  
  // Clean any existing data to ensure fresh start
  await cleanDatabase(testPool);

  return testPool;
}

/**
 * Initialize database schema using DatabaseMigrator from source code
 * 
 * Uses the production migration system to create all tables, indexes, and constraints
 */
async function initializeSchemaWithMigrator(pool: DatabasePool): Promise<void> {
  try {
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();

    console.log('✅ Test database schema initialized using DatabaseMigrator');
  } catch (error) {
    console.error('❌ Failed to initialize schema:', error);
    throw error;
  }
}


/**
 * Clean all test data from database
 * Truncates only tables that exist in the migration system
 * Always provides a completely fresh database state
 */
export async function cleanDatabase(pool: DatabasePool): Promise<void> {
  const tables = [
    'projections.users',  // FIXED: Correct schema.table format
    'projections.orgs',
    'projections.org_domains',
    'projections.projects',
    'projections.project_roles',
    'projections.applications',
    'projections.instances',
    'projections.instance_domains',
    'projections.instance_trusted_domains',
    'projections.sessions',
    'projections.login_names',
    'projection_states',
    'projection_failed_events',
    'projection_locks',  // Critical for projection tests
    'unique_constraints',
    'events', // Events table MUST be cleaned
    'projections.targets', // Sprint 4.2 tables
    'projections.executions', // Sprint 4.2 tables
    'projections.saml_requests', // SAML tables
    'projections.saml_sessions', // SAML tables
  ];

  for (const table of tables) {
    try {
      await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
    } catch (error: any) {
      // Only ignore if table doesn't exist, otherwise throw
      const errorMsg = error?.message || '';
      const parentMsg = error?.parent?.message || '';
      const causeMsg = error?.cause?.message || '';
      
      const combinedMsg = `${errorMsg} ${parentMsg} ${causeMsg}`.toLowerCase();
      
      if (!combinedMsg.includes('does not exist')) {
        console.error(`Failed to truncate ${table}:`, errorMsg, parentMsg);
        throw error;
      }
      // Table doesn't exist yet, skip silently
    }
  }
}

/**
 * Close test database connection using DatabasePool.close()
 */
export async function closeTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.close();  // Use source code method
    testPool = null;
    console.log('✅ Test database connection closed');
  }
}


/**
 * Execute query using DatabasePool.queryMany()
 */
export async function query<T extends QueryResultRow = any>(
  pool: DatabasePool,
  text: string,
  params?: any[]
): Promise<T[]> {
  return pool.queryMany<T>(text, params);  // Use source code method
}

/**
 * Execute query and get single result using DatabasePool.queryOne()
 */
export async function queryOne<T extends QueryResultRow = any>(
  pool: DatabasePool,
  text: string,
  params?: any[]
): Promise<T | null> {
  return pool.queryOne<T>(text, params);  // Use source code method
}

/**
 * Check if database is ready
 */
export async function isDatabaseReady(): Promise<boolean> {
  try {
    const pool = new DatabasePool(TEST_DB_CONFIG);
    const isHealthy = await pool.health();  // Use source code method
    await pool.close();
    return isHealthy;
  } catch {
    return false;
  }
}

/**
 * Wait for database to be ready
 */
export async function waitForDatabase(
  maxAttempts: number = 30,
  delayMs: number = 1000
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isDatabaseReady()) {
      console.log('✅ Test database is ready');
      return;
    }
    console.log(`⏳ Waiting for test database... (attempt ${i + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error('Test database did not become ready in time');
}
