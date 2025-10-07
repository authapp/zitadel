import { DatabasePool } from '../../../src/lib/database/pool';
import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import {
  Command,
  EventFilter,
  SearchQuery,
  EventstoreConfig,
  EventValidationError,
  ConcurrencyError,
} from '../../../src/lib/eventstore/types';

// Mock the database pool
const mockQuery = jest.fn();
const mockQueryOne = jest.fn();
const mockQueryMany = jest.fn();
const mockWithTransaction = jest.fn();
const mockClose = jest.fn();

const mockDb = {
  query: mockQuery,
  queryOne: mockQueryOne,
  queryMany: mockQueryMany,
  withTransaction: mockWithTransaction,
  close: mockClose,
} as unknown as DatabasePool;

// Mock the ID generator
jest.mock('@/id/snowflake', () => ({
  generateId: jest.fn(() => 'test-event-id'),
}));

describe('PostgresEventstore', () => {
  let eventstore: PostgresEventstore;
  let config: EventstoreConfig;

  beforeEach(() => {
    config = {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
      pushTimeout: 30000,
    };
    eventstore = new PostgresEventstore(mockDb, config);
    jest.clearAllMocks();
  });

  describe('push', () => {
    it('should push a single command as event', async () => {
      const command: Command = {
        aggregateType: 'user',
        aggregateID: 'user-123',
        eventType: 'user.created',
        payload: { name: 'John Doe' },
        creator: 'admin',
        owner: 'org-123',
        instanceID: 'test-instance',
      };

      const mockTx = {
        query: jest.fn()
          // getCurrentVersion: SELECT ... FOR UPDATE (returns empty for new aggregate)
          .mockResolvedValueOnce({
            rows: [],
          })
          // insertEvent: INSERT
          .mockResolvedValueOnce({
            rows: [{ created_at: new Date(), position: '1.0' }],
          }),
      };

      mockWithTransaction.mockImplementation(async (fn) => {
        return await fn(mockTx);
      });

      const result = await eventstore.push(command);

      expect(result).toMatchObject({
        eventType: 'user.created',
        aggregateType: 'user',
        aggregateID: 'user-123',
        aggregateVersion: 1n,
        payload: { name: 'John Doe' },
        creator: 'admin',
        owner: 'org-123',
        instanceID: 'test-instance',
      });

      expect(mockWithTransaction).toHaveBeenCalledTimes(1);
      expect(mockTx.query).toHaveBeenCalledTimes(2);
    });

    it('should validate command before pushing', async () => {
      const invalidCommand: Partial<Command> = {
        aggregateType: 'user',
        // Missing required fields
      };

      await expect(
        eventstore.push(invalidCommand as Command)
      ).rejects.toThrow(EventValidationError);
    });

    it('should reject batch that exceeds max size', async () => {
      const commands = Array(101).fill({
        aggregateType: 'user',
        aggregateID: 'user-123',
        eventType: 'user.created',
        payload: {},
        creator: 'admin',
        owner: 'org-123',
        instanceID: 'test-instance',
      });

      await expect(eventstore.pushMany(commands)).rejects.toThrow();
    });
  });

  describe('pushWithConcurrencyCheck', () => {
    it('should push events with version check', async () => {
      const commands: Command[] = [{
        aggregateType: 'user',
        aggregateID: 'user-123',
        eventType: 'user.updated',
        payload: { name: 'Jane Doe' },
        creator: 'admin',
        owner: 'org-123',
        instanceID: 'test-instance',
      }];

      const mockTx = {
        query: jest.fn()
          // getCurrentVersion: SELECT ... FOR UPDATE → returns version 1
          .mockResolvedValueOnce({ rows: [{ version: 1 }] })
          // insertEvent: INSERT
          .mockResolvedValueOnce({ rows: [{ created_at: new Date(), position: '2.0' }] }),
      };

      mockWithTransaction.mockImplementation(async (fn) => {
        return await fn(mockTx);
      });

      const result = await eventstore.pushWithConcurrencyCheck(commands, 1);

      expect(result).toHaveLength(1);
      expect(result[0].aggregateVersion).toBe(2n);
    });

    it('should throw ConcurrencyError on version mismatch', async () => {
      const commands: Command[] = [{
        aggregateType: 'user',
        aggregateID: 'user-123',
        eventType: 'user.updated',
        payload: { name: 'Jane Doe' },
        creator: 'admin',
        owner: 'org-123',
        instanceID: 'test-instance',
      }];

      const mockTx = {
        query: jest.fn().mockResolvedValueOnce({ rows: [{ version: 2 }] }),
      };

      mockWithTransaction.mockImplementation(async (fn) => {
        return await fn(mockTx);
      });

      await expect(
        eventstore.pushWithConcurrencyCheck(commands, 1)
      ).rejects.toThrow(ConcurrencyError);
    });

    it('should reject commands for different aggregates', async () => {
      const commands: Command[] = [
        {
          aggregateType: 'user',
          aggregateID: 'user-123',
          eventType: 'user.updated',
          payload: {},
          creator: 'admin',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
        {
          aggregateType: 'user',
          aggregateID: 'user-456', // Different aggregate ID
          eventType: 'user.updated',
          payload: {},
          creator: 'admin',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
      ];

      await expect(
        eventstore.pushWithConcurrencyCheck(commands, 1)
      ).rejects.toThrow();
    });
  });

  describe('query', () => {
    it('should query events by filter', async () => {
      const filter: EventFilter = {
        aggregateTypes: ['user'],
        owner: 'org-123',
      };

      const mockRows = [{
        instance_id: 'test-instance',
        aggregate_type: 'user',
        aggregate_id: 'user-123',
        event_type: 'user.created',
        aggregate_version: '1',
        revision: 1,
        created_at: new Date(),
        payload: '{"name":"John Doe"}',
        creator: 'admin',
        owner: 'org-123',
        position: '1',
        in_tx_order: 0,
      }];

      mockQueryMany.mockResolvedValueOnce(mockRows);

      const result = await eventstore.query(filter);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        eventType: 'user.created',
        aggregateType: 'user',
        aggregateID: 'user-123',
        payload: { name: 'John Doe' },
      });
    });

    it('should build correct query with multiple filters', async () => {
      const filter: EventFilter = {
        aggregateTypes: ['user', 'organization'],
        eventTypes: ['user.created', 'org.created'],
        owner: 'org-123',
        instanceID: 'test-instance',
        limit: 10,
      };

      mockQueryMany.mockResolvedValueOnce([]);

      await eventstore.query(filter);

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('aggregate_type = ANY($1)'),
        expect.arrayContaining([['user', 'organization']])
      );
    });
  });

  describe('latestEvent', () => {
    it('should return latest event for aggregate', async () => {
      const mockRow = {
        instance_id: 'test-instance',
        aggregate_type: 'user',
        aggregate_id: 'user-123',
        event_type: 'user.updated',
        aggregate_version: '2',
        revision: 1,
        created_at: new Date(),
        payload: '{"name":"Jane Doe"}',
        creator: 'admin',
        owner: 'org-123',
        position: '2',
        in_tx_order: 0,
      };

      mockQueryOne.mockResolvedValueOnce(mockRow);

      const result = await eventstore.latestEvent('user', 'user-123');

      expect(result).toMatchObject({
        eventType: 'user.updated',
        aggregateVersion: 2n,
      });
    });

    it('should return null if no events found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const result = await eventstore.latestEvent('user', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('aggregate', () => {
    it('should reconstruct aggregate from events', async () => {
      const mockRows = [
        {
          instance_id: 'test-instance',
          aggregate_type: 'user',
          aggregate_id: 'user-123',
          event_type: 'user.created',
          aggregate_version: '1',
          revision: 1,
          created_at: new Date(),
          payload: '{"name":"John Doe"}',
          creator: 'admin',
          owner: 'org-123',
          position: '1',
          in_tx_order: 0,
        },
        {
          instance_id: 'test-instance',
          aggregate_type: 'user',
          aggregate_id: 'user-123',
          event_type: 'user.updated',
          aggregate_version: '2',
          revision: 1,
          created_at: new Date(),
          payload: '{"name":"Jane Doe"}',
          creator: 'admin',
          owner: 'org-123',
          position: '2',
          in_tx_order: 0,
        },
      ];

      mockQueryMany.mockResolvedValueOnce(mockRows);

      const result = await eventstore.aggregate('user', 'user-123');

      expect(result).toMatchObject({
        id: 'user-123',
        type: 'user',
        version: 2n,
        owner: 'org-123',
        instanceID: 'test-instance',
      });
      expect(result?.events).toHaveLength(2);
    });

    it('should return null if aggregate not found', async () => {
      mockQueryMany.mockResolvedValueOnce([]);

      const result = await eventstore.aggregate('user', 'user-123');

      expect(result).toBeNull();
    });

    it('should limit events to specific version', async () => {
      const mockRows = [{
        id: 'event-1',
        event_type: 'user.created',
        aggregate_type: 'user',
        aggregate_id: 'user-123',
        aggregate_version: 1,
        event_data: '{"name":"John Doe"}',
        editor_user: 'admin',
        editor_service: null,
        resource_owner: 'org-123',
        instance_id: 'test-instance',
        position: '1',
        in_position_order: 0,
        creation_date: new Date(),
        revision: 1,
      }];

      mockQueryMany.mockResolvedValueOnce(mockRows);

      await eventstore.aggregate('user', 'user-123', 1);

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('aggregate_version <= $3'),
        expect.arrayContaining(['user', 'user-123', 1])
      );
    });
  });

  describe('search', () => {
    it('should search with multiple filters', async () => {
      const query: SearchQuery = {
        filters: [
          { aggregateTypes: ['user'] },
          { aggregateTypes: ['organization'] },
        ],
        limit: 10,
        desc: true,
      };

      mockQueryMany.mockResolvedValueOnce([]);

      await eventstore.search(query);

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('UNION'),
        expect.any(Array)
      );
    });

    it('should return empty array for empty filters', async () => {
      const query: SearchQuery = {
        filters: [],
      };

      const result = await eventstore.search(query);

      expect(result).toEqual([]);
      expect(mockQueryMany).not.toHaveBeenCalled();
    });
  });

  describe('count', () => {
    it('should count events matching filter', async () => {
      const filter: EventFilter = {
        aggregateTypes: ['user'],
      };

      mockQueryOne.mockResolvedValueOnce({ count: '5' });

      const result = await eventstore.count(filter);

      expect(result).toBe(5);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count'),
        expect.any(Array)
      );
    });

    it('should return 0 if no result', async () => {
      const filter: EventFilter = {
        aggregateTypes: ['user'],
      };

      mockQueryOne.mockResolvedValueOnce(null);

      const result = await eventstore.count(filter);

      expect(result).toBe(0);
    });
  });

  describe('eventsAfterPosition', () => {
    it('should get events after specific position', async () => {
      const position = { position: 5, inTxOrder: 2 };
      const mockRows = [{
        instance_id: 'test-instance',
        aggregate_type: 'user',
        aggregate_id: 'user-123',
        event_type: 'user.updated',
        aggregate_version: '3',
        revision: 1,
        created_at: new Date(),
        payload: '{}',
        creator: 'admin',
        owner: 'org-123',
        position: '6',
        in_tx_order: 0,
      }];

      mockQueryMany.mockResolvedValueOnce(mockRows);

      const result = await eventstore.eventsAfterPosition(position, 100);

      expect(result).toHaveLength(1);
      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('"position" > $1'),
        expect.arrayContaining(['5', 2, 100])
      );
    });
  });

  describe('health', () => {
    it('should return true when database is healthy', async () => {
      mockQuery.mockResolvedValueOnce({});

      const result = await eventstore.health();

      expect(result).toBe(true);
    });

    it('should return false when database query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const result = await eventstore.health();

      expect(result).toBe(false);
    });
  });

  describe('close', () => {
    it('should close database connections', async () => {
      await eventstore.close();

      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });
});
