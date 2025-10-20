/**
 * AuthN Key Projection - materializes machine user authentication key events
 * Handles service account key management for machine-to-machine auth
 */

import { Projection } from '../projection/projection';
import { Event } from '../../eventstore/types';

export class AuthNKeyProjection extends Projection {
  readonly name = 'authn_key_projection';
  readonly tables = ['authn_keys'];

  async init(): Promise<void> {
    // Create authn_keys table if it doesn't exist
    await this.query(
      `CREATE TABLE IF NOT EXISTS projections.authn_keys (
        id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        object_id TEXT NOT NULL,
        expiration TIMESTAMPTZ NOT NULL,
        type INTEGER NOT NULL DEFAULT 0,
        public_key BYTEA NOT NULL,
        PRIMARY KEY (instance_id, id)
      )`,
      []
    );

    // Create indexes for common queries
    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_authn_keys_aggregate_id 
       ON projections.authn_keys(aggregate_id, instance_id)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_authn_keys_object_id 
       ON projections.authn_keys(object_id, instance_id)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_authn_keys_expiration 
       ON projections.authn_keys(expiration) 
       WHERE expiration IS NOT NULL`,
      []
    );
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'user.machine.key.added':
        await this.handleKeyAdded(event);
        break;

      case 'user.machine.key.removed':
        await this.handleKeyRemoved(event);
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
   * Handle user.machine.key.added event
   */
  private async handleKeyAdded(event: Event): Promise<void> {
    const payload = event.payload || {};

    if (!payload.keyID || !payload.publicKey) {
      console.error('Missing required fields in user.machine.key.added event:', event);
      return;
    }

    // Convert base64 or hex public key to buffer if it's a string
    let publicKeyBuffer: Buffer;
    if (typeof payload.publicKey === 'string') {
      // Try base64 first, then hex
      try {
        publicKeyBuffer = Buffer.from(payload.publicKey, 'base64');
      } catch {
        publicKeyBuffer = Buffer.from(payload.publicKey, 'hex');
      }
    } else if (Buffer.isBuffer(payload.publicKey)) {
      publicKeyBuffer = payload.publicKey;
    } else {
      console.error('Invalid public key format in user.machine.key.added event:', event);
      return;
    }

    await this.query(
      `INSERT INTO projections.authn_keys (
        id, instance_id, creation_date, change_date, sequence,
        resource_owner, aggregate_id, object_id, expiration, type, public_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (instance_id, id) 
      DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence`,
      [
        payload.keyID,
        event.instanceID,
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
        event.owner,
        event.aggregateID, // User ID (machine user)
        payload.keyID, // object_id is the key ID
        payload.expiration || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year
        payload.type || 1, // Default to JSON type
        publicKeyBuffer,
      ]
    );
  }

  /**
   * Handle user.machine.key.removed event
   */
  private async handleKeyRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};

    if (!payload.keyID) {
      console.error('Missing keyID in user.machine.key.removed event:', event);
      return;
    }

    await this.query(
      `DELETE FROM projections.authn_keys
       WHERE id = $1 AND instance_id = $2 AND aggregate_id = $3`,
      [payload.keyID, event.instanceID, event.aggregateID]
    );
  }

  /**
   * Handle user.removed event - cleanup all keys for the user
   */
  private async handleUserRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.authn_keys
       WHERE aggregate_id = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );
  }

  /**
   * Handle instance.removed event - cleanup all keys for the instance
   */
  private async handleInstanceRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.authn_keys WHERE instance_id = $1`,
      [event.instanceID]
    );
  }
}

/**
 * Create authn key projection configuration
 */
export function createAuthNKeyProjectionConfig() {
  return {
    name: 'authn_key_projection',
    tables: ['authn_keys'],
    eventTypes: [
      'user.machine.key.added',
      'user.machine.key.removed',
      'user.removed',
      'user.deleted',
      'instance.removed',
    ],
    aggregateTypes: ['user', 'instance'],
    interval: 1000,
    enableLocking: false,
  };
}
