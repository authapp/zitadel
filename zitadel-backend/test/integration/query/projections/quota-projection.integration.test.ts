/**
 * Quota Projection Integration Tests
 * Tests quota and limit management with real database
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

describe('Quota Projection Integration Tests', () => {
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
      tables: ['quotas', 'quota_notifications'],
      eventTypes: [
        'quota.added',
        'quota.changed',
        'quota.removed',
        'quota.notification.added',
        'quota.notification.changed',
        'quota.notification.removed',
      ],
      aggregateTypes: ['instance', 'org'],
      batchSize: 100,
      interval: 50,
      enableLocking: false,
    }, projection);
    
    await registry.start('quota_projection');
    
    await new Promise(resolve => setTimeout(resolve, 500));
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

  describe('Quota Events', () => {
    it('should process quota.added event', async () => {
      const instanceID = 'test-instance';
      const quotaID = `quota_${generateSnowflakeId()}`;
      
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: quotaID,
          unit: 'requests_all_authenticated',
          amount: 100000,
          limitUsage: true,
          fromAnchor: new Date(),
          interval: '1 month',
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const quota = await queries.getQuota(instanceID, quotaID);
      
      expect(quota).toBeDefined();
      expect(quota!.id).toBe(quotaID);
      expect(quota!.unit).toBe('requests_all_authenticated');
      expect(quota!.amount).toBe(100000);
      expect(quota!.limitUsage).toBe(true);
      expect(quota!.interval).toBeDefined(); // PostgreSQL returns interval as object
    }, 5000);

    it('should process quota.changed event', async () => {
      const instanceID = 'test-instance';
      const quotaID = `quota_${generateSnowflakeId()}`;
      
      // Add quota
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: quotaID,
          unit: 'actions_all_runs_seconds',
          amount: 3600,
          limitUsage: false,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      let quota = await queries.getQuota(instanceID, quotaID);
      expect(quota!.amount).toBe(3600);
      expect(quota!.limitUsage).toBe(false);
      
      // Change quota
      await eventstore.push({
        eventType: 'quota.changed',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: quotaID,
          amount: 7200,
          limitUsage: true,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      quota = await queries.getQuota(instanceID, quotaID);
      expect(quota!.amount).toBe(7200);
      expect(quota!.limitUsage).toBe(true);
    }, 5000);

    it('should process quota.removed event', async () => {
      const instanceID = 'test-instance';
      const quotaID = `quota_${generateSnowflakeId()}`;
      
      // Add quota
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: quotaID,
          unit: 'users',
          amount: 1000,
          limitUsage: true,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      let quota = await queries.getQuota(instanceID, quotaID);
      expect(quota).toBeDefined();
      
      // Remove quota
      await eventstore.push({
        eventType: 'quota.removed',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: quotaID,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      quota = await queries.getQuota(instanceID, quotaID);
      expect(quota).toBeNull();
    }, 5000);
  });

  describe('Quota Queries', () => {
    it('should get quotas by resource owner', async () => {
      const instanceID = 'test-instance';
      const orgID = `org_${generateSnowflakeId()}`;
      const quota1ID = `quota_${generateSnowflakeId()}`;
      const quota2ID = `quota_${generateSnowflakeId()}`;
      
      // Add quotas for org
      await eventstore.pushMany([
        {
          eventType: 'quota.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: {
            id: quota1ID,
            unit: 'requests',
            amount: 50000,
            limitUsage: true,
            fromAnchor: new Date(),
          },
          creator: 'system',
          owner: orgID,
          instanceID,
        },
        {
          eventType: 'quota.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: {
            id: quota2ID,
            unit: 'users',
            amount: 500,
            limitUsage: true,
            fromAnchor: new Date(),
          },
          creator: 'system',
          owner: orgID,
          instanceID,
        },
      ]);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const quotas = await queries.getQuotasByOwner(instanceID, orgID);
      
      expect(quotas.length).toBe(2);
      expect(quotas.map(q => q.id)).toContain(quota1ID);
      expect(quotas.map(q => q.id)).toContain(quota2ID);
    }, 5000);

    it('should get quota by unit', async () => {
      const instanceID = 'test-instance';
      const orgID = `org_${generateSnowflakeId()}`;
      const quotaID = `quota_${generateSnowflakeId()}`;
      
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: {
          id: quotaID,
          unit: 'projects',
          amount: 100,
          limitUsage: true,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: orgID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const quota = await queries.getQuotaByUnit(instanceID, orgID, 'projects');
      
      expect(quota).toBeDefined();
      expect(quota!.id).toBe(quotaID);
      expect(quota!.unit).toBe('projects');
      expect(quota!.amount).toBe(100);
    }, 5000);

    it('should get only active quotas', async () => {
      const instanceID = 'test-instance';
      const activeID = `quota_${generateSnowflakeId()}`;
      const inactiveID = `quota_${generateSnowflakeId()}`;
      
      await eventstore.pushMany([
        {
          eventType: 'quota.added',
          aggregateType: 'instance',
          aggregateID: instanceID,
          payload: {
            id: activeID,
            unit: 'active_unit',
            amount: 1000,
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
            id: inactiveID,
            unit: 'inactive_unit',
            amount: 2000,
            limitUsage: false,
            fromAnchor: new Date(),
          },
          creator: 'system',
          owner: instanceID,
          instanceID,
        },
      ]);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const activeQuotas = await queries.getActiveQuotas(instanceID);
      const activeIds = activeQuotas.map(q => q.id);
      
      expect(activeIds).toContain(activeID);
      expect(activeIds).not.toContain(inactiveID);
    }, 5000);
  });

  describe('Quota Logic', () => {
    it('should check if quota is exceeded', async () => {
      const instanceID = 'test-instance';
      const quotaID = `quota_${generateSnowflakeId()}`;
      
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: quotaID,
          unit: 'requests',
          amount: 1000,
          limitUsage: true,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const quota = await queries.getQuota(instanceID, quotaID);
      
      // Under quota
      expect(queries.checkQuotaExceeded(500, quota!)).toBe(false);
      
      // At quota limit
      expect(queries.checkQuotaExceeded(1000, quota!)).toBe(true);
      
      // Over quota
      expect(queries.checkQuotaExceeded(1500, quota!)).toBe(true);
    }, 5000);

    it('should calculate remaining quota', async () => {
      const instanceID = 'test-instance';
      const quotaID = `quota_${generateSnowflakeId()}`;
      
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: quotaID,
          unit: 'storage_gb',
          amount: 100,
          limitUsage: true,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const quota = await queries.getQuota(instanceID, quotaID);
      
      expect(queries.getRemainingQuota(30, quota!)).toBe(70);
      expect(queries.getRemainingQuota(100, quota!)).toBe(0);
      expect(queries.getRemainingQuota(120, quota!)).toBe(0);
    }, 5000);

    it('should calculate usage percentage', async () => {
      const instanceID = 'test-instance';
      const quotaID = `quota_${generateSnowflakeId()}`;
      
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: quotaID,
          unit: 'api_calls',
          amount: 10000,
          limitUsage: true,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const quota = await queries.getQuota(instanceID, quotaID);
      
      expect(queries.getQuotaUsagePercent(5000, quota!)).toBe(50);
      expect(queries.getQuotaUsagePercent(8000, quota!)).toBe(80);
      expect(queries.getQuotaUsagePercent(10000, quota!)).toBe(100);
      expect(queries.getQuotaUsagePercent(15000, quota!)).toBe(100);
    }, 5000);
  });

  describe('Quota Notifications', () => {
    it('should process notification.added event', async () => {
      const instanceID = 'test-instance';
      const quotaID = `quota_${generateSnowflakeId()}`;
      const notifID = `notif_${generateSnowflakeId()}`;
      
      // Add quota first
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: quotaID,
          unit: 'requests',
          amount: 10000,
          limitUsage: true,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      // Add notification
      await eventstore.push({
        eventType: 'quota.notification.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: notifID,
          quotaId: quotaID,
          callURL: 'https://example.com/webhook',
          percent: 80,
          repeat: false,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const notifications = await queries.getQuotaNotifications(instanceID, quotaID);
      
      expect(notifications.length).toBe(1);
      expect(notifications[0].id).toBe(notifID);
      expect(notifications[0].percent).toBe(80);
      expect(notifications[0].callURL).toBe('https://example.com/webhook');
    }, 5000);

    it('should get triggered notifications based on usage', async () => {
      const instanceID = 'test-instance';
      const quotaID = `quota_${generateSnowflakeId()}`;
      const notif80ID = `notif_${generateSnowflakeId()}`;
      const notif100ID = `notif_${generateSnowflakeId()}`;
      
      // Add quota
      await eventstore.push({
        eventType: 'quota.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: quotaID,
          unit: 'storage',
          amount: 1000,
          limitUsage: true,
          fromAnchor: new Date(),
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      // Add notifications at 80% and 100%
      await eventstore.pushMany([
        {
          eventType: 'quota.notification.added',
          aggregateType: 'instance',
          aggregateID: instanceID,
          payload: {
            id: notif80ID,
            quotaId: quotaID,
            callURL: 'https://example.com/warn',
            percent: 80,
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
            id: notif100ID,
            quotaId: quotaID,
            callURL: 'https://example.com/critical',
            percent: 100,
            repeat: false,
          },
          creator: 'system',
          owner: instanceID,
          instanceID,
        },
      ]);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // At 75% usage - no notifications
      let triggered = await queries.getTriggeredNotifications(instanceID, quotaID, 75);
      expect(triggered.length).toBe(0);
      
      // At 85% usage - 80% notification triggers
      triggered = await queries.getTriggeredNotifications(instanceID, quotaID, 85);
      expect(triggered.length).toBe(1);
      expect(triggered[0].percent).toBe(80);
      
      // At 100% usage - both notifications trigger
      triggered = await queries.getTriggeredNotifications(instanceID, quotaID, 100);
      expect(triggered.length).toBe(2);
      expect(triggered.map(n => n.percent)).toContain(80);
      expect(triggered.map(n => n.percent)).toContain(100);
    }, 5000);
  });
});
