import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { createTestDatabase, cleanDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database/pool';
import { SubscriptionManager, globalSubscriptionManager } from '../../../src/lib/eventstore';

describe('Integration: Event Subscriptions', () => {
  let eventstore: PostgresEventstore;
  let db: DatabasePool;
  let subscriptionManager: SubscriptionManager;

  beforeAll(async () => {
    db = await createTestDatabase();
    eventstore = new PostgresEventstore(db, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
    });
    subscriptionManager = new SubscriptionManager();
  });

  afterAll(async () => {
    subscriptionManager.closeAll();
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
    subscriptionManager.cleanup();
    // Close all active subscriptions from previous tests
    globalSubscriptionManager.closeAll();
    // Wait for any pending notifications to complete
    await new Promise(resolve => setImmediate(resolve));
  });

  describe('Subscribe to Aggregates', () => {
    it('should receive events for subscribed aggregate types', async () => {
      const subscription = globalSubscriptionManager.subscribeAggregates('user');
      const receivedEvents: any[] = [];

      // Start listening in background
      const listenerPromise = (async () => {
        let count = 0;
        for await (const event of subscription) {
          receivedEvents.push(event);
          count++;
          if (count >= 2) {
            subscription.unsubscribe();
            break;
          }
        }
      })();

      // Give listener time to set up
      await new Promise(resolve => setTimeout(resolve, 50));

      // Push events
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
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: 'jane' },
          creator: 'admin',
          owner: 'org-1',
        },
      ]);

      await listenerPromise;

      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0].aggregateType).toBe('user');
      expect(receivedEvents[1].aggregateType).toBe('user');
    });

    it('should not receive events for unsubscribed aggregate types', async () => {
      const subscription = globalSubscriptionManager.subscribeAggregates('user');
      const receivedEvents: any[] = [];

      const listenerPromise = (async () => {
        const timeout = setTimeout(() => subscription.unsubscribe(), 200);
        for await (const event of subscription) {
          receivedEvents.push(event);
        }
        clearTimeout(timeout);
      })();

      await new Promise(resolve => setTimeout(resolve, 50));

      // Push event for different aggregate type
      await eventstore.pushMany([
        {
          instanceID: 'test-instance',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.added',
          payload: { name: 'ACME' },
          creator: 'admin',
          owner: 'system',
        },
      ]);

      await new Promise(resolve => setTimeout(resolve, 100));
      subscription.unsubscribe();
      await listenerPromise;

      expect(receivedEvents).toHaveLength(0);
    });

    it('should support multiple aggregate types in single subscription', async () => {
      const subscription = globalSubscriptionManager.subscribeAggregates('user', 'org');
      const receivedEvents: any[] = [];

      const listenerPromise = (async () => {
        let count = 0;
        for await (const event of subscription) {
          receivedEvents.push(event);
          count++;
          if (count >= 2) {
            subscription.unsubscribe();
            break;
          }
        }
      })();

      await new Promise(resolve => setTimeout(resolve, 50));

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
        {
          instanceID: 'test-instance',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.added',
          payload: { name: 'ACME' },
          creator: 'admin',
          owner: 'system',
        },
      ]);

      await listenerPromise;

      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents.map(e => e.aggregateType).sort()).toEqual(['org', 'user']);
    });
  });

  describe('Subscribe to Event Types', () => {
    it('should receive only specified event types', async () => {
      const subscription = globalSubscriptionManager.subscribeEventTypes(
        new Map([['user', ['user.added']]])
      );
      const receivedEvents: any[] = [];

      const listenerPromise = (async () => {
        const timeout = setTimeout(() => subscription.unsubscribe(), 300);
        for await (const event of subscription) {
          receivedEvents.push(event);
        }
        clearTimeout(timeout);
      })();

      await new Promise(resolve => setTimeout(resolve, 50));

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
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.updated',
          payload: { email: 'john@example.com' },
          creator: 'admin',
          owner: 'org-1',
        },
      ]);

      await new Promise(resolve => setTimeout(resolve, 150));
      subscription.unsubscribe();
      await listenerPromise;

      // Should only receive user.added, not user.updated
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].eventType).toBe('user.added');
    });

    it('should support multiple event types per aggregate', async () => {
      const subscription = globalSubscriptionManager.subscribeEventTypes(
        new Map([['user', ['user.added', 'user.updated']]])
      );
      const receivedEvents: any[] = [];

      const listenerPromise = (async () => {
        let count = 0;
        for await (const event of subscription) {
          receivedEvents.push(event);
          count++;
          if (count >= 2) {
            subscription.unsubscribe();
            break;
          }
        }
      })();

      await new Promise(resolve => setTimeout(resolve, 50));

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
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.updated',
          payload: { email: 'john@example.com' },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.deleted',
          payload: null,
          creator: 'admin',
          owner: 'org-1',
        },
      ]);

      await listenerPromise;

      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents.map(e => e.eventType).sort()).toEqual(['user.added', 'user.updated']);
    });
  });

  describe('Multiple Subscriptions', () => {
    it('should support multiple concurrent subscriptions', async () => {
      const sub1 = globalSubscriptionManager.subscribeAggregates('user');
      const sub2 = globalSubscriptionManager.subscribeAggregates('user');
      const sub3 = globalSubscriptionManager.subscribeAggregates('org');

      const received1: any[] = [];
      const received2: any[] = [];
      const received3: any[] = [];

      const listener1 = (async () => {
        const timeout = setTimeout(() => sub1.unsubscribe(), 300);
        for await (const event of sub1) {
          received1.push(event);
        }
        clearTimeout(timeout);
      })();

      const listener2 = (async () => {
        const timeout = setTimeout(() => sub2.unsubscribe(), 300);
        for await (const event of sub2) {
          received2.push(event);
        }
        clearTimeout(timeout);
      })();

      const listener3 = (async () => {
        const timeout = setTimeout(() => sub3.unsubscribe(), 300);
        for await (const event of sub3) {
          received3.push(event);
        }
        clearTimeout(timeout);
      })();

      await new Promise(resolve => setTimeout(resolve, 50));

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
        {
          instanceID: 'test-instance',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.added',
          payload: { name: 'ACME' },
          creator: 'admin',
          owner: 'system',
        },
      ]);

      await new Promise(resolve => setTimeout(resolve, 150));
      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();

      await Promise.all([listener1, listener2, listener3]);

      // Both user subscriptions should receive the user event
      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
      expect(received1[0].aggregateType).toBe('user');
      expect(received2[0].aggregateType).toBe('user');

      // Org subscription should receive the org event
      expect(received3).toHaveLength(1);
      expect(received3[0].aggregateType).toBe('org');
    });
  });

  describe('Unsubscribe', () => {
    it('should stop receiving events after unsubscribe', async () => {
      const subscription = globalSubscriptionManager.subscribeAggregates('user');
      const receivedEvents: any[] = [];

      const listenerPromise = (async () => {
        for await (const event of subscription) {
          receivedEvents.push(event);
        }
      })();

      await new Promise(resolve => setTimeout(resolve, 50));

      // Push first event
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

      await new Promise(resolve => setTimeout(resolve, 50));

      // Unsubscribe
      subscription.unsubscribe();

      // Push second event (should not be received)
      await eventstore.pushMany([
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: 'jane' },
          creator: 'admin',
          owner: 'org-1',
        },
      ]);

      await listenerPromise;

      // Should only have received first event
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].payload?.username).toBe('john');
    });

    it('should mark subscription as inactive after unsubscribe', () => {
      const subscription = globalSubscriptionManager.subscribeAggregates('user');
      expect(subscription.isActive()).toBe(true);

      subscription.unsubscribe();
      expect(subscription.isActive()).toBe(false);
    });
  });

  describe('Real-World Use Cases', () => {
    it('should enable building real-time dashboards', async () => {
      // Scenario: Dashboard showing live user registrations
      const subscription = globalSubscriptionManager.subscribeEventTypes(
        new Map([['user', ['user.registered']]])
      );

      const dashboard = {
        totalUsers: 0,
        recentUsers: [] as string[],
      };

      const updateDashboard = (async () => {
        const timeout = setTimeout(() => subscription.unsubscribe(), 300);
        for await (const event of subscription) {
          dashboard.totalUsers++;
          dashboard.recentUsers.push(event.payload?.email);
        }
        clearTimeout(timeout);
      })();

      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate user registrations
      await eventstore.pushMany([
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.registered',
          payload: { email: 'alice@example.com' },
          creator: 'system',
          owner: 'org-1',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.registered',
          payload: { email: 'bob@example.com' },
          creator: 'system',
          owner: 'org-1',
        },
      ]);

      await new Promise(resolve => setTimeout(resolve, 150));
      subscription.unsubscribe();
      await updateDashboard;

      expect(dashboard.totalUsers).toBe(2);
      expect(dashboard.recentUsers).toEqual(['alice@example.com', 'bob@example.com']);
    });
  });
});
