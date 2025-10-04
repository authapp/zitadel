/**
 * Integration Test Setup
 * 
 * Provides utilities for setting up integration test environment:
 * - Database connection and schema
 * - Test data cleanup
 * - Service initialization
 */

import { Pool, PoolClient } from 'pg';

/**
 * Test database configuration
 */
export const TEST_DB_CONFIG = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5433'),
  database: process.env.TEST_DB_NAME || 'zitadel_test',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'postgres',
};

/**
 * Global test database pool
 */
let testPool: Pool | null = null;

/**
 * Create and initialize test database
 */
export async function createTestDatabase(): Promise<Pool> {
  if (testPool) {
    return testPool;
  }

  testPool = new Pool(TEST_DB_CONFIG);

  // Test connection
  try {
    await testPool.query('SELECT 1');
    console.log('✅ Test database connected');
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error);
    throw new Error(
      `Cannot connect to test database. Make sure PostgreSQL is running on ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port}`
    );
  }

  // Initialize schema
  await initializeSchema(testPool);

  return testPool;
}

/**
 * Initialize database schema for tests
 */
async function initializeSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        state INTEGER DEFAULT 1,
        mfa_enabled BOOLEAN DEFAULT FALSE,
        org_id TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        metadata JSONB
      )
    `);

    // Organizations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        domain TEXT UNIQUE,
        state INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        changed_at TIMESTAMP DEFAULT NOW(),
        sequence INTEGER DEFAULT 0
      )
    `);

    // Projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        resource_owner TEXT NOT NULL,
        state INTEGER DEFAULT 1,
        project_role_assertion BOOLEAN DEFAULT FALSE,
        project_role_check BOOLEAN DEFAULT FALSE,
        has_project_check BOOLEAN DEFAULT FALSE,
        private_labeling_setting INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        changed_at TIMESTAMP DEFAULT NOW(),
        sequence INTEGER DEFAULT 0
      )
    `);

    // Applications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        client_id TEXT UNIQUE,
        client_secret TEXT,
        redirect_uris TEXT[],
        post_logout_redirect_uris TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        metadata JSONB
      )
    `);

    // Events table (event sourcing)
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        aggregate_type TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_data JSONB NOT NULL,
        sequence INTEGER NOT NULL,
        editor_user TEXT,
        resource_owner TEXT,
        instance_id TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(aggregate_type, aggregate_id, sequence)
      )
    `);

    // Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        last_activity_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL,
        metadata JSONB
      )
    `);

    // Roles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        scope_id TEXT,
        granted_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, role_id)
      )
    `);

    // Org members table
    await client.query(`
      CREATE TABLE IF NOT EXISTS org_members (
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        roles TEXT[],
        joined_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (org_id, user_id)
      )
    `);

    // Audit logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT NOW(),
        user_id TEXT,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        resource_id TEXT,
        details JSONB,
        ip_address TEXT,
        user_agent TEXT
      )
    `);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events(aggregate_type, aggregate_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_projects_resource_owner ON projects(resource_owner)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)');

    await client.query('COMMIT');
    console.log('✅ Test database schema initialized');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to initialize schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Clean all test data from database
 */
export async function cleanDatabase(pool: Pool): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Delete in correct order (respect foreign keys)
    await client.query('TRUNCATE TABLE audit_logs CASCADE');
    await client.query('TRUNCATE TABLE org_members CASCADE');
    await client.query('TRUNCATE TABLE user_roles CASCADE');
    await client.query('TRUNCATE TABLE sessions CASCADE');
    await client.query('TRUNCATE TABLE events CASCADE');
    await client.query('TRUNCATE TABLE applications CASCADE');
    await client.query('TRUNCATE TABLE projects CASCADE');
    await client.query('TRUNCATE TABLE organizations CASCADE');
    await client.query('TRUNCATE TABLE users CASCADE');
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to clean database:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close test database connection
 */
export async function closeTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
    console.log('✅ Test database connection closed');
  }
}

/**
 * Get a database client for transactions
 */
export async function getTestClient(pool: Pool): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Execute query with test pool
 */
export async function query<T = any>(
  pool: Pool,
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows;
}

/**
 * Check if database is ready
 */
export async function isDatabaseReady(): Promise<boolean> {
  try {
    const pool = new Pool(TEST_DB_CONFIG);
    await pool.query('SELECT 1');
    await pool.end();
    return true;
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
