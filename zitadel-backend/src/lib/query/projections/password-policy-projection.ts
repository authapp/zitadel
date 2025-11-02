/**
 * Password Policy Projection - materializes password policy events
 * Manages password complexity and age policies
 */

import { Projection } from '../projection/projection';
import { Event } from '../../eventstore/types';

export class PasswordPolicyProjection extends Projection {
  readonly name = 'password_policy_projection';
  readonly tables = ['password_complexity_policies', 'password_age_policies'];

  async init(): Promise<void> {
    // Create password_complexity_policies table
    await this.query(
      `CREATE TABLE IF NOT EXISTS projections.password_complexity_policies (
        id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        organization_id TEXT,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        min_length INTEGER NOT NULL DEFAULT 8,
        has_uppercase BOOLEAN NOT NULL DEFAULT true,
        has_lowercase BOOLEAN NOT NULL DEFAULT true,
        has_number BOOLEAN NOT NULL DEFAULT true,
        has_symbol BOOLEAN NOT NULL DEFAULT false,
        is_default BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (instance_id, id)
      )`,
      []
    );

    // Create password_age_policies table
    await this.query(
      `CREATE TABLE IF NOT EXISTS projections.password_age_policies (
        id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        organization_id TEXT,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        max_age_days INTEGER NOT NULL DEFAULT 0,
        expire_warn_days INTEGER NOT NULL DEFAULT 0,
        is_default BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (instance_id, id)
      )`,
      []
    );

    // Create indexes
    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_password_complexity_policies_org 
       ON projections.password_complexity_policies(organization_id, instance_id)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_password_complexity_policies_default 
       ON projections.password_complexity_policies(is_default, instance_id)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_password_age_policies_org 
       ON projections.password_age_policies(organization_id, instance_id)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_password_age_policies_default 
       ON projections.password_age_policies(is_default, instance_id)`,
      []
    );
  }
  
  /**
   * Get event types handled by this projection
   * Required for real-time event subscription
   */
  getEventTypes(): string[] {
    return [
      'instance.password.complexity.policy.added',
      'instance.password.complexity.policy.changed',
      'instance.password.complexity.policy.removed',
      'instance.policy.password_age.added',
      'instance.policy.password_age.changed',
      'instance.policy.password_age.removed',
      'instance.removed',
      'org.password.complexity.policy.added',
      'org.password.complexity.policy.changed',
      'org.password.complexity.policy.removed',
      'org.policy.password_age.added',
      'org.policy.password_age.changed',
      'org.policy.password_age.removed',
      'org.removed',
    ];
  }


  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'org.password.complexity.policy.added':
      case 'instance.password.complexity.policy.added':
        await this.handleComplexityPolicyAdded(event);
        break;

      case 'org.password.complexity.policy.changed':
      case 'instance.password.complexity.policy.changed':
        await this.handleComplexityPolicyChanged(event);
        break;

      case 'org.policy.password_age.added':
      case 'instance.policy.password_age.added':
        await this.handleAgePolicyAdded(event);
        break;

      case 'org.policy.password_age.changed':
      case 'instance.policy.password_age.changed':
        await this.handleAgePolicyChanged(event);
        break;

      case 'org.password.complexity.policy.removed':
      case 'instance.password.complexity.policy.removed':
        await this.handleComplexityPolicyRemoved(event);
        break;

      case 'org.policy.password_age.removed':
      case 'instance.policy.password_age.removed':
        await this.handleAgePolicyRemoved(event);
        break;

      case 'org.removed':
        await this.handleOrgRemoved(event);
        break;

      case 'instance.removed':
        await this.handleInstanceRemoved(event);
        break;

      default:
        // Unknown event type, ignore
        break;
    }
  }

  private async handleComplexityPolicyAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    const isDefault = event.eventType.includes('instance.');
    const policyID = payload.id || event.aggregateID;  // Use payload.id for instance policies
    const organizationID = isDefault ? null : event.owner;

    await this.query(
      `INSERT INTO projections.password_complexity_policies (
        id, instance_id, organization_id, creation_date, change_date, sequence, resource_owner,
        min_length, has_uppercase, has_lowercase, has_number, has_symbol, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        min_length = EXCLUDED.min_length,
        has_uppercase = EXCLUDED.has_uppercase,
        has_lowercase = EXCLUDED.has_lowercase,
        has_number = EXCLUDED.has_number,
        has_symbol = EXCLUDED.has_symbol`,
      [
        policyID,
        event.instanceID,
        organizationID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.owner,
        payload.minLength || 8,
        payload.hasUppercase !== false,
        payload.hasLowercase !== false,
        payload.hasNumber !== false,
        payload.hasSymbol || false,
        isDefault,
      ]
    );
  }

  private async handleComplexityPolicyChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const policyID = payload.id || event.aggregateID;  // Use payload.id for instance policies

    await this.query(
      `UPDATE projections.password_complexity_policies SET
        change_date = $1,
        sequence = $2,
        min_length = COALESCE($3, min_length),
        has_uppercase = COALESCE($4, has_uppercase),
        has_lowercase = COALESCE($5, has_lowercase),
        has_number = COALESCE($6, has_number),
        has_symbol = COALESCE($7, has_symbol)
      WHERE instance_id = $8 AND id = $9`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        payload.minLength,
        payload.hasUppercase,
        payload.hasLowercase,
        payload.hasNumber,
        payload.hasSymbol,
        event.instanceID,
        policyID,
      ]
    );
  }

  private async handleAgePolicyAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    const isDefault = event.eventType.includes('instance.');
    const policyID = payload.id || event.aggregateID;  // Use payload.id for instance policies
    const organizationID = isDefault ? null : event.owner;

    await this.query(
      `INSERT INTO projections.password_age_policies (
        id, instance_id, organization_id, creation_date, change_date, sequence, resource_owner,
        max_age_days, expire_warn_days, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        max_age_days = EXCLUDED.max_age_days,
        expire_warn_days = EXCLUDED.expire_warn_days`,
      [
        policyID,
        event.instanceID,
        organizationID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.owner,
        payload.maxAgeDays || 0,
        payload.expireWarnDays || 0,
        isDefault,
      ]
    );
  }

  private async handleAgePolicyChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const policyID = payload.id || event.aggregateID;  // Use payload.id for instance policies

    await this.query(
      `UPDATE projections.password_age_policies SET
        change_date = $1,
        sequence = $2,
        max_age_days = COALESCE($3, max_age_days),
        expire_warn_days = COALESCE($4, expire_warn_days)
      WHERE instance_id = $5 AND id = $6`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        payload.maxAgeDays,
        payload.expireWarnDays,
        event.instanceID,
        policyID,
      ]
    );
  }

  private async handleComplexityPolicyRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    const policyID = payload.id || event.aggregateID;

    await this.query(
      `DELETE FROM projections.password_complexity_policies 
       WHERE instance_id = $1 AND id = $2`,
      [event.instanceID, policyID]
    );
  }

  private async handleAgePolicyRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    const policyID = payload.id || event.aggregateID;

    await this.query(
      `DELETE FROM projections.password_age_policies 
       WHERE instance_id = $1 AND id = $2`,
      [event.instanceID, policyID]
    );
  }

  private async handleOrgRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.password_complexity_policies 
       WHERE instance_id = $1 AND organization_id = $2`,
      [event.instanceID, event.aggregateID]
    );

    await this.query(
      `DELETE FROM projections.password_age_policies 
       WHERE instance_id = $1 AND organization_id = $2`,
      [event.instanceID, event.aggregateID]
    );
  }

  private async handleInstanceRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.password_complexity_policies 
       WHERE instance_id = $1`,
      [event.instanceID]
    );

    await this.query(
      `DELETE FROM projections.password_age_policies 
       WHERE instance_id = $1`,
      [event.instanceID]
    );
  }
}

/**
 * Create projection config
 */
export function createPasswordPolicyProjectionConfig() {
  return {
    name: 'password_policy_projection',
    tables: ['password_complexity_policies', 'password_age_policies'],
    eventTypes: [
      'org.password.complexity.policy.added',
      'org.password.complexity.policy.changed',
      'org.password.complexity.policy.removed',
      'instance.password.complexity.policy.added',
      'instance.password.complexity.policy.changed',
      'instance.password.complexity.policy.removed',
      'org.policy.password_age.added',
      'org.policy.password_age.changed',
      'org.policy.password_age.removed',
      'instance.policy.password_age.added',
      'instance.policy.password_age.changed',
      'instance.policy.password_age.removed',
      'org.removed',
      'instance.removed',
    ],
    aggregateTypes: ['org', 'instance'],
    batchSize: 100,
    interval: 1000,
    enableLocking: false,
  };
}
