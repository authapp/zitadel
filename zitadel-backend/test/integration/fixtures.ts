/**
 * Test Fixtures and Data Factories
 * 
 * Provides three approaches for test data:
 * 1. **Repository-based** (createTestUser) - Fast, direct DB access for test setup
 * 2. **Command-based** (createUserViaCommand) - CQRS flow for testing command layer
 * 3. **Service-based** (createUserViaService) - Full E2E flow with business logic
 * 
 * Use repository-based for fast test setup.
 * Use command-based when testing the command layer specifically.
 * Use service-based for true end-to-end integration tests.
 */

import { DatabasePool } from '../../src/lib/database';
import { PostgresEventstore } from '../../src/lib/eventstore';
import { InMemoryCommandBus } from '../../src/lib/command';
import { CreateUserCommand, createUserHandler, createUserValidator, updateUserHandler, updateUserValidator, deactivateUserHandler, changePasswordHandler } from '../../src/lib/command/commands/user';
import { generateId as generateSnowflakeId } from '../../src/lib/id/snowflake';
import { PasswordHasher } from '../../src/lib/crypto/hash';
import { UserState } from '../../src/lib/domain/user';
import { Organization, OrgState } from '../../src/lib/domain/organization';
import { Project, ProjectState } from '../../src/lib/domain/project';
import { UserRepository } from '../../src/lib/repositories/user-repository';
import { createUserService } from '../../src/lib/services/user/user-service';

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
    options.phone,
    undefined, // nickname
    undefined, // preferredLanguage
    undefined, // gender
    undefined, // passwordChangeRequired
    undefined, // passwordHash
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
 * Create test user via UserService (Full E2E flow)
 * 
 * NOTE: This fixture is a helper for creating service dependencies.
 * See user-service.integration.test.ts for full service testing examples.
 * 
 * For most tests, use createTestUser (repository-based) for speed.
 */
