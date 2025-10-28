/**
 * Quota Queries
 * Handles querying resource quotas and limits
 * Based on Zitadel Go internal/query/quota.go
 * Aligned with Zitadel Go v2 schema
 */

import { DatabasePool } from '../../database';

export interface Quota {
  id: string;
  instanceID: string;
  unit: string;
  amount: number | null;
  limitUsage: boolean | null;
  fromAnchor: Date | null;
  interval: string | null;
}

export interface QuotaNotification {
  id: string;
  instanceID: string;
  unit: string;
  callURL: string;
  percent: number;
  repeat: boolean;
  latestDuePeriodStart: Date | null;
  nextDueThreshold: number | null;
}

export interface QuotaPeriod {
  instanceID: string;
  unit: string;
  start: Date;
  usage: number;
}

export class QuotaQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get quota by unit (primary lookup in Zitadel Go)
   * PK: (instance_id, unit)
   */
  async getQuotaByUnit(instanceID: string, unit: string): Promise<Quota | null> {
    const result = await this.database.queryOne(
      `SELECT 
        id, instance_id, unit, amount, limit_usage, from_anchor, interval
      FROM quotas
      WHERE instance_id = $1 AND unit = $2`,
      [instanceID, unit]
    );

    if (!result) {
      return null;
    }

    return this.mapToQuota(result);
  }

  /**
   * Get all quotas for an instance
   */
  async getQuotasByInstance(instanceID: string): Promise<Quota[]> {
    const result = await this.database.queryMany(
      `SELECT 
        id, instance_id, unit, amount, limit_usage, from_anchor, interval
      FROM quotas
      WHERE instance_id = $1
      ORDER BY unit ASC`,
      [instanceID]
    );

    return result.map(row => this.mapToQuota(row));
  }

  /**
   * Get all active (enforced) quotas for an instance
   */
  async getActiveQuotas(instanceID: string): Promise<Quota[]> {
    const result = await this.database.queryMany(
      `SELECT 
        id, instance_id, unit, amount, limit_usage, from_anchor, interval
      FROM quotas
      WHERE instance_id = $1 AND limit_usage = true
      ORDER BY unit ASC`,
      [instanceID]
    );

    return result.map(row => this.mapToQuota(row));
  }

  /**
   * Check if resource usage would exceed quota
   */
  checkQuotaExceeded(currentUsage: number, quota: Quota): boolean {
    if (!quota.limitUsage || quota.amount === null) {
      return false; // Quota not enforced or no limit set
    }
    return currentUsage >= quota.amount;
  }

  /**
   * Calculate remaining quota amount
   */
  getRemainingQuota(currentUsage: number, quota: Quota): number {
    if (quota.amount === null) {
      return Number.MAX_SAFE_INTEGER; // Unlimited
    }
    return Math.max(0, quota.amount - currentUsage);
  }

  /**
   * Calculate quota usage percentage
   */
  getQuotaUsagePercent(currentUsage: number, quota: Quota): number {
    if (quota.amount === null || quota.amount === 0) {
      return 100;
    }
    return Math.min(100, (currentUsage / quota.amount) * 100);
  }

  /**
   * Get notifications for a quota by unit
   */
  async getQuotaNotifications(instanceID: string, unit: string): Promise<QuotaNotification[]> {
    const result = await this.database.queryMany(
      `SELECT 
        id, instance_id, unit, call_url, percent, repeat,
        latest_due_period_start, next_due_threshold
      FROM quota_notifications
      WHERE instance_id = $1 AND unit = $2
      ORDER BY percent ASC`,
      [instanceID, unit]
    );

    return result.map(row => this.mapToNotification(row));
  }

  /**
   * Get notifications that should be triggered for a usage percentage
   */
  async getTriggeredNotifications(
    instanceID: string,
    unit: string,
    usagePercent: number
  ): Promise<QuotaNotification[]> {
    const result = await this.database.queryMany(
      `SELECT 
        id, instance_id, unit, call_url, percent, repeat,
        latest_due_period_start, next_due_threshold
      FROM quota_notifications
      WHERE instance_id = $1 AND unit = $2 AND percent <= $3
      AND (repeat = true OR latest_due_period_start IS NULL)
      ORDER BY percent DESC`,
      [instanceID, unit, Math.floor(usagePercent)]
    );

    return result.map(row => this.mapToNotification(row));
  }

  /**
   * Get usage for a specific period
   */
  async getPeriodUsage(
    instanceID: string,
    unit: string,
    periodStart: Date
  ): Promise<QuotaPeriod | null> {
    const result = await this.database.queryOne(
      `SELECT 
        instance_id, unit, start, usage
      FROM quotas_periods
      WHERE instance_id = $1 AND unit = $2 AND start = $3`,
      [instanceID, unit, periodStart]
    );

    if (!result) {
      return null;
    }

    return this.mapToPeriod(result);
  }

  /**
   * Get all periods for a quota
   */
  async getQuotaPeriods(
    instanceID: string,
    unit: string,
    limit?: number
  ): Promise<QuotaPeriod[]> {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    const result = await this.database.queryMany(
      `SELECT 
        instance_id, unit, start, usage
      FROM quotas_periods
      WHERE instance_id = $1 AND unit = $2
      ORDER BY start DESC
      ${limitClause}`,
      [instanceID, unit]
    );

    return result.map(row => this.mapToPeriod(row));
  }

  /**
   * Increment usage for a period (matches Zitadel Go incrementQuotaStatement)
   */
  async incrementPeriodUsage(
    instanceID: string,
    unit: string,
    periodStart: Date,
    usage: number
  ): Promise<number> {
    const result = await this.database.queryOne(
      `INSERT INTO quotas_periods (instance_id, unit, start, usage)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (instance_id, unit, start)
       DO UPDATE SET usage = quotas_periods.usage + EXCLUDED.usage
       RETURNING usage`,
      [instanceID, unit, periodStart, usage]
    );

    return result ? Number(result.usage) : 0;
  }

  /**
   * Get remaining quota for current period
   */
  async getRemainingQuotaForPeriod(
    instanceID: string,
    unit: string,
    periodStart: Date
  ): Promise<number> {
    const quota = await this.getQuotaByUnit(instanceID, unit);
    if (!quota || quota.amount === null) {
      return Number.MAX_SAFE_INTEGER; // Unlimited
    }

    const period = await this.getPeriodUsage(instanceID, unit, periodStart);
    const currentUsage = period ? period.usage : 0;

    return Math.max(0, quota.amount - currentUsage);
  }

  /**
   * Map database row to Quota
   */
  private mapToQuota(row: any): Quota {
    return {
      id: row.id,
      instanceID: row.instance_id,
      unit: row.unit,
      amount: row.amount !== null ? Number(row.amount) : null,
      limitUsage: row.limit_usage,
      fromAnchor: row.from_anchor,
      interval: row.interval,
    };
  }

  /**
   * Map database row to QuotaNotification
   */
  private mapToNotification(row: any): QuotaNotification {
    return {
      id: row.id,
      instanceID: row.instance_id,
      unit: row.unit,
      callURL: row.call_url,
      percent: row.percent,
      repeat: row.repeat,
      latestDuePeriodStart: row.latest_due_period_start,
      nextDueThreshold: row.next_due_threshold,
    };
  }

  /**
   * Map database row to QuotaPeriod
   */
  private mapToPeriod(row: any): QuotaPeriod {
    return {
      instanceID: row.instance_id,
      unit: row.unit,
      start: row.start,
      usage: Number(row.usage),
    };
  }
}
