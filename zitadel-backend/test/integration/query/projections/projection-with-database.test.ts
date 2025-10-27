/**
 * Projection Integration Test with Real Database
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Projection } from '../../../../src/lib/query/projection/projection';
import { Event } from '../../../../src/lib/eventstore/types';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabasePool } from '../../../../src/lib/database';

// Test projection that uses real database
class UserCountProjection extends Projection {
  readonly name = 'user_count_projection';
  readonly tables = ['test_user_counts'];

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'user.human.added':
        await this.incrementUserCount(event.instanceID);
        break;
      case 'user.removed':
        await this.decrementUserCount(event.instanceID);
        break;
    }
  }

  async init(): Promise<void> {
    // Create projection tables
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS test_user_counts (
        instance_id TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW())
    `, []);
  }

  async cleanup(): Promise<void> {
    await this.database.query('DROP TABLE IF EXISTS test_user_counts CASCADE', []);
  }

  private async incrementUserCount(instanceID: string): Promise<void> {
    await this.database.query(`
      INSERT INTO test_user_counts (instance_id, count, updated_at)
      VALUES ($1, 1, NOW())
      ON CONFLICT (instance_id)
      DO UPDATE SET count = test_user_counts.count + 1, updated_at = NOW()
    `, [instanceID]);
  }

  private async decrementUserCount(instanceID: string): Promise<void> {
    await this.database.query(`
      UPDATE test_user_counts 
      SET count = GREATEST(count - 1, 0), updated_at = NOW()
      WHERE instance_id = $1
    `, [instanceID]);
  }

  async getUserCount(instanceID: string): Promise<number> {
    const result = await this.database.query<{ count: number }>(`
      SELECT count FROM test_user_counts WHERE instance_id = $1
    `, [instanceID]);
    return result.rows[0]?.count || 0;
  }
}

describe('Projection Integration with Database', () => {
  let database: DatabasePool;
  let projection: UserCountProjection;

  const mockEventstore = {
    health: jest.fn() as any,
    query: jest.fn() as any,
    filter: jest.fn() as any,
  };

  beforeAll(async () => {
    // Use real database
    database = await createTestDatabase();
    
    // Create projection with real database
    projection = new UserCountProjection(
      mockEventstore as any,
      database as any
    );

    // Initialize projection tables
    await projection.init();
  });

  afterAll(async () => {
    // Cleanup
    await projection.cleanup();
    await closeTestDatabase();
  });

  describe('Event Processing', () => {
    it('should process user.human.added event', async () => {
      const event: Event = {
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-123',
        eventType: 'user.human.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date(),
        payload: { username: 'testuser' },
        creator: 'system',
        owner: 'test-org',
        position: { position: 1, inTxOrder: 0 },
      };

      await projection.reduce(event);

      const count = await projection.getUserCount('test-instance');
      expect(count).toBe(1);
    });

    it('should handle multiple user additions', async () => {
      const events: Event[] = [
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-456',
          eventType: 'user.human.added',
          aggregateVersion: BigInt(1),
          revision: 1,
          createdAt: new Date(),
          payload: { username: 'user2' },
          creator: 'system',
          owner: 'test-org',
          position: { position: 2, inTxOrder: 0 },
        },
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-789',
          eventType: 'user.human.added',
          aggregateVersion: BigInt(1),
          revision: 1,
          createdAt: new Date(),
          payload: { username: 'user3' },
          creator: 'system',
          owner: 'test-org',
          position: { position: 3, inTxOrder: 0 },
        },
      ];

      for (const event of events) {
        await projection.reduce(event);
      }

      const count = await projection.getUserCount('test-instance');
      expect(count).toBe(3);
    });

    it('should process user.removed event', async () => {
      const removeEvent: Event = {
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-123',
        eventType: 'user.removed',
        aggregateVersion: BigInt(2),
        revision: 1,
        createdAt: new Date(),
        payload: {},
        creator: 'system',
        owner: 'test-org',
        position: { position: 4, inTxOrder: 0 },
      };

      await projection.reduce(removeEvent);

      const count = await projection.getUserCount('test-instance');
      expect(count).toBe(2); // Was 3, now 2
    });

    it('should handle multiple instances separately', async () => {
      const instance2Event: Event = {
        instanceID: 'test-instance-2',
        aggregateType: 'user',
        aggregateID: 'user-999',
        eventType: 'user.human.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date(),
        payload: { username: 'user999' },
        creator: 'system',
        owner: 'test-org-2',
        position: { position: 5, inTxOrder: 0 },
      };

      await projection.reduce(instance2Event);

      const count1 = await projection.getUserCount('test-instance');
      const count2 = await projection.getUserCount('test-instance-2');

      expect(count1).toBe(2); // Unchanged from previous test
      expect(count2).toBe(1); // New instance
    });
  });

  describe('Position Tracking', () => {
    it('should track current position', async () => {
      const position = await projection.getCurrentPosition();
      expect(position).toBeGreaterThanOrEqual(0);
    });

    it('should update position after processing', async () => {
      const beforePosition = await projection.getCurrentPosition();

      await projection.setCurrentPosition(
        100,
        0, // positionOffset
        new Date(),
        'test-instance',
        'user',
        'user-123',
        5
      );

      const afterPosition = await projection.getCurrentPosition();
      expect(Number(afterPosition)).toBe(100);
      expect(Number(afterPosition)).toBeGreaterThan(Number(beforePosition));
    });
  });

  describe('Health Check', () => {
    it('should report healthy status', async () => {
      const healthy = await projection.isHealthy();
      expect(healthy).toBe(true);
    });
  });

  describe('Reset', () => {
    it('should reset projection data', async () => {
      // Ensure we have data
      const countBefore = await projection.getUserCount('test-instance');
      expect(countBefore).toBeGreaterThan(0);

      // Reset
      await projection.reset();

      // Verify data is cleared
      const countAfter = await projection.getUserCount('test-instance');
      expect(countAfter).toBe(0);
    });
  });
});
