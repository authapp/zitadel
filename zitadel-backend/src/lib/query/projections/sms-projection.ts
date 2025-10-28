/**
 * SMS Configuration Projection
 * Handles SMS delivery configuration
 * Based on Zitadel Go internal/query/projection/sms.go (simplified)
 */

import { Event } from '../../eventstore/types';
import { Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database/pool';
import { Projection } from '../projection/projection';
import { ProjectionConfig } from '../projection/projection-config';
import { SMSConfigState, SMSProviderType } from '../sms/sms-types';

export class SMSProjection extends Projection {
  readonly name = 'sms_projection';
  readonly tables = ['projections.sms_configs'];

  constructor(eventstore: Eventstore, database: DatabasePool) {
    super(eventstore, database);
  }

  /**
   * Initialize projection table
   */
  async init(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS projections.sms_configs (
        id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        resource_owner TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        description TEXT,
        state INTEGER NOT NULL DEFAULT 1,
        provider_type TEXT NOT NULL DEFAULT 'twilio',
        twilio_sid TEXT,
        twilio_sender_number TEXT,
        twilio_verify_service_sid TEXT,
        http_endpoint TEXT,
        PRIMARY KEY (instance_id, id)
      )
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS sms_configs_instance_id_idx 
      ON projections.sms_configs (instance_id)
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS sms_configs_resource_owner_idx 
      ON projections.sms_configs (instance_id, resource_owner)
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS sms_configs_state_idx 
      ON projections.sms_configs (instance_id, resource_owner, state)
    `);
  }

  /**
   * Process events
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'instance.sms.config.twilio.added':
      case 'org.sms.config.twilio.added':
        await this.handleSMSConfigTwilioAdded(event);
        break;

      case 'instance.sms.config.twilio.changed':
      case 'org.sms.config.twilio.changed':
        await this.handleSMSConfigTwilioChanged(event);
        break;

      case 'instance.sms.config.http.added':
      case 'org.sms.config.http.added':
        await this.handleSMSConfigHTTPAdded(event);
        break;

      case 'instance.sms.config.http.changed':
      case 'org.sms.config.http.changed':
        await this.handleSMSConfigHTTPChanged(event);
        break;

      case 'instance.sms.config.activated':
      case 'org.sms.config.activated':
        await this.handleSMSConfigActivated(event);
        break;

      case 'instance.sms.config.deactivated':
      case 'org.sms.config.deactivated':
        await this.handleSMSConfigDeactivated(event);
        break;

      case 'instance.sms.config.removed':
      case 'org.sms.config.removed':
        await this.handleSMSConfigRemoved(event);
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

  private async handleSMSConfigTwilioAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    const configID = payload.id || event.aggregateID;

    await this.query(
      `INSERT INTO projections.sms_configs (
        id, instance_id, resource_owner, creation_date, change_date, sequence,
        description, state, provider_type, twilio_sid, twilio_sender_number, twilio_verify_service_sid
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        description = EXCLUDED.description,
        twilio_sid = EXCLUDED.twilio_sid,
        twilio_sender_number = EXCLUDED.twilio_sender_number,
        twilio_verify_service_sid = EXCLUDED.twilio_verify_service_sid`,
      [
        configID,
        event.instanceID,
        event.owner,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        payload.description || '',
        payload.state || SMSConfigState.INACTIVE,
        SMSProviderType.TWILIO,
        payload.sid || '',
        payload.senderNumber || '',
        payload.verifyServiceSID || '',
      ]
    );
  }

  private async handleSMSConfigTwilioChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const configID = payload.id || event.aggregateID;

    const updates: string[] = ['change_date = $1', 'sequence = $2'];
    const values: any[] = [event.createdAt, Number(event.aggregateVersion || 1n)];
    let paramIndex = 3;

    const fields: [string, string, any][] = [
      ['description', 'description', payload.description],
      ['sid', 'twilio_sid', payload.sid],
      ['senderNumber', 'twilio_sender_number', payload.senderNumber],
      ['verifyServiceSID', 'twilio_verify_service_sid', payload.verifyServiceSID],
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
      `UPDATE projections.sms_configs SET
        ${updates.join(', ')}
      WHERE instance_id = $${paramIndex} AND id = $${paramIndex + 1}`,
      values
    );
  }

  private async handleSMSConfigHTTPAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    const configID = payload.id || event.aggregateID;

    await this.query(
      `INSERT INTO projections.sms_configs (
        id, instance_id, resource_owner, creation_date, change_date, sequence,
        description, state, provider_type, http_endpoint
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        description = EXCLUDED.description,
        http_endpoint = EXCLUDED.http_endpoint`,
      [
        configID,
        event.instanceID,
        event.owner,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        payload.description || '',
        payload.state || SMSConfigState.INACTIVE,
        SMSProviderType.HTTP,
        payload.endpoint || '',
      ]
    );
  }

  private async handleSMSConfigHTTPChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const configID = payload.id || event.aggregateID;

    const updates: string[] = ['change_date = $1', 'sequence = $2'];
    const values: any[] = [event.createdAt, Number(event.aggregateVersion || 1n)];
    let paramIndex = 3;

    if (payload.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(payload.description);
      paramIndex++;
    }

    if (payload.endpoint !== undefined) {
      updates.push(`http_endpoint = $${paramIndex}`);
      values.push(payload.endpoint);
      paramIndex++;
    }

    values.push(event.instanceID, configID);

    await this.query(
      `UPDATE projections.sms_configs SET
        ${updates.join(', ')}
      WHERE instance_id = $${paramIndex} AND id = $${paramIndex + 1}`,
      values
    );
  }

  private async handleSMSConfigActivated(event: Event): Promise<void> {
    const payload = event.payload || {};
    const configID = payload.id || event.aggregateID;

    await this.query(
      `UPDATE projections.sms_configs SET
        change_date = $1,
        sequence = $2,
        state = $3
      WHERE instance_id = $4 AND id = $5`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        SMSConfigState.ACTIVE,
        event.instanceID,
        configID,
      ]
    );
  }

  private async handleSMSConfigDeactivated(event: Event): Promise<void> {
    const payload = event.payload || {};
    const configID = payload.id || event.aggregateID;

    await this.query(
      `UPDATE projections.sms_configs SET
        change_date = $1,
        sequence = $2,
        state = $3
      WHERE instance_id = $4 AND id = $5`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        SMSConfigState.INACTIVE,
        event.instanceID,
        configID,
      ]
    );
  }

  private async handleSMSConfigRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    const configID = payload.id || event.aggregateID;

    await this.query(
      `DELETE FROM projections.sms_configs WHERE instance_id = $1 AND id = $2`,
      [event.instanceID, configID]
    );
  }

  private async handleOrgRemoved(event: Event): Promise<void> {
    const orgID = event.aggregateID;

    await this.query(
      `DELETE FROM projections.sms_configs WHERE instance_id = $1 AND resource_owner = $2`,
      [event.instanceID, orgID]
    );
  }

  private async handleInstanceRemoved(event: Event): Promise<void> {
    const instanceID = event.aggregateID;

    await this.query(
      `DELETE FROM projections.sms_configs WHERE instance_id = $1`,
      [instanceID]
    );
  }
}

/**
 * Create projection config for SMS
 */
export function createSMSProjectionConfig(): ProjectionConfig {
  return {
    name: 'sms_projection',
    tables: ['projections.sms_configs'],
    eventTypes: [
      'instance.sms.config.twilio.added',
      'instance.sms.config.twilio.changed',
      'instance.sms.config.http.added',
      'instance.sms.config.http.changed',
      'instance.sms.config.activated',
      'instance.sms.config.deactivated',
      'instance.sms.config.removed',
      'org.sms.config.twilio.added',
      'org.sms.config.twilio.changed',
      'org.sms.config.http.added',
      'org.sms.config.http.changed',
      'org.sms.config.activated',
      'org.sms.config.deactivated',
      'org.sms.config.removed',
      'org.removed',
      'instance.removed',
    ],
    aggregateTypes: ['org', 'instance'],
    batchSize: 100,
    interval: 1000,
    enableLocking: false,
  };
}
