/**
 * IDP User Link Projection - materializes user-IDP link events
 * Manages connections between users and external IDPs
 */

import { Projection } from '../projection/projection';
import { Event } from '../../eventstore/types';

export class IDPUserLinkProjection extends Projection {
  readonly name = 'idp_user_link_projection';
  readonly tables = ['idp_user_links'];

  async init(): Promise<void> {
    // Create idp_user_links table
    await this.query(
      `CREATE TABLE IF NOT EXISTS projections.idp_user_links (
        idp_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        idp_name TEXT NOT NULL,
        provided_user_id TEXT NOT NULL,
        provided_user_name TEXT NOT NULL,
        PRIMARY KEY (instance_id, user_id, idp_id)
      )`,
      []
    );

    // Create indexes
    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_idp_user_links_user_id 
       ON projections.idp_user_links(user_id, instance_id)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_idp_user_links_idp_id 
       ON projections.idp_user_links(idp_id, instance_id)`,
      []
    );
  }
  
  /**
   * Get event types handled by this projection
   * Required for real-time event subscription
   */
  getEventTypes(): string[] {
    return [
      'instance.removed',
      'user.deleted',
      'user.idp.external.added',
      'user.idp.external.removed',
      'user.idp.link.added',
      'user.idp.link.cascade.removed',
      'user.idp.link.removed',
      'user.removed',
    ];
  }


  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'user.idp.link.added':
      case 'user.idp.external.added':
        await this.handleLinkAdded(event);
        break;

      case 'user.idp.link.removed':
      case 'user.idp.external.removed':
        await this.handleLinkRemoved(event);
        break;

      case 'user.idp.link.cascade.removed':
        await this.handleLinkCascadeRemoved(event);
        break;

      case 'user.removed':
      case 'user.deleted':
        await this.handleUserRemoved(event);
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
   * Handle link added event
   */
  private async handleLinkAdded(event: Event): Promise<void> {
    const payload = event.payload || {};

    if (!payload.idpID || !payload.providedUserID) {
      console.error('Missing required fields in user.idp.link.added event:', event);
      return;
    }

    await this.query(
      `INSERT INTO projections.idp_user_links (
        idp_id, user_id, instance_id, creation_date, change_date, sequence,
        resource_owner, idp_name, provided_user_id, provided_user_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (instance_id, user_id, idp_id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        provided_user_id = EXCLUDED.provided_user_id,
        provided_user_name = EXCLUDED.provided_user_name`,
      [
        payload.idpID,
        event.aggregateID, // User ID
        event.instanceID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.owner,
        payload.idpName || payload.idpID,
        payload.providedUserID,
        payload.providedUserName || payload.providedUserID,
      ]
    );
  }

  /**
   * Handle link removed event
   */
  private async handleLinkRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};

    if (!payload.idpID) {
      console.error('Missing idpID in user.idp.link.removed event:', event);
      return;
    }

    await this.query(
      `DELETE FROM projections.idp_user_links 
       WHERE user_id = $1 AND idp_id = $2 AND instance_id = $3`,
      [event.aggregateID, payload.idpID, event.instanceID]
    );
  }

  /**
   * Handle cascade removed event (removes all links for an IDP)
   */
  private async handleLinkCascadeRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};

    if (!payload.idpID) {
      console.error('Missing idpID in user.idp.link.cascade.removed event:', event);
      return;
    }

    await this.query(
      `DELETE FROM projections.idp_user_links 
       WHERE idp_id = $1 AND instance_id = $2`,
      [payload.idpID, event.instanceID]
    );
  }

  /**
   * Handle user removed event
   */
  private async handleUserRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.idp_user_links 
       WHERE user_id = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );
  }

  /**
   * Handle instance removed event
   */
  private async handleInstanceRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.idp_user_links WHERE instance_id = $1`,
      [event.instanceID]
    );
  }
}

/**
 * Create IDP user link projection configuration
 */
export function createIDPUserLinkProjectionConfig() {
  return {
    name: 'idp_user_link_projection',
    tables: ['idp_user_links'],
    eventTypes: [
      'user.idp.link.added',
      'user.idp.link.removed',
      'user.idp.link.cascade.removed',
      'user.idp.external.added',
      'user.idp.external.removed',
      'user.removed',
      'user.deleted',
      'instance.removed',
    ],
    aggregateTypes: ['user', 'instance'],
    interval: 1000,
    enableLocking: false,
  };
}
