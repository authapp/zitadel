/**
 * Failed Event Handler Unit Tests
 * 
 * Comprehensive tests for the FailedEventHandler class covering:
 * - Recording failed events with retry tracking
 * - Retrieving failed events (single and multiple)
 * - Removing failed events after successful retry
 * - Failed event statistics and monitoring
 * - Permanent failure detection
 * - Database initialization
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FailedEventHandler } from '../../../../src/lib/query/projection/failed-events';
import { Event } from '../../../../src/lib/eventstore/types';

// Mock database
const createMockDatabase = () => {
  const failedEvents = new Map<string, any>();
  
  return {
    query: jest.fn(async (sql: string, params?: any[]) => {
      // Table creation
      if (sql.includes('CREATE TABLE')) return { rows: [] };
      if (sql.includes('CREATE INDEX')) return { rows: [] };
      
      // INSERT new
      if (sql.includes('INSERT INTO')) {
        const [id, projectionName, position, error, eventPayload, instanceID] = params || [];
        failedEvents.set(id, {
          id, projection_name: projectionName, projectionName,
          failed_sequence: position, failedSequence: position, position,
          failure_count: 1, failureCount: 1, error,
          event_data: eventPayload, eventData: eventPayload,
          last_failed: new Date(), lastFailed: new Date(),
          instance_id: instanceID, instanceID,
        });
        return { rows: [] };
      }
      
      // UPDATE increment failure count
      if (sql.includes('UPDATE') && sql.includes('failure_count = failure_count + 1')) {
        const key = `${params?.[2]}:${params?.[3]}`;
        const event = failedEvents.get(key);
        if (event) {
          event.failure_count++;
          event.failureCount++;
          event.error = params?.[0];
          event.last_failed = new Date();
          event.lastFailed = new Date();
        }
        return { rows: [] };
      }
      
      // DELETE by ID (most specific first)
      if (sql.includes('DELETE') && sql.includes('WHERE id = $1') && !sql.includes('AND')) {
        failedEvents.delete(params?.[0]);
        return { rows: [] };
      }
      
      // DELETE by projection and position (specific)
      if (sql.includes('DELETE') && sql.includes('WHERE projection_name = $1 AND failed_sequence = $2')) {
        const [projectionName, position] = params || [];
        for (const [key, event] of failedEvents.entries()) {
          if (event.projection_name === projectionName && event.failed_sequence === position) {
            failedEvents.delete(key);
            break;
          }
        }
        return { rows: [] };
      }
      
      // DELETE all for projection (least specific)
      if (sql.includes('DELETE') && sql.includes('WHERE projection_name = $1') && !sql.includes('AND')) {
        for (const [key, event] of failedEvents.entries()) {
          if (event.projection_name === params?.[0]) failedEvents.delete(key);
        }
        return { rows: [] };
      }
      
      // SELECT single failed event (most specific with 2 params)
      if (sql.includes('SELECT') && sql.includes('WHERE projection_name = $1 AND failed_sequence = $2')) {
        const [projectionName, position] = params || [];
        const event = Array.from(failedEvents.values()).find(
          e => e.projection_name === projectionName && e.failed_sequence === position
        );
        return { rows: event ? [event] : [] };
      }
      
      // SELECT permanently failed (has failure_count check, more specific)
      if (sql.includes('SELECT') && sql.includes('WHERE projection_name = $1 AND failure_count >= $2')) {
        const [projectionName, maxRetries] = params || [];
        const events = Array.from(failedEvents.values()).filter(
          e => e.projection_name === projectionName && e.failure_count >= maxRetries
        );
        return { rows: events };
      }
      
      // SELECT all for projection (least specific)
      if (sql.includes('SELECT') && sql.includes('WHERE projection_name = $1') && sql.includes('ORDER BY failed_sequence')) {
        const events = Array.from(failedEvents.values()).filter(e => e.projection_name === params?.[0]);
        return { rows: events };
      }
      
      // SELECT stats
      if (sql.includes('COUNT(*) as total')) {
        const events = Array.from(failedEvents.values());
        return {
          rows: [{
            total: events.length.toString(),
            oldest: events.length > 0 ? new Date(Math.min(...events.map((e: any) => e.last_failed.getTime()))) : null,
            newest: events.length > 0 ? new Date(Math.max(...events.map((e: any) => e.last_failed.getTime()))) : null,
          }],
        };
      }
      
      // SELECT by projection
      if (sql.includes('GROUP BY projection_name')) {
        const counts = new Map<string, number>();
        for (const event of failedEvents.values()) {
          counts.set(event.projection_name, (counts.get(event.projection_name) || 0) + 1);
        }
        return { rows: Array.from(counts.entries()).map(([projection_name, count]) => ({ projection_name, count: count.toString() })) };
      }
      
      return { rows: [] };
    }),
  };
};

const createTestEvent = (position: number): Event => ({
  eventType: 'user.created', aggregateType: 'user', aggregateID: `user-${position}`,
  aggregateVersion: 1n, payload: { username: 'testuser' }, position: { position, inTxOrder: 0 },
  createdAt: new Date(), creator: 'test', owner: 'test', instanceID: 'test', revision: 1,
});

describe('FailedEventHandler', () => {
  let handler: FailedEventHandler;
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase = createMockDatabase();
    handler = new FailedEventHandler(mockDatabase as any);
  });

  describe('Initialization', () => {
    it('should initialize table with correct schema', async () => {
      await handler.init();
      const call = mockDatabase.query.mock.calls.find((c: any) => c[0]?.includes('CREATE TABLE'));
      expect(call[0]).toContain('id TEXT PRIMARY KEY');
      expect(call[0]).toContain('UNIQUE(projection_name, failed_sequence)');
    });

    it('should create required indexes', async () => {
      await handler.init();
      expect(mockDatabase.query).toHaveBeenCalledWith(expect.stringContaining('idx_failed_events_projection'));
      expect(mockDatabase.query).toHaveBeenCalledWith(expect.stringContaining('idx_failed_events_last_failed'));
    });
  });

  describe('Record & Retrieve', () => {
    it('should record new failed event', async () => {
      await handler.recordFailedEvent('proj1', createTestEvent(100), new Error('Test'), 'inst1');
      const failed = await handler.getFailedEvent('proj1', 100);
      expect(failed?.failureCount).toBe(1);
      expect(failed?.error).toBe('Test');
    });

    it('should increment failure count on retry', async () => {
      const event = createTestEvent(100);
      await handler.recordFailedEvent('proj1', event, new Error('E1'), 'inst1');
      await handler.recordFailedEvent('proj1', event, new Error('E2'), 'inst1');
      const failed = await handler.getFailedEvent('proj1', 100);
      expect(failed?.failureCount).toBe(2);
    });

    it('should return null for non-existent event', async () => {
      expect(await handler.getFailedEvent('proj1', 999)).toBeNull();
    });

    it('should get all failed events for projection', async () => {
      await handler.recordFailedEvent('proj1', createTestEvent(100), new Error('E1'), 'inst1');
      await handler.recordFailedEvent('proj1', createTestEvent(200), new Error('E2'), 'inst1');
      const events = await handler.getFailedEvents('proj1');
      expect(events).toHaveLength(2);
    });
  });

  describe('Remove', () => {
    it('should remove by ID', async () => {
      await handler.recordFailedEvent('proj1', createTestEvent(100), new Error('E1'), 'inst1');
      await handler.removeFailedEvent('proj1:100');
      expect(await handler.getFailedEvent('proj1', 100)).toBeNull();
    });

    it('should remove by position', async () => {
      await handler.recordFailedEvent('proj1', createTestEvent(100), new Error('E1'), 'inst1');
      await handler.removeFailedEventByPosition('proj1', 100);
      expect(await handler.getFailedEvent('proj1', 100)).toBeNull();
    });

    it('should clear all for projection', async () => {
      await handler.recordFailedEvent('proj1', createTestEvent(100), new Error('E1'), 'inst1');
      await handler.recordFailedEvent('proj1', createTestEvent(200), new Error('E2'), 'inst1');
      await handler.clearFailedEvents('proj1');
      expect(await handler.getFailedEvents('proj1')).toEqual([]);
    });
  });

  describe('Statistics', () => {
    it('should calculate stats correctly', async () => {
      await handler.recordFailedEvent('proj1', createTestEvent(100), new Error('E1'), 'inst1');
      await handler.recordFailedEvent('proj1', createTestEvent(200), new Error('E2'), 'inst1');
      await handler.recordFailedEvent('proj2', createTestEvent(300), new Error('E3'), 'inst1');
      const stats = await handler.getFailedEventStats();
      expect(stats.totalFailed).toBe(3);
      expect(stats.failedByProjection.get('proj1')).toBe(2);
      expect(stats.failedByProjection.get('proj2')).toBe(1);
    });
  });

  describe('Permanent Failures', () => {
    it('should identify events exceeding max retries', async () => {
      const event = createTestEvent(100);
      for (let i = 0; i < 5; i++) {
        await handler.recordFailedEvent('proj1', event, new Error('E'), 'inst1');
      }
      const permanent = await handler.getPermanentlyFailedEvents('proj1', 5);
      expect(permanent).toHaveLength(1);
      expect(permanent[0].failureCount).toBe(5);
    });

    it('should not include events below threshold', async () => {
      await handler.recordFailedEvent('proj1', createTestEvent(100), new Error('E'), 'inst1');
      const permanent = await handler.getPermanentlyFailedEvents('proj1', 5);
      expect(permanent).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle position 0', async () => {
      await handler.recordFailedEvent('proj1', createTestEvent(0), new Error('E'), 'inst1');
      expect(await handler.getFailedEvent('proj1', 0)).not.toBeNull();
    });

    it('should handle NULL instance ID', async () => {
      await handler.recordFailedEvent('proj1', createTestEvent(100), new Error('E'), undefined);
      const failed = await handler.getFailedEvent('proj1', 100);
      expect(failed?.instanceID).toBeUndefined();
    });

    it('should handle bigint in event', async () => {
      const event = createTestEvent(100);
      event.aggregateVersion = 999999999999n;
      await expect(handler.recordFailedEvent('proj1', event, new Error('E'), 'inst1')).resolves.not.toThrow();
    });
  });
});
