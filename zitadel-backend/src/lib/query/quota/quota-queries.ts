/**
 * Quota Queries
 * Handles querying resource quotas and limits
 * Based on Zitadel Go internal/query/quota.go
 */

import { DatabasePool } from '../../database';

export interface Quota {
  id: string;
  instanceID: string;
  resourceOwner: string;
  unit: string;
  amount: number;
  limitUsage: boolean;
  fromAnchor: Date;
  interval: string | null;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
}

export interface QuotaNotification {
  id: string;
  instanceID: string;
  quotaID: string;
  callURL: string;
  percent: number;
  repeat: boolean;
  latestNotifiedAt: Date | null;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
}

export class QuotaQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get quota by ID
   */
  async getQuota(instanceID: string, quotaID: string): Promise<Quota | null> {
    const result = await this.database.queryOne(
      `SELECT 
        id, instance_id, resource_owner, unit, amount, limit_usage,
        from_anchor, interval, creation_date, change_date, sequence
      FROM quotas
      WHERE instance_id = $1 AND id = $2`,
      [instanceID, quotaID]
    );

    if (!result) {
      return null;
    }

    return this.mapToQuota(result);
  }

  /**
   * Get all quotas for a resource owner (instance or org)
   */
  async getQuotasByOwner(instanceID: string, resourceOwner: string): Promise<Quota[]> {
    const result = await this.database.queryMany(
      `SELECT 
        id, instance_id, resource_owner, unit, amount, limit_usage,
        from_anchor, interval, creation_date, change_date, sequence
      FROM quotas
      WHERE instance_id = $1 AND resource_owner = $2
      ORDER BY unit ASC`,
      [instanceID, resourceOwner]
    );

    return result.map(row => this.mapToQuota(row));
  }

  /**
   * Get quota by unit type for a resource owner
   */
  async getQuotaByUnit(
    instanceID: string,
    resourceOwner: string,
    unit: string
  ): Promise<Quota | null> {
    const result = await this.database.queryOne(
      `SELECT 
        id, instance_id, resource_owner, unit, amount, limit_usage,
        from_anchor, interval, creation_date, change_date, sequence
      FROM quotas
      WHERE instance_id = $1 AND resource_owner = $2 AND unit = $3`,
      [instanceID, resourceOwner, unit]
    );

    if (!result) {
      return null;
    }

    return this.mapToQuota(result);
  }

  /**
   * Get all active (enforced) quotas for an instance
   */
  async getActiveQuotas(instanceID: string): Promise<Quota[]> {
    const result = await this.database.queryMany(
      `SELECT 
        id, instance_id, resource_owner, unit, amount, limit_usage,
        from_anchor, interval, creation_date, change_date, sequence
      FROM quotas
      WHERE instance_id = $1 AND limit_usage = true
      ORDER BY resource_owner ASC, unit ASC`,
      [instanceID]
    );

    return result.map(row => this.mapToQuota(row));
  }

  /**
   * Check if resource usage would exceed quota
   */
  checkQuotaExceeded(currentUsage: number, quota: Quota): boolean {
    if (!quota.limitUsage) {
      return false; // Quota not enforced
    }
    return currentUsage >= quota.amount;
  }

  /**
   * Calculate remaining quota amount
   */
  getRemainingQuota(currentUsage: number, quota: Quota): number {
    return Math.max(0, quota.amount - currentUsage);
  }

  /**
   * Calculate quota usage percentage
   */
  getQuotaUsagePercent(currentUsage: number, quota: Quota): number {
    if (quota.amount === 0) {
      return 100;
    }
    return Math.min(100, (currentUsage / quota.amount) * 100);
  }

  /**
   * Get notifications for a quota
   */
  async getQuotaNotifications(instanceID: string, quotaID: string): Promise<QuotaNotification[]> {
    const result = await this.database.queryMany(
      `SELECT 
        id, instance_id, quota_id, call_url, percent, repeat,
        latest_notified_at, creation_date, change_date, sequence
      FROM quota_notifications
      WHERE instance_id = $1 AND quota_id = $2
      ORDER BY percent ASC`,
      [instanceID, quotaID]
    );

    return result.map(row => this.mapToNotification(row));
  }

  /**
   * Get notifications that should be triggered for a usage percentage
   */
  async getTriggeredNotifications(
    instanceID: string,
    quotaID: string,
    usagePercent: number
  ): Promise<QuotaNotification[]> {
    const result = await this.database.queryMany(
      `SELECT 
        id, instance_id, quota_id, call_url, percent, repeat,
        latest_notified_at, creation_date, change_date, sequence
      FROM quota_notifications
      WHERE instance_id = $1 AND quota_id = $2 AND percent <= $3
      AND (repeat = true OR latest_notified_at IS NULL)
      ORDER BY percent DESC`,
      [instanceID, quotaID, Math.floor(usagePercent)]
    );

    return result.map(row => this.mapToNotification(row));
  }

  /**
   * Map database row to Quota
   */
  private mapToQuota(row: any): Quota {
    return {
      id: row.id,
      instanceID: row.instance_id,
      resourceOwner: row.resource_owner,
      unit: row.unit,
      amount: Number(row.amount),
      limitUsage: row.limit_usage,
      fromAnchor: row.from_anchor,
      interval: row.interval,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
    };
  }

  /**
   * Map database row to QuotaNotification
   */
  private mapToNotification(row: any): QuotaNotification {
    return {
      id: row.id,
      instanceID: row.instance_id,
      quotaID: row.quota_id,
      callURL: row.call_url,
      percent: row.percent,
      repeat: row.repeat,
      latestNotifiedAt: row.latest_notified_at,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
    };
  }
}
