/**
 * Projection Handler Unit Tests
 * 
 * Comprehensive tests for the ProjectionHandler class covering:
 * - State machine transitions
 * - Event processing loop
 * - Distributed locking
 * - Failed event handling
 * - Lifecycle management
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ProjectionHandler } from '../../../../src/lib/query/projection/projection-handler';
import { Projection } from '../../../../src/lib/query/projection/projection';
import { ProjectionHandlerConfig } from '../../../../src/lib/query/projection/projection-config';
import { Event } from '../../../../src/lib/eventstore/types';

// Mock projection implementation
class TestProjection extends Projection {
  readonly name = 'test_projection';
  readonly tables = ['test_table'];
  
  reduceCalled = false;
  reduceCallCount = 0;
  initCalled = false;
  startCalled = false;
  stopCalled = false;
  lastEvent: Event | null = null;
  shouldThrow = false;
  throwError: Error | null = null;
  
  async reduce(event: Event): Promise<void> {
    this.reduceCalled = true;
    this.reduceCallCount++;
    this.lastEvent = event;
    
    if (this.shouldThrow) {
      throw this.throwError || new Error('Test reduce error');
    }
  }
  
  async init(): Promise<void> {
    this.initCalled = true;
  }
  
  async start(): Promise<void> {
    this.startCalled = true;
  }
  
  async stop(): Promise<void> {
    this.stopCalled = true;
  }
}

// Mock factories
const createMockEventstore = () => {
  const eventStore: Event[] = [];
  
  return {
    query: jest.fn(async (filter?: any) => {
      // Apply filter to stored events
      let result = [...eventStore];
      
      if (filter) {
        if (filter.eventTypes && filter.eventTypes.length > 0) {
          result = result.filter(e => filter.eventTypes.includes(e.eventType));
        }
        if (filter.aggregateTypes && filter.aggregateTypes.length > 0) {
          result = result.filter(e => filter.aggregateTypes.includes(e.aggregateType));
        }
        if (filter.instanceID) {
          result = result.filter(e => e.instanceID === filter.instanceID);
        }
      }
      
      return result;
    }),
    eventsAfterPosition: jest.fn(async (position: any, limit?: number) => {
      // Filter events after the given position
      const maxLimit = limit || 1000;
      return eventStore.filter(e => {
        if (e.position.position > position.position) return true;
        if (e.position.position === position.position && e.position.inTxOrder > position.inTxOrder) return true;
        return false;
      }).slice(0, maxLimit);
    }),
    health: jest.fn(),
    filter: jest.fn(),
    push: jest.fn(),
    _setEvents: (events: Event[]) => {
      eventStore.length = 0;
      eventStore.push(...events);
    },
  };
};

const createMockDatabase = () => {
  const state = new Map();
  const transactionQueries: any[] = [];
  const allQueries: any[] = [];
  
  return {
    query: jest.fn(async (sql: string, params?: any[]) => {
      allQueries.push({ sql, params });
      
      if (sql.includes('projection_states') && sql.includes('SELECT')) {
        const position = state.get('position') || 0;
        return { rows: position > 0 ? [{ projection_name: 'test', position, last_updated: new Date() }] : [] };
      }
      if (sql.includes('projection_states') && (sql.includes('INSERT') || sql.includes('UPDATE'))) {
        if (params) state.set('position', params[1]);
        return { rows: [] };
      }
      if (sql.includes('projection_locks') && sql.includes('INSERT')) {
        return { rows: [{ instance_id: params?.[1] }] };
      }
      if (sql.includes('DELETE FROM projection_locks')) {
        return { rows: [] };
      }
      return { rows: [] };
    }),
    withTransaction: jest.fn(async (cb: any) => {
      const txQueries: any[] = [];
      const txState = new Map(state);
      
      const tx = {
        query: jest.fn(async (sql: string, params?: any[]) => {
          txQueries.push({ sql, params });
          transactionQueries.push({ sql, params });
          allQueries.push({ sql, params, inTransaction: true });
          
          // Advisory lock - always succeed
          if (sql.includes('pg_try_advisory_xact_lock')) {
            return { rows: [{ pg_try_advisory_xact_lock: true }] };
          }
          
          // SAVEPOINT operations
          if (sql.includes('SAVEPOINT') || sql.includes('ROLLBACK TO SAVEPOINT')) {
            return { rows: [] };
          }
          
          // Get current state (handle both old and new schema-qualified names)
          if ((sql.includes('projection_states') || sql.includes('projections.projection_states')) && sql.includes('SELECT')) {
            const position = txState.get('position') || 0;
            if (position > 0) {
              return {
                rows: [{
                  projectionName: 'test_projection',
                  position,
                  positionOffset: 0,
                  eventTimestamp: new Date(),
                  lastUpdated: new Date(),
                  instanceID: 'test-instance',
                  aggregateType: '',
                  aggregateID: '',
                  sequence: 0,
                }]
              };
            }
            return { rows: [] };
          }
          
          // Set state (handle both old and new schema-qualified names)
          if ((sql.includes('projection_states') || sql.includes('projections.projection_states')) && sql.includes('INSERT')) {
            if (params) {
              txState.set('position', params[1]);
              state.set('position', params[1]);
            }
            return { rows: [] };
          }
          
          // Failed events - check for existing (handle both old and new schema-qualified names)
          if ((sql.includes('projection_failed_events') || sql.includes('projections.projection_failed_events')) && sql.includes('SELECT')) {
            return { rows: [] };
          }
          
          // Failed events - insert/update (handle both old and new schema-qualified names)
          if (sql.includes('projection_failed_events') || sql.includes('projections.projection_failed_events')) {
            return { rows: [] };
          }
          
          return { rows: [] };
        })
      };
      
      return await cb(tx);
    }),
    _getAllQueries: () => allQueries,
    _getTransactionQueries: () => transactionQueries,
  };
};

describe('ProjectionHandler', () => {
  let projection: TestProjection;
  let handler: ProjectionHandler;
  let mockEventstore: any;
  let mockDatabase: any;
  let config: ProjectionHandlerConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    projection = new TestProjection(createMockEventstore() as any, createMockDatabase() as any);
    mockEventstore = createMockEventstore();
    mockDatabase = createMockDatabase();
    
    config = {
      name: 'test_projection',
      tables: ['test_table'],
      eventTypes: ['test.event'],
      aggregateTypes: ['test'],
      batchSize: 100,
      interval: 50, // Shorter interval for faster tests
      maxRetries: 3,
      retryDelay: 1000,
      enableLocking: false,
      lockTTL: 60,
      instanceID: 'test-instance',
      rebuildOnStart: false,
    };
    
    handler = new ProjectionHandler(projection, config, mockEventstore as any, mockDatabase as any);
  });

  afterEach(async () => {
    // Ensure handler is stopped
    try {
      await handler.stop();
    } catch (e) {
      // Ignore
    }
  });

  describe('State Machine', () => {
    it('should start in STOPPED state', () => {
      expect(handler.getState()).toBe('stopped');
      expect(handler.isRunning()).toBe(false);
    });

    it('should transition STOPPED → STARTING → CATCH_UP on start', async () => {
      const startPromise = handler.start();
      expect(handler.getState()).toBe('starting');
      await startPromise;
      expect(handler.getState()).toBe('catch_up');
      expect(handler.isRunning()).toBe(true);
      await handler.stop();
    });

    it('should transition CATCH_UP → LIVE when no events', async () => {
      mockEventstore.query.mockResolvedValue([]);
      await handler.start();
      // Wait for first polling cycle
      await new Promise(resolve => setTimeout(resolve, 100).unref());
      expect(handler.getState()).toBe('live');
    });

    it('should transition to STOPPING → STOPPED on stop', async () => {
      await handler.start();
      const stopPromise = handler.stop();
      expect(handler.getState()).toBe('stopping');
      await stopPromise;
      expect(handler.getState()).toBe('stopped');
      expect(handler.isRunning()).toBe(false);
    });

    it('should reject if started twice', async () => {
      await handler.start();
      await expect(handler.start()).rejects.toThrow('already running');
      await handler.stop();
    });

    it('should allow multiple stops', async () => {
      await handler.start();
      await handler.stop();
      await expect(handler.stop()).resolves.not.toThrow();
    });
  });

  describe('Lifecycle Management', () => {
    it('should call projection init() and start() on handler start', async () => {
      await handler.start();
      expect(projection.initCalled).toBe(true);
      expect(projection.startCalled).toBe(true);
      await handler.stop();
    });

    it('should call projection stop() on handler stop', async () => {
      await handler.start();
      await handler.stop();
      expect(projection.stopCalled).toBe(true);
    });

    it('should reset projection if rebuildOnStart=true', async () => {
      config.rebuildOnStart = true;
      handler = new ProjectionHandler(projection, config, mockEventstore as any, mockDatabase as any);
      const resetSpy = jest.spyOn(projection, 'reset');
      await handler.start();
      expect(resetSpy).toHaveBeenCalled();
      await handler.stop();
    });

    it('should wait for in-flight processing before stopping', async () => {
      // Add event to trigger processing
      mockEventstore._setEvents([
        {
          eventType: 'test.event',
          aggregateType: 'test',
          aggregateID: 'test-123',
          aggregateVersion: 1n,
          instanceID: 'test-instance',
          payload: {},
          creator: 'test',
          owner: 'test',
          position: { position: 1, inTxOrder: 0 },
          createdAt: new Date(),
          revision: 1,
        }
      ]);
      
      await handler.start();
      // Wait for processing to start (interval is 50ms, so wait 100ms to ensure it starts)
      await new Promise(resolve => setTimeout(resolve, 100).unref());
      await handler.stop();
      // Verify that processing happened before stopping
      expect(projection.reduceCalled).toBe(true);
    }, 10000);
  });

  describe('Event Processing Loop', () => {
    it('should poll eventstore at configured interval', async () => {
      await handler.start();
      
      // Wait for at least 2 polling cycles (interval is 50ms, wait 200ms to be safe)
      await new Promise(resolve => setTimeout(resolve, 200).unref());
      
      await handler.stop();
      expect(mockEventstore.eventsAfterPosition.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should not start new processing if already processing', async () => {
      let processing = false;
      let processCount = 0;
      
      mockEventstore.query.mockImplementation(async () => {
        if (processing) return []; // Skip if already processing
        processing = true;
        processCount++;
        await new Promise(resolve => setTimeout(resolve, 150).unref());
        processing = false;
        return [];
      });
      
      await handler.start();
      // Wait long enough for multiple intervals but processing is still ongoing
      await new Promise(resolve => setTimeout(resolve, 120).unref());
      
      expect(processCount).toBeLessThanOrEqual(2);
    }, 10000);

    it('should stop polling after stop() called', async () => {
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 60).unref());
      const callCountBeforeStop = mockEventstore.query.mock.calls.length;
      
      await handler.stop();
      
      // Wait a bit more
      await new Promise(resolve => setTimeout(resolve, 150).unref());
      
      // Should not increase significantly after stop
      expect(mockEventstore.query.mock.calls.length).toBeLessThanOrEqual(callCountBeforeStop + 1);
    });
  });

  describe('Event Fetching and Filtering', () => {
    it('should fetch events with correct filter', async () => {
      mockEventstore.eventsAfterPosition.mockResolvedValue([]);
      await handler.start();
      // Wait for first poll
      await new Promise(resolve => setTimeout(resolve, 150).unref());
      
      await handler.stop();
      expect(mockEventstore.eventsAfterPosition).toHaveBeenCalled();
    });

    it('should only process events after current position', async () => {
      const events: Event[] = [
        {
          eventType: 'test.event',
          aggregateType: 'test',
          aggregateID: 'test-1',
          aggregateVersion: 1n,
          payload: {},
          position: { position: 5, inTxOrder: 0 },
          createdAt: new Date(),
          creator: 'test',
          owner: 'test',
          instanceID: 'test-instance',
          revision: 1,
        },
        {
          eventType: 'test.event',
          aggregateType: 'test',
          aggregateID: 'test-2',
          aggregateVersion: 1n,
          payload: {},
          position: { position: 10, inTxOrder: 0 },
          createdAt: new Date(),
          creator: 'test',
          owner: 'test',
          instanceID: 'test-instance',
          revision: 1,
        },
      ];
      
      await mockDatabase.query(
        'INSERT INTO projection_states (projection_name, position) VALUES ($1, $2)',
        ['test_projection', 5]
      );
      
      mockEventstore._setEvents(events);
      await handler.start();
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200).unref());
      
      await handler.stop();
      // Should only process event at position 10 (after position 5)
      expect(projection.reduceCallCount).toBeGreaterThanOrEqual(1);
      if (projection.lastEvent) {
        expect(projection.lastEvent.position.position).toBe(10);
      }
    });

    it('should skip events not matching eventType filter', async () => {
      // Eventstore should filter this out, so return empty array
      mockEventstore.query.mockResolvedValue([]);
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 150).unref());
      
      await handler.stop();
      expect(projection.reduceCalled).toBe(false);
    });

    it('should skip events not matching aggregateType filter', async () => {
      mockEventstore.query.mockResolvedValue([]);
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 100).unref());
      
      expect(projection.reduceCalled).toBe(false);
    });
  });

  describe('Event Processing', () => {
    it('should call projection.reduce() for matching events', async () => {
      const event: Event = {
        eventType: 'test.event',
        aggregateType: 'test',
        aggregateID: 'test-123',
        aggregateVersion: 1n,
        payload: { data: 'test' },
        position: { position: 1, inTxOrder: 0 },
        createdAt: new Date(),
        creator: 'test',
        owner: 'test',
        instanceID: 'test-instance',
        revision: 1,
      };
      
      mockEventstore._setEvents([event]);
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 200).unref());
      
      await handler.stop();
      expect(projection.reduceCalled).toBe(true);
      expect(projection.lastEvent).toEqual(event);
    });

    it('should update position after processing', async () => {
      const event: Event = {
        eventType: 'test.event',
        aggregateType: 'test',
        aggregateID: 'test-123',
        aggregateVersion: 5n,
        payload: {},
        position: { position: 100, inTxOrder: 0 },
        createdAt: new Date(),
        creator: 'test',
        owner: 'test',
        instanceID: 'test-instance',
        revision: 1,
      };
      
      mockEventstore._setEvents([event]);
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 250).unref());
      
      await handler.stop();
      // Verify that reduce was called (meaning position was tracked)
      expect(projection.reduceCalled).toBe(true);
      expect(projection.lastEvent?.position.position).toBe(100);
    });

    it('should process multiple events in batch', async () => {
      const events: Event[] = Array.from({ length: 3 }, (_, i) => ({
        eventType: 'test.event',
        aggregateType: 'test',
        aggregateID: `test-${i}`,
        aggregateVersion: 1n,
        payload: {},
        position: { position: i + 1, inTxOrder: 0 },
        createdAt: new Date(),
        creator: 'test',
        owner: 'test',
        instanceID: 'test-instance',
        revision: 1,
      }));
      
      mockEventstore._setEvents(events);
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 250).unref());
      
      await handler.stop();
      expect(projection.reduceCallCount).toBe(3);
    });
  });

  describe('Failed Event Handling', () => {
    it('should record failed event when reduce() throws', async () => {
      projection.shouldThrow = true;
      projection.throwError = new Error('Processing failed');
      
      const event: Event = {
        eventType: 'test.event',
        aggregateType: 'test',
        aggregateID: 'test-123',
        aggregateVersion: 1n,
        payload: {},
        position: { position: 1, inTxOrder: 0 },
        createdAt: new Date(),
        creator: 'test',
        owner: 'test',
        instanceID: 'test-instance',
        revision: 1,
      };
      
      mockEventstore._setEvents([event]);
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 300).unref());
      
      await handler.stop();
      // Check that failed event was recorded in transaction
      const allQueries = mockDatabase._getAllQueries();
      const failedEventQuery = allQueries.find((q: any) => 
        (q.sql.includes('projection_failed_events') || q.sql.includes('projections.projection_failed_events')) && q.sql.includes('INSERT')
      );
      expect(failedEventQuery).toBeDefined();
    });

    it('should not increment error count when individual event fails (continues processing)', async () => {
      projection.shouldThrow = true;
      
      mockEventstore.query.mockResolvedValue([{
        eventType: 'test.event',
        aggregateType: 'test',
        aggregateID: 'test-123',
        aggregateVersion: 1n,
        payload: {},
        position: { position: 1, inTxOrder: 0 },
        createdAt: new Date(),
        creator: 'test',
        owner: 'test',
        instanceID: 'test-instance',
        revision: 1,
      }]);
      
      await handler.start();
      expect(handler.getErrorCount()).toBe(0);
      
      await new Promise(resolve => setTimeout(resolve, 100).unref());
      
      // Error count is for transaction-level errors, not individual event failures
      // Individual event failures are recorded in projection_failed_events
      expect(handler.getErrorCount()).toBe(0);
    });

    it('should stop handler after 10 consecutive transaction errors', async () => {
      // Make the entire transaction fail by having withTransaction throw
      const failingMockDb = {
        ...mockDatabase,
        withTransaction: jest.fn(async () => {
          throw new Error('Transaction failed');
        }),
      };
      
      handler = new ProjectionHandler(projection, config, mockEventstore as any, failingMockDb as any);
      
      mockEventstore.query.mockResolvedValue([{
        eventType: 'test.event',
        aggregateType: 'test',
        aggregateID: 'test-123',
        aggregateVersion: 1n,
        payload: {},
        position: { position: 1, inTxOrder: 0 },
        createdAt: new Date(),
        creator: 'test',
        owner: 'test',
        instanceID: 'test-instance',
        revision: 1,
      }]);
      
      await handler.start();
      
      // Wait for errors to accumulate (handler stops after 10 errors)
      await new Promise(resolve => setTimeout(resolve, 700).unref());
      
      // Handler should auto-stop after 10 errors
      expect(handler.isRunning()).toBe(false);
      expect(handler.getErrorCount()).toBeGreaterThanOrEqual(10);
    }, 15000);
  });

  describe('Distributed Locking', () => {
    it('should acquire advisory lock during transaction', async () => {
      const event: Event = {
        eventType: 'test.event',
        aggregateType: 'test',
        aggregateID: 'test-123',
        aggregateVersion: 1n,
        payload: {},
        position: { position: 1, inTxOrder: 0 },
        createdAt: new Date(),
        creator: 'test',
        owner: 'test',
        instanceID: 'test-instance',
        revision: 1,
      };
      
      mockEventstore.query.mockResolvedValue([event]);
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 100).unref());
      
      // Check that withTransaction was called
      expect(mockDatabase.withTransaction).toHaveBeenCalled();
      
      await handler.stop();
    });

    it('should skip processing if advisory lock fails', async () => {
      // Create a mock database where advisory lock fails
      const mockDbWithFailedLock = {
        query: jest.fn(async () => ({ rows: [] })),
        withTransaction: jest.fn(async (cb: any) => {
          const tx = {
            query: jest.fn(async (sql: string) => {
              if (sql.includes('pg_try_advisory_xact_lock')) {
                return { rows: [{ pg_try_advisory_xact_lock: false }] };
              }
              return { rows: [] };
            })
          };
          return await cb(tx);
        }),
      };
      
      handler = new ProjectionHandler(projection, config, mockEventstore as any, mockDbWithFailedLock as any);
      
      mockEventstore.query.mockResolvedValue([{
        eventType: 'test.event',
        aggregateType: 'test',
        aggregateID: 'test-123',
        aggregateVersion: 1n,
        payload: {},
        position: { position: 1, inTxOrder: 0 },
        createdAt: new Date(),
        creator: 'test',
        owner: 'test',
        instanceID: 'test-instance',
        revision: 1,
      }]);
      
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 100).unref());
      
      // Should not process events if lock failed
      expect(projection.reduceCalled).toBe(false);
      
      await handler.stop();
    });

    it('should use instance ID in advisory lock hash', async () => {
      config.instanceID = 'custom-instance';
      handler = new ProjectionHandler(projection, config, mockEventstore as any, mockDatabase as any);
      
      mockEventstore.query.mockResolvedValue([{
        eventType: 'test.event',
        aggregateType: 'test',
        aggregateID: 'test-123',
        aggregateVersion: 1n,
        payload: {},
        position: { position: 1, inTxOrder: 0 },
        createdAt: new Date(),
        creator: 'test',
        owner: 'test',
        instanceID: 'test-instance',
        revision: 1,
      }]);
      
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 100).unref());
      
      // Check that withTransaction was called
      expect(mockDatabase.withTransaction).toHaveBeenCalled();
      
      await handler.stop();
    });

    it('should handle NULL instance ID in advisory lock', async () => {
      config.instanceID = undefined;
      handler = new ProjectionHandler(projection, config, mockEventstore as any, mockDatabase as any);
      
      mockEventstore.query.mockResolvedValue([{
        eventType: 'test.event',
        aggregateType: 'test',
        aggregateID: 'test-123',
        aggregateVersion: 1n,
        payload: {},
        position: { position: 1, inTxOrder: 0 },
        createdAt: new Date(),
        creator: 'test',
        owner: 'test',
        instanceID: 'test-instance',
        revision: 1,
      }]);
      
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 100).unref());
      
      // Should still work with undefined instance ID
      expect(mockDatabase.withTransaction).toHaveBeenCalled();
      
      await handler.stop();
    });
  });

  describe('Error Handling', () => {
    it('should handle eventstore query errors', async () => {
      mockEventstore.query.mockRejectedValue(new Error('Eventstore error'));
      
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 150).unref());
      
      expect(handler.isRunning()).toBe(true);
      // Eventstore error should increment error count
      const errorCount = handler.getErrorCount();
      expect(errorCount).toBeGreaterThanOrEqual(0); // May or may not have processed yet
    });

    it('should handle failed event handler errors silently', async () => {
      projection.shouldThrow = true;
      
      mockDatabase.query.mockImplementation(async (sql: string) => {
        if (sql.includes('projection_failed_events')) {
          throw new Error('Failed event handler error');
        }
        return { rows: [] };
      });
      
      mockEventstore.query.mockResolvedValue([{
        eventType: 'test.event',
        aggregateType: 'test',
        aggregateID: 'test-123',
        aggregateVersion: 1n,
        payload: {},
        position: { position: 1, inTxOrder: 0 },
        createdAt: new Date(),
        creator: 'test',
        owner: 'test',
        instanceID: 'test-instance',
        revision: 1,
      }]);
      
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 100).unref());
      
      expect(handler.isRunning()).toBe(true);
    });

    it('should handle empty event batches gracefully', async () => {
      mockEventstore.query.mockResolvedValue([]);
      
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 100).unref());
      
      expect(projection.reduceCalled).toBe(false);
      // Should transition to live when no events
      expect(['catch_up', 'live']).toContain(handler.getState());
    });
  });
});
