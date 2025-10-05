/**
 * Test Fixtures and Data Factories
 * 
 * Provides two approaches for test data:
 * 1. **Repository-based** (createTestUser) - Fast, direct DB access for test setup
 * 2. **Command-based** (createUserViaCommand) - Full CQRS flow for testing commands
 * 
 * Use repository-based fixtures for general test data setup.
 * Use command-based fixtures when specifically testing the command layer.
 */

import { DatabasePool } from '../../src/lib/database';
import { PostgresEventstore } from '../../src/lib/eventstore';
import { InMemoryCommandBus } from '../../src/lib/command';
import { CreateUserCommand, createUserHandler, createUserValidator } from '../../src/lib/command/commands/user';
import { generateId as generateSnowflakeId } from '../../src/lib/id/snowflake';
import { PasswordHasher } from '../../src/lib/crypto/hash';
import { UserState } from '../../src/lib/domain/user';
import { Organization, OrgState } from '../../src/lib/domain/organization';
import { Project, ProjectState } from '../../src/lib/domain/project';
import { UserRepository } from '../../src/lib/repositories/user-repository';

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

/**
 * Create test user via Repository (Fast path for test data setup)
 * 
 * This bypasses the command layer and writes directly to the projection.
 * Use this for setting up test data quickly.
 * 
 * NOTE: This does NOT generate events or go through business rules.
 */
export async function createTestUser(
  pool: DatabasePool,
  options: CreateUserOptions = {}
): Promise<any> {
  const userRepo = new UserRepository(pool);
  
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

  // Use UserRepository to create user in projection
  const userRow = await userRepo.create({
    id,
    instanceId: 'test-instance',
    resourceOwner: options.orgId || 'test-org',
    username,
    email,
    phone: options.phone,
    firstName: options.firstName || 'Test',
    lastName: options.lastName || 'User',
    state: stateString,
    passwordHash,
    mfaEnabled: options.mfaEnabled ?? false,
  });

  return {
    id: userRow.id,
    username: userRow.username,
    email: userRow.email,
    firstName: userRow.first_name,
    lastName: userRow.last_name,
    phone: userRow.phone,
    state: options.state ?? UserState.ACTIVE,
    createdAt: userRow.created_at,
    updatedAt: userRow.updated_at,
    metadata: options.metadata,
  };
}

/**
 * Create user via Command layer (Full CQRS flow)
 * 
 * This uses the command bus and generates events.
 * Use this when specifically testing the command layer.
 * 
 * NOTE: Projections must be manually updated or you need to wait for projection manager.
 */
export async function createUserViaCommand(
  pool: DatabasePool,
  options: CreateUserOptions = {}
): Promise<{ aggregateId: string; event: any }> {
  const eventstore = new PostgresEventstore(pool, {
    instanceID: 'test-instance',
    maxPushBatchSize: 100,
  });
  const commandBus = new InMemoryCommandBus(eventstore);
  
  // Register user command handler
  commandBus.registerHandler(
    'CreateUserCommand',
    createUserHandler,
    createUserValidator
  );
  
  const username = options.username || `testuser_${Date.now()}`;
  const email = options.email || `${username}@test.com`;

  // Create command with context
  const command = new CreateUserCommand(
    username,
    email,
    options.firstName || 'Test',
    options.lastName || 'User',
    {
      instanceId: 'test-instance',
      resourceOwner: options.orgId || 'test-org',
      userId: 'system',
    }
  );
  
  // Override ID if provided (for test predictability)
  if (options.id) {
    command.aggregateId = options.id;
  }

  // Execute command through command bus - this creates events
  const result = await commandBus.execute(command);
  
  return result;
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
  _pool: DatabasePool, // Prefixed with _ as it's temporarily unused
  options: CreateOrgOptions = {}
): Promise<Organization> {
  const id = options.id || generateSnowflakeId();
  const name = options.name || `Test Org ${Date.now()}`;

  // NOTE: organizations_projection table doesn't exist yet in migrations
  // Returning mock organization without database insertion
  // TODO: Enable when organizations_projection migration is added
  /*
  await _pool.query(
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
  */

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
  _pool: DatabasePool, // Prefixed with _ as it's temporarily unused
  options: CreateProjectOptions
): Promise<Project> {
  const id = options.id || generateSnowflakeId();
  const name = options.name || `Test Project ${Date.now()}`;

  // NOTE: projects_projection table doesn't exist yet in migrations
  // Returning mock project without database insertion
  // TODO: Enable when projects_projection migration is added
  /*
  await _pool.query(
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
  */

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
  const id = generateSnowflakeId();
  const aggregateVersion = options.sequence !== undefined ? options.sequence + 1 : 1;
  
  // Create unique position by combining timestamp with aggregate info
  // This ensures each event gets a unique position even when created rapidly
  const timestamp = BigInt(Date.now()) * 1000000n; // Convert to microseconds
  const uniqueOffset = BigInt(aggregateVersion) * 1000n; // Add version-based offset
  const position = (timestamp + uniqueOffset).toString();
  
  const result = await pool.query(
    `INSERT INTO events (
      id, aggregate_type, aggregate_id, aggregate_version, event_type, event_data,
      editor_user, resource_owner, instance_id, position, in_position_order,
      creation_date, revision
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), 1)
    RETURNING id`,
    [
      id,
      options.aggregateType,
      options.aggregateId,
      aggregateVersion, // Use sequence as aggregate_version, +1 because versions start at 1
      options.eventType,
      JSON.stringify(options.eventData),
      options.editorUser || 'system',
      'test-org',
      'test-instance',
      position,
      0, // in_position_order
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
 * Get user from database using repository
 */
export async function getTestUser(pool: DatabasePool, userId: string): Promise<any | null> {
  const userRepo = new UserRepository(pool);
  const userRow = await userRepo.findById(userId);
  
  if (!userRow) {
    return null;
  }

  return {
    id: userRow.id,
    username: userRow.username,
    email: userRow.email,
    firstName: userRow.first_name,
    lastName: userRow.last_name,
    phone: userRow.phone,
    state: userRow.state,
    orgId: userRow.resource_owner,
    org_id: userRow.resource_owner,  // Also include snake_case version
    createdAt: userRow.created_at,
    updatedAt: userRow.updated_at,
    metadata: undefined, // Not stored in current schema
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
     ORDER BY aggregate_version ASC`,
    [aggregateType, aggregateId]
  );
  
  return result.rows.map(row => ({
    id: row.id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    eventData: row.event_data,
    sequence: row.aggregate_version - 1, // Map aggregate_version to sequence (version starts at 1, sequence starts at 0)
    editorUser: row.editor_user,
    createdAt: row.creation_date,
  }));
}
