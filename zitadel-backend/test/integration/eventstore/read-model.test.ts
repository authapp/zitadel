import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { createTestDatabase, cleanDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database/pool';
import { Command, Event, ReadModel, buildReadModel, rebuildReadModel } from '../../../src/lib/eventstore';

/**
 * Example read model for a user
 */
class UserReadModel extends ReadModel {
  username?: string;
  email?: string;
  isActive: boolean = true;
  loginCount: number = 0;

  protected handleEvent(event: Event): void {
    switch (event.eventType) {
      case 'user.added':
        this.username = event.payload?.username;
        this.email = event.payload?.email;
        break;

      case 'user.updated':
        if (event.payload?.username) this.username = event.payload.username;
        if (event.payload?.email) this.email = event.payload.email;
        break;

      case 'user.deactivated':
        this.isActive = false;
        break;

      case 'user.activated':
        this.isActive = true;
        break;

      case 'user.logged_in':
        this.loginCount++;
        break;
    }
  }

  protected serializeState(): Record<string, any> {
    return {
      username: this.username,
      email: this.email,
      isActive: this.isActive,
      loginCount: this.loginCount,
    };
  }
}

/**
 * Example read model for an organization
 */
class OrgReadModel extends ReadModel {
  name?: string;
  memberCount: number = 0;
  projectCount: number = 0;

  protected handleEvent(event: Event): void {
    switch (event.eventType) {
      case 'org.added':
        this.name = event.payload?.name;
        break;

      case 'org.member_added':
        this.memberCount++;
        break;

      case 'org.member_removed':
        this.memberCount--;
        break;

      case 'org.project_added':
        this.projectCount++;
        break;
    }
  }

  protected serializeState(): Record<string, any> {
    return {
      name: this.name,
      memberCount: this.memberCount,
      projectCount: this.projectCount,
    };
  }
}

describe('Integration: Read Model Pattern', () => {
  let eventstore: PostgresEventstore;
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
  });

  describe('Basic Functionality', () => {
    it('should create an empty read model', () => {
      const model = new UserReadModel();
      
      expect(model.aggregateID).toBe('');
      expect(model.processedSequence).toBe(0n);
      expect(model.isInitialized()).toBe(false);
    });

    it('should apply single event', async () => {
      const model = new UserReadModel();
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john', email: 'john@example.com' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      const events = await eventstore.pushMany(commands);
      model.appendEvents(...events);
      await model.reduce();

      expect(model.aggregateID).toBe('user-1');
      expect(model.username).toBe('john');
      expect(model.email).toBe('john@example.com');
      expect(model.isActive).toBe(true);
      expect(model.isInitialized()).toBe(true);
    });

    it('should apply multiple events sequentially', async () => {
      const model = new UserReadModel();
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john', email: 'john@example.com' },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.updated',
          payload: { email: 'john.doe@example.com' },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.logged_in',
          payload: null,
          creator: 'system',
          owner: 'org-1',
        },
      ];

      const events = await eventstore.pushMany(commands);
      model.appendEvents(...events);
      await model.reduce();

      expect(model.username).toBe('john');
      expect(model.email).toBe('john.doe@example.com'); // Updated
      expect(model.loginCount).toBe(1);
      expect(model.processedSequence).toBe(3n);
    });
  });

  describe('Automatic State Tracking', () => {
    it('should track aggregate ID', async () => {
      const model = new UserReadModel();
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-123',
          eventType: 'user.added',
          payload: { username: 'alice' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      const events = await eventstore.pushMany(commands);
      await buildReadModel(model, events);

      expect(model.aggregateID).toBe('user-123');
    });

    it('should track processed sequence', async () => {
      const model = new UserReadModel();
      const commands: Command[] = Array.from({ length: 5 }, () => ({
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-1',
        eventType: 'user.logged_in',
        payload: null,
        creator: 'system',
        owner: 'org-1',
      }));

      const events = await eventstore.pushMany(commands);
      await buildReadModel(model, events);

      expect(model.processedSequence).toBe(5n);
      expect(model.getEventCount()).toBe(5);
    });

    it('should track position', async () => {
      const model = new UserReadModel();
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      const events = await eventstore.pushMany(commands);
      await buildReadModel(model, events);

      expect(model.position.position).toBeGreaterThan(0);
      expect(model.position.inTxOrder).toBeGreaterThanOrEqual(0);
    });

    it('should track timestamps', async () => {
      const model = new UserReadModel();
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      const events = await eventstore.pushMany(commands);
      await buildReadModel(model, events);

      expect(model.creationDate).toBeInstanceOf(Date);
      expect(model.changeDate).toBeInstanceOf(Date);
      expect(model.creationDate).toEqual(model.changeDate);
    });

    it('should update changeDate on subsequent events', async () => {
      const model = new UserReadModel();
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      const firstEvents = await eventstore.pushMany(commands);
      await buildReadModel(model, firstEvents);

      const creationDate = model.creationDate;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Add another event
      const moreCommands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.updated',
          payload: { email: 'john@example.com' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      const secondEvents = await eventstore.pushMany(moreCommands);
      model.appendEvents(...secondEvents);
      await model.reduce();

      expect(model.creationDate).toEqual(creationDate); // Unchanged
      expect(model.changeDate!.getTime()).toBeGreaterThanOrEqual(creationDate!.getTime());
    });

    it('should track resource owner and instance ID', async () => {
      const model = new UserReadModel();
      const commands: Command[] = [
        {
          instanceID: 'tenant-acme',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john' },
          creator: 'admin',
          owner: 'acme-corp',
        },
      ];

      const events = await eventstore.pushMany(commands);
      await buildReadModel(model, events);

      expect(model.resourceOwner).toBe('acme-corp');
      expect(model.instanceID).toBe('tenant-acme');
    });
  });

  describe('Integration with Eventstore', () => {
    it('should work with filterToReducer', async () => {
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john' },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.logged_in',
          payload: null,
          creator: 'system',
          owner: 'org-1',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.logged_in',
          payload: null,
          creator: 'system',
          owner: 'org-1',
        },
      ];

      await eventstore.pushMany(commands);

      const model = new UserReadModel();
      await eventstore.filterToReducer(
        { aggregateTypes: ['user'], aggregateIDs: ['user-1'] },
        model
      );

      expect(model.username).toBe('john');
      expect(model.loginCount).toBe(2);
    });

    it('should build read model for complex aggregate', async () => {
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.added',
          payload: { name: 'ACME Corp' },
          creator: 'admin',
          owner: 'system',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.member_added',
          payload: { userID: 'user-1' },
          creator: 'admin',
          owner: 'system',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.member_added',
          payload: { userID: 'user-2' },
          creator: 'admin',
          owner: 'system',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.project_added',
          payload: { projectID: 'project-1' },
          creator: 'admin',
          owner: 'system',
        },
      ];

      await eventstore.pushMany(commands);

      const model = new OrgReadModel();
      await eventstore.filterToReducer(
        { aggregateTypes: ['org'], aggregateIDs: ['org-1'] },
        model
      );

      expect(model.name).toBe('ACME Corp');
      expect(model.memberCount).toBe(2);
      expect(model.projectCount).toBe(1);
    });
  });

  describe('Helper Functions', () => {
    it('should build read model using buildReadModel helper', async () => {
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'alice', email: 'alice@example.com' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      const events = await eventstore.pushMany(commands);
      const model = await buildReadModel(new UserReadModel(), events);

      expect(model.username).toBe('alice');
      expect(model.email).toBe('alice@example.com');
    });

    it('should rebuild read model using rebuildReadModel helper', async () => {
      const model = new UserReadModel();
      
      // Initial build
      const commands1: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'alice' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];
      const events1 = await eventstore.pushMany(commands1);
      await buildReadModel(model, events1);

      expect(model.username).toBe('alice');

      // Rebuild with different events
      const commands2: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: 'bob' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];
      const events2 = await eventstore.pushMany(commands2);
      await rebuildReadModel(model, events2);

      expect(model.username).toBe('bob');
      expect(model.aggregateID).toBe('user-2');
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', async () => {
      const model = new UserReadModel();
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john', email: 'john@example.com' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      const events = await eventstore.pushMany(commands);
      await buildReadModel(model, events);

      const json = model.toJSON();

      expect(json.aggregateID).toBe('user-1');
      expect(json.username).toBe('john');
      expect(json.email).toBe('john@example.com');
      expect(json.isActive).toBe(true);
      expect(json.loginCount).toBe(0);
      expect(json.creationDate).toBeDefined();
      expect(json.processedSequence).toBe('1');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset read model to initial state', async () => {
      const model = new UserReadModel();
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john', email: 'john@example.com' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      const events = await eventstore.pushMany(commands);
      await buildReadModel(model, events);

      expect(model.isInitialized()).toBe(true);
      expect(model.username).toBe('john');

      model.reset();

      expect(model.isInitialized()).toBe(false);
      expect(model.aggregateID).toBe('');
      expect(model.processedSequence).toBe(0n);
      expect(model.username).toBe('john'); // Custom fields not reset
    });
  });
});
