/**
 * Projection Configuration Unit Tests
 * 
 * Comprehensive tests for projection configuration covering:
 * - Default value application
 * - Configuration validation
 * - Event filtering logic
 * - Test mode detection
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  ProjectionConfig,
  ProjectionFilter,
  applyProjectionDefaults,
  eventMatchesFilter,
} from '../../../../src/lib/query/projection/projection-config';
import { Event } from '../../../../src/lib/eventstore/types';

const createTestEvent = (overrides?: Partial<Event>): Event => ({
  eventType: 'user.created',
  aggregateType: 'user',
  aggregateID: 'user-123',
  aggregateVersion: 1n,
  payload: { username: 'test' },
  position: { position: 1, inTxOrder: 0 },
  createdAt: new Date(),
  creator: 'creator-1',
  owner: 'owner-1',
  instanceID: 'instance-1',
  revision: 1,
  ...overrides,
});

describe('Projection Configuration', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe('applyProjectionDefaults', () => {
    it('should apply all default values to minimal config', () => {
      const config: ProjectionConfig = {
        name: 'test_projection',
        tables: ['test_table'],
      };

      const result = applyProjectionDefaults(config);

      expect(result).toEqual({
        name: 'test_projection',
        tables: ['test_table'],
        eventTypes: [],
        aggregateTypes: [],
        batchSize: 100,
        interval: expect.any(Number),
        maxRetries: 3,
        retryDelay: 5000,
        enableLocking: true,
        lockTTL: 60,
        instanceID: undefined,
        startPosition: undefined,
        rebuildOnStart: false,
      });
    });

    it('should preserve provided values', () => {
      const config: ProjectionConfig = {
        name: 'test_projection',
        tables: ['test_table'],
        eventTypes: ['user.created', 'user.updated'],
        aggregateTypes: ['user', 'organization'],
        batchSize: 50,
        interval: 2000,
        maxRetries: 5,
        retryDelay: 10000,
        enableLocking: false,
        lockTTL: 120,
        instanceID: 'instance-1',
        startPosition: 1000,
        rebuildOnStart: true,
      };

      const result = applyProjectionDefaults(config);

      expect(result).toEqual({
        name: 'test_projection',
        tables: ['test_table'],
        eventTypes: ['user.created', 'user.updated'],
        aggregateTypes: ['user', 'organization'],
        batchSize: 50,
        interval: 2000,
        maxRetries: 5,
        retryDelay: 10000,
        enableLocking: false,
        lockTTL: 120,
        instanceID: 'instance-1',
        startPosition: 1000,
        rebuildOnStart: true,
      });
    });

    it('should use test interval in test mode', () => {
      process.env.NODE_ENV = 'test';

      const config: ProjectionConfig = {
        name: 'test_projection',
        tables: ['test_table'],
      };

      const result = applyProjectionDefaults(config);

      expect(result.interval).toBe(100); // Fast polling in tests
    });

    it('should use production interval in production mode', () => {
      process.env.NODE_ENV = 'production';
      delete (process.env as any).JEST_WORKER_ID;

      const config: ProjectionConfig = {
        name: 'test_projection',
        tables: ['test_table'],
      };

      const result = applyProjectionDefaults(config);

      expect(result.interval).toBe(1000); // Normal polling in production
    });

    it('should detect JEST_WORKER_ID for test mode', () => {
      delete process.env.NODE_ENV;
      (process.env as any).JEST_WORKER_ID = '1';

      const config: ProjectionConfig = {
        name: 'test_projection',
        tables: ['test_table'],
      };

      const result = applyProjectionDefaults(config);

      expect(result.interval).toBe(100);
    });

    it('should enable locking by default', () => {
      const config: ProjectionConfig = {
        name: 'test_projection',
        tables: ['test_table'],
      };

      const result = applyProjectionDefaults(config);

      expect(result.enableLocking).toBe(true);
    });

    it('should allow explicitly disabling locking', () => {
      const config: ProjectionConfig = {
        name: 'test_projection',
        tables: ['test_table'],
        enableLocking: false,
      };

      const result = applyProjectionDefaults(config);

      expect(result.enableLocking).toBe(false);
    });

    it('should handle empty event and aggregate type arrays', () => {
      const config: ProjectionConfig = {
        name: 'test_projection',
        tables: ['test_table'],
        eventTypes: [],
        aggregateTypes: [],
      };

      const result = applyProjectionDefaults(config);

      expect(result.eventTypes).toEqual([]);
      expect(result.aggregateTypes).toEqual([]);
    });

    it('should handle multiple tables', () => {
      const config: ProjectionConfig = {
        name: 'test_projection',
        tables: ['table1', 'table2', 'table3'],
      };

      const result = applyProjectionDefaults(config);

      expect(result.tables).toEqual(['table1', 'table2', 'table3']);
    });

    it('should default rebuildOnStart to false', () => {
      const config: ProjectionConfig = {
        name: 'test_projection',
        tables: ['test_table'],
      };

      const result = applyProjectionDefaults(config);

      expect(result.rebuildOnStart).toBe(false);
    });

    it('should handle startPosition of 0', () => {
      const config: ProjectionConfig = {
        name: 'test_projection',
        tables: ['test_table'],
        startPosition: 0,
      };

      const result = applyProjectionDefaults(config);

      expect(result.startPosition).toBe(0);
    });

    it('should allow NULL instanceID for processing all instances', () => {
      const config: ProjectionConfig = {
        name: 'test_projection',
        tables: ['test_table'],
      };

      const result = applyProjectionDefaults(config);

      expect(result.instanceID).toBeUndefined();
    });
  });

  describe('eventMatchesFilter', () => {
    describe('Event Type Filtering', () => {
      it('should match when event type is in filter', () => {
        const event = createTestEvent({ eventType: 'user.created' });
        const filter: ProjectionFilter = {
          eventTypes: ['user.created', 'user.updated'],
        };

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });

      it('should not match when event type is not in filter', () => {
        const event = createTestEvent({ eventType: 'user.deleted' });
        const filter: ProjectionFilter = {
          eventTypes: ['user.created', 'user.updated'],
        };

        expect(eventMatchesFilter(event, filter)).toBe(false);
      });

      it('should match when no event types specified', () => {
        const event = createTestEvent({ eventType: 'user.deleted' });
        const filter: ProjectionFilter = {};

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });

      it('should match when event types array is empty', () => {
        const event = createTestEvent();
        const filter: ProjectionFilter = { eventTypes: [] };

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });
    });

    describe('Aggregate Type Filtering', () => {
      it('should match when aggregate type is in filter', () => {
        const event = createTestEvent({ aggregateType: 'user' });
        const filter: ProjectionFilter = {
          aggregateTypes: ['user', 'organization'],
        };

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });

      it('should not match when aggregate type is not in filter', () => {
        const event = createTestEvent({ aggregateType: 'project' });
        const filter: ProjectionFilter = {
          aggregateTypes: ['user', 'organization'],
        };

        expect(eventMatchesFilter(event, filter)).toBe(false);
      });

      it('should match when no aggregate types specified', () => {
        const event = createTestEvent();
        const filter: ProjectionFilter = {};

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });
    });

    describe('Aggregate ID Filtering', () => {
      it('should match when aggregate ID is in filter', () => {
        const event = createTestEvent({ aggregateID: 'user-123' });
        const filter: ProjectionFilter = {
          aggregateIDs: ['user-123', 'user-456'],
        };

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });

      it('should not match when aggregate ID is not in filter', () => {
        const event = createTestEvent({ aggregateID: 'user-789' });
        const filter: ProjectionFilter = {
          aggregateIDs: ['user-123', 'user-456'],
        };

        expect(eventMatchesFilter(event, filter)).toBe(false);
      });

      it('should match when no aggregate IDs specified', () => {
        const event = createTestEvent();
        const filter: ProjectionFilter = {};

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });
    });

    describe('Instance ID Filtering', () => {
      it('should match when instance ID matches', () => {
        const event = createTestEvent({ instanceID: 'instance-1' });
        const filter: ProjectionFilter = {
          instanceID: 'instance-1',
        };

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });

      it('should not match when instance ID does not match', () => {
        const event = createTestEvent({ instanceID: 'instance-2' });
        const filter: ProjectionFilter = {
          instanceID: 'instance-1',
        };

        expect(eventMatchesFilter(event, filter)).toBe(false);
      });

      it('should match when no instance ID specified', () => {
        const event = createTestEvent();
        const filter: ProjectionFilter = {};

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });
    });

    describe('Owner Filtering', () => {
      it('should match when owner matches', () => {
        const event = createTestEvent({ owner: 'owner-1' });
        const filter: ProjectionFilter = {
          owner: 'owner-1',
        };

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });

      it('should not match when owner does not match', () => {
        const event = createTestEvent({ owner: 'owner-2' });
        const filter: ProjectionFilter = {
          owner: 'owner-1',
        };

        expect(eventMatchesFilter(event, filter)).toBe(false);
      });

      it('should match when no owner specified', () => {
        const event = createTestEvent();
        const filter: ProjectionFilter = {};

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });
    });

    describe('Custom Filter', () => {
      it('should match when custom filter returns true', () => {
        const event = createTestEvent({ aggregateID: 'user-123' });
        const filter: ProjectionFilter = {
          customFilter: (e) => e.aggregateID.startsWith('user-'),
        };

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });

      it('should not match when custom filter returns false', () => {
        const event = createTestEvent({ aggregateID: 'org-123' });
        const filter: ProjectionFilter = {
          customFilter: (e) => e.aggregateID.startsWith('user-'),
        };

        expect(eventMatchesFilter(event, filter)).toBe(false);
      });

      it('should match when no custom filter specified', () => {
        const event = createTestEvent();
        const filter: ProjectionFilter = {};

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });

      it('should support complex custom filter logic', () => {
        const event = createTestEvent({
          payload: { username: 'admin', role: 'administrator' },
        });
        const filter: ProjectionFilter = {
          customFilter: (e) => {
            const payload = e.payload as any;
            return payload.role === 'administrator';
          },
        };

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });
    });

    describe('Combined Filters', () => {
      it('should match when all filters match', () => {
        const event = createTestEvent({
          eventType: 'user.created',
          aggregateType: 'user',
          aggregateID: 'user-123',
          instanceID: 'instance-1',
          owner: 'owner-1',
        });

        const filter: ProjectionFilter = {
          eventTypes: ['user.created'],
          aggregateTypes: ['user'],
          aggregateIDs: ['user-123'],
          instanceID: 'instance-1',
          owner: 'owner-1',
        };

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });

      it('should not match if any filter fails', () => {
        const event = createTestEvent({
          eventType: 'user.created',
          aggregateType: 'user',
          aggregateID: 'user-123',
          instanceID: 'instance-2', // Wrong instance
          owner: 'owner-1',
        });

        const filter: ProjectionFilter = {
          eventTypes: ['user.created'],
          aggregateTypes: ['user'],
          aggregateIDs: ['user-123'],
          instanceID: 'instance-1',
          owner: 'owner-1',
        };

        expect(eventMatchesFilter(event, filter)).toBe(false);
      });

      it('should match with partial filters', () => {
        const event = createTestEvent({
          eventType: 'user.created',
          aggregateType: 'user',
        });

        const filter: ProjectionFilter = {
          eventTypes: ['user.created'],
          // Other filters not specified
        };

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });

      it('should support custom filter with other filters', () => {
        const event = createTestEvent({
          eventType: 'user.created',
          aggregateType: 'user',
          payload: { active: true },
        });

        const filter: ProjectionFilter = {
          eventTypes: ['user.created'],
          aggregateTypes: ['user'],
          customFilter: (e) => (e.payload as any).active === true,
        };

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty filter object', () => {
        const event = createTestEvent();
        const filter: ProjectionFilter = {};

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });

      it('should handle event with missing optional fields', () => {
        const event = createTestEvent({
          instanceID: '',
          owner: '',
        });

        const filter: ProjectionFilter = {
          eventTypes: ['user.created'],
        };

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });

      it('should handle very long filter arrays', () => {
        const event = createTestEvent({ eventType: 'user.created' });
        const filter: ProjectionFilter = {
          eventTypes: Array.from({ length: 100 }, (_, i) => `event.type${i}`).concat(['user.created']),
        };

        expect(eventMatchesFilter(event, filter)).toBe(true);
      });
    });
  });
});
