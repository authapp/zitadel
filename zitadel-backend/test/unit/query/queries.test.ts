/**
 * Queries Class Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Queries } from '../../../src/lib/query/queries';

// Create mock functions at module level

const mockHealth: jest.MockedFunction<() => Promise<boolean>> = jest.fn();
const mockQuery = jest.fn();
const mockSearch = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDelete = jest.fn();
const mockCacheKeys = jest.fn();
const mockCacheClear = jest.fn();
const mockCacheStats = jest.fn();

// Mock dependencies using module-level mocks
const mockEventstore = {
  health: mockHealth,
  query: mockQuery,
  search: mockSearch,
  push: jest.fn(),
  pushMany: jest.fn(),
  latestEvent: jest.fn(),
  aggregate: jest.fn(),
  count: jest.fn(),
  eventsAfterPosition: jest.fn(),
  latestPosition: jest.fn(),
  close: jest.fn(),
  filterToReducer: jest.fn(),
  distinctInstanceIDs: jest.fn(),
  pushWithConcurrencyCheck: jest.fn(),
};

const mockDatabase = {
  query: jest.fn(
    async <T  = any>(): Promise<T> => ({ rows: [] as T[] } as T)
  ),

  close: jest.fn(),
};

const mockCache = {
  get: mockCacheGet,
  set: mockCacheSet,
  delete: mockCacheDelete,
  mget: jest.fn(),
  mset: jest.fn(),
  mdelete: jest.fn(),
  keys: mockCacheKeys,
  clear: mockCacheClear,
  stats: mockCacheStats,
};

describe('Queries', () => {
  let queries: Queries;

  beforeEach(() => {
    jest.clearAllMocks();
    queries = new Queries({
      eventstore: mockEventstore as any,
      database: mockDatabase as any,
      cache: mockCache as any,
      defaultLanguage: 'en',
      instanceID: 'test-instance',
    });
  });

  describe('constructor', () => {
    it('should instantiate with required config', () => {
      expect(queries).toBeInstanceOf(Queries);
    });

    it('should set default language', () => {
      expect(queries.getDefaultLanguage()).toBe('en');
    });

    it('should set instance ID', () => {
      expect(queries.getInstanceID()).toBe('test-instance');
    });

    it('should work without cache', () => {
      const q = new Queries({
        eventstore: mockEventstore as any,
        database: mockDatabase as any,
      });
      expect(q.getCache()).toBeUndefined();
    });
  });

  describe('lifecycle', () => {
    it('should start successfully', async () => {
      await expect(queries.start()).resolves.not.toThrow();
      expect(queries.isStarted()).toBe(true);
    });

    it('should stop successfully', async () => {
      await queries.start();
      await queries.stop();
      expect(queries.isStarted()).toBe(false);
    });

    it('should not start twice', async () => {
      await queries.start();
      await expect(queries.start()).rejects.toThrow('already started');
    });

    it('should not error stopping when not started', async () => {
      await expect(queries.stop()).resolves.not.toThrow();
    });
  });

  describe('health', () => {
    it('should check database health', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [{ test: 1 }] });
      mockEventstore.health.mockResolvedValueOnce(true);
      
      const health = await queries.health();
      expect(health.database).toBe(true);
      expect(health.eventstore).toBe(true);
    });

    it('should detect database failure', async () => {
      mockDatabase.query.mockRejectedValueOnce(new Error('DB error'));
      
      const health = await queries.health();
      expect(health.database).toBe(false);
      expect(health.healthy).toBe(false);
    });

    it('should detect eventstore failure', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });
      mockEventstore.health.mockResolvedValueOnce(false);
      
      const health = await queries.health();
      expect(health.eventstore).toBe(false);
      expect(health.healthy).toBe(false);
    });
  });

  describe('createContext', () => {
    it('should create context with defaults', () => {
      const ctx = queries.createContext();
      expect(ctx.instanceID).toBe('test-instance');
      expect(ctx.language).toBe('en');
    });

    it('should override defaults', () => {
      const ctx = queries.createContext({
        instanceID: 'custom-instance',
        orgID: 'org-123',
        userID: 'user-456',
        language: 'de',
      });
      expect(ctx.instanceID).toBe('custom-instance');
      expect(ctx.orgID).toBe('org-123');
      expect(ctx.userID).toBe('user-456');
      expect(ctx.language).toBe('de');
    });
  });

  describe('getters', () => {
    it('should get database', () => {
      expect(queries.getDatabase()).toBe(mockDatabase);
    });

    it('should get eventstore', () => {
      expect(queries.getEventstore()).toBe(mockEventstore);
    });

    it('should get cache', () => {
      expect(queries.getCache()).toBe(mockCache);
    });

    it('should get projection registry', () => {
      const registry = queries.getProjectionRegistry();
      expect(registry).toBeDefined();
    });
  });

  describe('executeQuery', () => {
    it('should execute raw SQL', async () => {
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'test' }],
      });

      const result = await queries.executeQuery('SELECT * FROM users');
      expect(result).toEqual([{ id: 1, name: 'test' }]);
      expect(mockDatabase.query).toHaveBeenCalledWith('SELECT * FROM users', undefined);
    });

    it('should execute with parameters', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      await queries.executeQuery('SELECT * FROM users WHERE id = $1', ['123']);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        ['123']
      );
    });
  });

  describe('projection registry', () => {
    it('should register projection', () => {
      expect(() => {
        queries.registerProjection({
          name: 'test_projection',
          tables: ['test_table'],
          eventTypes: ['test.event'],
        });
      }).not.toThrow();
    });
  });
});
