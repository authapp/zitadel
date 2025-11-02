/**
 * IDP Projection - materializes identity provider events
 * Handles all IDP types: OIDC, OAuth, LDAP, SAML, JWT, Azure, Google, Apple
 */

import { Projection } from '../projection/projection';
import { Event } from '../../eventstore/types';

export class IDPProjection extends Projection {
  readonly name = 'idp_projection';
  readonly tables = ['idps'];

  async init(): Promise<void> {
    // Create idps table
    await this.query(
      `CREATE TABLE IF NOT EXISTS projections.idps (
        id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        name TEXT NOT NULL,
        type INTEGER NOT NULL,
        state INTEGER NOT NULL DEFAULT 1,
        styling_type INTEGER DEFAULT 0,
        is_creation_allowed BOOLEAN DEFAULT true,
        is_linking_allowed BOOLEAN DEFAULT true,
        is_auto_creation BOOLEAN DEFAULT false,
        is_auto_update BOOLEAN DEFAULT false,
        config_data JSONB,
        PRIMARY KEY (instance_id, id)
      )`,
      []
    );

    // Create indexes
    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_idps_resource_owner 
       ON projections.idps(resource_owner, instance_id)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_idps_type 
       ON projections.idps(type, instance_id)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_idps_name 
       ON projections.idps(name, instance_id)`,
      []
    );
  }
  
  /**
   * Get event types handled by this projection
   * Required for real-time event subscription
   */
  getEventTypes(): string[] {
    return [
      'idp.added',
      'idp.apple.added',
      'idp.apple.changed',
      'idp.azure.added',
      'idp.azure.changed',
      'idp.changed',
      'idp.config.changed',
      'idp.google.added',
      'idp.google.changed',
      'idp.jwt.added',
      'idp.jwt.changed',
      'idp.ldap.added',
      'idp.ldap.changed',
      'idp.oauth.added',
      'idp.oauth.changed',
      'idp.oidc.added',
      'idp.oidc.changed',
      'idp.removed',
      'idp.saml.added',
      'idp.saml.changed',
      'instance.idp.added',
      'instance.idp.apple.added',
      'instance.idp.apple.changed',
      'instance.idp.azure.added',
      'instance.idp.azure.changed',
      'instance.idp.changed',
      'instance.idp.config.changed',
      'instance.idp.google.added',
      'instance.idp.google.changed',
      'instance.idp.jwt.added',
      'instance.idp.jwt.changed',
      'instance.idp.ldap.added',
      'instance.idp.ldap.changed',
      'instance.idp.oauth.added',
      'instance.idp.oauth.changed',
      'instance.idp.oidc.added',
      'instance.idp.oidc.changed',
      'instance.idp.removed',
      'instance.idp.saml.added',
      'instance.idp.saml.changed',
      'instance.removed',
      'org.idp.added',
      'org.idp.apple.added',
      'org.idp.apple.changed',
      'org.idp.azure.added',
      'org.idp.azure.changed',
      'org.idp.changed',
      'org.idp.config.changed',
      'org.idp.google.added',
      'org.idp.google.changed',
      'org.idp.jwt.added',
      'org.idp.jwt.changed',
      'org.idp.ldap.added',
      'org.idp.ldap.changed',
      'org.idp.oauth.added',
      'org.idp.oauth.changed',
      'org.idp.oidc.added',
      'org.idp.oidc.changed',
      'org.idp.removed',
      'org.idp.saml.added',
      'org.idp.saml.changed',
    ];
  }


  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      // Instance-level IDP events
      case 'idp.added':
      case 'idp.oidc.added':
      case 'idp.oauth.added':
      case 'idp.ldap.added':
      case 'idp.saml.added':
      case 'idp.jwt.added':
      case 'idp.azure.added':
      case 'idp.google.added':
      case 'idp.apple.added':
      // Instance-level IDP events
      case 'instance.idp.added':
      case 'instance.idp.oidc.added':
      case 'instance.idp.oauth.added':
      case 'instance.idp.ldap.added':
      case 'instance.idp.saml.added':
      case 'instance.idp.jwt.added':
      case 'instance.idp.azure.added':
      case 'instance.idp.google.added':
      case 'instance.idp.apple.added':
      // Organization-level IDP events
      case 'org.idp.added':
      case 'org.idp.oidc.added':
      case 'org.idp.oauth.added':
      case 'org.idp.ldap.added':
      case 'org.idp.saml.added':
      case 'org.idp.jwt.added':
      case 'org.idp.azure.added':
      case 'org.idp.google.added':
      case 'org.idp.apple.added':
        await this.handleIDPAdded(event);
        break;

      case 'idp.changed':
      case 'idp.config.changed':
      case 'idp.oidc.changed':
      case 'idp.oauth.changed':
      case 'idp.ldap.changed':
      case 'idp.saml.changed':
      case 'idp.jwt.changed':
      case 'idp.azure.changed':
      case 'idp.google.changed':
      case 'idp.apple.changed':
      // Instance-level changes
      case 'instance.idp.changed':
      case 'instance.idp.config.changed':
      case 'instance.idp.oidc.changed':
      case 'instance.idp.oauth.changed':
      case 'instance.idp.ldap.changed':
      case 'instance.idp.saml.changed':
      case 'instance.idp.jwt.changed':
      case 'instance.idp.azure.changed':
      case 'instance.idp.google.changed':
      case 'instance.idp.apple.changed':
      // Organization-level changes
      case 'org.idp.changed':
      case 'org.idp.config.changed':
      case 'org.idp.oidc.changed':
      case 'org.idp.oauth.changed':
      case 'org.idp.ldap.changed':
      case 'org.idp.saml.changed':
      case 'org.idp.jwt.changed':
      case 'org.idp.azure.changed':
      case 'org.idp.google.changed':
      case 'org.idp.apple.changed':
        await this.handleIDPChanged(event);
        break;

      case 'idp.removed':
      case 'instance.idp.removed':
      case 'org.idp.removed':
        await this.handleIDPRemoved(event);
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
   * Handle IDP added events (all types)
   */
  private async handleIDPAdded(event: Event): Promise<void> {
    const payload = event.payload || {};

    // Determine IDP type from event
    let type = 0; // UNSPECIFIED
    if (event.eventType.includes('oidc')) type = 1;
    else if (event.eventType.includes('oauth')) type = 2;
    else if (event.eventType.includes('ldap')) type = 3;
    else if (event.eventType.includes('saml')) type = 4;
    else if (event.eventType.includes('jwt')) type = 5;
    else if (event.eventType.includes('azure')) type = 6;
    else if (event.eventType.includes('google')) type = 7;
    else if (event.eventType.includes('apple')) type = 8;

    // Determine IDP ID based on event type
    // - For old instance-level IDPs (idp.*): aggregateID IS the IDP ID
    // - For new instance-level IDPs (instance.idp.*): IDP ID is in payload
    // - For org-level IDPs (org.idp.*): aggregateID is org ID, IDP ID is in payload
    const isOrgLevel = event.eventType.startsWith('org.');
    const isNewInstanceLevel = event.eventType.startsWith('instance.idp.');
    const idpID = (isOrgLevel || isNewInstanceLevel) ? (payload.id || payload.idpID) : event.aggregateID;

    await this.query(
      `INSERT INTO projections.idps (
        id, instance_id, creation_date, change_date, sequence, resource_owner,
        name, type, state, styling_type, is_creation_allowed, is_linking_allowed,
        is_auto_creation, is_auto_update, config_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence`,
      [
        idpID,
        event.instanceID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.owner,
        payload.name || 'Unnamed IDP',
        type,
        1, // ACTIVE
        payload.stylingType || 0,
        payload.isCreationAllowed !== false,
        payload.isLinkingAllowed !== false,
        payload.isAutoCreation || false,
        payload.isAutoUpdate || false,
        JSON.stringify(payload),
      ]
    );
  }

  /**
   * Handle IDP changed events
   */
  private async handleIDPChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
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
    updates.push(`config_data = $${paramIndex++}`);
    values.push(JSON.stringify(payload));

    updates.push(`change_date = $${paramIndex++}`);
    values.push(event.createdAt);

    updates.push(`sequence = $${paramIndex++}`);
    values.push(Number(event.aggregateVersion || 1n));

    // Determine IDP ID based on event type
    const isOrgLevel = event.eventType.startsWith('org.');
    const isNewInstanceLevel = event.eventType.startsWith('instance.idp.');
    const idpID = (isOrgLevel || isNewInstanceLevel) ? (payload.idpID || payload.id) : event.aggregateID;

    values.push(idpID);
    values.push(event.instanceID);

    if (updates.length > 0) {
      await this.query(
        `UPDATE projections.idps
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex++} AND instance_id = $${paramIndex++}`,
        values
      );
    }
  }

  /**
   * Handle IDP removed event
   */
  private async handleIDPRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    // Determine IDP ID based on event type
    const isOrgLevel = event.eventType.startsWith('org.');
    const isNewInstanceLevel = event.eventType.startsWith('instance.idp.');
    const idpID = (isOrgLevel || isNewInstanceLevel) ? (payload.idpID || payload.id) : event.aggregateID;
    
    await this.query(
      `DELETE FROM projections.idps WHERE id = $1 AND instance_id = $2`,
      [idpID, event.instanceID]
    );
  }

  /**
   * Handle instance removed event
   */
  private async handleInstanceRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.idps WHERE instance_id = $1`,
      [event.instanceID]
    );
  }
}

/**
 * Create IDP projection configuration
 */
export function createIDPProjectionConfig() {
  return {
    name: 'idp_projection',
    tables: ['idps'],
    eventTypes: [
      'idp.added',
      'idp.changed',
      'idp.removed',
      'idp.oidc.added',
      'idp.oidc.changed',
      'idp.oauth.added',
      'idp.oauth.changed',
      'idp.ldap.added',
      'idp.ldap.changed',
      'idp.saml.added',
      'idp.saml.changed',
      'idp.jwt.added',
      'idp.jwt.changed',
      'idp.azure.added',
      'idp.azure.changed',
      'idp.google.added',
      'idp.google.changed',
      'idp.apple.added',
      'idp.apple.changed',
      'idp.config.changed',
      'instance.removed',
    ],
    aggregateTypes: ['idp', 'instance'],
    interval: 1000,
    enableLocking: false,
  };
}
