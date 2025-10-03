import { Eventstore, Event, Command as EventstoreCommand, EventFilter } from '../eventstore/types';
import { InMemoryCommandBus } from './command-bus';
import { BaseAggregate, UserAggregate } from './aggregate';
import { AggregateRepository } from './repository';
import {
  CreateUserCommand,
  UpdateUserCommand,
  createUserHandler,
  updateUserHandler,
  deactivateUserHandler,
  createUserValidator,
  updateUserValidator,
} from './commands/user';
import { AppCommand } from './types';

// Mock Eventstore
class MockEventstore implements Eventstore {
  private events: Event[] = [];
  private eventCounter = 0;

  async push(command: EventstoreCommand): Promise<Event> {
    const event: Event = {
      id: String(++this.eventCounter),
      eventType: command.eventType,
      aggregateType: command.aggregateType,
      aggregateID: command.aggregateID,
      aggregateVersion: command.revision || this.events.filter(e => e.aggregateID === command.aggregateID).length + 1,
      eventData: command.eventData,
      editorUser: command.editorUser,
      editorService: command.editorService,
      resourceOwner: command.resourceOwner,
      instanceID: command.instanceID,
      position: { position: BigInt(this.events.length), inPositionOrder: 0 },
      creationDate: new Date(),
      revision: 1,
    };
    this.events.push(event);
    return event;
  }

  async pushMany(commands: EventstoreCommand[]): Promise<Event[]> {
    const events: Event[] = [];
    for (const command of commands) {
      events.push(await this.push(command));
    }
    return events;
  }

  async pushWithConcurrencyCheck(commands: EventstoreCommand[], _expectedVersion: number): Promise<Event[]> {
    return this.pushMany(commands);
  }

  async query(filter: EventFilter): Promise<Event[]> {
    return this.events.filter(e => {
      if (filter.aggregateIDs && filter.aggregateIDs.length > 0 && !filter.aggregateIDs.includes(e.aggregateID)) return false;
      if (filter.aggregateTypes && filter.aggregateTypes.length > 0 && !filter.aggregateTypes.includes(e.aggregateType)) return false;
      return true;
    });
  }

  async latestEvent(): Promise<Event | null> {
    return this.events[this.events.length - 1] || null;
  }

  async aggregate(): Promise<any> {
    return null;
  }

  async search(): Promise<Event[]> {
    return this.events;
  }

  async count(): Promise<number> {
    return this.events.length;
  }

  async eventsAfterPosition(): Promise<Event[]> {
    return [];
  }

