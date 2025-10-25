/**
 * Mail & OIDC Projection
 * Handles mail templates and OIDC settings
 * Based on Zitadel Go internal/query/projection/mail_template.go and oidc_settings.go
 */

import { Event } from '../../eventstore/types';
import { Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database/pool';
import { Projection } from '../projection/projection';
import { ProjectionConfig } from '../projection/projection-config';

export class MailOIDCProjection extends Projection {
  readonly name = 'mail_oidc_projection';
  readonly tables = [
    'projections.mail_templates',
    'projections.oidc_settings',
  ];

  constructor(eventstore: Eventstore, database: DatabasePool) {
    super(eventstore, database);
  }

  /**
   * Initialize projection tables
   */
  async init(): Promise<void> {
    // Create mail_templates table
    await this.query(`
      CREATE TABLE IF NOT EXISTS projections.mail_templates (
        aggregate_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        organization_id TEXT,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        template TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (instance_id, aggregate_id)
      )
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS mail_templates_instance_id_idx 
      ON projections.mail_templates (instance_id)
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS mail_templates_org_id_idx 
      ON projections.mail_templates (instance_id, organization_id)
    `);

    // Create oidc_settings table
    await this.query(`
      CREATE TABLE IF NOT EXISTS projections.oidc_settings (
        aggregate_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        access_token_lifetime BIGINT NOT NULL DEFAULT 43200,
        id_token_lifetime BIGINT NOT NULL DEFAULT 43200,
        refresh_token_idle_expiration BIGINT NOT NULL DEFAULT 1296000,
        refresh_token_expiration BIGINT NOT NULL DEFAULT 2592000,
        PRIMARY KEY (instance_id)
      )
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS oidc_settings_instance_id_idx 
      ON projections.oidc_settings (instance_id)
    `);
  }

  /**
   * Process events
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      // Mail Template Events
      case 'instance.mail.template.added':
      case 'org.mail.template.added':
        await this.handleMailTemplateAdded(event);
        break;

      case 'instance.mail.template.changed':
      case 'org.mail.template.changed':
        await this.handleMailTemplateChanged(event);
        break;

      // OIDC Settings Events
      case 'instance.oidc.settings.added':
        await this.handleOIDCSettingsAdded(event);
        break;

      case 'instance.oidc.settings.changed':
        await this.handleOIDCSettingsChanged(event);
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

  // Mail Template Handlers
  private async handleMailTemplateAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    const isDefault = event.eventType.includes('instance.');
    const aggregateID = event.aggregateID;
    const organizationID = isDefault ? null : event.owner;

    await this.query(
      `INSERT INTO projections.mail_templates (
        aggregate_id, instance_id, organization_id, creation_date, change_date, sequence,
        template, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (instance_id, aggregate_id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        template = EXCLUDED.template`,
      [
        aggregateID,
        event.instanceID,
        organizationID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        payload.template || '',
        isDefault,
      ]
    );
  }

  private async handleMailTemplateChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const aggregateID = event.aggregateID;

    await this.query(
      `UPDATE projections.mail_templates SET
        change_date = $1,
        sequence = $2,
        template = COALESCE($3, template)
      WHERE instance_id = $4 AND aggregate_id = $5`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        payload.template,
        event.instanceID,
        aggregateID,
      ]
    );
  }

  // OIDC Settings Handlers
  private async handleOIDCSettingsAdded(event: Event): Promise<void> {
    const payload = event.payload || {};

    await this.query(
      `INSERT INTO projections.oidc_settings (
        aggregate_id, instance_id, creation_date, change_date, sequence, resource_owner,
        access_token_lifetime, id_token_lifetime, refresh_token_idle_expiration, refresh_token_expiration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (instance_id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        access_token_lifetime = EXCLUDED.access_token_lifetime,
        id_token_lifetime = EXCLUDED.id_token_lifetime,
        refresh_token_idle_expiration = EXCLUDED.refresh_token_idle_expiration,
        refresh_token_expiration = EXCLUDED.refresh_token_expiration`,
      [
        event.instanceID,
        event.instanceID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.owner,
        payload.accessTokenLifetime || 43200,
        payload.idTokenLifetime || 43200,
        payload.refreshTokenIdleExpiration || 1296000,
        payload.refreshTokenExpiration || 2592000,
      ]
    );
  }

  private async handleOIDCSettingsChanged(event: Event): Promise<void> {
    const payload = event.payload || {};

    const updates: string[] = ['change_date = $1', 'sequence = $2'];
    const values: any[] = [event.createdAt, Number(event.aggregateVersion || 1n)];
    let paramIndex = 3;

    if (payload.accessTokenLifetime !== undefined) {
      updates.push(`access_token_lifetime = $${paramIndex}`);
      values.push(payload.accessTokenLifetime);
      paramIndex++;
    }

    if (payload.idTokenLifetime !== undefined) {
      updates.push(`id_token_lifetime = $${paramIndex}`);
      values.push(payload.idTokenLifetime);
      paramIndex++;
    }

    if (payload.refreshTokenIdleExpiration !== undefined) {
      updates.push(`refresh_token_idle_expiration = $${paramIndex}`);
      values.push(payload.refreshTokenIdleExpiration);
      paramIndex++;
    }

    if (payload.refreshTokenExpiration !== undefined) {
      updates.push(`refresh_token_expiration = $${paramIndex}`);
      values.push(payload.refreshTokenExpiration);
      paramIndex++;
    }

    values.push(event.instanceID);

    await this.query(
      `UPDATE projections.oidc_settings SET
        ${updates.join(', ')}
      WHERE instance_id = $${paramIndex}`,
      values
    );
  }

  // Cleanup Handlers
  private async handleOrgRemoved(event: Event): Promise<void> {
    const orgID = event.aggregateID;

    // Delete org-specific mail templates
    await this.query(
      `DELETE FROM projections.mail_templates WHERE instance_id = $1 AND organization_id = $2`,
      [event.instanceID, orgID]
    );
  }

  private async handleInstanceRemoved(event: Event): Promise<void> {
    const instanceID = event.aggregateID;

    // Delete all resources for this instance
    await this.query(
      `DELETE FROM projections.mail_templates WHERE instance_id = $1`,
      [instanceID]
    );

    await this.query(
      `DELETE FROM projections.oidc_settings WHERE instance_id = $1`,
      [instanceID]
    );
  }
}

/**
 * Create projection config for mail & OIDC
 */
export function createMailOIDCProjectionConfig(): ProjectionConfig {
  return {
    name: 'mail_oidc_projection',
    tables: [
      'projections.mail_templates',
      'projections.oidc_settings',
    ],
    eventTypes: [
      'instance.mail.template.added',
      'instance.mail.template.changed',
      'org.mail.template.added',
      'org.mail.template.changed',
      'instance.oidc.settings.added',
      'instance.oidc.settings.changed',
      'org.removed',
      'instance.removed',
    ],
    interval: 1000,
  };
}
