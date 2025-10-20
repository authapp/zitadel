/**
 * Projection Base Class Unit Tests
 * 
 * Comprehensive tests for the abstract Projection class covering:
 * - Lifecycle methods (init, start, stop, cleanup)
 * - Position tracking and state management
 * - Health checks
 * - Database operations (insert, update, delete, query)
 * - Helper methods for event data extraction
 * - Transaction support
 * - Reset functionality
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
        0,
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

  describe('Database Operations', () => {
    describe('insert', () => {
      it('should insert record with correct SQL', async () => {
        await projection['insert']('users', { id: '123', name: 'John', email: 'john@example.com' });
        
        expect(mockDatabase.query).toHaveBeenCalledWith(
          'INSERT INTO users (id, name, email) VALUES ($1, $2, $3)',
          ['123', 'John', 'john@example.com']
        );
      });

      it('should handle single column insert', async () => {
        await projection['insert']('tags', { name: 'important' });
        
        expect(mockDatabase.query).toHaveBeenCalledWith(
          'INSERT INTO tags (name) VALUES ($1)',
          ['important']
        );
      });

      it('should handle multiple columns', async () => {
        await projection['insert']('complex_table', {
          col1: 'val1',
          col2: 'val2',
          col3: 'val3',
          col4: 'val4',
        });
        
        expect(mockDatabase.query).toHaveBeenCalledWith(
          'INSERT INTO complex_table (col1, col2, col3, col4) VALUES ($1, $2, $3, $4)',
          ['val1', 'val2', 'val3', 'val4']
        );
      });
    });

    describe('update', () => {
      it('should update record with correct SQL', async () => {
        await projection['update']('users', '123', { name: 'Jane', email: 'jane@example.com' });
        
        expect(mockDatabase.query).toHaveBeenCalledWith(
          'UPDATE users SET name = $1, email = $2 WHERE id = $3',
          ['Jane', 'jane@example.com', '123']
        );
      });

      it('should handle single field update', async () => {
        await projection['update']('users', '123', { name: 'Updated' });
        
        expect(mockDatabase.query).toHaveBeenCalledWith(
          'UPDATE users SET name = $1 WHERE id = $2',
          ['Updated', '123']
        );
      });
    });

    describe('delete', () => {
      it('should delete record with correct SQL', async () => {
        await projection['delete']('users', '123');
        
        expect(mockDatabase.query).toHaveBeenCalledWith(
          'DELETE FROM users WHERE id = $1',
          ['123']
        );
      });
    });

    describe('exists', () => {
      it('should return true when record exists', async () => {
        mockDatabase.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
        
        const result = await projection['exists']('users', '123');
        
        expect(result).toBe(true);
        expect(mockDatabase.query).toHaveBeenCalledWith(
          'SELECT 1 FROM users WHERE id = $1 LIMIT 1',
          ['123']
        );
      });

      it('should return false when record does not exist', async () => {
        mockDatabase.query.mockResolvedValueOnce({ rows: [] });
        
        const result = await projection['exists']('users', '999');
        
        expect(result).toBe(false);
      });
    });

    describe('getByID', () => {
      it('should return record when found', async () => {
        const mockUser = { id: '123', name: 'John', email: 'john@example.com' };
        mockDatabase.query.mockResolvedValueOnce({ rows: [mockUser] });
        
        const result = await projection['getByID']('users', '123');
        
        expect(result).toEqual(mockUser);
        expect(mockDatabase.query).toHaveBeenCalledWith(
          'SELECT * FROM users WHERE id = $1',
          ['123']
        );
      });

      it('should return null when not found', async () => {
        mockDatabase.query.mockResolvedValueOnce({ rows: [] });
        
        const result = await projection['getByID']('users', '999');
        
        expect(result).toBeNull();
      });

      it('should support generic type parameter', async () => {
        interface User {
          id: string;
          name: string;
          email: string;
        }
        
        const mockUser: User = { id: '123', name: 'John', email: 'john@example.com' };
        mockDatabase.query.mockResolvedValueOnce({ rows: [mockUser] });
        
        const result = await projection['getByID']<User>('users', '123');
        
        expect(result).toEqual(mockUser);
      });
    });

    describe('query', () => {
      it('should execute raw SQL query', async () => {
        mockDatabase.query.mockResolvedValueOnce({ rows: [{ count: 5 }] });
        
        await projection['query']('SELECT COUNT(*) as count FROM users');
        
        expect(mockDatabase.query).toHaveBeenCalledWith(
          'SELECT COUNT(*) as count FROM users',
          undefined
        );
      });

      it('should execute parameterized query', async () => {
        mockDatabase.query.mockResolvedValueOnce({ rows: [] });
        
        await projection['query']('SELECT * FROM users WHERE age > $1', [18]);
        
        expect(mockDatabase.query).toHaveBeenCalledWith(
          'SELECT * FROM users WHERE age > $1',
          [18]
        );
      });
    });
  });

  describe('Position Tracking', () => {
    it('should return 0 for initial position', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });
      
      const position = await projection.getCurrentPosition();
      
      expect(position).toBe(0);
    });

    it('should return stored position', async () => {
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          projectionName: 'test_projection',
          position: 12345,
          lastUpdated: new Date(),
        }],
      });
      
      const position = await projection.getCurrentPosition();
      
      expect(position).toBe(12345);
    });

    it('should set position with all metadata', async () => {
      const testDate = new Date('2024-01-01');
      
      await projection.setCurrentPosition(
        500,
        0,
        testDate,
        'instance-1',
        'user',
        'user-123',
        10
      );
      
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projection_states'),
        expect.arrayContaining([
          'test_projection',
          500,
          0,  // positionOffset
          testDate,
          'instance-1',
          'user',
          'user-123',
          10,
        ])
      );
    });

    it('should handle NULL instanceID', async () => {
      await projection.setCurrentPosition(
        100,
        0,
        new Date(),
        undefined,
        'user',
        'user-1',
        1
      );
      
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null])
      );
    });
  });

  describe('Health Check', () => {
    it('should be healthy when just starting (no state)', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });
      
      const healthy = await projection.isHealthy();
      
      expect(healthy).toBe(true);
    });

    it('should be healthy with recent update', async () => {
      const recentDate = new Date();
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          projectionName: 'test_projection',
          position: 100,
          lastUpdated: recentDate,
        }],
      });
      
      const healthy = await projection.isHealthy();
      
      expect(healthy).toBe(true);
    });

    it('should be unhealthy with old update', async () => {
      const oldDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          projectionName: 'test_projection',
          position: 100,
          lastUpdated: oldDate,
        }],
      });
      
      const healthy = await projection.isHealthy();
      
      expect(healthy).toBe(false);
    });

    it('should be unhealthy on database error', async () => {
      mockDatabase.query.mockRejectedValueOnce(new Error('Database error'));
      
      const healthy = await projection.isHealthy();
      
      expect(healthy).toBe(false);
    });
  });

  describe('Reset', () => {
    it('should truncate all projection tables', async () => {
      const multiTableProjection = new (class extends TestProjection {
        readonly tables = ['table1', 'table2', 'table3'];
      })(mockEventstore, mockDatabase as any);
      
      await multiTableProjection.reset();
      
      expect(mockDatabase.query).toHaveBeenCalledWith('TRUNCATE TABLE table1 CASCADE');
      expect(mockDatabase.query).toHaveBeenCalledWith('TRUNCATE TABLE table2 CASCADE');
      expect(mockDatabase.query).toHaveBeenCalledWith('TRUNCATE TABLE table3 CASCADE');
    });

    it('should delete projection state', async () => {
      await projection.reset();
      
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM projection_states'),
        expect.arrayContaining(['test_projection'])
      );
    });

    it('should use CASCADE to handle foreign keys', async () => {
      await projection.reset();
      
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('CASCADE')
      );
    });
  });

  describe('Transaction Support', () => {
    it('should execute callback within transaction', async () => {
      const mockTx: any = {
        query: jest.fn(async () => ({ rows: [] })),
      };
      
      const dbWithTransaction: any = {
        ...mockDatabase,
        withTransaction: jest.fn(async (callback: any) => {
          return callback(mockTx);
        }),
      };
      
      const txProjection = new TestProjection(mockEventstore, dbWithTransaction);
      
      const result = await txProjection['transaction'](async (tx: any) => {
        await tx.query('INSERT INTO test VALUES ($1)', ['value']);
        return 'success';
      });
      
      expect(result).toBe('success');
      expect(dbWithTransaction.withTransaction).toHaveBeenCalled();
      expect(mockTx.query).toHaveBeenCalledWith('INSERT INTO test VALUES ($1)', ['value']);
    });
  });

  describe('Event Helper Methods', () => {
    const createTestEvent = (overrides?: Partial<Event>): Event => ({
      eventType: 'user.created',
      aggregateType: 'user',
      aggregateID: 'user-123',
      aggregateVersion: 1n,
      payload: { username: 'testuser', email: 'test@example.com' },
      position: { position: 1, inTxOrder: 0 },
      createdAt: new Date(),
      creator: 'creator-1',
      owner: 'owner-1',
      instanceID: 'instance-1',
      revision: 1,
      ...overrides,
    });

    describe('getPayload', () => {
      it('should extract payload from event', () => {
        const event = createTestEvent({ payload: { key: 'value' } });
        const payload = projection['getPayload'](event);
        expect(payload).toEqual({ key: 'value' });
      });

      it('should support generic type parameter', () => {
        interface UserPayload {
          username: string;
          email: string;
        }
        const event = createTestEvent({ payload: { username: 'john', email: 'john@example.com' } });
        const payload = projection['getPayload']<UserPayload>(event);
        expect(payload.username).toBe('john');
        expect(payload.email).toBe('john@example.com');
      });
    });

    describe('getCreator', () => {
      it('should extract creator from event', () => {
        const event = createTestEvent({ creator: 'admin-user' });
        expect(projection['getCreator'](event)).toBe('admin-user');
      });
    });

    describe('getOwner', () => {
      it('should extract owner from event', () => {
        const event = createTestEvent({ owner: 'org-123' });
        expect(projection['getOwner'](event)).toBe('org-123');
      });
    });

    describe('getAggregateID', () => {
      it('should extract aggregateID from event', () => {
        const event = createTestEvent({ aggregateID: 'user-456' });
        expect(projection['getAggregateID'](event)).toBe('user-456');
      });
    });

    describe('getAggregateType', () => {
      it('should extract aggregateType from event', () => {
        const event = createTestEvent({ aggregateType: 'organization' });
        expect(projection['getAggregateType'](event)).toBe('organization');
      });
    });

    describe('getInstanceID', () => {
      it('should extract instanceID from event', () => {
        const event = createTestEvent({ instanceID: 'instance-999' });
        expect(projection['getInstanceID'](event)).toBe('instance-999');
      });
    });
  });

  describe('Lifecycle Hooks', () => {
    it('should allow subclass to override start', async () => {
      let startCalled = false;
      
      const customProjection = new (class extends TestProjection {
        async start(): Promise<void> {
          startCalled = true;
        }
      })(mockEventstore, mockDatabase as any);
      
      await customProjection.start();
      
      expect(startCalled).toBe(true);
    });

    it('should allow subclass to override stop', async () => {
      let stopCalled = false;
      
      const customProjection = new (class extends TestProjection {
        async stop(): Promise<void> {
          stopCalled = true;
        }
      })(mockEventstore, mockDatabase as any);
      
      await customProjection.stop();
      
      expect(stopCalled).toBe(true);
    });

    it('should allow subclass to override cleanup', async () => {
      let cleanupCalled = false;
      
      const customProjection = new (class extends TestProjection {
        async cleanup(): Promise<void> {
          cleanupCalled = true;
        }
      })(mockEventstore, mockDatabase as any);
      
      await customProjection.cleanup();
      
      expect(cleanupCalled).toBe(true);
    });

    it('should have default no-op lifecycle methods', async () => {
      await expect(projection.start()).resolves.not.toThrow();
      await expect(projection.stop()).resolves.not.toThrow();
      await expect(projection.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should propagate database errors from insert', async () => {
      mockDatabase.query.mockRejectedValueOnce(new Error('Insert failed'));
      
      await expect(projection['insert']('users', { id: '123' })).rejects.toThrow('Insert failed');
    });

    it('should propagate database errors from update', async () => {
      mockDatabase.query.mockRejectedValueOnce(new Error('Update failed'));
      
      await expect(projection['update']('users', '123', { name: 'test' })).rejects.toThrow('Update failed');
    });

    it('should propagate database errors from delete', async () => {
      mockDatabase.query.mockRejectedValueOnce(new Error('Delete failed'));
      
      await expect(projection['delete']('users', '123')).rejects.toThrow('Delete failed');
    });

    it('should propagate database errors from reset', async () => {
      mockDatabase.query.mockRejectedValueOnce(new Error('Truncate failed'));
      
      await expect(projection.reset()).rejects.toThrow('Truncate failed');
    });
  });
});

