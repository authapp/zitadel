import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { createTestDatabase, cleanDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database/pool';
import {
  Command,
  QueryBuilder,
  query,
  queryByAggregateTypes,
  queryByAggregateIDs,
  queryByEventTypes,
} from '../../../src/lib/eventstore';

describe('Integration: Advanced Query Builder', () => {
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

  describe('Basic Query Building', () => {
    it('should build simple query with aggregate types', () => {
      const searchQuery = new QueryBuilder()
        .aggregateTypes('user')
        .build();

      expect(searchQuery.queries).toHaveLength(1);
      expect(searchQuery.queries![0].aggregateTypes).toEqual(['user']);
    });

    it('should build query with multiple aggregate types', () => {
      const searchQuery = new QueryBuilder()
        .aggregateTypes('user', 'org')
        .build();

      expect(searchQuery.queries![0].aggregateTypes).toEqual(['user', 'org']);
    });

    it('should build query with aggregate IDs', () => {
      const searchQuery = new QueryBuilder()
        .aggregateIDs('user-1', 'user-2')
        .build();

      expect(searchQuery.queries![0].aggregateIDs).toEqual(['user-1', 'user-2']);
    });

    it('should build query with event types', () => {
      const searchQuery = new QueryBuilder()
        .eventTypes('user.added', 'user.updated')
        .build();

      expect(searchQuery.queries![0].eventTypes).toEqual(['user.added', 'user.updated']);
    });

    it('should combine multiple filters in single query (AND logic)', () => {
      const searchQuery = new QueryBuilder()
        .aggregateTypes('user')
        .aggregateIDs('user-1')
        .eventTypes('user.added')
        .build();

      expect(searchQuery.queries![0]).toEqual({
        aggregateTypes: ['user'],
        aggregateIDs: ['user-1'],
        eventTypes: ['user.added'],
      });
    });
  });

  describe('OR Logic', () => {
    it('should build query with OR logic', () => {
      const searchQuery = new QueryBuilder()
        .aggregateTypes('user')
        .or()
        .aggregateTypes('org')
        .build();

      expect(searchQuery.queries).toHaveLength(2);
      expect(searchQuery.queries![0].aggregateTypes).toEqual(['user']);
      expect(searchQuery.queries![1].aggregateTypes).toEqual(['org']);
    });

    it('should execute OR query against database', async () => {
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
        {
          instanceID: 'test-instance',
          aggregateType: 'project',
          aggregateID: 'project-1',
          eventType: 'project.added',
          payload: { name: 'Project A' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      await eventstore.pushMany(commands);

      const searchQuery = query()
        .aggregateTypes('user')
        .or()
        .aggregateTypes('org')
        .build();

      const events = await eventstore.search(searchQuery);

      expect(events).toHaveLength(2);
      const types = events.map(e => e.aggregateType).sort();
      expect(types).toEqual(['org', 'user']);
    });

    it('should support multiple OR segments', async () => {
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: null,
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.added',
          payload: null,
          creator: 'admin',
          owner: 'system',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'project',
          aggregateID: 'project-1',
          eventType: 'project.added',
          payload: null,
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      await eventstore.pushMany(commands);

      const searchQuery = query()
        .aggregateTypes('user')
        .or()
        .aggregateTypes('org')
        .or()
        .aggregateTypes('project')
        .build();

      const events = await eventstore.search(searchQuery);
      expect(events).toHaveLength(3);
    });
  });

  describe('Exclusion Filters', () => {
    it('should exclude aggregate types', async () => {
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: null,
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.added',
          payload: null,
          creator: 'admin',
          owner: 'system',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'project',
          aggregateID: 'project-1',
          eventType: 'project.added',
          payload: null,
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      await eventstore.pushMany(commands);

      // Get all but exclude projects
      const searchQuery = query()
        .aggregateTypes('user', 'org', 'project')
        .excludeAggregateTypes('project')
        .build();

      const events = await eventstore.search(searchQuery);

      expect(events).toHaveLength(2);
      expect(events.map(e => e.aggregateType).sort()).toEqual(['org', 'user']);
    });

    it('should exclude event types', async () => {
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: null,
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.updated',
          payload: null,
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
      ];

      await eventstore.pushMany(commands);

      const searchQuery = query()
        .aggregateTypes('user')
        .excludeEventTypes('user.deleted')
        .build();

      const events = await eventstore.search(searchQuery);

      expect(events).toHaveLength(2);
      expect(events.map(e => e.eventType).sort()).toEqual(['user.added', 'user.updated']);
    });

    it('should exclude aggregate IDs', async () => {
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: null,
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: null,
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-3',
          eventType: 'user.added',
          payload: null,
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      await eventstore.pushMany(commands);

      const searchQuery = query()
        .aggregateTypes('user')
        .excludeAggregateIDs('user-2')
        .build();

      const events = await eventstore.search(searchQuery);

      expect(events).toHaveLength(2);
      expect(events.map(e => e.aggregateID).sort()).toEqual(['user-1', 'user-3']);
    });
  });

  describe('Ordering and Limits', () => {
    it('should limit results', async () => {
      const commands: Command[] = Array.from({ length: 10 }, (_, i) => ({
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: `user-${i}`,
        eventType: 'user.added',
        payload: null,
        creator: 'admin',
        owner: 'org-1',
      }));

      await eventstore.pushMany(commands);

      const searchQuery = query()
        .aggregateTypes('user')
        .limit(5)
        .build();

      const events = await eventstore.search(searchQuery);
      expect(events).toHaveLength(5);
    });

    it('should order descending', async () => {
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { order: 1 },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { order: 2 },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      await eventstore.pushMany(commands);

      const searchQuery = query()
        .aggregateTypes('user')
        .orderDescending()
        .build();

      const events = await eventstore.search(searchQuery);
      
      expect(events).toHaveLength(2);
      expect(events[0].payload?.order).toBe(2); // Newest first
      expect(events[1].payload?.order).toBe(1);
    });

    it('should order ascending (default)', async () => {
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { order: 1 },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { order: 2 },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      await eventstore.pushMany(commands);

      const searchQuery = query()
        .aggregateTypes('user')
        .orderAscending()
        .build();

      const events = await eventstore.search(searchQuery);
      
      expect(events).toHaveLength(2);
      expect(events[0].payload?.order).toBe(1); // Oldest first
      expect(events[1].payload?.order).toBe(2);
    });
  });

  describe('Helper Functions', () => {
    it('should use query() helper', () => {
      const searchQuery = query()
        .aggregateTypes('user')
        .build();

      expect(searchQuery.queries![0].aggregateTypes).toEqual(['user']);
    });

    it('should use queryByAggregateTypes helper', () => {
      const filter = queryByAggregateTypes('user', 'org');
      
      expect(filter.aggregateTypes).toEqual(['user', 'org']);
    });

    it('should use queryByAggregateIDs helper', () => {
      const filter = queryByAggregateIDs('user-1', 'user-2');
      
      expect(filter.aggregateIDs).toEqual(['user-1', 'user-2']);
    });

    it('should use queryByEventTypes helper', () => {
      const filter = queryByEventTypes('user.added', 'user.updated');
      
      expect(filter.eventTypes).toEqual(['user.added', 'user.updated']);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset builder', () => {
      const builder = new QueryBuilder()
        .aggregateTypes('user')
        .limit(10);

      let searchQuery = builder.build();
      expect(searchQuery.queries![0].aggregateTypes).toEqual(['user']);
      expect(searchQuery.limit).toBe(10);

      builder.reset().aggregateTypes('org');
      searchQuery = builder.build();
      
      expect(searchQuery.queries![0].aggregateTypes).toEqual(['org']);
      expect(searchQuery.limit).toBeUndefined();
    });
  });

  describe('Complex Real-World Scenarios', () => {
    it('should handle complex multi-tenant query', async () => {
      // Scenario: Get all user and org events, but exclude deleted events
      const commands: Command[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: null,
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
        {
          instanceID: 'test-instance',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.added',
          payload: null,
          creator: 'admin',
          owner: 'system',
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'project',
          aggregateID: 'project-1',
          eventType: 'project.added',
          payload: null,
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      await eventstore.pushMany(commands);

      const searchQuery = query()
        .aggregateTypes('user')
        .or()
        .aggregateTypes('org')
        .excludeEventTypes('user.deleted')
        .limit(10)
        .build();

      const events = await eventstore.search(searchQuery);

      expect(events).toHaveLength(2); // user.added and org.added only
      expect(events.find(e => e.eventType === 'user.deleted')).toBeUndefined();
    });
  });
});
