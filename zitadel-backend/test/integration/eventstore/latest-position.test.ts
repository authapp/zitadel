import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { createTestDatabase, cleanDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database/pool';
import { Command, EventFilter } from '../../../src/lib/eventstore';

describe('Integration: Latest Position', () => {
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

  describe('latestPosition', () => {
    it('should return zero position when no events exist', async () => {
      const position = await eventstore.latestPosition();

      expect(position.position).toBe(0);
      expect(position.inTxOrder).toBe(0);
    });

    it('should return latest position across all events', async () => {
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
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: 'jane' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      const events = await eventstore.pushMany(commands);
      const position = await eventstore.latestPosition();

      // Position should be from the last event
      expect(position.position).toBeGreaterThan(0);
      expect(position.position).toBe(events[events.length - 1].position.position);
    });

    it('should filter by instanceID', async () => {
      const commands1: Command[] = [
        {
          instanceID: 'instance-1',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      const commands2: Command[] = [
        {
          instanceID: 'instance-2',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: 'jane' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      const events1 = await eventstore.pushMany(commands1);
      await eventstore.pushMany(commands2);

      const filter: EventFilter = {
        instanceID: 'instance-1',
      };

      const position = await eventstore.latestPosition(filter);

      // Should only get position from instance-1
      expect(position.position).toBe(events1[0].position.position);
    });

    it('should filter by aggregateType', async () => {
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

      const events = await eventstore.pushMany(commands);
      const filter: EventFilter = {
        instanceID: 'test-instance',
        aggregateTypes: ['user'],
      };

      const position = await eventstore.latestPosition(filter);

      // Should get position from user event only
      expect(position.position).toBe(events[0].position.position);
    });

    it('should filter by aggregateID', async () => {
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
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: 'jane' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      const events = await eventstore.pushMany(commands);
      const filter: EventFilter = {
        instanceID: 'test-instance',
        aggregateIDs: ['user-1'],
      };

      const position = await eventstore.latestPosition(filter);

      // Should get position from user-1 only
      expect(position.position).toBe(events[0].position.position);
    });

    it('should filter by eventType', async () => {
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
          eventType: 'user.updated',
          payload: { email: 'john@example.com' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      const events = await eventstore.pushMany(commands);
      const filter: EventFilter = {
        instanceID: 'test-instance',
        eventTypes: ['user.added'],
      };

      const position = await eventstore.latestPosition(filter);

      // Should get position from user.added event only
      expect(position.position).toBe(events[0].position.position);
    });

    it('should filter by owner', async () => {
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
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: 'jane' },
          creator: 'admin',
          owner: 'org-2',
        },
      ];

      const events = await eventstore.pushMany(commands);
      const filter: EventFilter = {
        instanceID: 'test-instance',
        owner: 'org-1',
      };

      const position = await eventstore.latestPosition(filter);

      // Should get position from org-1 events only
      expect(position.position).toBe(events[0].position.position);
    });

    it('should filter by creator', async () => {
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
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: 'jane' },
          creator: 'user-1',
          owner: 'org-1',
        },
      ];

      const events = await eventstore.pushMany(commands);
      const filter: EventFilter = {
        instanceID: 'test-instance',
        creator: 'admin',
      };

      const position = await eventstore.latestPosition(filter);

      // Should get position from admin events only
      expect(position.position).toBe(events[0].position.position);
    });

    it('should combine multiple filters', async () => {
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
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: 'jane' },
          creator: 'user-1',
          owner: 'org-2',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.added',
          payload: { name: 'ACME' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      const events = await eventstore.pushMany(commands);
      const filter: EventFilter = {
        instanceID: 'test-instance',
        aggregateTypes: ['user'],
        owner: 'org-1',
        creator: 'admin',
      };

      const position = await eventstore.latestPosition(filter);

      // Should get position from first event only (user + org-1 + admin)
      expect(position.position).toBe(events[0].position.position);
    });
  });

  describe('Use Case: Catch-up Subscriptions', () => {
    it('should enable catch-up subscription pattern', async () => {
      // Initial events
      const initialCommands: Command[] = Array.from({ length: 5 }, (_, i) => ({
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: `user-${i}`,
        eventType: 'user.added',
        payload: { username: `user${i}` },
        creator: 'admin',
        owner: 'org-1',
      }));

      await eventstore.pushMany(initialCommands);

      // Get latest position (projection checkpoint)
      const checkpoint = await eventstore.latestPosition({
        instanceID: 'test-instance',
      });

      // New events arrive
      const newCommands: Command[] = Array.from({ length: 3 }, (_, i) => ({
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: `user-${i + 5}`,
        eventType: 'user.added',
        payload: { username: `user${i + 5}` },
        creator: 'admin',
        owner: 'org-1',
      }));

      await eventstore.pushMany(newCommands);

      // Catch up from checkpoint
      const newEvents = await eventstore.eventsAfterPosition(checkpoint);

      expect(newEvents).toHaveLength(3);
      expect(newEvents[0].aggregateID).toBe('user-5');
    });
  });

  describe('Priority 1 Edge Cases', () => {
    describe('Position Ties (Same Position, Different inTxOrder)', () => {
      it('should return highest inTxOrder for same position', async () => {
        // Push multiple events in same transaction (same position, different inTxOrder)
        const commands: Command[] = Array.from({ length: 5 }, (_, i) => ({
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: `user-${i}`,
          eventType: 'user.added',
          payload: { username: `user${i}` },
          creator: 'admin',
          owner: 'org-1',
        }));

        const events = await eventstore.pushMany(commands);

        // All events in same transaction should have same position but different inTxOrder
        const position = await eventstore.latestPosition({
          instanceID: 'test-instance',
        });

        // Should return the last event's position and inTxOrder
        const lastEvent = events[events.length - 1];
        expect(position.position).toBe(lastEvent.position.position);
        expect(position.inTxOrder).toBe(lastEvent.position.inTxOrder);
      });

      it('should handle position comparison correctly with ties', async () => {
        // First batch
        const batch1: Command[] = Array.from({ length: 3 }, (_, i) => ({
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: `batch1-${i}`,
          eventType: 'user.added',
          payload: { batch: 1 },
          creator: 'admin',
          owner: 'org-1',
        }));

        const events1 = await eventstore.pushMany(batch1);
        const checkpoint1 = events1[events1.length - 1].position;

        // Second batch (different transaction, different position)
        const batch2: Command[] = Array.from({ length: 3 }, (_, i) => ({
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: `batch2-${i}`,
          eventType: 'user.added',
          payload: { batch: 2 },
          creator: 'admin',
          owner: 'org-1',
        }));

        await eventstore.pushMany(batch2);

        // Events after checkpoint should only include batch2
        const newEvents = await eventstore.eventsAfterPosition(checkpoint1);
        expect(newEvents).toHaveLength(3);
        expect(newEvents.every(e => e.payload?.batch === 2)).toBe(true);
      });
    });

    describe('Concurrent Event Insertion', () => {
      it('should handle concurrent insertions during position query', async () => {
        // Insert initial events
        const initial: Command[] = Array.from({ length: 10 }, (_, i) => ({
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: `user-${i}`,
          eventType: 'user.added',
          payload: { username: `user${i}` },
          creator: 'admin',
          owner: 'org-1',
        }));

        await eventstore.pushMany(initial);

        // Query position and insert concurrently
        const [position1, _] = await Promise.all([
          eventstore.latestPosition({ instanceID: 'test-instance' }),
          eventstore.pushMany([
            {
              instanceID: 'test-instance',
              aggregateType: 'user',
              aggregateID: 'user-concurrent',
              eventType: 'user.added',
              payload: { username: 'concurrent' },
              creator: 'admin',
              owner: 'org-1',
            },
          ]),
        ]);

        // Query again after concurrent insert
        const position2 = await eventstore.latestPosition({
          instanceID: 'test-instance',
        });

        // Position 2 should be >= position 1 (monotonically increasing)
        expect(
          position2.position > position1.position ||
          (position2.position === position1.position && position2.inTxOrder >= position1.inTxOrder)
        ).toBe(true);
      });

      it('should maintain position consistency under concurrent load', async () => {
        const commands: Command[] = Array.from({ length: 20 }, (_, i) => ({
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: `user-${i}`,
          eventType: 'user.added',
          payload: { username: `user${i}` },
          creator: 'admin',
          owner: 'org-1',
        }));

        // Insert events concurrently in batches
        await Promise.all([
          eventstore.pushMany(commands.slice(0, 5)),
          eventstore.pushMany(commands.slice(5, 10)),
          eventstore.pushMany(commands.slice(10, 15)),
          eventstore.pushMany(commands.slice(15, 20)),
        ]);

        // Get latest position
        const finalPosition = await eventstore.latestPosition({
          instanceID: 'test-instance',
        });

        // All 20 events should exist
        const allEvents = await eventstore.query({
          instanceID: 'test-instance',
        });
        expect(allEvents).toHaveLength(20);

        // Position should be from one of the last events
        expect(finalPosition.position).toBeGreaterThan(0);
      });
    });

    describe('Zero Position Edge Cases', () => {
      it('should return zero position for non-existent instance', async () => {
        const position = await eventstore.latestPosition({
          instanceID: 'non-existent-instance',
        });

        expect(position.position).toBe(0);
        expect(position.inTxOrder).toBe(0);
      });

      it('should return zero position when all filters match nothing', async () => {
        // Add some events
        await eventstore.pushMany([
          {
            instanceID: 'test-instance',
            aggregateType: 'user',
            aggregateID: 'user-1',
            eventType: 'user.added',
            payload: { username: 'john' },
            creator: 'admin',
            owner: 'org-1',
          },
        ]);

        // Query with filter that matches nothing
        const position = await eventstore.latestPosition({
          instanceID: 'test-instance',
          aggregateTypes: ['non-existent-type'],
        });

        expect(position.position).toBe(0);
        expect(position.inTxOrder).toBe(0);
      });
    });
  });
});
