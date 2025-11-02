/**
 * Security & Notification Policy Projection
 * Handles lockout, privacy, notification, and security policies
 * Based on Zitadel Go internal/query/projection/*_policy.go
 */

import { Event } from '../../eventstore/types';
import { Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database/pool';
import { Projection } from '../projection/projection';
import { ProjectionConfig } from '../projection/projection-config';

export class SecurityNotificationPolicyProjection extends Projection {
  readonly name = 'security_notification_policy_projection';
  readonly tables = [
    'projections.lockout_policies',
    'projections.privacy_policies',
    'projections.notification_policies',
    'projections.security_policies',
  ];

  constructor(eventstore: Eventstore, database: DatabasePool) {
    super(eventstore, database);
  }

  /**
   * Initialize projection tables
   */
  async init(): Promise<void> {
    // Create lockout_policies table
    await this.query(`
      CREATE TABLE IF NOT EXISTS projections.lockout_policies (
        id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        organization_id TEXT,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        max_password_attempts BIGINT NOT NULL DEFAULT 10,
        max_otp_attempts BIGINT NOT NULL DEFAULT 5,
        show_failures BOOLEAN NOT NULL DEFAULT true,
        is_default BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (instance_id, id)
      )
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS lockout_policies_instance_id_idx 
      ON projections.lockout_policies (instance_id)
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS lockout_policies_org_id_idx 
      ON projections.lockout_policies (instance_id, organization_id)
    `);

    // Create privacy_policies table
    await this.query(`
      CREATE TABLE IF NOT EXISTS projections.privacy_policies (
        id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        organization_id TEXT,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        tos_link TEXT,
        privacy_link TEXT,
        help_link TEXT,
        support_email TEXT,
        docs_link TEXT,
        custom_link TEXT,
        custom_link_text TEXT,
        is_default BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (instance_id, id)
      )
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS privacy_policies_instance_id_idx 
      ON projections.privacy_policies (instance_id)
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS privacy_policies_org_id_idx 
      ON projections.privacy_policies (instance_id, organization_id)
    `);

    // Create notification_policies table
    await this.query(`
      CREATE TABLE IF NOT EXISTS projections.notification_policies (
        id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        organization_id TEXT,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        password_change BOOLEAN NOT NULL DEFAULT true,
        is_default BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (instance_id, id)
      )
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS notification_policies_instance_id_idx 
      ON projections.notification_policies (instance_id)
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS notification_policies_org_id_idx 
      ON projections.notification_policies (instance_id, organization_id)
    `);

    // Create security_policies table
    await this.query(`
      CREATE TABLE IF NOT EXISTS projections.security_policies (
        aggregate_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        enable_iframe_embedding BOOLEAN NOT NULL DEFAULT false,
        allowed_origins TEXT[],
        enable_impersonation BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (instance_id)
      )
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS security_policies_instance_id_idx 
      ON projections.security_policies (instance_id)
    `);
  }
  
  /**
   * Get event types handled by this projection
   * Required for real-time event subscription
   */
  getEventTypes(): string[] {
    return [
      'instance.lockout.policy.added',
      'instance.lockout.policy.changed',
      'instance.notification.policy.added',
      'instance.notification.policy.changed',
      'instance.privacy.policy.added',
      'instance.privacy.policy.changed',
      'instance.removed',
      'instance.security.policy.added',
      'instance.security.policy.changed',
      'org.lockout.policy.added',
      'org.lockout.policy.changed',
      'org.notification.policy.added',
      'org.notification.policy.changed',
      'org.privacy.policy.added',
      'org.privacy.policy.changed',
      'org.removed',
    ];
  }


  /**
   * Process events
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      // Lockout Policy Events
      case 'instance.lockout.policy.added':
      case 'org.lockout.policy.added':
        await this.handleLockoutPolicyAdded(event);
        break;

      case 'instance.lockout.policy.changed':
      case 'org.lockout.policy.changed':
        await this.handleLockoutPolicyChanged(event);
        break;

      // Privacy Policy Events
      case 'instance.privacy.policy.added':
      case 'org.privacy.policy.added':
        await this.handlePrivacyPolicyAdded(event);
        break;

      case 'instance.privacy.policy.changed':
      case 'org.privacy.policy.changed':
        await this.handlePrivacyPolicyChanged(event);
        break;

      // Notification Policy Events
      case 'instance.notification.policy.added':
      case 'org.notification.policy.added':
        await this.handleNotificationPolicyAdded(event);
        break;

      case 'instance.notification.policy.changed':
      case 'org.notification.policy.changed':
        await this.handleNotificationPolicyChanged(event);
        break;

      // Security Policy Events
      case 'instance.security.policy.added':
        await this.handleSecurityPolicyAdded(event);
        break;

      case 'instance.security.policy.changed':
        await this.handleSecurityPolicyChanged(event);
        break;

      // Cleanup events
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

  // Lockout Policy Handlers
  private async handleLockoutPolicyAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    const isDefault = event.eventType.includes('instance.');
    const policyID = event.aggregateID;
    const organizationID = isDefault ? null : event.owner;

    await this.query(
      `INSERT INTO projections.lockout_policies (
        id, instance_id, organization_id, creation_date, change_date, sequence, resource_owner,
        max_password_attempts, max_otp_attempts, show_failures, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        max_password_attempts = EXCLUDED.max_password_attempts,
        max_otp_attempts = EXCLUDED.max_otp_attempts,
        show_failures = EXCLUDED.show_failures`,
      [
        policyID,
        event.instanceID,
        organizationID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.owner,
        payload.maxPasswordAttempts || 10,
        payload.maxOTPAttempts || 5,
        payload.showFailures !== false,
        isDefault,
      ]
    );
  }

  private async handleLockoutPolicyChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const policyID = event.aggregateID;

    await this.query(
      `UPDATE projections.lockout_policies SET
        change_date = $1,
        sequence = $2,
        max_password_attempts = COALESCE($3, max_password_attempts),
        max_otp_attempts = COALESCE($4, max_otp_attempts),
        show_failures = COALESCE($5, show_failures)
      WHERE instance_id = $6 AND id = $7`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        payload.maxPasswordAttempts,
        payload.maxOTPAttempts,
        payload.showFailures,
        event.instanceID,
        policyID,
      ]
    );
  }

  // Privacy Policy Handlers
  private async handlePrivacyPolicyAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    const isDefault = event.eventType.includes('instance.');
    const policyID = event.aggregateID;
    const organizationID = isDefault ? null : event.owner;

    await this.query(
      `INSERT INTO projections.privacy_policies (
        id, instance_id, organization_id, creation_date, change_date, sequence, resource_owner,
        tos_link, privacy_link, help_link, support_email, docs_link, custom_link, custom_link_text, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        tos_link = EXCLUDED.tos_link,
        privacy_link = EXCLUDED.privacy_link,
        help_link = EXCLUDED.help_link,
        support_email = EXCLUDED.support_email,
        docs_link = EXCLUDED.docs_link,
        custom_link = EXCLUDED.custom_link,
        custom_link_text = EXCLUDED.custom_link_text`,
      [
        policyID,
        event.instanceID,
        organizationID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.owner,
        payload.tosLink || '',
        payload.privacyLink || '',
        payload.helpLink || '',
        payload.supportEmail || '',
        payload.docsLink || '',
        payload.customLink || '',
        payload.customLinkText || '',
        isDefault,
      ]
    );
  }

  private async handlePrivacyPolicyChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const policyID = event.aggregateID;

    const updates: string[] = ['change_date = $1', 'sequence = $2'];
    const values: any[] = [event.createdAt, Number(event.aggregateVersion || 1n)];
    let paramIndex = 3;

    const fieldMappings: [string, string, any][] = [
      ['tosLink', 'tos_link', payload.tosLink],
      ['privacyLink', 'privacy_link', payload.privacyLink],
      ['helpLink', 'help_link', payload.helpLink],
      ['supportEmail', 'support_email', payload.supportEmail],
      ['docsLink', 'docs_link', payload.docsLink],
      ['customLink', 'custom_link', payload.customLink],
      ['customLinkText', 'custom_link_text', payload.customLinkText],
    ];

    for (const [, dbField, value] of fieldMappings) {
      if (value !== undefined) {
        updates.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    values.push(event.instanceID, policyID);

    await this.query(
      `UPDATE projections.privacy_policies SET
        ${updates.join(', ')}
      WHERE instance_id = $${paramIndex} AND id = $${paramIndex + 1}`,
      values
    );
  }

  // Notification Policy Handlers
  private async handleNotificationPolicyAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    const isDefault = event.eventType.includes('instance.');
    const policyID = event.aggregateID;
    const organizationID = isDefault ? null : event.owner;

    await this.query(
      `INSERT INTO projections.notification_policies (
        id, instance_id, organization_id, creation_date, change_date, sequence, resource_owner,
        password_change, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        password_change = EXCLUDED.password_change`,
      [
        policyID,
        event.instanceID,
        organizationID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.owner,
        payload.passwordChange !== false,
        isDefault,
      ]
    );
  }

  private async handleNotificationPolicyChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const policyID = event.aggregateID;

    await this.query(
      `UPDATE projections.notification_policies SET
        change_date = $1,
        sequence = $2,
        password_change = COALESCE($3, password_change)
      WHERE instance_id = $4 AND id = $5`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        payload.passwordChange,
        event.instanceID,
        policyID,
      ]
    );
  }

  // Security Policy Handlers
  private async handleSecurityPolicyAdded(event: Event): Promise<void> {
    const payload = event.payload || {};

    await this.query(
      `INSERT INTO projections.security_policies (
        aggregate_id, instance_id, creation_date, change_date, sequence, resource_owner,
        enable_iframe_embedding, allowed_origins, enable_impersonation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (instance_id, aggregate_id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        enable_iframe_embedding = EXCLUDED.enable_iframe_embedding,
        allowed_origins = EXCLUDED.allowed_origins,
        enable_impersonation = EXCLUDED.enable_impersonation`,
      [
        event.aggregateID,
        event.instanceID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.owner,
        payload.enableIframeEmbedding || false,
        payload.allowedOrigins || [],
        payload.enableImpersonation || false,
      ]
    );
  }

  private async handleSecurityPolicyChanged(event: Event): Promise<void> {
    const payload = event.payload || {};

    const updates: string[] = ['change_date = $1', 'sequence = $2'];
    const values: any[] = [event.createdAt, Number(event.aggregateVersion || 1n)];
    let paramIndex = 3;

    if (payload.enableIframeEmbedding !== undefined) {
      updates.push(`enable_iframe_embedding = $${paramIndex}`);
      values.push(payload.enableIframeEmbedding);
      paramIndex++;
    }

    if (payload.allowedOrigins !== undefined) {
      updates.push(`allowed_origins = $${paramIndex}`);
      values.push(payload.allowedOrigins);
      paramIndex++;
    }

    if (payload.enableImpersonation !== undefined) {
      updates.push(`enable_impersonation = $${paramIndex}`);
      values.push(payload.enableImpersonation);
      paramIndex++;
    }

    values.push(event.instanceID);
    values.push(event.aggregateID);

    await this.query(
      `UPDATE projections.security_policies SET
        ${updates.join(', ')}
      WHERE instance_id = $${paramIndex} AND aggregate_id = $${paramIndex + 1}`,
      values
    );
  }

  // Cleanup Handlers
  private async handleOrgRemoved(event: Event): Promise<void> {
    const orgID = event.aggregateID;

    // Delete org-specific policies
    await this.query(
      `DELETE FROM projections.lockout_policies WHERE instance_id = $1 AND organization_id = $2`,
      [event.instanceID, orgID]
    );

    await this.query(
      `DELETE FROM projections.privacy_policies WHERE instance_id = $1 AND organization_id = $2`,
      [event.instanceID, orgID]
    );

    await this.query(
      `DELETE FROM projections.notification_policies WHERE instance_id = $1 AND organization_id = $2`,
      [event.instanceID, orgID]
    );
  }

  private async handleInstanceRemoved(event: Event): Promise<void> {
    const instanceID = event.aggregateID;

    // Delete all policies for this instance
    await this.query(
      `DELETE FROM projections.lockout_policies WHERE instance_id = $1`,
      [instanceID]
    );

    await this.query(
      `DELETE FROM projections.privacy_policies WHERE instance_id = $1`,
      [instanceID]
    );

    await this.query(
      `DELETE FROM projections.notification_policies WHERE instance_id = $1`,
      [instanceID]
    );

    await this.query(
      `DELETE FROM projections.security_policies WHERE instance_id = $1`,
      [instanceID]
    );
  }
}

/**
 * Create projection config for security & notification policies
 */
export function createSecurityNotificationPolicyProjectionConfig(): ProjectionConfig {
  return {
    name: 'security_notification_policy_projection',
    tables: [
      'projections.lockout_policies',
      'projections.privacy_policies',
      'projections.notification_policies',
      'projections.security_policies',
    ],
    eventTypes: [
      'instance.lockout.policy.added',
      'instance.lockout.policy.changed',
      'org.lockout.policy.added',
      'org.lockout.policy.changed',
      'instance.privacy.policy.added',
      'instance.privacy.policy.changed',
      'org.privacy.policy.added',
      'org.privacy.policy.changed',
      'instance.notification.policy.added',
      'instance.notification.policy.changed',
      'org.notification.policy.added',
      'org.notification.policy.changed',
      'instance.security.policy.added',
      'instance.security.policy.changed',
      'org.removed',
      'instance.removed',
    ],
    aggregateTypes: ['org', 'instance'],
    batchSize: 100,
    interval: 1000,
    enableLocking: false,
  };
}
