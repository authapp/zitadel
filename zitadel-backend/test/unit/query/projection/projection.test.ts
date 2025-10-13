/**
 * Projection Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Projection } from '../../../../src/lib/query/projection/projection';
import { Event } from '../../../../src/lib/eventstore/types';

// Mock projection implementation
class TestProjection extends Projection {
  readonly name = 'test_projection';
  readonly tables = ['test_table'];
  
  reduceCalled = false;
  initCalled = false;
  
  async reduce(_event: Event): Promise<void> {
    this.reduceCalled = true;
  }
  
  async init(): Promise<void> {
    this.initCalled = true;
  }
}

// @ts-ignore - Jest mock type inference issues
const mockEventstore: any = {
  health: jest.fn(),
  query: jest.fn(),
  filter: jest.fn(),
};


const mockDatabase = {
  query: jest.fn(
    async <T  = any>(): Promise<T> => ({ rows: [] as T[] } as T)
  ),
};

describe('Projection', () => {
  let projection: TestProjection;

  beforeEach(() => {
    jest.clearAllMocks();
    projection = new TestProjection(
      mockEventstore as any,
      mockDatabase as any
    );
  });

  describe('constructor', () => {
    it('should create projection with required properties', () => {
      expect(projection.name).toBe('test_projection');
      expect(projection.tables).toEqual(['test_table']);
    });
  });

  describe('abstract methods', () => {
    it('should implement reduce', async () => {
      const event = {
        eventType: 'test.event',
        aggregateID: '123',
        aggregateType: 'test',
        payload: {},
        position: { position: 1, inTxOrder: 0 },
      } as Event;

      await projection.reduce(event);
      expect(projection.reduceCalled).toBe(true);
    });

    it('should implement init', async () => {
      await projection.init();
      expect(projection.initCalled).toBe(true);
    });
  });

  describe('lifecycle', () => {
    it('start should not throw', async () => {
      await expect(projection.start()).resolves.not.toThrow();
    });

    it('stop should not throw', async () => {
      await expect(projection.stop()).resolves.not.toThrow();
    });

    it('cleanup should not throw', async () => {
      await expect(projection.cleanup()).resolves.not.toThrow();
    });
  });

  describe('reset', () => {
    it('should truncate tables', async () => {
      await projection.reset();
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('TRUNCATE TABLE test_table')
      );
    });
  });

  describe('position tracking', () => {
    it('getCurrentPosition should return 0 initially', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });
      const position = await projection.getCurrentPosition();
      expect(position).toBe(0);
    });

    it('setCurrentPosition should update state', async () => {
      await projection.setCurrentPosition(
        100,
        new Date(),
        'instance-1',
        'test',
        'test-123',
        5
      );
      expect(mockDatabase.query).toHaveBeenCalled();
    });
  });

  describe('isHealthy', () => {
    it('should return true when no state', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });
      const healthy = await projection.isHealthy();
      expect(healthy).toBe(true);
    });

    it('should return true for recent updates', async () => {
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          projectionName: 'test_projection',
          position: 100,
          lastUpdated: new Date(),
        }],
      });
      const healthy = await projection.isHealthy();
      expect(healthy).toBe(true);
    });
  });

  describe('helper methods', () => {
    it('exists should check record existence', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const exists = await projection['exists']('test_table', '123');
      expect(exists).toBe(true);
    });

    it('getByID should fetch record', async () => {
      const mockRow = { id: '123', name: 'test' };
      mockDatabase.query.mockResolvedValueOnce({ rows: [mockRow] });
      const result = await projection['getByID']('test_table', '123');
      expect(result).toEqual(mockRow);
    });
  });
});
