/**
 * Projection Registry Unit Tests
 * 
 * Comprehensive tests for the ProjectionRegistry class covering:
 * - Projection registration and unregistration
 * - Multi-projection lifecycle management
 * - Health monitoring
 * - Failed event management
 * - Lock table initialization
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { Projection } from '../../../../src/lib/query/projection/projection';
import { ProjectionConfig } from '../../../../src/lib/query/projection/projection-config';
import { Event } from '../../../../src/lib/eventstore/types';

// Mock projection
class TestProjection extends Projection {
  constructor(
    public readonly name: string,
    eventstore: any,
    database: any
  ) {
    super(eventstore, database);
  }
  
  readonly tables = ['test_table'];
  
  async reduce(_event: Event): Promise<void> {
    // No-op
  }
  
  async init(): Promise<void> {
    // No-op
  }
}

// Mock factories
const createMockEventstore = () => ({
  query: jest.fn(async () => []),
  health: jest.fn(),
  filter: jest.fn(),
  push: jest.fn(),
});

const createMockDatabase = () => {
  const tables = new Set<string>();
  const states = new Map<string, any>();
  
  return {
    query: jest.fn(async (sql: string, params?: any[]) => {
      // Table creation
      if (sql.includes('CREATE TABLE')) {
        const match = sql.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/);
        if (match) tables.add(match[1]);
        return { rows: [] };
      }
      
      // Lock operations
      if (sql.includes('projection_locks')) {
        if (sql.includes('INSERT') || sql.includes('UPDATE')) {
          // Return success with the instance_id
          return { rows: [{ instance_id: params?.[1] }] };
        }
        if (sql.includes('DELETE')) {
          return { rows: [] };
        }
      }
      
      // Current states
      if (sql.includes('projection_states')) {
        if (sql.includes('SELECT') && params) {
          const state = states.get(params[0]);
          return { rows: state ? [state] : [] };
        }
        if (sql.includes('SELECT') && !params) {
          return { rows: Array.from(states.values()) };
        }
        if (sql.includes('INSERT') || sql.includes('UPDATE')) {
          if (params) states.set(params[0], { projection_name: params[0], position: params[1], last_updated: new Date() });
          return { rows: [] };
        }
      }
      
      // Failed events stats
      if (sql.includes('projection_failed_events')) {
        if (sql.includes('COUNT(*)')) {
          return {
            rows: [{
              total: '5',
              oldest: new Date(),
              newest: new Date(),
            }],
          };
        }
        if (sql.includes('GROUP BY')) {
          return {
            rows: [
              { projection_name: 'proj1', count: '3' },
              { projection_name: 'proj2', count: '2' },
            ],
          };
        }
        if (sql.includes('SELECT')) {
          return { rows: [] };
        }
      }
      
      // Latest position
      if (sql.includes('MAX(position)')) {
        return { rows: [{ max_position: '1000' }] };
      }
      
      return { rows: [] };
    }),
    withTransaction: jest.fn(async (cb: any) => cb({ query: jest.fn(async () => ({ rows: [] })) })),
  };
};

describe('ProjectionRegistry', () => {
  let registry: ProjectionRegistry;
  let mockEventstore: any;
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEventstore = createMockEventstore();
    mockDatabase = createMockDatabase();
    
    registry = new ProjectionRegistry({
      eventstore: mockEventstore as any,
      database: mockDatabase as any,
    });
  });

  afterEach(async () => {
    // Ensure all handlers are stopped to prevent worker process hanging
    try {
      await registry.stopAll();
    } catch (e) {
      // Ignore errors during cleanup
    }
  });

  describe('Initialization', () => {
    it('should initialize registry tables', async () => {
      await registry.init();
      
      // projection_states table is created by migrations, not by init()
      // Only check for tables that init() actually creates
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('projection_failed_events')
      );
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('projection_locks')
      );
    });

    it('should create required indexes', async () => {
      await registry.init();
      
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX')
      );
    });

    it('should clean up expired locks on init', async () => {
      await registry.init();
      
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM projection_locks WHERE expires_at < NOW()')
      );
    });

    it('should allow multiple init() calls (idempotent)', async () => {
      await registry.init();
      await registry.init();
      
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Registration', () => {
    it('should register a projection', () => {
      const projection = new TestProjection('test_proj', mockEventstore, mockDatabase);
      const config: ProjectionConfig = {
        name: 'test_proj',
        tables: ['test_table'],
      };
      
      registry.register(config, projection);
      
      expect(registry.get('test_proj')).toBeDefined();
      expect(registry.getNames()).toContain('test_proj');
    });

    it('should reject duplicate registration', () => {
      const projection = new TestProjection('test_proj', mockEventstore, mockDatabase);
      const config: ProjectionConfig = {
        name: 'test_proj',
        tables: ['test_table'],
      };
      
      registry.register(config, projection);
      
      expect(() => registry.register(config, projection)).toThrow('already registered');
    });

    it('should reject name mismatch between config and projection', () => {
      const projection = new TestProjection('proj_a', mockEventstore, mockDatabase);
      const config: ProjectionConfig = {
        name: 'proj_b',
        tables: ['test_table'],
      };
      
      expect(() => registry.register(config, projection)).toThrow('name mismatch');
    });

    it('should apply default configuration', () => {
      const projection = new TestProjection('test_proj', mockEventstore, mockDatabase);
      const config: ProjectionConfig = {
        name: 'test_proj',
        tables: ['test_table'],
      };
      
      registry.register(config, projection);
      
      const handler = registry.get('test_proj');
      expect(handler).toBeDefined();
    });

    it('should register multiple projections', () => {
      const proj1 = new TestProjection('proj1', mockEventstore, mockDatabase);
      const proj2 = new TestProjection('proj2', mockEventstore, mockDatabase);
      
      registry.register({ name: 'proj1', tables: ['t1'] }, proj1);
      registry.register({ name: 'proj2', tables: ['t2'] }, proj2);
      
      expect(registry.getNames()).toEqual(['proj1', 'proj2']);
    });
  });

  describe('Unregistration', () => {
    it('should unregister a projection', async () => {
      const projection = new TestProjection('test_proj', mockEventstore, mockDatabase);
      registry.register({ name: 'test_proj', tables: ['test_table'] }, projection);
      
      await registry.unregister('test_proj');
      
      expect(registry.get('test_proj')).toBeUndefined();
    });

    it('should stop running projection before unregistering', async () => {
      const projection = new TestProjection('test_proj', mockEventstore, mockDatabase);
      registry.register({ name: 'test_proj', tables: ['test_table'] }, projection);
      
      await registry.init();
      await registry.start('test_proj');
      await new Promise(resolve => setTimeout(resolve, 50).unref()); // Wait for start
      
      const handler = registry.get('test_proj');
      expect(handler?.isRunning()).toBe(true);
      
      await registry.unregister('test_proj');
      
      // Handler should be gone
      expect(registry.get('test_proj')).toBeUndefined();
    });

    it('should handle unregistering non-existent projection', async () => {
      await expect(registry.unregister('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('Single Projection Lifecycle', () => {
    beforeEach(async () => {
      const projection = new TestProjection('test_proj', mockEventstore, mockDatabase);
      registry.register({ name: 'test_proj', tables: ['test_table'] }, projection);
      await registry.init();
    });

    it('should start a projection', async () => {
      await registry.start('test_proj');
      await new Promise(resolve => setTimeout(resolve, 50).unref()); // Wait for start
      
      const handler = registry.get('test_proj');
      expect(handler?.isRunning()).toBe(true);
    });

    it('should stop a projection', async () => {
      await registry.start('test_proj');
      await new Promise(resolve => setTimeout(resolve, 50).unref()); // Wait for start
      await registry.stop('test_proj');
      
      const handler = registry.get('test_proj');
      expect(handler?.isRunning()).toBe(false);
    });

    it('should reject starting non-existent projection', async () => {
      await expect(registry.start('nonexistent')).rejects.toThrow('not found');
    });

    it('should reject stopping non-existent projection', async () => {
      await expect(registry.stop('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('Multi-Projection Lifecycle', () => {
    beforeEach(async () => {
      const proj1 = new TestProjection('proj1', mockEventstore, mockDatabase);
      const proj2 = new TestProjection('proj2', mockEventstore, mockDatabase);
      const proj3 = new TestProjection('proj3', mockEventstore, mockDatabase);
      
      registry.register({ name: 'proj1', tables: ['t1'] }, proj1);
      registry.register({ name: 'proj2', tables: ['t2'] }, proj2);
      registry.register({ name: 'proj3', tables: ['t3'] }, proj3);
      
      await registry.init();
    });

    it('should start all projections', async () => {
      await registry.startAll();
      await new Promise(resolve => setTimeout(resolve, 100).unref()); // Wait for all to start
      
      expect(registry.get('proj1')?.isRunning()).toBe(true);
      expect(registry.get('proj2')?.isRunning()).toBe(true);
      expect(registry.get('proj3')?.isRunning()).toBe(true);
    });

    it('should stop all projections', async () => {
      await registry.startAll();
      await new Promise(resolve => setTimeout(resolve, 100).unref()); // Wait for all to start
      await registry.stopAll();
      
      expect(registry.get('proj1')?.isRunning()).toBe(false);
      expect(registry.get('proj2')?.isRunning()).toBe(false);
      expect(registry.get('proj3')?.isRunning()).toBe(false);
    });

    it('should skip already running projections in startAll', async () => {
      await registry.start('proj1');
      await new Promise(resolve => setTimeout(resolve, 50).unref()); // Wait for start
      
      const handler = registry.get('proj1');
      const startSpy = jest.spyOn(handler as any, 'start');
      
      await registry.startAll();
      await new Promise(resolve => setTimeout(resolve, 50).unref());
      
      // proj1 was already running, should not call start again
      expect(startSpy).not.toHaveBeenCalled();
    });

    it('should skip already stopped projections in stopAll', async () => {
      await registry.startAll();
      await new Promise(resolve => setTimeout(resolve, 100).unref()); // Wait for all to start
      await registry.stop('proj1');
      
      const handler = registry.get('proj1');
      const stopSpy = jest.spyOn(handler as any, 'stop');
      
      await registry.stopAll();
      
      // proj1 was already stopped
      expect(stopSpy).not.toHaveBeenCalled();
    });

    it('should auto-init before startAll if not initialized', async () => {
      // Create fresh registry
      const freshRegistry = new ProjectionRegistry({
        eventstore: mockEventstore as any,
        database: mockDatabase as any,
      });
      
      const proj = new TestProjection('proj', mockEventstore, mockDatabase);
      freshRegistry.register({ name: 'proj', tables: ['t'] }, proj);
      
      // Don't call init() - startAll() should do it
      await freshRegistry.startAll();
      await new Promise(resolve => setTimeout(resolve, 100).unref()); // Wait for start
      
      expect(freshRegistry.get('proj')?.isRunning()).toBe(true);
      
      // Cleanup
      await freshRegistry.stopAll();
    });
  });

  describe('Retrieval Methods', () => {
    beforeEach(() => {
      const proj1 = new TestProjection('proj1', mockEventstore, mockDatabase);
      const proj2 = new TestProjection('proj2', mockEventstore, mockDatabase);
      
      registry.register({ name: 'proj1', tables: ['t1'] }, proj1);
      registry.register({ name: 'proj2', tables: ['t2'] }, proj2);
    });

    it('should get projection handler by name', () => {
      const handler = registry.get('proj1');
      expect(handler).toBeDefined();
    });

    it('should return undefined for non-existent projection', () => {
      const handler = registry.get('nonexistent');
      expect(handler).toBeUndefined();
    });

    it('should get all projection handlers', () => {
      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });

    it('should get all projection names', () => {
      const names = registry.getNames();
      expect(names).toEqual(['proj1', 'proj2']);
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      const proj1 = new TestProjection('proj1', mockEventstore, mockDatabase);
      const proj2 = new TestProjection('proj2', mockEventstore, mockDatabase);
      
      registry.register({ name: 'proj1', tables: ['t1'] }, proj1);
      registry.register({ name: 'proj2', tables: ['t2'] }, proj2);
      
      await registry.init();
    });

    it('should get health for all projections', async () => {
      const health = await registry.getHealth();
      
      expect(health).toHaveLength(2);
      expect(health[0].name).toBeDefined();
      expect(health[0].healthy).toBeDefined();
      expect(health[0].currentPosition).toBeDefined();
      expect(health[0].lag).toBeDefined();
    });

    it('should get health for specific projection', async () => {
      const health = await registry.getProjectionHealth('proj1');
      
      expect(health.name).toBe('proj1');
      expect(health.healthy).toBeDefined();
      expect(health.currentPosition).toBeDefined();
      expect(health.lag).toBeDefined();
      expect(health.errorCount).toBeDefined();
      expect(health.state).toBeDefined();
    });

    it('should mark projection unhealthy if not found', async () => {
      const health = await registry.getProjectionHealth('nonexistent');
      
      expect(health.healthy).toBe(false);
      expect(health.state).toBe('not_found');
    });

    it('should calculate lag from latest position', async () => {
      mockDatabase.query.mockImplementation(async (sql: string) => {
        if (sql.includes('MAX(position)')) {
          return { rows: [{ max_position: '1000' }] };
        }
        if (sql.includes('projection_states') && sql.includes('SELECT')) {
          return {
            rows: [{
              projection_name: 'proj1',
              position: 900,
              last_updated: new Date(),
            }],
          };
        }
        return { rows: [] };
      });
      
      const health = await registry.getProjectionHealth('proj1');
      
      expect(health.lag).toBe(100);
    });

    it('should report unhealthy if lag too high', async () => {
      mockDatabase.query.mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('MAX(position)')) {
          return { rows: [{ max_position: '10000' }] };
        }
        if (sql.includes('projection_states') && sql.includes('SELECT')) {
          return {
            rows: [{
              projection_name: 'proj1',
              position: 100,
              last_updated: new Date(),
            }],
          };
        }
        // Handle lock operations
        if (sql.includes('projection_locks') && (sql.includes('INSERT') || sql.includes('UPDATE'))) {
          return { rows: [{ instance_id: params?.[1] }] };
        }
        return { rows: [] };
      });
      
      await registry.start('proj1');
      await new Promise(resolve => setTimeout(resolve, 50).unref()); // Wait for start
      const health = await registry.getProjectionHealth('proj1');
      
      // Lag > 1000 should be unhealthy
      expect(health.healthy).toBe(false);
      expect(health.lag).toBeGreaterThan(1000);
    });

    it('should report unhealthy if error count high', async () => {
      await registry.start('proj1');
      await new Promise(resolve => setTimeout(resolve, 50).unref()); // Wait for start
      
      const handler = registry.get('proj1');
      if (handler) {
        // Simulate errors
        for (let i = 0; i < 6; i++) {
          (handler as any).errorCount++;
        }
      }
      
      const health = await registry.getProjectionHealth('proj1');
      
      expect(health.healthy).toBe(false);
      expect(health.errorCount).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Failed Event Management', () => {
    beforeEach(async () => {
      const proj = new TestProjection('proj1', mockEventstore, mockDatabase);
      registry.register({ name: 'proj1', tables: ['t1'] }, proj);
      await registry.init();
      // Clear mock calls from init() to test only the actual test calls
      mockDatabase.query.mockClear();
    });

    it('should get failed events for projection', async () => {
      const failedEvents = await registry.getFailedEvents('proj1');
      
      expect(Array.isArray(failedEvents)).toBe(true);
    });

    it('should get failed event statistics', async () => {
      const stats = await registry.getFailedEventStats();
      
      expect(stats.totalFailed).toBeDefined();
      expect(stats.failedByProjection).toBeDefined();
      expect(stats.failedByProjection instanceof Map).toBe(true);
    });

    it('should clear failed events for projection', async () => {
      await registry.clearFailedEvents('proj1');
      
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM projections.projection_failed_events'),
        expect.arrayContaining(['proj1'])
      );
    });
  });

  describe('State Management', () => {
    beforeEach(async () => {
      const proj1 = new TestProjection('proj1', mockEventstore, mockDatabase);
      const proj2 = new TestProjection('proj2', mockEventstore, mockDatabase);
      
      registry.register({ name: 'proj1', tables: ['t1'] }, proj1);
      registry.register({ name: 'proj2', tables: ['t2'] }, proj2);
      
      await registry.init();
    });

    it('should get all projection states', async () => {
      const states = await registry.getAllStates();
      
      expect(Array.isArray(states)).toBe(true);
    });
  });

  describe('Lock Management', () => {
    beforeEach(async () => {
      await registry.init();
    });

    it('should initialize lock table with primary key', async () => {
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS projection_locks')
      );
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('projection_name TEXT PRIMARY KEY')
      );
    });

    it('should create index on expires_at', async () => {
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('idx_projection_locks_expires_at')
      );
    });

    it('should cleanup expired locks', async () => {
      await registry.cleanupExpiredLocks();
      
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM projection_locks WHERE expires_at < NOW()')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during init', async () => {
      mockDatabase.query.mockRejectedValueOnce(new Error('Database error'));
      
      await expect(registry.init()).rejects.toThrow('Database error');
    });

    it('should handle errors getting health', async () => {
      const proj = new TestProjection('proj1', mockEventstore, mockDatabase);
      registry.register({ name: 'proj1', tables: ['t1'] }, proj);
      await registry.init();
      
      // Create a mock that will fail for state queries but succeed for others
      mockDatabase.query.mockImplementation(async (sql: string) => {
        if (sql.includes('projection_states') && sql.includes('SELECT')) {
          throw new Error('Database error');
        }
        if (sql.includes('MAX(position)')) {
          return { rows: [{ max_position: '0' }] };
        }
        return { rows: [] };
      });
      
      // Should throw the database error (error handling is done by caller)
      await expect(registry.getProjectionHealth('proj1')).rejects.toThrow('Database error');
    });

    it('should handle errors getting latest position', async () => {
      const proj = new TestProjection('proj1', mockEventstore, mockDatabase);
      registry.register({ name: 'proj1', tables: ['t1'] }, proj);
      await registry.init();
      
      mockDatabase.query.mockImplementation(async (sql: string) => {
        if (sql.includes('MAX(position)')) {
          throw new Error('Query error');
        }
        return { rows: [] };
      });
      
      const health = await registry.getProjectionHealth('proj1');
      
      expect(health.lag).toBe(0); // Should default to 0 on error
    });
  });
});