export function setupUserServiceForTest(pool: DatabasePool) {
  const eventstore = new PostgresEventstore(pool, {
    instanceID: 'test-instance',
    maxPushBatchSize: 100,
  });
  const commandBus = new InMemoryCommandBus(eventstore);
  
  // Create user repository for projection updates
  const userRepo = new UserRepository(pool);
  
  // Register all user command handlers
  commandBus.registerHandler('CreateUserCommand', createUserHandler, createUserValidator);
  commandBus.registerHandler('UpdateUserCommand', updateUserHandler, updateUserValidator);
  commandBus.registerHandler('DeactivateUserCommand', deactivateUserHandler);
  commandBus.registerHandler('ChangePasswordCommand', changePasswordHandler);
  
  // Add simple projection handler (updates projection after command execution)
  commandBus.use(async (_command, next) => {
    const result = await next();
    
    // Update projection based on event type
    if (result.event) {
      const event = result.event as any;
      
      if (event.eventType === 'user.created') {
        await userRepo.create({
          id: event.aggregateID,
          instanceId: event.instanceID,
          resourceOwner: event.resourceOwner,
          username: event.eventData.username,
          email: event.eventData.email,
          firstName: event.eventData.firstName,
          lastName: event.eventData.lastName,
          displayName: event.eventData.displayName,
          phone: event.eventData.phone,
          passwordHash: event.eventData.passwordHash,
          state: 'active',
        });
      } else if (event.eventType === 'user.password.changed') {
        const existing = await userRepo.findById(event.aggregateID);
        if (existing) {
          await userRepo.update(event.aggregateID, {
            passwordHash: event.eventData.passwordHash,
          });
        }
      } else if (event.eventType === 'user.updated') {
        const existing = await userRepo.findById(event.aggregateID);
        if (existing) {
          await userRepo.update(event.aggregateID, {
            email: event.eventData.email || existing.email,
            firstName: event.eventData.firstName || existing.first_name,
            lastName: event.eventData.lastName || existing.last_name,
          });
        }
      } else if (event.eventType === 'user.deactivated') {
        await userRepo.update(event.aggregateID, { state: 'inactive' });
      }
    }
    
    return result;
  });
  
  // Mock permission checker (always allows for tests)
  const mockPermissionChecker: any = {
    async check() {
      return { allowed: true };
    },
    async checkAny() {
      return { allowed: true };
    },
    async checkAll() {
      return { allowed: true };
    },
    async hasRole() {
      return true;
    }
  };
  
  // Mock notification service
  const sentNotifications: any[] = [];
  const mockNotificationService: any = {
    async send(recipient: string, subject: string, body: string) {
      sentNotifications.push({ recipient, subject, body });
      return 'notification-id';
    },
    async sendFromTemplate(templateId: string, recipient: string, data: any) {
      sentNotifications.push({ templateId, recipient, data });
      return 'notification-id';
    }
  };
  
  // Create mock query (wraps repository)
  const mockQuery: any = {
    async execute(sql: string, params: any[]) {
      // Handle list query
      if (sql.includes('SELECT * FROM users WHERE 1=1')) {
        const users = await userRepo.findAll();
        let filtered = users;
        
        // Apply filters
        if (sql.includes('username LIKE')) {
          const usernamePattern = params.find(p => typeof p === 'string' && p.includes('%'));
          if (usernamePattern) {
            const username = usernamePattern.replace(/%/g, '');
            filtered = filtered.filter(u => u.username.includes(username));
          }
        }
        
        if (sql.includes('email LIKE')) {
          const emailPattern = params.find(p => typeof p === 'string' && p.includes('%') && p.includes('@'));
          if (emailPattern) {
            const email = emailPattern.replace(/%/g, '');
            filtered = filtered.filter(u => u.email && u.email.includes(email));
          }
        }
        
        // Apply limit and offset (they're the last two parameters)
        const limit = sql.includes('LIMIT') && params.length >= 2 ? parseInt(params[params.length - 2]) : filtered.length;
        const offset = sql.includes('OFFSET') && params.length >= 2 ? parseInt(params[params.length - 1]) : 0;
        
        return filtered.slice(offset, offset + limit).map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          state: user.state,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        }));
      }
      
      // Handle email-based queries (various types)
      // Note: queries use "users" but actual table is "users_projection"
      // Check this BEFORE username lookup since username might appear in SELECT clause
      if (sql.includes('WHERE email') && params[0] && !params[0].includes('%')) {
        const email = params[0];
        const user = await userRepo.findByEmail(email);
        if (!user) return [];
        
        // Return fields based on what's requested in SELECT
        if (sql.includes('SELECT id, username FROM')) {
          return [{
            id: user.id,
            username: user.username,
          }];
        }
        
        if (sql.includes('SELECT password_hash FROM')) {
          return [{
            password_hash: user.password_hash,
          }];
        }
        
        return [{
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          state: user.state,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        }];
      }
      
      // Handle single username lookup (check after email to avoid conflicts)
      if (sql.includes('SELECT') && sql.includes('username') && sql.includes('WHERE') && !sql.includes('WHERE email') && params[0] && !params[0].includes('%')) {
        const username = params[0];
        const user = await userRepo.findByUsername(username);
        if (!user) return [];
        return [{
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          state: user.state,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        }];
      }
      
      // Handle password hash lookup
      if (sql.includes('SELECT') && sql.includes('password_hash')) {
        const userId = params[0];
        const user = await userRepo.findById(userId);
        return user ? [user] : [];
      }
      
      return [];
    },
    async findById(table: string, id: string) {
      if (table === 'users') {
        const user = await userRepo.findById(id);
        // Map database row to User domain object
        if (!user) return null;
        return {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          state: user.state,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        };
      }
      return null;
    }
  };
  
  // Create user service
  const userService = createUserService(
    commandBus,
    mockQuery,
    mockPermissionChecker,
    hasher,
    mockNotificationService
  );
  
  return {
    userService,
    commandBus,
    sentNotifications,
    userRepo,
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
    resource_owner: userRow.resource_owner,  // Add snake_case DB field
    orgId: userRow.resource_owner,
    org_id: userRow.resource_owner,  // Also include alternate snake_case version
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

/**
 * ARCHITECTURE NOTE: Repository Usage in Production vs Testing
 * ===========================================================
 * 
 * Q: Is UserRepository only for testing?
 * A: NO - It has legitimate production uses!
 * 
 * PRODUCTION USES:
 * ----------------
 * 1. Projections: Update read models when events occur
 *    - EventHandler receives event → UserRepository.update()
 * 
 * 2. Cross-Aggregate Validation: Check constraints in commands
 *    - CreateUserCommand → Check username uniqueness via UserRepository.findByUsername()
 * 
 * 3. Query Layer: Read operations
 *    - Query.findUser() → UserRepository.findById()
 * 
 * 4. Admin Operations: Direct DB access when appropriate
 *    - Bulk operations, migrations, reporting
 * 
 * TESTING STRATEGY:
 * -----------------
 * Use different approaches based on what you're testing:
 * 
 * 1. REPOSITORY-BASED (createTestUser)
 *    - Speed: ~300ms
 *    - Tests: Repository, Query, Database layer
 *    - Use: 90% of tests for fast setup
 * 
 * 2. COMMAND-BASED (createUserViaCommand)
 *    - Speed: ~400ms
 *    - Tests: Command layer, Event sourcing
 *    - Use: Command-specific tests
 * 
 * 3. SERVICE-BASED (TODO: createUserViaService)
 *    - Speed: ~500ms
 *    - Tests: Full stack (Service → Commands → Events → Projections)
 *    - Use: E2E integration tests, API tests
 * 
 * ZITADEL'S APPROACH:
 * -------------------
 * Zitadel uses both patterns:
 * - Commands use "WriteModel" (aggregate reconstruction from events)
 * - Projections use direct DB writes (similar to our UserRepository)
 * - Services orchestrate the full flow
 * 
 * Our architecture follows the same principles with clearer naming.
 */
