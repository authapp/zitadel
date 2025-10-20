/**
 * IDP Login Policy Link Projection - materializes IDP login policy link events
 * Manages which IDPs are enabled for org/instance login policies
 */

import { Projection } from '../projection/projection';
import { Event } from '../../eventstore/types';

export class IDPLoginPolicyLinkProjection extends Projection {
  readonly name = 'idp_login_policy_link_projection';
  readonly tables = ['idp_login_policy_links'];

  async init(): Promise<void> {
    // Create idp_login_policy_links table
    await this.query(
      `CREATE TABLE IF NOT EXISTS projections.idp_login_policy_links (
        idp_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        resource_owner TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        owner_type TEXT NOT NULL,
        PRIMARY KEY (instance_id, resource_owner, idp_id)
      )`,
      []
    );

    // Create indexes
    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_idp_login_policy_links_idp_id 
       ON projections.idp_login_policy_links(idp_id, instance_id)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_idp_login_policy_links_owner 
       ON projections.idp_login_policy_links(resource_owner, instance_id)`,
      []
    );
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'org.idp.config.added':
      case 'org.login.policy.idp.added':
        await this.handleOrgLinkAdded(event);
        break;

      case 'org.idp.config.removed':
      case 'org.login.policy.idp.removed':
        await this.handleOrgLinkRemoved(event);
        break;

      case 'instance.idp.config.added':
      case 'instance.login.policy.idp.added':
        await this.handleInstanceLinkAdded(event);
        break;

      case 'instance.idp.config.removed':
      case 'instance.login.policy.idp.removed':
        await this.handleInstanceLinkRemoved(event);
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

  /**
   * Handle org IDP link added event
   */
  private async handleOrgLinkAdded(event: Event): Promise<void> {
    const payload = event.payload || {};

    if (!payload.idpID && !payload.idpConfigID) {
      console.error('Missing IDP ID in org.idp.config.added event:', event);
      return;
    }

    const idpID = payload.idpID || payload.idpConfigID;

    await this.query(
      `INSERT INTO projections.idp_login_policy_links (
        idp_id, instance_id, resource_owner, creation_date, change_date, sequence, owner_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (instance_id, resource_owner, idp_id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence`,
      [
        idpID,
        event.instanceID,
        event.aggregateID, // Org ID
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
        'org',
      ]
    );
  }

  /**
   * Handle org IDP link removed event
   */
  private async handleOrgLinkRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};

    if (!payload.idpID && !payload.idpConfigID) {
      console.error('Missing IDP ID in org.idp.config.removed event:', event);
      return;
    }

    const idpID = payload.idpID || payload.idpConfigID;

    await this.query(
      `DELETE FROM projections.idp_login_policy_links 
       WHERE idp_id = $1 AND resource_owner = $2 AND instance_id = $3`,
      [idpID, event.aggregateID, event.instanceID]
    );
  }

  /**
   * Handle instance IDP link added event
   */
  private async handleInstanceLinkAdded(event: Event): Promise<void> {
    const payload = event.payload || {};

    if (!payload.idpID && !payload.idpConfigID) {
      console.error('Missing IDP ID in instance.idp.config.added event:', event);
      return;
    }

    const idpID = payload.idpID || payload.idpConfigID;

    await this.query(
      `INSERT INTO projections.idp_login_policy_links (
        idp_id, instance_id, resource_owner, creation_date, change_date, sequence, owner_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (instance_id, resource_owner, idp_id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence`,
      [
        idpID,
        event.instanceID,
        event.instanceID, // Instance is the resource owner
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
        'instance',
      ]
    );
  }

  /**
   * Handle instance IDP link removed event
   */
  private async handleInstanceLinkRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};

    if (!payload.idpID && !payload.idpConfigID) {
      console.error('Missing IDP ID in instance.idp.config.removed event:', event);
      return;
    }

    const idpID = payload.idpID || payload.idpConfigID;

    await this.query(
      `DELETE FROM projections.idp_login_policy_links 
       WHERE idp_id = $1 AND resource_owner = $2 AND instance_id = $3`,
      [idpID, event.instanceID, event.instanceID]
    );
  }

  /**
   * Handle org removed event
   */
  private async handleOrgRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.idp_login_policy_links 
       WHERE resource_owner = $1 AND instance_id = $2 AND owner_type = 'org'`,
      [event.aggregateID, event.instanceID]
    );
  }

  /**
   * Handle instance removed event
   */
  private async handleInstanceRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.idp_login_policy_links WHERE instance_id = $1`,
      [event.instanceID]
    );
  }
}

/**
 * Create IDP login policy link projection configuration
 */
export function createIDPLoginPolicyLinkProjectionConfig() {
  return {
    name: 'idp_login_policy_link_projection',
    tables: ['idp_login_policy_links'],
    eventTypes: [
      'org.idp.config.added',
      'org.idp.config.removed',
      'org.login.policy.idp.added',
      'org.login.policy.idp.removed',
      'instance.idp.config.added',
      'instance.idp.config.removed',
      'instance.login.policy.idp.added',
      'instance.login.policy.idp.removed',
      'org.removed',
      'instance.removed',
    ],
    aggregateTypes: ['org', 'instance'],
    interval: 1000,
    enableLocking: false,
  };
}
