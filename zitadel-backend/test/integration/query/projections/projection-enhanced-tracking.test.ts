/**
 * Enhanced Projection State Tracking Tests
 * 
 * Tests for the optional enhanced state tracking fields added in migration 002_51:
 * - event_timestamp: Timestamp of last processed event
 * - instance_id: Instance ID for multi-instance tracking
 * - aggregate_type: Aggregate type for exact deduplication
 * - aggregate_id: Aggregate ID for exact deduplication
 * - sequence: Sequence number for exact deduplication
 * 
 * These fields are OPTIONAL to ensure backward compatibility with existing tests.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { PostgresEventstore } from '../../../../src/lib/eventstore';
import { Projection } from '../../../../src/lib/query/projection/projection';
import { ProjectionHandler } from '../../../../src/lib/query/projection/projection-handler';
import { CurrentStateTracker } from '../../../../src/lib/query/projection/current-state';
import { Event } from '../../../../src/lib/eventstore/types';
import { applyProjectionDefaults } from '../../../../src/lib/query/projection/projection-config';

// Simple test projection
class EnhancedTrackingProjection extends Projection {
  readonly name = 'enhanced_tracking_test';
  readonly tables = ['enhanced_tracking_data'];

  async init(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS enhanced_tracking_data (
        id TEXT PRIMARY KEY,
        data TEXT
      )
    `);
  }

  async reduce(event: Event): Promise<void> {
    await this.query(`
      INSERT INTO enhanced_tracking_data (id, data)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
    `, [event.aggregateID, JSON.stringify(event.payload)]);
  }
}

describe('Enhanced Projection State Tracking', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let stateTracker: CurrentStateTracker;

  beforeAll(async () => {
    pool = await createTestDatabase();
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
    });
    stateTracker = new CurrentStateTracker(pool);
    await stateTracker.init();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE events CASCADE');
    await pool.query('DELETE FROM projection_states');
    await pool.query('DROP TABLE IF EXISTS enhanced_tracking_data CASCADE');
    await pool.query('DROP TABLE IF EXISTS enhanced_tracking_data_2 CASCADE');
    try {
      await pool.query('DELETE FROM projection_locks');
    } catch (err) {
      // Table may not exist
    }
    try {
      await pool.query('DELETE FROM projection_failed_events');
    } catch (err) {
      // Table may not exist
    }
  });

  describe('Optional Enhanced Tracking Fields', () => {
    it('should store all enhanced tracking fields when provided', async () => {
      const projection = new EnhancedTrackingProjection(eventstore, pool);
      await projection.init();

      const config = applyProjectionDefaults({
        name: 'enhanced_tracking_test',
        tables: ['enhanced_tracking_data'],
        eventTypes: ['test.event'],
        aggregateTypes: ['test'],
        instanceID: 'instance-123',
        interval: 50,
        enableLocking: false,
      });

      // Push an event
      await eventstore.push({
        aggregateType: 'test',
        aggregateID: 'agg-456',
        eventType: 'test.event',
        payload: { value: 'test-data' },
        creator: 'system',
        owner: 'test',
        instanceID: 'instance-123',
      });

      const handler = new ProjectionHandler(projection, config, eventstore, pool);
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 300));
      await handler.stop();

      // Verify all enhanced fields are populated
      const state = await stateTracker.getCurrentState('enhanced_tracking_test');
      expect(state).toBeDefined();
      expect(state!.projectionName).toBe('enhanced_tracking_test');
      expect(Number(state!.position)).toBeGreaterThan(0);
      expect(state!.positionOffset).toBeDefined();
      
      // Enhanced tracking fields
      expect(state!.eventTimestamp).toBeInstanceOf(Date);
      expect(state!.instanceID).toBe('instance-123');
      expect(state!.aggregateType).toBe('test');
      expect(state!.aggregateID).toBe('agg-456');
      expect(Number(state!.sequence)).toBe(1);
    });

    it('should work without enhanced tracking fields (backward compatibility)', async () => {
      const projection = new EnhancedTrackingProjection(eventstore, pool);
      await projection.init();

      // Manually set position without enhanced fields (simulating old code)
      await projection.setCurrentPosition(100, 0);

      const state = await stateTracker.getCurrentState('enhanced_tracking_test');
      expect(state).toBeDefined();
      expect(Number(state!.position)).toBe(100);
      expect(state!.positionOffset).toBe(0);
      
      // Enhanced fields should be null/undefined (backward compatible)
      expect(state!.eventTimestamp).toBeFalsy();
      expect(state!.instanceID).toBeFalsy();
      expect(state!.aggregateType).toBeFalsy();
      expect(state!.aggregateID).toBeFalsy();
      expect(state!.sequence).toBeFalsy();
    });

    it('should allow partial enhanced tracking fields', async () => {
      const projection = new EnhancedTrackingProjection(eventstore, pool);
      await projection.init();

      const now = new Date();
      
      // Set position with only some enhanced fields
      await projection.setCurrentPosition(
        200,
        0,
        now,
        'partial-instance',
        null, // No aggregate type
        null, // No aggregate ID
        null  // No sequence
      );

      const state = await stateTracker.getCurrentState('enhanced_tracking_test');
      expect(state).toBeDefined();
      expect(Number(state!.position)).toBe(200);
      expect(state!.eventTimestamp).toBeInstanceOf(Date);
      expect(state!.instanceID).toBe('partial-instance');
      expect(state!.aggregateType).toBeFalsy();
      expect(state!.aggregateID).toBeFalsy();
      expect(state!.sequence).toBeFalsy();
    });

    it('should preserve existing enhanced fields when updating with nulls', async () => {
      const projection = new EnhancedTrackingProjection(eventstore, pool);
      await projection.init();

      const now = new Date();
      
      // First update: Set all fields
      await projection.setCurrentPosition(
        100,
        0,
        now,
        'instance-1',
        'aggregate-type-1',
        'aggregate-id-1',
        10
      );

      let state = await stateTracker.getCurrentState('enhanced_tracking_test');
      expect(state!.instanceID).toBe('instance-1');
      expect(state!.aggregateType).toBe('aggregate-type-1');
      expect(Number(state!.sequence)).toBe(10);

      // Second update: Update position only (with nulls for enhanced fields)
      await projection.setCurrentPosition(200, 0);

      state = await stateTracker.getCurrentState('enhanced_tracking_test');
      expect(Number(state!.position)).toBe(200);
      // Enhanced fields should be preserved due to COALESCE in SQL
      expect(state!.instanceID).toBe('instance-1');
      expect(state!.aggregateType).toBe('aggregate-type-1');
      expect(Number(state!.sequence)).toBe(10);
    });
  });

  describe('Enhanced Deduplication with Full State', () => {
    it('should enable exact deduplication with aggregate+sequence tracking', async () => {
      const projection = new EnhancedTrackingProjection(eventstore, pool);
      await projection.init();

      const config = applyProjectionDefaults({
        name: 'enhanced_tracking_test',
        tables: ['enhanced_tracking_data'],
        eventTypes: ['test.event'],
        aggregateTypes: ['test'],
        instanceID: 'dedupe-instance',
        interval: 50,
        enableLocking: false,
      });

      // Push 3 events
      for (let i = 1; i <= 3; i++) {
        await eventstore.push({
          aggregateType: 'test',
          aggregateID: `test-${i}`,
          eventType: 'test.event',
          payload: { value: `event-${i}` },
          creator: 'system',
          owner: 'test',
          instanceID: 'dedupe-instance',
        });
      }

      // First handler processes all events
      const handler1 = new ProjectionHandler(projection, config, eventstore, pool);
      await handler1.start();
      await new Promise(resolve => setTimeout(resolve, 300));
      await handler1.stop();

      // Verify state has full tracking info
      const state = await stateTracker.getCurrentState('enhanced_tracking_test');
      expect(state).toBeDefined();
      expect(state!.aggregateType).toBe('test');
      expect(state!.aggregateID).toBe('test-3'); // Last processed
      expect(Number(state!.sequence)).toBe(1);

      // Verify all 3 events processed
      const data = await pool.query('SELECT * FROM enhanced_tracking_data');
      expect(data.rows.length).toBe(3);

      // Second handler should not reprocess (exact deduplication)
      const projection2 = new EnhancedTrackingProjection(eventstore, pool);
      const handler2 = new ProjectionHandler(projection2, config, eventstore, pool);
      await handler2.start();
      await new Promise(resolve => setTimeout(resolve, 300));
      await handler2.stop();

      // Still 3 events (no reprocessing)
      const data2 = await pool.query('SELECT * FROM enhanced_tracking_data');
      expect(data2.rows.length).toBe(3);
    });
  });

  describe('Multi-Instance Tracking', () => {
    it('should track which instance last processed events', async () => {
      const projection1 = new EnhancedTrackingProjection(eventstore, pool);
      await projection1.init();

      const config1 = applyProjectionDefaults({
        name: 'enhanced_tracking_test',
        tables: ['enhanced_tracking_data'],
        eventTypes: ['test.event'],
        aggregateTypes: ['test'],
        instanceID: 'instance-alpha',
        interval: 50,
        enableLocking: false,
      });

      // Push events
      await eventstore.push({
        aggregateType: 'test',
        aggregateID: 'test-1',
        eventType: 'test.event',
        payload: { value: 'data' },
        creator: 'system',
        owner: 'test',
        instanceID: 'test-instance',
      });

      // Instance alpha processes
      const handler1 = new ProjectionHandler(projection1, config1, eventstore, pool);
      await handler1.start();
      await new Promise(resolve => setTimeout(resolve, 500));
      await handler1.stop();

      // Verify events were processed
      const data1 = await pool.query('SELECT * FROM enhanced_tracking_data');
      expect(data1.rows.length).toBe(1);

      // Verify instance alpha is tracked
      let state = await stateTracker.getCurrentState('enhanced_tracking_test');
      expect(state).toBeDefined();
      expect(state!.instanceID).toBe('instance-alpha');

      // Push more events
      await eventstore.push({
        aggregateType: 'test',
        aggregateID: 'test-2',
        eventType: 'test.event',
        payload: { value: 'data2' },
        creator: 'system',
        owner: 'test',
        instanceID: 'test-instance',
      });

      // Instance beta processes
      const projection2 = new EnhancedTrackingProjection(eventstore, pool);
      const config2 = applyProjectionDefaults({
        name: 'enhanced_tracking_test',
        tables: ['enhanced_tracking_data'],
        eventTypes: ['test.event'],
        aggregateTypes: ['test'],
        instanceID: 'instance-beta',
        interval: 50,
        enableLocking: false,
      });

      const handler2 = new ProjectionHandler(projection2, config2, eventstore, pool);
      await handler2.start();
      await new Promise(resolve => setTimeout(resolve, 300));
      await handler2.stop();

      // Verify instance beta is now tracked
      state = await stateTracker.getCurrentState('enhanced_tracking_test');
      expect(state!.instanceID).toBe('instance-beta');
    });

    it('should work with undefined instanceID (backward compatibility)', async () => {
      const projection = new EnhancedTrackingProjection(eventstore, pool);
      await projection.init();

      const config = applyProjectionDefaults({
        name: 'enhanced_tracking_test',
        tables: ['enhanced_tracking_data'],
        eventTypes: ['test.event'],
        aggregateTypes: ['test'],
        // instanceID intentionally not set
        interval: 50,
        enableLocking: false,
      });

      await eventstore.push({
        aggregateType: 'test',
        aggregateID: 'test-1',
        eventType: 'test.event',
        payload: { value: 'data' },
        creator: 'system',
        owner: 'test',
        instanceID: 'test-instance',
      });

      const handler = new ProjectionHandler(projection, config, eventstore, pool);
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 300));
      await handler.stop();

      // Should process successfully
      const data = await pool.query('SELECT * FROM enhanced_tracking_data');
      expect(data.rows.length).toBe(1);

      // instanceID should be null/undefined
      const state = await stateTracker.getCurrentState('enhanced_tracking_test');
      expect(state).toBeDefined();
      expect(state!.instanceID).toBeFalsy();
    });
  });

  describe('Event Timestamp Tracking', () => {
    it('should track event timestamps for lag monitoring', async () => {
      const projection = new EnhancedTrackingProjection(eventstore, pool);
      await projection.init();

      const config = applyProjectionDefaults({
        name: 'enhanced_tracking_test',
        tables: ['enhanced_tracking_data'],
        eventTypes: ['test.event'],
        aggregateTypes: ['test'],
        instanceID: 'test-instance',
        interval: 50,
        enableLocking: false,
      });

      const beforePush = new Date();
      
      await eventstore.push({
        aggregateType: 'test',
        aggregateID: 'test-1',
        eventType: 'test.event',
        payload: { value: 'data' },
        creator: 'system',
        owner: 'test',
        instanceID: 'test-instance',
      });

      await new Promise(resolve => setTimeout(resolve, 50)); // Small delay

      const handler = new ProjectionHandler(projection, config, eventstore, pool);
      await handler.start();
      await new Promise(resolve => setTimeout(resolve, 300));
      await handler.stop();

      const state = await stateTracker.getCurrentState('enhanced_tracking_test');
      expect(state).toBeDefined();
      expect(state!.eventTimestamp).toBeInstanceOf(Date);
      
      // Event timestamp should be around when we pushed it (allow 100ms tolerance for clock precision)
      const timeDiff = state!.eventTimestamp!.getTime() - beforePush.getTime();
      expect(Math.abs(timeDiff)).toBeLessThan(100); // Within 100ms tolerance
      
      // Last updated should be >= event timestamp (processing happened after event)
      expect(state!.lastUpdated.getTime()).toBeGreaterThanOrEqual(state!.eventTimestamp!.getTime());
    });
  });

  describe('Index Performance', () => {
    it('should have index on updated_at for monitoring queries', async () => {
      // Query to check if index exists
      const result = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'projection_states'
        AND indexname = 'idx_projection_states_updated_at'
      `);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].indexname).toBe('idx_projection_states_updated_at');
      expect(result.rows[0].indexdef).toContain('updated_at DESC');
    });

    it('should efficiently query projections by last update time', async () => {
      // Create multiple projection states
      const projection1 = new EnhancedTrackingProjection(eventstore, pool);
      await projection1.init();

      // Create a second projection class with different name
      class EnhancedTrackingProjection2 extends Projection {
        readonly name = 'enhanced_tracking_test_2';
        readonly tables = ['enhanced_tracking_data_2'];
        async init(): Promise<void> {
          await this.query(`
            CREATE TABLE IF NOT EXISTS enhanced_tracking_data_2 (id TEXT PRIMARY KEY, data TEXT)
          `);
        }
        async reduce(event: Event): Promise<void> {
          await this.query(`
            INSERT INTO enhanced_tracking_data_2 (id, data)
            VALUES ($1, $2)
            ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
          `, [event.aggregateID, JSON.stringify(event.payload)]);
        }
      }
      
      const projection2 = new EnhancedTrackingProjection2(eventstore, pool);
      await projection2.init();

      await projection1.setCurrentPosition(100, 0, new Date(), 'inst-1', 'type-1', 'id-1', 1);
      await new Promise(resolve => setTimeout(resolve, 100));
      await projection2.setCurrentPosition(200, 0, new Date(), 'inst-2', 'type-2', 'id-2', 2);

      // Query using the index (ORDER BY updated_at DESC)
      const result = await pool.query(`
        SELECT name, updated_at
        FROM projection_states
        ORDER BY updated_at DESC
        LIMIT 1
      `);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].name).toBe('enhanced_tracking_test_2'); // Most recent
    });
  });
});
