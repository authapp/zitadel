import { PostgresEventstore } from '../../src/lib/eventstore/postgres/eventstore';
import { createTestDatabase, cleanDatabase, closeTestDatabase } from './setup';
import { DatabasePool } from '../../src/lib/database/pool';
import {
  InMemoryCommandBus,
  CreateUserCommand,
  createUserHandler,
  createUserValidator,
  UpdateUserCommand,
  updateUserHandler,
  updateUserValidator,
  DeactivateUserCommand,
  deactivateUserHandler,
  CreateOrganizationCommand,
  createOrganizationHandler,
  createOrganizationValidator,
  UpdateOrganizationCommand,
  updateOrganizationHandler,
  DeactivateOrganizationCommand,
  deactivateOrganizationHandler,
  CreateProjectCommand,
  createProjectHandler,
  createProjectValidator,
  UpdateProjectCommand,
  updateProjectHandler,
} from '../../src/lib/command';

describe('Integration: Command Bus', () => {
  let eventstore: PostgresEventstore;
  let commandBus: InMemoryCommandBus;
  let db: DatabasePool;

  beforeAll(async () => {
    db = await createTestDatabase();
    eventstore = new PostgresEventstore(db, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
      enableSubscriptions: false,
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
    // Create fresh command bus for each test to avoid handler conflicts
    commandBus = new InMemoryCommandBus(eventstore);
  });

  describe('User Commands', () => {
    beforeEach(() => {
      // Register handlers
      commandBus.registerHandler('CreateUserCommand', createUserHandler, createUserValidator);
      commandBus.registerHandler('UpdateUserCommand', updateUserHandler, updateUserValidator);
      commandBus.registerHandler('DeactivateUserCommand', deactivateUserHandler);
    });

    it('should create a user', async () => {
      const command = new CreateUserCommand(
        'john_doe',
        'john@example.com',
        'John',
        'Doe',
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        undefined,
        { instanceId: 'test', resourceOwner: 'org-1' }
      );

      const result = await commandBus.execute(command);

      expect(result.aggregateId).toBe(command.aggregateId);
      expect(result.event.eventType).toBe('user.created');
      expect(result.event.payload?.username).toBe('john_doe');
      expect(result.event.payload?.email).toBe('john@example.com');
      expect(result.event.payload?.displayName).toBe('John Doe');
    });

    it('should fail to create duplicate user', async () => {
      const command1 = new CreateUserCommand(
        'john_doe',
        'john@example.com',
        'John',
        'Doe'
      );

      // First creation succeeds
      await commandBus.execute(command1);

      // Second creation with same ID should fail
      const command2 = new CreateUserCommand(
        'jane_doe',
        'jane@example.com',
        'Jane',
        'Doe'
      );
      command2.aggregateId = command1.aggregateId; // Same ID

      await expect(commandBus.execute(command2)).rejects.toThrow('User already exists');
    });

    it('should update a user', async () => {
      // Create user first
      const createCommand = new CreateUserCommand(
        'john_doe',
        'john@example.com',
        'John',
        'Doe'
      );
      const createResult = await commandBus.execute(createCommand);

      // Update user
      const updateCommand = new UpdateUserCommand(
        createResult.aggregateId,
        'john.doe@example.com',
        'Johnny',
        undefined,
        undefined,
        undefined,
        undefined
      );

      const updateResult = await commandBus.execute(updateCommand);

      expect(updateResult.event.eventType).toBe('user.updated');
      expect(updateResult.event.payload?.email).toBe('john.doe@example.com');
      expect(updateResult.event.payload?.firstName).toBe('Johnny');
    });

    it('should fail to update non-existent user', async () => {
      const command = new UpdateUserCommand(
        'non-existent-id',
        'test@example.com'
      );

      await expect(commandBus.execute(command)).rejects.toThrow('User not found');
    });

    it('should deactivate a user', async () => {
      // Create user first
      const createCommand = new CreateUserCommand(
        'john_doe',
        'john@example.com',
        'John',
        'Doe'
      );
      const createResult = await commandBus.execute(createCommand);

      // Deactivate user
      const deactivateCommand = new DeactivateUserCommand(createResult.aggregateId);
      const deactivateResult = await commandBus.execute(deactivateCommand);

      expect(deactivateResult.event.eventType).toBe('user.deactivated');
    });

    it('should validate user commands', async () => {
      const invalidCommand = new CreateUserCommand(
        '', // Invalid: empty username
        'invalid-email', // Invalid: bad email format
        '', // Invalid: empty firstName
        '' // Invalid: empty lastName
      );

      await expect(commandBus.execute(invalidCommand)).rejects.toThrow('Command validation failed');
    });
  });

  describe('Organization Commands', () => {
    beforeEach(() => {
      // Register handlers
      commandBus.registerHandler('CreateOrganizationCommand', createOrganizationHandler, createOrganizationValidator);
      commandBus.registerHandler('UpdateOrganizationCommand', updateOrganizationHandler);
      commandBus.registerHandler('DeactivateOrganizationCommand', deactivateOrganizationHandler);
    });

    it('should create an organization', async () => {
      const command = new CreateOrganizationCommand(
        'ACME Corp',
        'acme.com',
        { instanceId: 'test', resourceOwner: 'system' }
      );

      const result = await commandBus.execute(command);

      expect(result.aggregateId).toBe(command.aggregateId);
      expect(result.event.eventType).toBe('organization.created');
      expect(result.event.payload?.name).toBe('ACME Corp');
      expect(result.event.payload?.domain).toBe('acme.com');
    });

    it('should update an organization', async () => {
      // Create organization first
      const createCommand = new CreateOrganizationCommand('ACME Corp');
      const createResult = await commandBus.execute(createCommand);

      // Update organization
      const updateCommand = new UpdateOrganizationCommand(
        createResult.aggregateId,
        'ACME Corporation',
        'acmecorp.com'
      );

      const updateResult = await commandBus.execute(updateCommand);

      expect(updateResult.event.eventType).toBe('organization.updated');
      expect(updateResult.event.payload?.name).toBe('ACME Corporation');
    });

    it('should deactivate an organization', async () => {
      // Create organization first
      const createCommand = new CreateOrganizationCommand('ACME Corp');
      const createResult = await commandBus.execute(createCommand);

      // Deactivate organization
      const deactivateCommand = new DeactivateOrganizationCommand(createResult.aggregateId);
      const deactivateResult = await commandBus.execute(deactivateCommand);

      expect(deactivateResult.event.eventType).toBe('organization.deactivated');
    });

    it('should validate organization commands', async () => {
      const invalidCommand = new CreateOrganizationCommand(''); // Invalid: empty name

      await expect(commandBus.execute(invalidCommand)).rejects.toThrow('Command validation failed');
    });
  });

  describe('Project Commands', () => {
    beforeEach(() => {
      // Register handlers
      commandBus.registerHandler('CreateProjectCommand', createProjectHandler, createProjectValidator);
      commandBus.registerHandler('UpdateProjectCommand', updateProjectHandler);
    });

    it('should create a project', async () => {
      const command = new CreateProjectCommand(
        'My App',
        true,
        false,
        true,
        'ENFORCE_PROJECT_RESOURCE_OWNER_POLICY',
        { instanceId: 'test', resourceOwner: 'org-1' }
      );

      const result = await commandBus.execute(command);

      expect(result.aggregateId).toBe(command.aggregateId);
      expect(result.event.eventType).toBe('project.created');
      expect(result.event.payload?.name).toBe('My App');
      expect(result.event.payload?.projectRoleAssertion).toBe(true);
    });

    it('should update a project', async () => {
      // Create project first
      const createCommand = new CreateProjectCommand('My App');
      const createResult = await commandBus.execute(createCommand);

      // Update project
      const updateCommand = new UpdateProjectCommand(
        createResult.aggregateId,
        'My Application',
        true
      );

      const updateResult = await commandBus.execute(updateCommand);

      expect(updateResult.event.eventType).toBe('project.updated');
      expect(updateResult.event.payload?.name).toBe('My Application');
    });

    it('should validate project commands', async () => {
      const invalidCommand = new CreateProjectCommand(''); // Invalid: empty name

      await expect(commandBus.execute(invalidCommand)).rejects.toThrow('Command validation failed');
    });
  });

  describe('State Reconstruction', () => {
    beforeEach(() => {
      commandBus.registerHandler('CreateUserCommand', createUserHandler);
      commandBus.registerHandler('UpdateUserCommand', updateUserHandler);
    });

    it('should reconstruct state from multiple events', async () => {
      // Create user
      const createCommand = new CreateUserCommand(
        'john_doe',
        'john@example.com',
        'John',
        'Doe'
      );
      const createResult = await commandBus.execute(createCommand);

      // Update user multiple times
      const update1 = new UpdateUserCommand(
        createResult.aggregateId,
        'john.doe@example.com'
      );
      await commandBus.execute(update1);

      const update2 = new UpdateUserCommand(
        createResult.aggregateId,
        undefined,
        'Johnny'
      );
      await commandBus.execute(update2);

      // Verify state was reconstructed correctly for the last update
      // (by checking it didn't throw errors about "User not found")
      expect(true).toBe(true);
    });
  });

  describe('Optimistic Concurrency Control', () => {
    beforeEach(() => {
      commandBus.registerHandler('CreateUserCommand', createUserHandler);
      commandBus.registerHandler('UpdateUserCommand', updateUserHandler);
    });

    it('should use revision for updates', async () => {
      // Create user
      const createCommand = new CreateUserCommand(
        'john_doe',
        'john@example.com',
        'John',
        'Doe'
      );
      const createResult = await commandBus.execute(createCommand);

      // Update should include revision
      const updateCommand = new UpdateUserCommand(
        createResult.aggregateId,
        'john.updated@example.com'
      );
      const updateResult = await commandBus.execute(updateCommand);

      // Verify revision was set (version from current state)
      expect(updateResult.event.revision).toBeDefined();
    });
  });
});
