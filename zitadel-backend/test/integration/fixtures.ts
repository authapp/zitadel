/**
 * Test Fixtures and Data Factories
 * 
 * Provides utilities for creating test data
 */

import { DatabasePool } from '../../src/lib/database';
import { generateId as generateSnowflakeId } from '../../src/lib/id/snowflake';
import { PasswordHasher } from '../../src/lib/crypto/hash';
import { UserState } from '../../src/lib/domain/user';
import { Organization, OrgState } from '../../src/lib/domain/organization';
import { Project, ProjectState } from '../../src/lib/domain/project';

const hasher = new PasswordHasher();

/**
 * User factory
 */
export interface CreateUserOptions {
  id?: string;
  username?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  state?: UserState;
  mfaEnabled?: boolean;
  orgId?: string;
  metadata?: Record<string, any>;
}

export async function createTestUser(
  pool: DatabasePool,
  options: CreateUserOptions = {}
): Promise<any> {
  const id = options.id || generateSnowflakeId();
  const username = options.username || `testuser_${Date.now()}`;
  const email = options.email || `${username}@test.com`;
  const password = options.password || 'TestPassword123!';
  const passwordHash = await hasher.hash(password);

  // Convert numeric state to string for DB
  let stateString = 'active';
  if (options.state === UserState.INACTIVE) {
    stateString = 'inactive';
  } else if (options.state === UserState.DELETED) {
    stateString = 'deleted';
  } else if (options.state === UserState.LOCKED) {
    stateString = 'locked';
  }

  // Insert into database
  await pool.query(
    `INSERT INTO users_projection (
      id, username, email, password_hash, first_name, last_name,
      phone, state, mfa_enabled, instance_id, resource_owner, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
    [
      id,
      username,
      email,
      passwordHash,
      options.firstName || 'Test',
      options.lastName || 'User',
      options.phone || null,
      stateString,
      options.mfaEnabled ?? false,
      'test-instance',
      options.orgId || 'test-org',
    ]
  );

  return {
    id,
    username,
    email,
    firstName: options.firstName || 'Test',
    lastName: options.lastName || 'User',
    phone: options.phone,
    state: options.state ?? UserState.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: options.metadata,
  };
}

/**
 * Organization factory
 */
export interface CreateOrgOptions {
  id?: string;
  name?: string;
  domain?: string;
  state?: OrgState;
}

export async function createTestOrg(
  pool: DatabasePool,
  options: CreateOrgOptions = {}
): Promise<Organization> {
  const id = options.id || generateSnowflakeId();
  const name = options.name || `Test Org ${Date.now()}`;

  await pool.query(
    `INSERT INTO organizations_projection (id, name, domain, instance_id, state, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    [
      id,
      name,
      options.domain || null,
      'test-instance',  // instance_id
      options.state ?? OrgState.ACTIVE,
    ]
  );

  return {
    id,
    name,
    primaryDomain: options.domain,
    state: options.state ?? OrgState.ACTIVE,
    createdAt: new Date(),
    changedAt: new Date(),
    sequence: 0,
  };
}

/**
 * Project factory
 */
export interface CreateProjectOptions {
  id?: string;
  name?: string;
  orgId: string;
  state?: ProjectState;
}

export async function createTestProject(
  pool: DatabasePool,
  options: CreateProjectOptions
): Promise<Project> {
  const id = options.id || generateSnowflakeId();
  const name = options.name || `Test Project ${Date.now()}`;

  await pool.query(
    `INSERT INTO projects_projection (
      id, name, resource_owner, instance_id, state, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    [
      id,
      name,
      options.orgId,
      'test-instance',  // instance_id
      options.state ?? ProjectState.ACTIVE,
    ]
  );

  return {
    id,
    name,
    resourceOwner: options.orgId,
    state: options.state ?? ProjectState.ACTIVE,
    projectRoleAssertion: false,
    projectRoleCheck: false,
    hasProjectCheck: false,
    privateLabelingSetting: 0,
    createdAt: new Date(),
    changedAt: new Date(),
    sequence: 0,
  };
}

/**
 * Application factory
 */
export interface CreateAppOptions {
  id?: string;
  projectId: string;
  name?: string;
  type: 'web' | 'native' | 'api';
  redirectUris?: string[];
}

export async function createTestApplication(
  pool: DatabasePool,
  options: CreateAppOptions
): Promise<any> {
  const id = options.id || generateSnowflakeId();
  const name = options.name || `Test App ${Date.now()}`;
  const clientId = generateSnowflakeId();
  const clientSecret = generateSnowflakeId();

  await pool.query(
    `INSERT INTO applications (
      id, project_id, name, type, client_id, client_secret, redirect_uris
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      options.projectId,
      name,
      options.type,
      clientId,
      clientSecret,
      options.redirectUris || [],
    ]
  );

  return {
    id,
    projectId: options.projectId,
    name,
    type: options.type,
    clientId,
    clientSecret,
    redirectUris: options.redirectUris || [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Session factory
 */
export interface CreateSessionOptions {
  id?: string;
  userId: string;
  instanceId?: string;
  expiresInMinutes?: number;
}

export async function createTestSession(
  pool: DatabasePool,
  options: CreateSessionOptions
): Promise<any> {
  const id = options.id || generateSnowflakeId();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + (options.expiresInMinutes || 60));

  await pool.query(
    `INSERT INTO sessions (id, user_id, instance_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [
      id,
      options.userId,
      options.instanceId || 'test-instance',
      expiresAt,
    ]
  );

  return {
    id,
    userId: options.userId,
    instanceId: options.instanceId || 'test-instance',
    createdAt: new Date(),
    lastActivityAt: new Date(),
    expiresAt,
  };
}

/**
 * Event factory
 */
export interface CreateEventOptions {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  eventData: any;
  sequence?: number;
  editorUser?: string;
}

export async function createTestEvent(
  pool: DatabasePool,
  options: CreateEventOptions
): Promise<any> {
  const result = await pool.query(
    `INSERT INTO events (
      aggregate_type, aggregate_id, event_type, event_data,
      sequence, editor_user
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id`,
    [
      options.aggregateType,
      options.aggregateId,
      options.eventType,
      JSON.stringify(options.eventData),
      options.sequence || 0,
      options.editorUser || 'system',
    ]
  );

  return {
    id: result.rows[0].id,
    ...options,
    createdAt: new Date(),
  };
}

/**
 * Assign role to user
 */
export async function assignTestRole(
  pool: DatabasePool,
  userId: string,
  roleId: string,
  scopeId?: string
): Promise<void> {
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id, scope_id)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [userId, roleId, scopeId || null]
  );
}

/**
 * Add user to organization
 */
export async function addTestOrgMember(
  pool: DatabasePool,
  orgId: string,
  userId: string,
  roles: string[] = []
): Promise<void> {
  await pool.query(
    `INSERT INTO org_members (org_id, user_id, roles)
     VALUES ($1, $2, $3)
     ON CONFLICT (org_id, user_id) DO UPDATE SET roles = $3`,
    [orgId, userId, roles]
  );
}

/**
 * Get user from database
 */
export async function getTestUser(pool: DatabasePool, userId: string): Promise<any | null> {
  const result = await pool.query(
    'SELECT * FROM users_projection WHERE id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    state: row.state,
    orgId: row.resource_owner,
    org_id: row.resource_owner,  // Also include snake_case version
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata,
  };
}

/**
 * Get events for aggregate
 */
export async function getTestEvents(
  pool: DatabasePool,
  aggregateType: string,
  aggregateId: string
): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM events 
     WHERE aggregate_type = $1 AND aggregate_id = $2
     ORDER BY sequence ASC`,
    [aggregateType, aggregateId]
  );
  
  return result.rows.map(row => ({
    id: row.id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    eventData: row.event_data,
    sequence: row.sequence,
    editorUser: row.editor_user,
    createdAt: row.created_at,
  }));
}
