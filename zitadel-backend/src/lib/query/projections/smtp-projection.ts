/**
 * SMTP Configuration Projection
 * Handles SMTP email delivery configuration
 * Based on Zitadel Go internal/query/projection/smtp.go (simplified)
 */

import { Event } from '../../eventstore/types';
import { Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database/pool';
import { Projection } from '../projection/projection';
import { ProjectionConfig } from '../projection/projection-config';
import { SMTPConfigState } from '../smtp/smtp-types';

export class SMTPProjection extends Projection {
  readonly name = 'smtp_projection';
  readonly tables = ['projections.smtp_configs'];

  constructor(eventstore: Eventstore, database: DatabasePool) {
    super(eventstore, database);
  }

  /**
   * Initialize projection table
   */
  async init(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS projections.smtp_configs (
        id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        resource_owner TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        description TEXT,
        state INTEGER NOT NULL DEFAULT 1,
        tls BOOLEAN NOT NULL DEFAULT true,
        sender_address TEXT NOT NULL,
        sender_name TEXT,
        reply_to_address TEXT,
        host TEXT NOT NULL,
        smtp_user TEXT,
        PRIMARY KEY (instance_id, id)
      )
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS smtp_configs_instance_id_idx 
      ON projections.smtp_configs (instance_id)
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS smtp_configs_resource_owner_idx 
      ON projections.smtp_configs (instance_id, resource_owner)
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS smtp_configs_state_idx 
      ON projections.smtp_configs (instance_id, resource_owner, state)
    `);
  }

  /**
   * Process events
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'instance.smtp.config.added':
      case 'org.smtp.config.added':
        await this.handleSMTPConfigAdded(event);
        break;

      case 'instance.smtp.config.changed':
      case 'org.smtp.config.changed':
        await this.handleSMTPConfigChanged(event);
        break;

      case 'instance.smtp.config.activated':
      case 'org.smtp.config.activated':
        await this.handleSMTPConfigActivated(event);
        break;

      case 'instance.smtp.config.deactivated':
      case 'org.smtp.config.deactivated':
        await this.handleSMTPConfigDeactivated(event);
        break;

      case 'instance.smtp.config.removed':
      case 'org.smtp.config.removed':
        await this.handleSMTPConfigRemoved(event);
        break;

      case 'org.removed':
        await this.handleOrgRemoved(event);
        break;

      case 'instance.removed':
        await this.handleInstanceRemoved(event);
        break;

      default:
        break;
    }
  }

  private async handleSMTPConfigAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    const configID = payload.id || event.aggregateID;

    await this.query(
      `INSERT INTO projections.smtp_configs (
        id, instance_id, resource_owner, creation_date, change_date, sequence,
        description, state, tls, sender_address, sender_name, reply_to_address, host, smtp_user
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        description = EXCLUDED.description,
        tls = EXCLUDED.tls,
        sender_address = EXCLUDED.sender_address,
        sender_name = EXCLUDED.sender_name,
        reply_to_address = EXCLUDED.reply_to_address,
        host = EXCLUDED.host,
        smtp_user = EXCLUDED.smtp_user`,
      [
        configID,
        event.instanceID,
        event.owner,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        payload.description || '',
        payload.state || SMTPConfigState.INACTIVE,
        payload.tls !== false,
        payload.senderAddress || '',
        payload.senderName || '',
        payload.replyToAddress || '',
        payload.host || '',
        payload.user || '',
      ]
    );
  }

  private async handleSMTPConfigChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const configID = payload.id || event.aggregateID;

    const updates: string[] = ['change_date = $1', 'sequence = $2'];
    const values: any[] = [event.createdAt, Number(event.aggregateVersion || 1n)];
    let paramIndex = 3;

    const fields: [string, string, any][] = [
      ['description', 'description', payload.description],
      ['tls', 'tls', payload.tls],
      ['senderAddress', 'sender_address', payload.senderAddress],
      ['senderName', 'sender_name', payload.senderName],
      ['replyToAddress', 'reply_to_address', payload.replyToAddress],
      ['host', 'host', payload.host],
      ['user', 'smtp_user', payload.user],
    ];

    for (const [, dbField, value] of fields) {
      if (value !== undefined) {
        updates.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    values.push(event.instanceID, configID);

    await this.query(
      `UPDATE projections.smtp_configs SET
        ${updates.join(', ')}
      WHERE instance_id = $${paramIndex} AND id = $${paramIndex + 1}`,
      values
    );
  }

  private async handleSMTPConfigActivated(event: Event): Promise<void> {
    const payload = event.payload || {};
    const configID = payload.id || event.aggregateID;

    await this.query(
      `UPDATE projections.smtp_configs SET
        change_date = $1,
        sequence = $2,
        state = $3
      WHERE instance_id = $4 AND id = $5`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        SMTPConfigState.ACTIVE,
        event.instanceID,
        configID,
      ]
    );
  }

  private async handleSMTPConfigDeactivated(event: Event): Promise<void> {
    const payload = event.payload || {};
    const configID = payload.id || event.aggregateID;

    await this.query(
      `UPDATE projections.smtp_configs SET
        change_date = $1,
        sequence = $2,
        state = $3
      WHERE instance_id = $4 AND id = $5`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        SMTPConfigState.INACTIVE,
        event.instanceID,
        configID,
      ]
    );
  }

  private async handleSMTPConfigRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    const configID = payload.id || event.aggregateID;

    await this.query(
      `DELETE FROM projections.smtp_configs WHERE instance_id = $1 AND id = $2`,
      [event.instanceID, configID]
    );
  }

  private async handleOrgRemoved(event: Event): Promise<void> {
    const orgID = event.aggregateID;

    await this.query(
      `DELETE FROM projections.smtp_configs WHERE instance_id = $1 AND resource_owner = $2`,
      [event.instanceID, orgID]
    );
  }

  private async handleInstanceRemoved(event: Event): Promise<void> {
    const instanceID = event.aggregateID;

    await this.query(
      `DELETE FROM projections.smtp_configs WHERE instance_id = $1`,
      [instanceID]
    );
  }
}

/**
 * Create projection config for SMTP
 */
export function createSMTPProjectionConfig(): ProjectionConfig {
  return {
    name: 'smtp_projection',
    tables: ['projections.smtp_configs'],
    eventTypes: [
      'instance.smtp.config.added',
      'instance.smtp.config.changed',
      'instance.smtp.config.activated',
      'instance.smtp.config.deactivated',
      'instance.smtp.config.removed',
      'org.smtp.config.added',
      'org.smtp.config.changed',
      'org.smtp.config.activated',
      'org.smtp.config.deactivated',
      'org.smtp.config.removed',
      'org.removed',
      'instance.removed',
    ],
    aggregateTypes: ['org', 'instance'],
    batchSize: 100,
    interval: 1000,
    enableLocking: false,
  };
}
