/**
 * Quota Projection Integration Tests
 * Tests quota and limit management with real database
 * Updated for Zitadel Go v2 schema compatibility (Oct 28, 2025)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabaseMigrator } from '../../../../src/lib/database/migrator';
import { PostgresEventstore } from '../../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { QuotaProjection } from '../../../../src/lib/query/projections/quota-projection';
import { QuotaQueries } from '../../../../src/lib/query/quota/quota-queries';
import { generateId as generateSnowflakeId } from '../../../../src/lib/id/snowflake';
import { waitForProjectionCatchUp, delay } from '../../../helpers/projection-test-helpers';

describe('Quota Projection Integration Tests (Zitadel Go v2 Compatible)', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let queries: QuotaQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
    });
    
    queries = new QuotaQueries(pool);
    
    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register quota projection
    const projection = new QuotaProjection(eventstore, pool);
    await projection.init();
    
    registry.register({
      name: 'quota_projection',
      tables: ['quotas', 'quota_notifications', 'quotas_periods'],
      eventTypes: [
        'quota.added',
        'quota.changed',
        'quota.removed',
        'quota.notification.added',
        'quota.notification.changed',
        'quota.notification.removed',
        'quota.usage.incremented',
        'instance.removed',
      ],
      aggregateTypes: ['instance'],
      batchSize: 100,
      interval: 50,
      enableLocking: false,
    }, projection);
    
    await registry.start('quota_projection');
    
    // Give projection time to start and establish subscriptions
    await delay(100);
  });

  afterAll(async () => {
    if (registry) {
      const names = registry.getNames();
      for (const name of names) {
        try {
          await registry.stop(name);
        } catch (e) {
          // Ignore
        }
      }
    }
    
    await closeTestDatabase();
  });

  // Helper to wait for projection to process events
  const waitForEvents = async () => {
    await waitForProjectionCatchUp(registry, eventstore, 'quota_projection', 2000);
  };

  describe('Quota Events', () => {
    it('should process quota.added event', async () => {
      const instanceID = 'test-instance';
      const unit = 'requests_all_authenticated';
      
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: generateSnowflakeId(),
          unit,
          amount: 100000,
          limitUsage: true,
          fromAnchor: new Date(),
          interval: '1 month',
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      // Query by unit (new way)
      const quota = await queries.getQuotaByUnit(instanceID, unit);
      
      expect(quota).toBeDefined();
      expect(quota!.unit).toBe(unit);
      expect(quota!.amount).toBe(100000);
      expect(quota!.limitUsage).toBe(true);
      expect(quota!.interval).toBeDefined();
    }, 5000);

    it('should process quota.changed event', async () => {
      const instanceID = 'test-instance';
      const unit = 'actions_all_runs_seconds';
      
      // Add quota
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: generateSnowflakeId(),
          unit,
          amount: 3600,
          limitUsage: false,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      let quota = await queries.getQuotaByUnit(instanceID, unit);
      expect(quota!.amount).toBe(3600);
      expect(quota!.limitUsage).toBe(false);
      
      // Change quota
      await eventstore.push({
        eventType: 'quota.changed',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          unit,
          amount: 7200,
          limitUsage: true,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      quota = await queries.getQuotaByUnit(instanceID, unit);
      expect(quota!.amount).toBe(7200);
      expect(quota!.limitUsage).toBe(true);
    }, 5000);

    it('should process quota.removed event', async () => {
      const instanceID = 'test-instance';
      const unit = 'users_count';
      
      // Add quota
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: generateSnowflakeId(),
          unit,
          amount: 1000,
          limitUsage: true,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      let quota = await queries.getQuotaByUnit(instanceID, unit);
      expect(quota).toBeDefined();
      
      // Remove quota
      await eventstore.push({
        eventType: 'quota.removed',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          unit,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      quota = await queries.getQuotaByUnit(instanceID, unit);
      expect(quota).toBeNull();
    }, 5000);
  });

  describe('Quota Queries', () => {
    it('should get quotas by instance', async () => {
      const instanceID = 'test-instance';
      const unit1 = `requests_test_${generateSnowflakeId()}`;
      const unit2 = `users_test_${generateSnowflakeId()}`;
      
      // Add quotas for instance
      await eventstore.pushMany([
        {
          eventType: 'quota.added',
          aggregateType: 'instance',
          aggregateID: instanceID,
          payload: {
            id: generateSnowflakeId(),
            unit: unit1,
            amount: 50000,
            limitUsage: true,
            fromAnchor: new Date(),
          },
          creator: 'system',
          owner: instanceID,
          instanceID,
        },
        {
          eventType: 'quota.added',
          aggregateType: 'instance',
          aggregateID: instanceID,
          payload: {
            id: generateSnowflakeId(),
            unit: unit2,
            amount: 500,
            limitUsage: true,
            fromAnchor: new Date(),
          },
          creator: 'system',
          owner: instanceID,
          instanceID,
        },
      ]);
      
      await waitForEvents();
      
      const quotas = await queries.getQuotasByInstance(instanceID);
      
      const testQuotas = quotas.filter(q => q.unit === unit1 || q.unit === unit2);
      expect(testQuotas.length).toBeGreaterThanOrEqual(2);
      
      const quota1 = testQuotas.find(q => q.unit === unit1);
      expect(quota1?.amount).toBe(50000);
      
      const quota2 = testQuotas.find(q => q.unit === unit2);
      expect(quota2?.amount).toBe(500);
    }, 5000);

    it('should get quota by unit', async () => {
      const instanceID = 'test-instance';
      const unit = `api_calls_${generateSnowflakeId()}`;
      
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: generateSnowflakeId(),
          unit,
          amount: 25000,
          limitUsage: true,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      const quota = await queries.getQuotaByUnit(instanceID, unit);
      
      expect(quota).toBeDefined();
      expect(quota!.unit).toBe(unit);
      expect(quota!.amount).toBe(25000);
      expect(quota!.limitUsage).toBe(true);
    }, 5000);

    it('should get only active quotas', async () => {
      const instanceID = 'test-instance';
      const unit1 = `enforced_${generateSnowflakeId()}`;
      const unit2 = `not_enforced_${generateSnowflakeId()}`;
      
      await eventstore.pushMany([
        {
          eventType: 'quota.added',
          aggregateType: 'instance',
          aggregateID: instanceID,
          payload: {
            id: generateSnowflakeId(),
            unit: unit1,
            amount: 10000,
            limitUsage: true, // Enforced
            fromAnchor: new Date(),
          },
          creator: 'system',
          owner: instanceID,
          instanceID,
        },
        {
          eventType: 'quota.added',
          aggregateType: 'instance',
          aggregateID: instanceID,
          payload: {
            id: generateSnowflakeId(),
            unit: unit2,
            amount: 20000,
            limitUsage: false, // Not enforced
            fromAnchor: new Date(),
          },
          creator: 'system',
          owner: instanceID,
          instanceID,
        },
      ]);
      
      await waitForEvents();
      
      const activeQuotas = await queries.getActiveQuotas(instanceID);
      
      const enforcedQuota = activeQuotas.find(q => q.unit === unit1);
      expect(enforcedQuota).toBeDefined();
      expect(enforcedQuota!.limitUsage).toBe(true);
      
      const notEnforcedQuota = activeQuotas.find(q => q.unit === unit2);
      expect(notEnforcedQuota).toBeUndefined();
    }, 5000);

    it('should check if quota is exceeded', async () => {
      const instanceID = 'test-instance';
      const unit = `check_exceeded_${generateSnowflakeId()}`;
      
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: generateSnowflakeId(),
          unit,
          amount: 100,
          limitUsage: true,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      const quota = await queries.getQuotaByUnit(instanceID, unit);
      
      expect(queries.checkQuotaExceeded(50, quota!)).toBe(false);
      expect(queries.checkQuotaExceeded(100, quota!)).toBe(true);
      expect(queries.checkQuotaExceeded(150, quota!)).toBe(true);
    }, 5000);

    it('should calculate remaining quota', async () => {
      const instanceID = 'test-instance';
      const unit = `remaining_${generateSnowflakeId()}`;
      
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: generateSnowflakeId(),
          unit,
          amount: 1000,
          limitUsage: true,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      const quota = await queries.getQuotaByUnit(instanceID, unit);
      
      expect(queries.getRemainingQuota(300, quota!)).toBe(700);
      expect(queries.getRemainingQuota(1000, quota!)).toBe(0);
      expect(queries.getRemainingQuota(1500, quota!)).toBe(0); // Can't go negative
    }, 5000);

    it('should calculate usage percentage', async () => {
      const instanceID = 'test-instance';
      const unit = `percent_${generateSnowflakeId()}`;
      
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: generateSnowflakeId(),
          unit,
          amount: 1000,
          limitUsage: true,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      const quota = await queries.getQuotaByUnit(instanceID, unit);
      
      expect(queries.getQuotaUsagePercent(0, quota!)).toBe(0);
      expect(queries.getQuotaUsagePercent(500, quota!)).toBe(50);
      expect(queries.getQuotaUsagePercent(1000, quota!)).toBe(100);
      expect(queries.getQuotaUsagePercent(1500, quota!)).toBe(100); // Capped at 100%
    }, 5000);
  });

  describe('Quota Notifications', () => {
    it('should process notification.added event', async () => {
      const instanceID = 'test-instance';
      const unit = `notif_test_${generateSnowflakeId()}`;
      const notifID = `notif_${generateSnowflakeId()}`;
      
      // Add quota first
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: generateSnowflakeId(),
          unit,
          amount: 10000,
          limitUsage: true,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      // Add notification
      await eventstore.push({
        eventType: 'quota.notification.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: notifID,
          unit,
          callURL: 'https://example.com/webhook',
          percent: 80,
          repeat: false,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      const notifications = await queries.getQuotaNotifications(instanceID, unit);
      
      const notification = notifications.find(n => n.id === notifID);
      expect(notification).toBeDefined();
      expect(notification!.callURL).toBe('https://example.com/webhook');
      expect(notification!.percent).toBe(80);
      expect(notification!.repeat).toBe(false);
    }, 5000);

    it('should get triggered notifications based on usage', async () => {
      const instanceID = 'test-instance';
      const unit = `trigger_test_${generateSnowflakeId()}`;
      
      // Add quota
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: generateSnowflakeId(),
          unit,
          amount: 1000,
          limitUsage: true,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      // Add notifications at different thresholds
      await eventstore.pushMany([
        {
          eventType: 'quota.notification.added',
          aggregateType: 'instance',
          aggregateID: instanceID,
          payload: {
            id: `notif_50_${generateSnowflakeId()}`,
            unit,
            callURL: 'https://example.com/webhook/50',
            percent: 50,
            repeat: true,
          },
          creator: 'system',
          owner: instanceID,
          instanceID,
        },
        {
          eventType: 'quota.notification.added',
          aggregateType: 'instance',
          aggregateID: instanceID,
          payload: {
            id: `notif_80_${generateSnowflakeId()}`,
            unit,
            callURL: 'https://example.com/webhook/80',
            percent: 80,
            repeat: false,
          },
          creator: 'system',
          owner: instanceID,
          instanceID,
        },
        {
          eventType: 'quota.notification.added',
          aggregateType: 'instance',
          aggregateID: instanceID,
          payload: {
            id: `notif_100_${generateSnowflakeId()}`,
            unit,
            callURL: 'https://example.com/webhook/100',
            percent: 100,
            repeat: false,
          },
          creator: 'system',
          owner: instanceID,
          instanceID,
        },
      ]);
      
      await waitForEvents();
      
      // Check at 60% usage
      const triggered60 = await queries.getTriggeredNotifications(instanceID, unit, 60);
      expect(triggered60.length).toBe(1);
      expect(triggered60[0].percent).toBe(50);
      
      // Check at 90% usage
      const triggered90 = await queries.getTriggeredNotifications(instanceID, unit, 90);
      expect(triggered90.length).toBe(2);
      expect(triggered90.some(n => n.percent === 50)).toBe(true);
      expect(triggered90.some(n => n.percent === 80)).toBe(true);
    }, 5000);
  });

  describe('Usage Periods', () => {
    it('should increment usage for a period', async () => {
      const instanceID = 'test-instance';
      const unit = `period_test_${generateSnowflakeId()}`;
      const periodStart = new Date('2025-10-01T00:00:00Z');
      
      // Add quota
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: generateSnowflakeId(),
          unit,
          amount: 100000,
          limitUsage: true,
          fromAnchor: periodStart,
          interval: '1 month',
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      // Increment usage
      await eventstore.push({
        eventType: 'quota.usage.incremented',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          unit,
          periodStart,
          usage: 150,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      const period = await queries.getPeriodUsage(instanceID, unit, periodStart);
      
      expect(period).toBeDefined();
      expect(period!.usage).toBe(150);
    }, 5000);

    it('should accumulate usage across multiple increments', async () => {
      const instanceID = 'test-instance';
      const unit = `accumulate_test_${generateSnowflakeId()}`;
      const periodStart = new Date('2025-10-01T00:00:00Z');
      
      // Add quota
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: generateSnowflakeId(),
          unit,
          amount: 10000,
          limitUsage: true,
          fromAnchor: periodStart,
          interval: '1 month',
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      // Increment usage multiple times
      for (let i = 0; i < 5; i++) {
        await eventstore.push({
          eventType: 'quota.usage.incremented',
          aggregateType: 'instance',
          aggregateID: instanceID,
          payload: {
            unit,
            periodStart,
            usage: 100,
          },
          creator: 'system',
          owner: instanceID,
          instanceID,
        });
      }
      
      await waitForEvents();
      
      const period = await queries.getPeriodUsage(instanceID, unit, periodStart);
      
      expect(period).toBeDefined();
      expect(period!.usage).toBe(500); // 5 * 100
    }, 5000);

    it('should get remaining quota for period', async () => {
      const instanceID = 'test-instance';
      const unit = `remaining_period_${generateSnowflakeId()}`;
      const periodStart = new Date('2025-10-01T00:00:00Z');
      
      // Add quota
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: generateSnowflakeId(),
          unit,
          amount: 1000,
          limitUsage: true,
          fromAnchor: periodStart,
          interval: '1 month',
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      // Increment usage
      await eventstore.push({
        eventType: 'quota.usage.incremented',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          unit,
          periodStart,
          usage: 300,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await waitForEvents();
      
      const remaining = await queries.getRemainingQuotaForPeriod(instanceID, unit, periodStart);
      
      expect(remaining).toBe(700); // 1000 - 300
    }, 5000);
  });
});
