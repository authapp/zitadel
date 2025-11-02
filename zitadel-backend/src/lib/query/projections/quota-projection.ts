/**
 * Quota Projection
 * Handles quota and resource limit events
 * Based on Zitadel Go internal/query/projection/quota.go
 * Updated to match Zitadel Go v2 schema (Oct 28, 2025)
 */

import { Event } from '../../eventstore/types';
import { Projection } from '../projection/projection';

export class QuotaProjection extends Projection {
  readonly name = 'quota_projection';
  readonly tables = ['quotas', 'quota_notifications', 'quotas_periods'];

  async init(): Promise<void> {
    // Tables created by migration schema
  }
  
  /**
   * Get event types handled by this projection
   * Required for real-time event subscription
   */
  getEventTypes(): string[] {
    return [
      'instance.removed',
      'quota.added',
      'quota.changed',
      'quota.notification.added',
      'quota.notification.changed',
      'quota.notification.removed',
      'quota.removed',
      'quota.usage.incremented',
    ];
  }


  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'quota.added':
        await this.handleQuotaAdded(event);
        break;
      case 'quota.changed':
        await this.handleQuotaChanged(event);
        break;
      case 'quota.removed':
        await this.handleQuotaRemoved(event);
        break;
      case 'quota.notification.added':
        await this.handleNotificationAdded(event);
        break;
      case 'quota.notification.changed':
        await this.handleNotificationChanged(event);
        break;
      case 'quota.notification.removed':
        await this.handleNotificationRemoved(event);
        break;
      case 'quota.usage.incremented':
        await this.handleUsageIncremented(event);
        break;
      case 'instance.removed':
        await this.handleInstanceRemoved(event);
        break;
      default:
        // Silently ignore unhandled events
        break;
    }
  }

  /**
   * Handle quota.added event
   * Zitadel Go: Uses ON CONFLICT (instance_id, unit) for upsert
   */
  private async handleQuotaAdded(event: Event): Promise<void> {
    const data = event.payload as any;
    
    await this.database.query(
      `INSERT INTO quotas (
        id, instance_id, unit, amount, limit_usage, from_anchor, interval
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (instance_id, unit) DO UPDATE SET
        id = EXCLUDED.id,
        amount = EXCLUDED.amount,
        limit_usage = EXCLUDED.limit_usage,
        from_anchor = EXCLUDED.from_anchor,
        interval = EXCLUDED.interval`,
      [
        data.id || event.aggregateID,
        event.instanceID || 'default',
        data.unit,
        data.amount !== undefined ? data.amount : null,
        data.limitUsage !== undefined ? data.limitUsage : null,
        data.fromAnchor || null,
        data.interval || null,
      ]
    );
  }

  /**
   * Handle quota.changed event
   */
  private async handleQuotaChanged(event: Event): Promise<void> {
    const data = event.payload as any;
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.id !== undefined) {
      updates.push(`id = $${paramIndex++}`);
      values.push(data.id);
    }

    if (data.amount !== undefined) {
      updates.push(`amount = $${paramIndex++}`);
      values.push(data.amount);
    }

    if (data.limitUsage !== undefined) {
      updates.push(`limit_usage = $${paramIndex++}`);
      values.push(data.limitUsage);
    }

    if (data.fromAnchor !== undefined) {
      updates.push(`from_anchor = $${paramIndex++}`);
      values.push(data.fromAnchor);
    }

    if (data.interval !== undefined) {
      updates.push(`interval = $${paramIndex++}`);
      values.push(data.interval);
    }

    if (updates.length === 0) {
      return; // No changes
    }

    values.push(event.instanceID || 'default');
    values.push(data.unit);

    await this.database.query(
      `UPDATE quotas 
       SET ${updates.join(', ')}
       WHERE instance_id = $${paramIndex++} AND unit = $${paramIndex}`,
      values
    );
  }

  /**
   * Handle quota.removed event
   * Cascade delete will remove notifications and periods
   */
  private async handleQuotaRemoved(event: Event): Promise<void> {
    const data = event.payload as any;
    
    await this.database.query(
      `DELETE FROM quotas 
       WHERE instance_id = $1 AND unit = $2`,
      [event.instanceID || 'default', data.unit]
    );
  }

  /**
   * Handle quota.notification.added event
   * Zitadel Go: Uses ON CONFLICT (instance_id, unit, id) for upsert
   */
  private async handleNotificationAdded(event: Event): Promise<void> {
    const data = event.payload as any;
    
    await this.database.query(
      `INSERT INTO quota_notifications (
        instance_id, unit, id, call_url, percent, repeat,
        latest_due_period_start, next_due_threshold
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (instance_id, unit, id) DO UPDATE SET
        call_url = EXCLUDED.call_url,
        percent = EXCLUDED.percent,
        repeat = EXCLUDED.repeat,
        latest_due_period_start = EXCLUDED.latest_due_period_start,
        next_due_threshold = EXCLUDED.next_due_threshold`,
      [
        event.instanceID || 'default',
        data.unit,
        data.id || `notif_${Date.now()}`,
        data.callURL,
        data.percent || 100,
        data.repeat !== undefined ? data.repeat : false,
        data.latestDuePeriodStart || null,
        data.nextDueThreshold || null,
      ]
    );
  }

  /**
   * Handle quota.notification.changed event
   */
  private async handleNotificationChanged(event: Event): Promise<void> {
    const data = event.payload as any;
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.callURL !== undefined) {
      updates.push(`call_url = $${paramIndex++}`);
      values.push(data.callURL);
    }

    if (data.percent !== undefined) {
      updates.push(`percent = $${paramIndex++}`);
      values.push(data.percent);
    }

    if (data.repeat !== undefined) {
      updates.push(`repeat = $${paramIndex++}`);
      values.push(data.repeat);
    }

    if (data.latestDuePeriodStart !== undefined) {
      updates.push(`latest_due_period_start = $${paramIndex++}`);
      values.push(data.latestDuePeriodStart);
    }

    if (data.nextDueThreshold !== undefined) {
      updates.push(`next_due_threshold = $${paramIndex++}`);
      values.push(data.nextDueThreshold);
    }

    if (updates.length === 0) {
      return;
    }

    values.push(event.instanceID || 'default');
    values.push(data.unit);
    values.push(data.id);

    await this.database.query(
      `UPDATE quota_notifications 
       SET ${updates.join(', ')}
       WHERE instance_id = $${paramIndex++} AND unit = $${paramIndex++} AND id = $${paramIndex}`,
      values
    );
  }

  /**
   * Handle quota.notification.removed event
   */
  private async handleNotificationRemoved(event: Event): Promise<void> {
    const data = event.payload as any;
    
    await this.database.query(
      `DELETE FROM quota_notifications 
       WHERE instance_id = $1 AND unit = $2 AND id = $3`,
      [event.instanceID || 'default', data.unit, data.id]
    );
  }

  /**
   * Handle quota.usage.incremented event
   * Matches Zitadel Go incrementQuotaStatement
   */
  private async handleUsageIncremented(event: Event): Promise<void> {
    const data = event.payload as any;
    
    await this.database.query(
      `INSERT INTO quotas_periods (instance_id, unit, start, usage)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (instance_id, unit, start)
       DO UPDATE SET usage = quotas_periods.usage + EXCLUDED.usage`,
      [
        event.instanceID || 'default',
        data.unit,
        data.periodStart || event.createdAt,
        data.usage || 1,
      ]
    );
  }

  /**
   * Handle instance.removed event
   * Clean up all quotas for the instance (cascade handles rest)
   */
  private async handleInstanceRemoved(event: Event): Promise<void> {
    await this.database.query(
      `DELETE FROM quotas WHERE instance_id = $1`,
      [event.instanceID || 'default']
    );
  }

  /**
   * Update notification tracking fields
   * Used for notification scheduling
   */
  async updateNotificationTracking(
    instanceID: string,
    unit: string,
    notificationID: string,
    latestDuePeriodStart: Date,
    nextDueThreshold: number
  ): Promise<void> {
    await this.database.query(
      `UPDATE quota_notifications 
       SET latest_due_period_start = $1, next_due_threshold = $2
       WHERE instance_id = $3 AND unit = $4 AND id = $5`,
      [latestDuePeriodStart, nextDueThreshold, instanceID, unit, notificationID]
    );
  }

  /**
   * Delete old periods (for cleanup/archival)
   */
  async deletePeriodsBeforeDate(
    instanceID: string,
    unit: string,
    beforeDate: Date
  ): Promise<void> {
    await this.database.query(
      `DELETE FROM quotas_periods 
       WHERE instance_id = $1 AND unit = $2 AND start < $3`,
      [instanceID, unit, beforeDate]
    );
  }
}
