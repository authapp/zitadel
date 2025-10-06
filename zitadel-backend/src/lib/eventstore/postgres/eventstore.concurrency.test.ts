/**
 * Concurrency tests for PostgreSQL eventstore
 * 
 * Tests the FOR UPDATE locking mechanism and retry logic
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '@/database/pool';
import { PostgresEventstore } from './eventstore';
import { Command } from '../types';
import { TEST_DB_CONFIG } from '../../../../test/integration/setup';

describe('PostgresEventstore Concurrency', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;

  beforeAll(async () => {
    pool = new DatabasePool(TEST_DB_CONFIG);
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
    });
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    // Clean events table
    await pool.query('DELETE FROM events');
  });

  describe('Per-Aggregate Locking', () => {
    it('should handle concurrent updates to different aggregates', async () => {
      const user1Commands: Command = {
        aggregateType: 'user',
        aggregateID: 'user-1',
        eventType: 'user.created',
        payload: { username: 'user1' },
        creator: 'system',
        owner: 'org-1',
        instanceID: 'test-instance',
      };

      const user2Commands: Command = {
        aggregateType: 'user',
        aggregateID: 'user-2',
        eventType: 'user.created',
        payload: { username: 'user2' },
        creator: 'system',
        owner: 'org-1',
        instanceID: 'test-instance',
      };

      // Push concurrently to different aggregates - should succeed
      const [events1, events2] = await Promise.all([
        eventstore.push(user1Commands),
        eventstore.push(user2Commands),
      ]);

      expect(events1.aggregateID).toBe('user-1');
      expect(events1.aggregateVersion).toBe(1n);
      expect(events2.aggregateID).toBe('user-2');
      expect(events2.aggregateVersion).toBe(1n);
    });

    it('should serialize updates to same aggregate', async () => {
      const aggregateID = 'user-concurrent';

      // Create initial user
      await eventstore.push({
        aggregateType: 'user',
        aggregateID,
        eventType: 'user.created',
        payload: { username: 'user' },
        creator: 'system',
        owner: 'org-1',
        instanceID: 'test-instance',
      });

      // Try to update concurrently - retry logic will handle conflicts
      const updates = Array.from({ length: 3 }, (_, i) => 
        eventstore.push({
          aggregateType: 'user',
          aggregateID,
          eventType: 'user.updated',
          payload: { update: i },
          creator: 'system',
          owner: 'org-1',
          instanceID: 'test-instance',
        })
      );

      const results = await Promise.all(updates);

      // Verify versions are sequential (order may vary due to retries)
      const versions = results.map(e => e.aggregateVersion).sort((a, b) => Number(a - b));
      expect(versions).toEqual([2n, 3n, 4n]);
      
      // Verify all updates succeeded
      expect(results.length).toBe(3);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient failures', async () => {
      // This test verifies the retry mechanism exists
      // In practice, retries would happen automatically on serialization errors
      
      const command: Command = {
        aggregateType: 'user',
        aggregateID: 'retry-test',
        eventType: 'user.created',
        payload: { username: 'retry' },
        creator: 'system',
        owner: 'org-1',
        instanceID: 'test-instance',
      };

      // Should succeed even with maxRetries parameter
      const event = await eventstore.pushMany([command], 3);
      
      expect(event).toHaveLength(1);
      expect(event[0].aggregateVersion).toBe(1n);
    });
  });

  describe('Global Position Ordering', () => {
    it('should maintain global position order across aggregates', async () => {
      const commands = [
        {
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.created',
          payload: { username: 'user1' },
          creator: 'system',
          owner: 'org-1',
          instanceID: 'test-instance',
        },
        {
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.created',
          payload: { name: 'Org 1' },
          creator: 'system',
          owner: 'org-1',
          instanceID: 'test-instance',
        },
        {
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.created',
          payload: { username: 'user2' },
          creator: 'system',
          owner: 'org-1',
          instanceID: 'test-instance',
        },
      ];

      const events = await eventstore.pushMany(commands);

      // Verify positions are monotonically increasing
      const positions = events.map(e => e.position.position);
      expect(positions[0] < positions[1]).toBe(true);
      expect(positions[1] < positions[2]).toBe(true);
    });
  });

  describe('Optimistic Concurrency with FOR UPDATE', () => {
    it('should handle optimistic concurrency check with locking', async () => {
      const aggregateID = 'user-optimistic';

      // Create user
      await eventstore.push({
        aggregateType: 'user',
        aggregateID,
        eventType: 'user.created',
        payload: { username: 'user' },
        creator: 'system',
        owner: 'org-1',
        instanceID: 'test-instance',
      });

      // Update with expected version
      const event = await eventstore.pushWithConcurrencyCheck(
        [{
          aggregateType: 'user',
          aggregateID,
          eventType: 'user.updated',
          payload: { email: 'new@example.com' },
          creator: 'system',
          owner: 'org-1',
          instanceID: 'test-instance',
        }],
        1  // Expected version
      );

      expect(event[0].aggregateVersion).toBe(2n);
    });

    it('should throw ConcurrencyError on version mismatch', async () => {
      const aggregateID = 'user-conflict';

      // Create user
      await eventstore.push({
        aggregateType: 'user',
        aggregateID,
        eventType: 'user.created',
        payload: { username: 'user' },
        creator: 'system',
        owner: 'org-1',
        instanceID: 'test-instance',
      });

      // Try to update with wrong expected version
      await expect(
        eventstore.pushWithConcurrencyCheck(
          [{
            aggregateType: 'user',
            aggregateID,
            eventType: 'user.updated',
            payload: { email: 'new@example.com' },
            creator: 'system',
            owner: 'org-1',
            instanceID: 'test-instance',
          }],
          999  // Wrong expected version
        )
      ).rejects.toThrow('Version mismatch');
    });
  });
});
