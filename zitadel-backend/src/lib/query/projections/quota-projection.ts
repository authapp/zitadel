/**
 * Quota Projection
 * Handles quota and resource limit events
 * Based on Zitadel Go internal/query/quota.go
 */

import { Event } from '../../eventstore/types';
import { Projection } from '../projection/projection';

export class QuotaProjection extends Projection {
  readonly name = 'quota_projection';
  readonly tables = ['quotas', 'quota_notifications'];

  async init(): Promise<void> {
    // Tables created by migration 002_50
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
      default:
        console.warn(`Unhandled event type in quota projection: ${event.eventType}`);
    }
  }

  /**
   * Handle quota.added event
   */
  private async handleQuotaAdded(event: Event): Promise<void> {
    const data = event.payload as any;
    
    await this.database.query(
      `INSERT INTO quotas (
        id, instance_id, resource_owner, unit, amount, limit_usage,
        from_anchor, interval, creation_date, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        amount = EXCLUDED.amount,
        limit_usage = EXCLUDED.limit_usage,
        from_anchor = EXCLUDED.from_anchor,
        interval = EXCLUDED.interval,
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence`,
      [
        data.id || event.aggregateID,
        event.instanceID || 'default',
        event.owner || event.aggregateID,
        data.unit,
        data.amount || 0,
        data.limitUsage !== undefined ? data.limitUsage : false,
        data.fromAnchor || event.createdAt,
        data.interval || null,
        event.createdAt,
        event.createdAt,
        event.aggregateVersion || 0,
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

    updates.push(`change_date = $${paramIndex++}`);
    values.push(event.createdAt);
    
    updates.push(`sequence = $${paramIndex++}`);
    values.push(event.aggregateVersion || 0);

    values.push(event.instanceID || 'default');
    values.push(data.id || event.aggregateID);

    await this.database.query(
      `UPDATE quotas 
       SET ${updates.join(', ')}
       WHERE instance_id = $${paramIndex++} AND id = $${paramIndex}`,
      values
    );
  }

  /**
   * Handle quota.removed event
   */
  private async handleQuotaRemoved(event: Event): Promise<void> {
    const data = event.payload as any;
    
    await this.database.query(
      `DELETE FROM quotas 
       WHERE instance_id = $1 AND id = $2`,
      [event.instanceID || 'default', data.id || event.aggregateID]
    );
  }

  /**
   * Handle quota.notification.added event
   */
  private async handleNotificationAdded(event: Event): Promise<void> {
    const data = event.payload as any;
    
    await this.database.query(
      `INSERT INTO quota_notifications (
        id, instance_id, quota_id, call_url, percent, repeat,
        latest_notified_at, creation_date, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        call_url = EXCLUDED.call_url,
        percent = EXCLUDED.percent,
        repeat = EXCLUDED.repeat,
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence`,
      [
        data.id || `notif_${Date.now()}`,
        event.instanceID || 'default',
        data.quotaId,
        data.callURL,
        data.percent || 100,
        data.repeat !== undefined ? data.repeat : false,
        null,
        event.createdAt,
        event.createdAt,
        event.aggregateVersion || 0,
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

    if (updates.length === 0) {
      return;
    }

    updates.push(`change_date = $${paramIndex++}`);
    values.push(event.createdAt);
    
    updates.push(`sequence = $${paramIndex++}`);
    values.push(event.aggregateVersion || 0);

    values.push(event.instanceID || 'default');
    values.push(data.id);

    await this.database.query(
      `UPDATE quota_notifications 
       SET ${updates.join(', ')}
       WHERE instance_id = $${paramIndex++} AND id = $${paramIndex}`,
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
       WHERE instance_id = $1 AND id = $2`,
      [event.instanceID || 'default', data.id]
    );
  }

  /**
   * Mark notification as sent
   */
  async markNotificationSent(instanceID: string, notificationID: string): Promise<void> {
    await this.database.query(
      `UPDATE quota_notifications 
       SET latest_notified_at = NOW()
       WHERE instance_id = $1 AND id = $2`,
      [instanceID, notificationID]
    );
  }
}
