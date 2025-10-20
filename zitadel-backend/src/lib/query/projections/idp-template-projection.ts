/**
 * IDP Template Projection - materializes IDP template events
 * Manages org and instance level IDP templates
 */

import { Projection } from '../projection/projection';
import { Event } from '../../eventstore/types';

export class IDPTemplateProjection extends Projection {
  readonly name = 'idp_template_projection';
  readonly tables = ['idp_templates'];

  async init(): Promise<void> {
    // Create idp_templates table
    await this.query(
      `CREATE TABLE IF NOT EXISTS projections.idp_templates (
        id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        name TEXT NOT NULL,
        type INTEGER NOT NULL,
        owner_type TEXT NOT NULL,
        is_creation_allowed BOOLEAN DEFAULT true,
        is_linking_allowed BOOLEAN DEFAULT true,
        is_auto_creation BOOLEAN DEFAULT false,
        is_auto_update BOOLEAN DEFAULT false,
        PRIMARY KEY (instance_id, id)
      )`,
      []
    );

    // Create indexes
    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_idp_templates_resource_owner 
       ON projections.idp_templates(resource_owner, instance_id)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_idp_templates_owner_type 
       ON projections.idp_templates(owner_type, instance_id)`,
      []
    );
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'idp.template.added':
      case 'org.idp.added':
      case 'instance.idp.added':
        await this.handleTemplateAdded(event);
        break;

      case 'idp.template.changed':
      case 'org.idp.changed':
      case 'instance.idp.changed':
        await this.handleTemplateChanged(event);
        break;

      case 'idp.template.removed':
      case 'org.idp.removed':
      case 'instance.idp.removed':
        await this.handleTemplateRemoved(event);
        break;

      case 'instance.removed':
        await this.handleInstanceRemoved(event);
        break;

      default:
        // Unknown event type, ignore
        break;
    }
  }

  /**
   * Handle template added event
   */
  private async handleTemplateAdded(event: Event): Promise<void> {
    const payload = event.payload || {};

    // Determine owner type from event or aggregate
    let ownerType = 'instance';
    if (event.eventType.includes('org.idp')) {
      ownerType = 'org';
    } else if (event.aggregateType === 'org') {
      ownerType = 'org';
    }

    // Extract IDP ID - might be in payload or be the aggregate ID
    const idpID = payload.idpID || payload.id || event.aggregateID;

    await this.query(
      `INSERT INTO projections.idp_templates (
        id, instance_id, creation_date, change_date, sequence, resource_owner,
        name, type, owner_type, is_creation_allowed, is_linking_allowed,
        is_auto_creation, is_auto_update
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence`,
      [
        idpID,
        event.instanceID,
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
        event.owner,
        payload.name || 'Unnamed Template',
        payload.type || 0,
        ownerType,
        payload.isCreationAllowed !== false,
        payload.isLinkingAllowed !== false,
        payload.isAutoCreation || false,
        payload.isAutoUpdate || false,
      ]
    );
  }

  /**
   * Handle template changed event
   */
  private async handleTemplateChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const idpID = payload.idpID || payload.id || event.aggregateID;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (payload.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(payload.name);
    }

    if (payload.isCreationAllowed !== undefined) {
      updates.push(`is_creation_allowed = $${paramIndex++}`);
      values.push(payload.isCreationAllowed);
    }

    if (payload.isLinkingAllowed !== undefined) {
      updates.push(`is_linking_allowed = $${paramIndex++}`);
      values.push(payload.isLinkingAllowed);
    }

    if (payload.isAutoCreation !== undefined) {
      updates.push(`is_auto_creation = $${paramIndex++}`);
      values.push(payload.isAutoCreation);
    }

    if (payload.isAutoUpdate !== undefined) {
      updates.push(`is_auto_update = $${paramIndex++}`);
      values.push(payload.isAutoUpdate);
    }

    // Always update these
    updates.push(`change_date = $${paramIndex++}`);
    values.push(event.createdAt);

    updates.push(`sequence = $${paramIndex++}`);
    values.push(Math.floor(event.position.position));

    values.push(idpID);
    values.push(event.instanceID);

    if (updates.length > 0) {
      await this.query(
        `UPDATE projections.idp_templates
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex++} AND instance_id = $${paramIndex++}`,
        values
      );
    }
  }

  /**
   * Handle template removed event
   */
  private async handleTemplateRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    const idpID = payload.idpID || payload.id || event.aggregateID;

    await this.query(
      `DELETE FROM projections.idp_templates WHERE id = $1 AND instance_id = $2`,
      [idpID, event.instanceID]
    );
  }

  /**
   * Handle instance removed event
   */
  private async handleInstanceRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.idp_templates WHERE instance_id = $1`,
      [event.instanceID]
    );
  }
}

/**
 * Create IDP template projection configuration
 */
export function createIDPTemplateProjectionConfig() {
  return {
    name: 'idp_template_projection',
    tables: ['idp_templates'],
    eventTypes: [
      'idp.template.added',
      'idp.template.changed',
      'idp.template.removed',
      'org.idp.added',
      'org.idp.changed',
      'org.idp.removed',
      'instance.idp.added',
      'instance.idp.changed',
      'instance.idp.removed',
      'instance.removed',
    ],
    aggregateTypes: ['idp', 'org', 'instance'],
    interval: 1000,
    enableLocking: false,
  };
}