  async health(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {}

  // Helper to clear events
  clear() {
    this.events = [];
    this.eventCounter = 0;
  }
}

describe('CommandBus', () => {
  let eventstore: MockEventstore;
  let commandBus: InMemoryCommandBus;

  beforeEach(() => {
    eventstore = new MockEventstore();
    commandBus = new InMemoryCommandBus(eventstore);
  });

  describe('handler registration', () => {
    it('should register command handler', () => {
      expect(() => {
        commandBus.registerHandler(
          'CreateUserCommand',
          createUserHandler,
          createUserValidator
        );
      }).not.toThrow();
    });

    it('should throw error for duplicate handler', () => {
      commandBus.registerHandler('CreateUserCommand', createUserHandler);
      
      expect(() => {
        commandBus.registerHandler('CreateUserCommand', createUserHandler);
      }).toThrow('already registered');
    });
  });

  describe('command execution', () => {
    beforeEach(() => {
      commandBus.registerHandler(
        'CreateUserCommand',
        createUserHandler,
        createUserValidator
      );
      commandBus.registerHandler(
        'UpdateUserCommand',
        updateUserHandler,
        updateUserValidator
      );
      commandBus.registerHandler(
        'DeactivateUserCommand',
        deactivateUserHandler
      );
    });

    it('should execute create user command', async () => {
      const command = new CreateUserCommand('john_doe', 'john@example.com', 'John', 'Doe');
      
      const result = await commandBus.execute(command);
      
      expect(result.aggregateId).toBe(command.aggregateId);
      expect(result.event).toBeDefined();
      expect(result.event.eventType).toBe('user.created');
      expect(result.event.eventData.username).toBe('john_doe');
    });

    it('should validate command before execution', async () => {
      const command = new CreateUserCommand('', ''); // Invalid
      
      await expect(commandBus.execute(command)).rejects.toThrow('validation failed');
    });

    it('should execute update user command', async () => {
      // First create user
      const createCommand = new CreateUserCommand('john_doe', 'john@example.com');
      await commandBus.execute(createCommand);
      
      // Then update
      const updateCommand = new UpdateUserCommand(
        createCommand.aggregateId,
        'newemail@example.com',
        'Johnny'
      );
      
      const result = await commandBus.execute(updateCommand);
      
      expect(result.event.eventType).toBe('user.updated');
      expect(result.event.eventData.email).toBe('newemail@example.com');
    });

    it('should throw error for unregistered command', async () => {
      class UnknownCommand implements AppCommand {
        aggregateId = '123';
        aggregateType = 'unknown';
        context = {
          instanceId: 'test',
          resourceOwner: 'test',
          timestamp: new Date(),
          requestId: '123',
        };
      }
      
      await expect(commandBus.execute(new UnknownCommand())).rejects.toThrow('No handler');
    });
  });

  describe('middleware', () => {
    beforeEach(() => {
      commandBus.registerHandler('CreateUserCommand', createUserHandler);
    });

    it('should execute middleware', async () => {
      const middlewareCalls: string[] = [];
      
      commandBus.use(async (_command, next) => {
        middlewareCalls.push('before');
        const result = await next();
        middlewareCalls.push('after');
        return result;
      });
      
      const command = new CreateUserCommand('test', 'test@example.com');
      await commandBus.execute(command);
      
      expect(middlewareCalls).toEqual(['before', 'after']);
    });

    it('should execute multiple middlewares in order', async () => {
      const calls: number[] = [];
      
      commandBus.use(async (_command, next) => {
        calls.push(1);
        const result = await next();
        calls.push(4);
        return result;
      });
      
      commandBus.use(async (_command, next) => {
        calls.push(2);
        const result = await next();
        calls.push(3);
        return result;
      });
      
      const command = new CreateUserCommand('test', 'test@example.com');
      await commandBus.execute(command);
      
      expect(calls).toEqual([1, 2, 3, 4]);
    });
  });

  describe('health check', () => {
    it('should return true for healthy command bus', async () => {
      const healthy = await commandBus.health();
      expect(healthy).toBe(true);
    });
  });
});

describe('BaseAggregate', () => {
  class TestAggregate extends BaseAggregate {
    value?: string;

    constructor(id: string) {
      super(id, 'test');
    }

    protected onTestCreated(event: Event): void {
      this.value = event.eventData.value;
    }

    protected onTestUpdated(event: Event): void {
      this.value = event.eventData.value;
    }
  }

  it('should initialize with id and type', () => {
    const aggregate = new TestAggregate('123');
    
    expect(aggregate.id).toBe('123');
    expect(aggregate.type).toBe('test');
    expect(aggregate.version).toBe(0);
  });

  it('should apply events and call handlers', () => {
    const aggregate = new TestAggregate('123');
    
    const event: Event = {
      id: '1',
      eventType: 'test.created',
      aggregateID: '123',
      aggregateType: 'test',
      aggregateVersion: 1,
      eventData: { value: 'hello' },
      editorUser: 'system',
      resourceOwner: 'test',
      instanceID: 'test',
      position: { position: 0n, inPositionOrder: 0 },
      creationDate: new Date(),
      revision: 1,
    };
    
    aggregate.apply(event);
    
    expect(aggregate.value).toBe('hello');
    expect(aggregate.version).toBe(1);
  });

  it('should load from history', () => {
    const aggregate = new TestAggregate('123');
    
    const events: Event[] = [
      {
        id: '1',
        eventType: 'test.created',
        aggregateID: '123',
        aggregateType: 'test',
        aggregateVersion: 1,
        eventData: { value: 'first' },
        editorUser: 'system',
        resourceOwner: 'test',
        instanceID: 'test',
        position: { position: 0n, inPositionOrder: 0 },
        creationDate: new Date(),
        revision: 1,
      },
      {
        id: '2',
        eventType: 'test.updated',
        aggregateID: '123',
        aggregateType: 'test',
        aggregateVersion: 2,
        eventData: { value: 'second' },
        editorUser: 'system',
        resourceOwner: 'test',
        instanceID: 'test',
        position: { position: 1n, inPositionOrder: 0 },
        creationDate: new Date(),
        revision: 1,
      },
    ];
    
    aggregate.loadFromHistory(events);
    
    expect(aggregate.value).toBe('second');
    expect(aggregate.version).toBe(2);
  });
});

describe('UserAggregate', () => {
  it('should handle user created event', () => {
    const aggregate = new UserAggregate('123');
    
    const event: Event = {
      id: '1',
      eventType: 'user.created',
      aggregateID: '123',
      aggregateType: 'user',
      aggregateVersion: 1,
      eventData: {
        username: 'john_doe',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      editorUser: 'system',
      resourceOwner: 'test',
      instanceID: 'test',
      position: { position: 0n, inPositionOrder: 0 },
      creationDate: new Date(),
      revision: 1,
    };
    
    aggregate.apply(event);
    
    expect(aggregate.username).toBe('john_doe');
    expect(aggregate.email).toBe('john@example.com');
    expect(aggregate.firstName).toBe('John');
    expect(aggregate.lastName).toBe('Doe');
    expect(aggregate.state).toBe('active');
  });

  it('should handle user updated event', () => {
    const aggregate = new UserAggregate('123');
    aggregate.email = 'old@example.com';
    
    const event: Event = {
      id: '2',
      eventType: 'user.updated',
      aggregateID: '123',
      aggregateType: 'user',
      aggregateVersion: 2,
      eventData: {
        email: 'new@example.com',
        firstName: 'Johnny',
      },
      editorUser: 'system',
      resourceOwner: 'test',
      instanceID: 'test',
      position: { position: 1n, inPositionOrder: 0 },
      creationDate: new Date(),
      revision: 1,
    };
    
    aggregate.apply(event);
    
    expect(aggregate.email).toBe('new@example.com');
    expect(aggregate.firstName).toBe('Johnny');
  });

  it('should handle user deactivated event', () => {
    const aggregate = new UserAggregate('123');
    aggregate.state = 'active';
    
    const event: Event = {
      id: '3',
      eventType: 'user.deactivated',
      aggregateID: '123',
      aggregateType: 'user',
      aggregateVersion: 3,
      eventData: {},
      editorUser: 'system',
      resourceOwner: 'test',
      instanceID: 'test',
      position: { position: 2n, inPositionOrder: 0 },
      creationDate: new Date(),
      revision: 1,
    };
    
    aggregate.apply(event);
    
    expect(aggregate.state).toBe('inactive');
  });
});

describe('AggregateRepository', () => {
  let eventstore: MockEventstore;
  let repository: AggregateRepository<UserAggregate>;

  beforeEach(() => {
    eventstore = new MockEventstore();
    repository = new AggregateRepository(
      eventstore,
      (id: string) => new UserAggregate(id)
    );
  });

  it('should load aggregate from events', async () => {
    // Push event directly
    await eventstore.push({
      eventType: 'user.created',
      aggregateID: '123',
      aggregateType: 'user',
      eventData: { username: 'test', email: 'test@example.com' },
      editorUser: 'system',
      resourceOwner: 'test',
      instanceID: 'test',
    });
    
    const aggregate = await repository.load('123');
    
    expect(aggregate).not.toBeNull();
    expect(aggregate!.username).toBe('test');
    expect(aggregate!.version).toBe(1);
  });

  it('should return null for non-existent aggregate', async () => {
    const aggregate = await repository.load('999');
    expect(aggregate).toBeNull();
  });

  it('should check if aggregate exists', async () => {
    await eventstore.push({
      eventType: 'user.created',
      aggregateID: '123',
      aggregateType: 'user',
      eventData: {},
      editorUser: 'system',
      resourceOwner: 'test',
      instanceID: 'test',
    });
    
    expect(await repository.exists('123')).toBe(true);
    expect(await repository.exists('999')).toBe(false);
  });
});
