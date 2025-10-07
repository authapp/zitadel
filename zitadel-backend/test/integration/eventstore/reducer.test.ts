import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { createTestDatabase, cleanDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database/pool';
import { Command, Event, EventFilter, Reducer } from '../../../src/lib/eventstore';

/**
 * Test reducer that collects all events
 */
class CollectingReducer implements Reducer {
  public events: Event[] = [];
  public reduceCallCount = 0;

  appendEvents(...events: Event[]): void {
    this.events.push(...events);
  }

  async reduce(): Promise<void> {
    this.reduceCallCount++;
    // Simulate some processing
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

/**
 * Test reducer that builds a user projection
 */
class UserProjectionReducer implements Reducer {
  public users = new Map<string, any>();
  private buffer: Event[] = [];

  appendEvents(...events: Event[]): void {
    this.buffer.push(...events);
  }

  async reduce(): Promise<void> {
    for (const event of this.buffer) {
      switch (event.eventType) {
        case 'user.added':
          this.users.set(event.aggregateID, {
            id: event.aggregateID,
            username: event.payload?.username,
            email: event.payload?.email,
            state: 'active',
          });
          break;
        case 'user.updated':
          const user = this.users.get(event.aggregateID);
          if (user) {
            Object.assign(user, event.payload);
          }
          break;
        case 'user.deleted':
          this.users.delete(event.aggregateID);
          break;
      }
    }
    this.buffer = [];
  }
}

describe('Integration: Reducer Pattern', () => {
  let eventstore: PostgresEventstore;
  let db: DatabasePool;

  beforeAll(async () => {
    db = await createTestDatabase();
    eventstore = new PostgresEventstore(db, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
      enableSubscriptions: false, // Disable to prevent cross-test contamination
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
    // Wait for any pending notifications to complete
    await new Promise(resolve => setImmediate(resolve));
  });

  afterEach(async () => {
    // Import and cleanup global subscription manager
    const { globalSubscriptionManager } = await import('../../../src/lib/eventstore/subscription');
    globalSubscriptionManager.closeAll();
    // Wait for cleanup
    await new Promise(resolve => setImmediate(resolve));
  });

  describe('filterToReducer', () => {
    it('should stream events to reducer', async () => {
      // Create some test events
      const commands: Command[] = Array.from({ length: 10 }, (_, i) => ({
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: `user-${i}`,
        eventType: 'user.added',
        payload: { username: `user${i}` },
        creator: 'admin',
        owner: 'org-1',
      }));

      await eventstore.pushMany(commands);

      // Use reducer to collect events
      const reducer = new CollectingReducer();
      const filter: EventFilter = {
        instanceID: 'test-instance',
        aggregateTypes: ['user'],
      };

      await eventstore.filterToReducer(filter, reducer);

      expect(reducer.events).toHaveLength(10);
      expect(reducer.reduceCallCount).toBeGreaterThan(0);
      expect(reducer.events[0].eventType).toBe('user.added');
    });

    it('should process events in batches', async () => {
      // Create 250 events (should be processed in 3 batches of 100 for reading)
      const commands: Command[] = Array.from({ length: 250 }, (_, i) => ({
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: `user-${i}`,
        eventType: 'user.added',
        payload: { username: `user${i}` },
        creator: 'admin',
        owner: 'org-1',
      }));

      // Push in batches to respect maxPushBatchSize
      for (let i = 0; i < commands.length; i += 100) {
        await eventstore.pushMany(commands.slice(i, i + 100));
      }

      const reducer = new CollectingReducer();
      const filter: EventFilter = {
        instanceID: 'test-instance',
        aggregateTypes: ['user'],
      };

      await eventstore.filterToReducer(filter, reducer);

      expect(reducer.events).toHaveLength(250);
      // Should be called at least 3 times (3 batches)
      expect(reducer.reduceCallCount).toBeGreaterThanOrEqual(3);
    });

    it('should build projection from events', async () => {
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
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: 'jane', email: 'jane@example.com' },
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
          aggregateID: 'user-2',
          eventType: 'user.deleted',
          payload: null,
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      await eventstore.pushMany(commands);

      const reducer = new UserProjectionReducer();
      const filter: EventFilter = {
        instanceID: 'test-instance',
        aggregateTypes: ['user'],
      };

      await eventstore.filterToReducer(filter, reducer);

      // user-1 should exist with updated email
      expect(reducer.users.has('user-1')).toBe(true);
      expect(reducer.users.get('user-1').email).toBe('john.doe@example.com');

      // user-2 should be deleted
      expect(reducer.users.has('user-2')).toBe(false);
    });

    it('should filter events before reducing', async () => {
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
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.added',
          payload: { name: 'ACME' },
          creator: 'admin',
          owner: 'system',
        },
      ];

      await eventstore.pushMany(commands);

      const reducer = new CollectingReducer();
      const filter: EventFilter = {
        instanceID: 'test-instance',
        aggregateTypes: ['user'],
      };

      await eventstore.filterToReducer(filter, reducer);

      // Should only receive user events
      expect(reducer.events).toHaveLength(1);
      expect(reducer.events[0].aggregateType).toBe('user');
    });

    it('should handle empty result set', async () => {
      const reducer = new CollectingReducer();
      const filter: EventFilter = {
        instanceID: 'non-existent',
        aggregateTypes: ['user'],
      };

      await eventstore.filterToReducer(filter, reducer);

      expect(reducer.events).toHaveLength(0);
      // Reduce might be called once with empty events
      expect(reducer.reduceCallCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not load all events into memory at once', async () => {
      // This test verifies the batching behavior
      const commands: Command[] = Array.from({ length: 500 }, (_, i) => ({
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: `user-${i}`,
        eventType: 'user.added',
        payload: { username: `user${i}`, data: 'x'.repeat(1000) }, // 1KB per event
        creator: 'admin',
        owner: 'org-1',
      }));

      // Push in batches to respect maxPushBatchSize
      for (let i = 0; i < commands.length; i += 100) {
        await eventstore.pushMany(commands.slice(i, i + 100));
      }

      const reducer = new CollectingReducer();
      const filter: EventFilter = {
        instanceID: 'test-instance',
        aggregateTypes: ['user'],
      };

      await eventstore.filterToReducer(filter, reducer);

      expect(reducer.events).toHaveLength(500);
      // Verify batching happened (should be at least 5 batches)
      expect(reducer.reduceCallCount).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Priority 1 Edge Cases', () => {
    describe('Reducer Error Handling', () => {
      class ErrorThrowingReducer implements Reducer {
        public events: Event[] = [];
        public throwOnReduce = false;

        appendEvents(...events: Event[]): void {
          this.events.push(...events);
        }

        async reduce(): Promise<void> {
          if (this.throwOnReduce) {
            throw new Error('Reducer processing failed');
          }
        }
      }

      it('should propagate error when reducer throws', async () => {
        const commands: Command[] = Array.from({ length: 10 }, (_, i) => ({
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: `user-${i}`,
          eventType: 'user.added',
          payload: { username: `user${i}` },
          creator: 'admin',
          owner: 'org-1',
        }));

        await eventstore.pushMany(commands);

        const reducer = new ErrorThrowingReducer();
        reducer.throwOnReduce = true;

        const filter: EventFilter = {
          instanceID: 'test-instance',
          aggregateTypes: ['user'],
        };

        // Should throw error from reducer
        await expect(eventstore.filterToReducer(filter, reducer)).rejects.toThrow(
          'Reducer processing failed'
        );
      });

      it('should allow recovery after reducer error', async () => {
        const commands: Command[] = Array.from({ length: 10 }, (_, i) => ({
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: `user-${i}`,
          eventType: 'user.added',
          payload: { username: `user${i}` },
          creator: 'admin',
          owner: 'org-1',
        }));

        await eventstore.pushMany(commands);

        const reducer = new ErrorThrowingReducer();
        reducer.throwOnReduce = true;

        const filter: EventFilter = {
          instanceID: 'test-instance',
          aggregateTypes: ['user'],
        };

        // First attempt fails
        await expect(eventstore.filterToReducer(filter, reducer)).rejects.toThrow();

        // Second attempt should work (new reducer)
        const workingReducer = new CollectingReducer();
        await eventstore.filterToReducer(filter, workingReducer);
        expect(workingReducer.events).toHaveLength(10);
      });
    });

    describe('Batch Boundaries', () => {
      it('should handle exactly 100 events (1 batch)', async () => {
        const commands: Command[] = Array.from({ length: 100 }, (_, i) => ({
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: `user-${i}`,
          eventType: 'user.added',
          payload: { username: `user${i}` },
          creator: 'admin',
          owner: 'org-1',
        }));

        await eventstore.pushMany(commands);

        const reducer = new CollectingReducer();
        const filter: EventFilter = {
          instanceID: 'test-instance',
          aggregateTypes: ['user'],
        };

        await eventstore.filterToReducer(filter, reducer);

        expect(reducer.events).toHaveLength(100);
        expect(reducer.reduceCallCount).toBe(1);
      });

      it('should handle 101 events (2 batches)', async () => {
        const commands: Command[] = Array.from({ length: 101 }, (_, i) => ({
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: `user-${i}`,
          eventType: 'user.added',
          payload: { username: `user${i}` },
          creator: 'admin',
          owner: 'org-1',
        }));

        // Push in batches
        await eventstore.pushMany(commands.slice(0, 100));
        await eventstore.pushMany(commands.slice(100));

        const reducer = new CollectingReducer();
        const filter: EventFilter = {
          instanceID: 'test-instance',
          aggregateTypes: ['user'],
        };

        await eventstore.filterToReducer(filter, reducer);

        expect(reducer.events).toHaveLength(101);
        expect(reducer.reduceCallCount).toBe(2);
      });

      it('should handle exactly 200 events (2 batches)', async () => {
        const commands: Command[] = Array.from({ length: 200 }, (_, i) => ({
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: `user-${i}`,
          eventType: 'user.added',
          payload: { username: `user${i}` },
          creator: 'admin',
          owner: 'org-1',
        }));

        // Push in batches
        await eventstore.pushMany(commands.slice(0, 100));
        await eventstore.pushMany(commands.slice(100));

        const reducer = new CollectingReducer();
        const filter: EventFilter = {
          instanceID: 'test-instance',
          aggregateTypes: ['user'],
        };

        await eventstore.filterToReducer(filter, reducer);

        expect(reducer.events).toHaveLength(200);
        expect(reducer.reduceCallCount).toBe(2);
      });

      it('should handle 201 events (3 batches)', async () => {
        const commands: Command[] = Array.from({ length: 201 }, (_, i) => ({
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: `user-${i}`,
          eventType: 'user.added',
          payload: { username: `user${i}` },
          creator: 'admin',
          owner: 'org-1',
        }));

        // Push in batches
        await eventstore.pushMany(commands.slice(0, 100));
        await eventstore.pushMany(commands.slice(100, 200));
        await eventstore.pushMany(commands.slice(200));

        const reducer = new CollectingReducer();
        const filter: EventFilter = {
          instanceID: 'test-instance',
          aggregateTypes: ['user'],
        };

        await eventstore.filterToReducer(filter, reducer);

        expect(reducer.events).toHaveLength(201);
        expect(reducer.reduceCallCount).toBe(3);
      });
    });

    describe('Concurrent Reduce Operations', () => {
      it('should handle concurrent reduce calls safely', async () => {
        const commands: Command[] = Array.from({ length: 50 }, (_, i) => ({
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: `user-${i}`,
          eventType: 'user.added',
          payload: { username: `user${i}` },
          creator: 'admin',
          owner: 'org-1',
        }));

        await eventstore.pushMany(commands);

        const filter: EventFilter = {
          instanceID: 'test-instance',
          aggregateTypes: ['user'],
        };

        // Multiple reducers processing same events concurrently
        const results = await Promise.all([
          (async () => {
            const reducer = new CollectingReducer();
            await eventstore.filterToReducer(filter, reducer);
            return reducer.events.length;
          })(),
          (async () => {
            const reducer = new CollectingReducer();
            await eventstore.filterToReducer(filter, reducer);
            return reducer.events.length;
          })(),
          (async () => {
            const reducer = new CollectingReducer();
            await eventstore.filterToReducer(filter, reducer);
            return reducer.events.length;
          })(),
        ]);

        // All should process all events
        expect(results).toEqual([50, 50, 50]);
      });
    });
  });
});
