/**
 * User Metadata Projection
 * Handles user metadata events (flexible key-value storage)
 * Based on Zitadel Go user metadata management
 */

import { Event } from '../../eventstore/types';
import { Projection } from '../projection/projection';

export class UserMetadataProjection extends Projection {
  readonly name = 'user_metadata_projection';
  readonly tables = ['user_metadata'];

  async init(): Promise<void> {
    // Table created by migration 002_15
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      // User metadata events
      case 'user.metadata.set':
      case 'user.v1.metadata.set':
        await this.handleMetadataSet(event);
        break;
      case 'user.metadata.removed':
      case 'user.v1.metadata.removed':
        await this.handleMetadataRemoved(event);
        break;
      case 'user.metadata.removed.all':
      case 'user.v1.metadata.removed.all':
        await this.handleAllMetadataRemoved(event);
        break;

      // Cleanup events
      case 'user.removed':
      case 'user.v1.removed':
        await this.handleUserRemoved(event);
        break;
      case 'org.removed':
        await this.handleOrgRemoved(event);
        break;
      case 'instance.removed':
        await this.handleInstanceRemoved(event);
        break;
    }
  }

  private async handleMetadataSet(event: Event): Promise<void> {
    const payload = event.payload as any;
    const metadataKey = payload.key || payload.metadataKey;
    const metadataValue = payload.value || payload.metadataValue;
    
    if (!metadataKey) {
      console.warn('Metadata event missing key, skipping:', event);
      return;
    }

    // Generate deterministic ID
    const scope = payload.scope || null;
    const metadataId = scope
      ? `${event.aggregateID}_${metadataKey}_${scope}`
      : `${event.aggregateID}_${metadataKey}`;

    // Convert value to JSON - handle both objects and primitives
    const valueJson = typeof metadataValue === 'object' && metadataValue !== null
      ? JSON.stringify(metadataValue)
      : JSON.stringify(metadataValue);

    await this.database.query(
      `INSERT INTO user_metadata (
        id, user_id, instance_id, metadata_key, metadata_value,
        metadata_type, scope, created_at, updated_at, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        metadata_value = EXCLUDED.metadata_value,
        metadata_type = EXCLUDED.metadata_type,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by`,
      [
        metadataId,
        event.aggregateID,
        event.instanceID,
        metadataKey,
        valueJson,
        payload.metadataType || payload.metadata_type || 'custom',
        scope,
        event.createdAt,
        event.createdAt,
        event.creator,
        event.creator,
      ]
    );
  }

  private async handleMetadataRemoved(event: Event): Promise<void> {
    const payload = event.payload as any;
    const metadataKey = payload.key || payload.metadataKey;
    
    if (!metadataKey) {
      console.warn('Metadata removal event missing key, skipping:', event);
      return;
    }

    const scope = payload.scope || null;
    
    if (scope) {
      // Remove specific scoped metadata
      await this.database.query(
        `DELETE FROM user_metadata 
         WHERE instance_id = $1 AND user_id = $2 AND metadata_key = $3 AND scope = $4`,
        [event.instanceID, event.aggregateID, metadataKey, scope]
      );
    } else {
      // Remove metadata with null scope
      await this.database.query(
        `DELETE FROM user_metadata 
         WHERE instance_id = $1 AND user_id = $2 AND metadata_key = $3 AND scope IS NULL`,
        [event.instanceID, event.aggregateID, metadataKey]
      );
    }
  }

  private async handleAllMetadataRemoved(event: Event): Promise<void> {
    // Remove all metadata for this user
    await this.database.query(
      `DELETE FROM user_metadata 
       WHERE instance_id = $1 AND user_id = $2`,
      [event.instanceID, event.aggregateID]
    );
  }

  private async handleUserRemoved(event: Event): Promise<void> {
    await this.database.query(
      `DELETE FROM user_metadata 
       WHERE instance_id = $1 AND user_id = $2`,
      [event.instanceID, event.aggregateID]
    );
  }

  private async handleOrgRemoved(event: Event): Promise<void> {
    // Remove metadata for all users in this organization
    await this.database.query(
      `DELETE FROM user_metadata 
       WHERE instance_id = $1 AND user_id IN (
         SELECT id FROM users_projection 
         WHERE instance_id = $1 AND resource_owner = $2
       )`,
      [event.instanceID, event.aggregateID]
    );
  }

  private async handleInstanceRemoved(event: Event): Promise<void> {
    // Remove all metadata for this instance
    await this.database.query(
      `DELETE FROM user_metadata WHERE instance_id = $1`,
      [event.instanceID]
    );
  }
}

/**
 * Create projection config
 */
export function createUserMetadataProjectionConfig() {
  return {
    name: 'user_metadata_projection',
    tables: ['user_metadata'],
    eventTypes: [
      'user.metadata.set',
      'user.v1.metadata.set',
      'user.metadata.removed',
      'user.v1.metadata.removed',
      'user.metadata.removed.all',
      'user.v1.metadata.removed.all',
      'user.removed',
      'user.v1.removed',
      'org.removed',
      'instance.removed',
    ],
    interval: 1000,
  };
}
