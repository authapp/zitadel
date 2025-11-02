/**
 * Lockout Policy Projection
 * Tracks account lockout policies for failed authentication attempts
 */

import { Event } from '../../eventstore/types';
import { Projection } from '../projection/projection';

export class LockoutPolicyProjection extends Projection {
  readonly name = 'lockout_policy_projection';
  readonly tables = ['projections.lockout_policies'];

  async init(): Promise<void> {
    // Table created by migration 002_46
  }
  
  /**
   * Get event types handled by this projection
   * Required for real-time event subscription
   */
  getEventTypes(): string[] {
    return [
      'instance.lockout.policy.added',
      'instance.lockout.policy.changed',
      'instance.lockout.policy.removed',
      'org.lockout.policy.added',
      'org.lockout.policy.changed',
      'org.lockout.policy.removed',
      'org.removed',
    ];
  }


  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'org.lockout.policy.added':
      case 'instance.lockout.policy.added':
        await this.handleLockoutPolicyAdded(event);
        break;
      case 'org.lockout.policy.changed':
      case 'instance.lockout.policy.changed':
        await this.handleLockoutPolicyChanged(event);
        break;
      case 'org.lockout.policy.removed':
      case 'instance.lockout.policy.removed':
        await this.handleLockoutPolicyRemoved(event);
        break;
      case 'org.removed':
        await this.handleOrgRemoved(event);
        break;
    }
  }

  private async handleLockoutPolicyAdded(event: Event): Promise<void> {
    const data = event.payload as any;
    const isInstance = event.eventType.startsWith('instance.');
    
    await this.database.query(
        `INSERT INTO projections.lockout_policies (
          id, instance_id, organization_id, resource_owner, max_password_attempts, max_otp_attempts,
          show_failures, is_default, creation_date, change_date, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (instance_id, id) DO UPDATE SET
          max_password_attempts = EXCLUDED.max_password_attempts,
          max_otp_attempts = EXCLUDED.max_otp_attempts,
          show_failures = EXCLUDED.show_failures,
          change_date = EXCLUDED.change_date,
          sequence = GREATEST(projections.lockout_policies.sequence, EXCLUDED.sequence)`,
        [
          data.id || event.aggregateID,
          event.instanceID || 'default',
          event.owner,  // organization_id
          event.owner,  // resource_owner (same value)
          data.maxPasswordAttempts || 5,
          data.maxOTPAttempts || data.maxOtpAttempts || 5,  // Support both naming conventions
          data.showFailures !== undefined ? data.showFailures : (data.showFailure !== false),  // Support both field names
          isInstance,
          event.createdAt,
          event.createdAt,
          event.aggregateVersion,
        ]
      );
  }

  private async handleLockoutPolicyChanged(event: Event): Promise<void> {
    const data = event.payload as any;
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.maxPasswordAttempts !== undefined) {
      updates.push(`max_password_attempts = $${paramIndex++}`);
      values.push(data.maxPasswordAttempts);
    }
    if (data.maxOTPAttempts !== undefined || data.maxOtpAttempts !== undefined) {
      updates.push(`max_otp_attempts = $${paramIndex++}`);
      values.push(data.maxOTPAttempts || data.maxOtpAttempts);
    }
    if (data.showFailures !== undefined || data.showFailure !== undefined) {
      updates.push(`show_failures = $${paramIndex++}`);
      values.push(data.showFailures !== undefined ? data.showFailures : data.showFailure);
    }

    if (updates.length > 0) {
      updates.push(`change_date = $${paramIndex++}`);
      values.push(event.createdAt);
      updates.push(`sequence = $${paramIndex++}`);
      values.push(event.aggregateVersion);

      values.push(event.instanceID || 'default');
      values.push(data.id || event.aggregateID);

      await this.database.query(
        `UPDATE projections.lockout_policies SET ${updates.join(', ')} 
         WHERE instance_id = $${paramIndex++} AND id = $${paramIndex}`,
        values
      );
    }
  }

  private async handleLockoutPolicyRemoved(event: Event): Promise<void> {
    const data = event.payload as any;
    await this.database.query(
      `DELETE FROM projections.lockout_policies 
       WHERE instance_id = $1 AND id = $2`,
      [event.instanceID || 'default', data.id || event.aggregateID]
    );
  }

  private async handleOrgRemoved(event: Event): Promise<void> {
    // Delete all policies for the removed organization
    await this.database.query(
      `DELETE FROM projections.lockout_policies 
       WHERE instance_id = $1 AND resource_owner = $2 AND is_default = false`,
      [event.instanceID || 'default', event.aggregateID]
    );
  }
}
