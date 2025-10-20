/**
 * Current State Tracker Unit Tests
 * 
 * Comprehensive tests for the CurrentStateTracker class covering:
 * - Position tracking and updates
 * - State retrieval (single and multiple)
 * - Timestamp tracking
 * - State deletion for rebuilds
 * - Lag calculation
 * - Database initialization
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CurrentStateTracker, CurrentState } from '../../../../src/lib/query/projection/current-state';

// Mock database
const createMockDatabase = () => {
  const states = new Map<string, CurrentState>();
  
  return {
    query: jest.fn(async (sql: string, params?: any[]) => {
      // Table creation
      if (sql.includes('CREATE TABLE')) {
        return { rows: [] };
      }
      
      // Index creation
      if (sql.includes('CREATE INDEX')) {
        return { rows: [] };
      }
      
      // SELECT event_timestamp only
      if (sql.includes('SELECT event_timestamp FROM') && sql.includes('WHERE name = $1')) {
        const projectionName = params?.[0];
        const state = states.get(projectionName);
        return { rows: state ? [{ event_timestamp: state.eventTimestamp }] : [] };
      }
      
      // SELECT single state (full)
      if (sql.includes('SELECT') && sql.includes('WHERE name = $1')) {
        const projectionName = params?.[0];
        const state = states.get(projectionName);
        return { rows: state ? [state] : [] };
      }
      
      // SELECT all states
      if (sql.includes('SELECT') && sql.includes('ORDER BY name')) {
        return { rows: Array.from(states.values()) };
      }
      
      // INSERT/UPDATE position
      if (sql.includes('INSERT INTO') && sql.includes('ON CONFLICT')) {
        const [projectionName, position, positionOffset, eventTimestamp, instanceID, aggregateType, aggregateID, sequence] = params || [];
        states.set(projectionName, {
          projectionName,
          position,
          positionOffset,
          eventTimestamp,
          lastUpdated: new Date(),
          instanceID,
          aggregateType,
          aggregateID,
          sequence,
        });
        return { rows: [] };
      }
      
      // DELETE state
      if (sql.includes('DELETE FROM') && sql.includes('WHERE name = $1')) {
        const projectionName = params?.[0];
        states.delete(projectionName);
        return { rows: [] };
      }
      
      return { rows: [] };
    }),
  };
};

describe('CurrentStateTracker', () => {
  let tracker: CurrentStateTracker;
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase = createMockDatabase();
    tracker = new CurrentStateTracker(mockDatabase as any);
  });

  describe('Initialization', () => {
    it('should initialize without errors (tables created by migrations)', async () => {
      await expect(tracker.init()).resolves.not.toThrow();
    });

    it('should be idempotent', async () => {
      await tracker.init();
      await tracker.init();
      
      // Should not throw on multiple calls
      expect(true).toBe(true);
    });
  });

  describe('Get Current State', () => {
    it('should return null for non-existent projection', async () => {
      const state = await tracker.getCurrentState('non_existent');
      
      expect(state).toBeNull();
    });

    it('should return current state for existing projection', async () => {
      const testDate = new Date('2024-01-01T00:00:00Z');
      
      await tracker.updatePosition(
        'test_projection',
        100,
        0,
        testDate,
        'instance-1',
        'user',
        'user-123',
        5
      );
      
      const state = await tracker.getCurrentState('test_projection');
      
      expect(state).toBeDefined();
      expect(state?.projectionName).toBe('test_projection');
      expect(state?.position).toBe(100);
      expect(state?.instanceID).toBe('instance-1');
      expect(state?.aggregateType).toBe('user');
      expect(state?.aggregateID).toBe('user-123');
      expect(state?.sequence).toBe(5);
    });

    it('should query with correct SQL', async () => {
      await tracker.getCurrentState('test_projection');
      
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['test_projection']
      );
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE name = $1'),
        ['test_projection']
      );
    });

    it('should return state with all required fields', async () => {
      const testDate = new Date();
      
      await tracker.updatePosition(
        'test_projection',
        200,
        0,
        testDate,
        'instance-2',
        'org',
        'org-456',
        10
      );
      
      const state = await tracker.getCurrentState('test_projection');
      
      expect(state).toMatchObject({
        projectionName: 'test_projection',
        position: 200,
        eventTimestamp: testDate,
        instanceID: 'instance-2',
        aggregateType: 'org',
        aggregateID: 'org-456',
        sequence: 10,
      });
      expect(state?.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('Update Position', () => {
    it('should insert new state for first update', async () => {
      const testDate = new Date();
      
      await tracker.updatePosition(
        'new_projection',
        50,
        0,
        testDate,
        'instance-1',
        'user',
        'user-789',
        3
      );
      
      const state = await tracker.getCurrentState('new_projection');
      
      expect(state).toBeDefined();
      expect(state?.position).toBe(50);
    });

    it('should update existing state on subsequent updates', async () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-02');
      
      await tracker.updatePosition('test_projection', 100, 0, date1, 'instance-1', 'user', 'user-1', 1);
      await tracker.updatePosition('test_projection', 200, 0, date2, 'instance-1', 'user', 'user-2', 2);
      
      const state = await tracker.getCurrentState('test_projection');
      
      expect(state?.position).toBe(200);
      expect(state?.eventTimestamp).toEqual(date2);
      expect(state?.aggregateID).toBe('user-2');
      expect(state?.sequence).toBe(2);
    });

    it('should handle NULL instance ID', async () => {
      await tracker.updatePosition(
        'test_projection',
        100,
        0,
        new Date(),
        null,
        'user',
        'user-1',
        1
      );
      
      const state = await tracker.getCurrentState('test_projection');
      
      expect(state?.instanceID).toBeNull();
    });

    it('should use ON CONFLICT for upsert behavior', async () => {
      const testDate = new Date();
      
      await tracker.updatePosition('test_projection', 100, 0, testDate, 'instance-1', 'user', 'user-1', 1);
      
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (name)'),
        expect.any(Array)
      );
    });

    it('should update lastUpdated timestamp automatically', async () => {
      const oldDate = new Date('2024-01-01');
      
      await tracker.updatePosition('test_projection', 100, 0, oldDate, 'instance-1', 'user', 'user-1', 1);
      await tracker.getCurrentState('test_projection');
      
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await tracker.updatePosition('test_projection', 200, 0, oldDate, 'instance-1', 'user', 'user-2', 2);
      const state2 = await tracker.getCurrentState('test_projection');
      
      // lastUpdated should be auto-updated by database (mocked as new Date())
      expect(state2?.lastUpdated).toBeDefined();
    });

    it('should track multiple projections independently', async () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-02');
      
      await tracker.updatePosition('projection1', 100, 0, date1, 'instance-1', 'user', 'user-1', 1);
      await tracker.updatePosition('projection2', 200, 0, date2, 'instance-2', 'org', 'org-1', 2);
      
      const state1 = await tracker.getCurrentState('projection1');
      const state2 = await tracker.getCurrentState('projection2');
      
      expect(state1?.position).toBe(100);
      expect(state2?.position).toBe(200);
      expect(state1?.aggregateType).toBe('user');
      expect(state2?.aggregateType).toBe('org');
    });
  });

  describe('Get Last Event Timestamp', () => {
    it('should return null for non-existent projection', async () => {
      const timestamp = await tracker.getLastEventTimestamp('non_existent');
      
      expect(timestamp).toBeNull();
    });

    it('should return timestamp for existing projection', async () => {
      const testDate = new Date('2024-01-01T12:00:00Z');
      
      await tracker.updatePosition('test_projection', 100, 0, testDate, 'instance-1', 'user', 'user-1', 1);
      
      const timestamp = await tracker.getLastEventTimestamp('test_projection');
      
      expect(timestamp).toEqual(testDate);
    });

    it('should query only event_timestamp column', async () => {
      await tracker.getLastEventTimestamp('test_projection');
      
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT event_timestamp FROM'),
        ['test_projection']
      );
    });
  });

  describe('Get All States', () => {
    it('should return empty array when no projections exist', async () => {
      const states = await tracker.getAllStates();
      
      expect(states).toEqual([]);
    });

    it('should return all projection states', async () => {
      const date = new Date();
      
      await tracker.updatePosition('projection1', 100, 0, date, 'instance-1', 'user', 'user-1', 1);
      await tracker.updatePosition('projection2', 200, 0, date, 'instance-1', 'org', 'org-1', 2);
      await tracker.updatePosition('projection3', 300, 0, date, 'instance-2', 'project', 'project-1', 3);
      
      const states = await tracker.getAllStates();
      
      expect(states).toHaveLength(3);
      expect(states.map(s => s.projectionName)).toContain('projection1');
      expect(states.map(s => s.projectionName)).toContain('projection2');
      expect(states.map(s => s.projectionName)).toContain('projection3');
    });

    it('should order results by projection name', async () => {
      await tracker.getAllStates();
      
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY name')
      );
    });

    it('should return complete state objects', async () => {
      const testDate = new Date();
      
      await tracker.updatePosition('test_projection', 150, 0, testDate, 'instance-1', 'user', 'user-1', 5);
      
      const states = await tracker.getAllStates();
      
      expect(states[0]).toMatchObject({
        projectionName: 'test_projection',
        position: 150,
        eventTimestamp: testDate,
        instanceID: 'instance-1',
        aggregateType: 'user',
        aggregateID: 'user-1',
        sequence: 5,
      });
    });
  });

  describe('Delete State', () => {
    it('should delete existing projection state', async () => {
      const testDate = new Date();
      
      await tracker.updatePosition('test_projection', 100, 0, testDate, 'instance-1', 'user', 'user-1', 1);
      
      let state = await tracker.getCurrentState('test_projection');
      expect(state).not.toBeNull();
      
      await tracker.deleteState('test_projection');
      
      state = await tracker.getCurrentState('test_projection');
      expect(state).toBeNull();
    });

    it('should not error when deleting non-existent projection', async () => {
      await expect(tracker.deleteState('non_existent')).resolves.not.toThrow();
    });

    it('should use correct SQL for deletion', async () => {
      await tracker.deleteState('test_projection');
      
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM projection_states WHERE name = $1'),
        ['test_projection']
      );
    });

    it('should only delete specified projection', async () => {
      const date = new Date();
      
      await tracker.updatePosition('projection1', 100, 0, date, 'instance-1', 'user', 'user-1', 1);
      await tracker.updatePosition('projection2', 200, 0, date, 'instance-1', 'org', 'org-1', 2);
      
      await tracker.deleteState('projection1');
      
      const state1 = await tracker.getCurrentState('projection1');
      const state2 = await tracker.getCurrentState('projection2');
      
      expect(state1).toBeNull();
      expect(state2).not.toBeNull();
    });
  });

  describe('Get Projection Lag', () => {
    it('should return latestPosition when projection has no state', async () => {
      const lag = await tracker.getProjectionLag('new_projection', 1000);
      
      expect(lag).toBe(1000);
    });

    it('should calculate lag correctly', async () => {
      await tracker.updatePosition('test_projection', 800, 0, new Date(), 'instance-1', 'user', 'user-1', 1);
      
      const lag = await tracker.getProjectionLag('test_projection', 1000);
      
      expect(lag).toBe(200);
    });

    it('should return 0 when projection is up to date', async () => {
      await tracker.updatePosition('test_projection', 1000, 0, new Date(), 'instance-1', 'user', 'user-1', 1);
      
      const lag = await tracker.getProjectionLag('test_projection', 1000);
      
      expect(lag).toBe(0);
    });

    it('should handle negative lag (projection ahead)', async () => {
      await tracker.updatePosition('test_projection', 1200, 0, new Date(), 'instance-1', 'user', 'user-1', 1);
      
      const lag = await tracker.getProjectionLag('test_projection', 1000);
      
      expect(lag).toBe(-200);
    });

    it('should handle large position values', async () => {
      const largePosition = 999999999;
      await tracker.updatePosition('test_projection', largePosition - 1000, 0, new Date(), 'instance-1', 'user', 'user-1', 1);
      
      const lag = await tracker.getProjectionLag('test_projection', largePosition);
      
      expect(lag).toBe(1000);
    });
  });

  describe('Error Handling', () => {
    it('should propagate database errors on getCurrentState', async () => {
      mockDatabase.query.mockRejectedValueOnce(new Error('Query failed'));
      
      await expect(tracker.getCurrentState('test')).rejects.toThrow('Query failed');
    });

    it('should propagate database errors on updatePosition', async () => {
      mockDatabase.query.mockRejectedValueOnce(new Error('Insert failed'));
      
      await expect(
        tracker.updatePosition('test', 100, 0, new Date(), 'instance-1', 'user', 'user-1', 1)
      ).rejects.toThrow('Insert failed');
    });

    it('should propagate database errors on deleteState', async () => {
      mockDatabase.query.mockRejectedValueOnce(new Error('Delete failed'));
      
      await expect(tracker.deleteState('test')).rejects.toThrow('Delete failed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle position 0', async () => {
      await tracker.updatePosition('test_projection', 0, 0, new Date(), 'instance-1', 'user', 'user-1', 0);
      
      const state = await tracker.getCurrentState('test_projection');
      
      expect(state?.position).toBe(0);
      expect(state?.sequence).toBe(0);
    });

    it('should handle very long projection names', async () => {
      const longName = 'a'.repeat(200);
      
      await tracker.updatePosition(longName, 100, 0, new Date(), 'instance-1', 'user', 'user-1', 1);
      
      const state = await tracker.getCurrentState(longName);
      
      expect(state?.projectionName).toBe(longName);
    });

    it('should handle special characters in projection name', async () => {
      const specialName = 'test-projection_v2.1';
      
      await tracker.updatePosition(specialName, 100, 0, new Date(), 'instance-1', 'user', 'user-1', 1);
      
      const state = await tracker.getCurrentState(specialName);
      
      expect(state?.projectionName).toBe(specialName);
    });

    it('should handle empty string aggregate values', async () => {
      await tracker.updatePosition('test_projection', 100, 0, new Date(), 'instance-1', '', '', 1);
      
      const state = await tracker.getCurrentState('test_projection');
      
      expect(state?.aggregateType).toBe('');
      expect(state?.aggregateID).toBe('');
    });

    it('should handle very old dates', async () => {
      const oldDate = new Date('1970-01-01T00:00:00Z');
      
      await tracker.updatePosition('test_projection', 100, 0, oldDate, 'instance-1', 'user', 'user-1', 1);
      
      const state = await tracker.getCurrentState('test_projection');
      
      expect(state?.eventTimestamp).toEqual(oldDate);
    });

    it('should handle future dates', async () => {
      const futureDate = new Date('2099-12-31T23:59:59Z');
      
      await tracker.updatePosition('test_projection', 100, 0, futureDate, 'instance-1', 'user', 'user-1', 1);
      
      const state = await tracker.getCurrentState('test_projection');
      
      expect(state?.eventTimestamp).toEqual(futureDate);
    });
  });
});
