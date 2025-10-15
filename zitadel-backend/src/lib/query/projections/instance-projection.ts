/**
 * Instance projection for Zitadel query layer
 * Projects instance-related events into the instances_projection table
 */

import { Projection } from '../projection/projection';
import { ProjectionConfig } from '../projection/projection-config';
import { Event } from '../../eventstore/types';

export class InstanceProjection extends Projection {
  readonly name = 'instance_projection';
  readonly tables = ['instances_projection'];

  async init(): Promise<void> {
    // Tables created by migration, nothing to do
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'instance.added':
        await this.handleInstanceAdded(event);
        break;
      
      case 'instance.changed':
        await this.handleInstanceChanged(event);
        break;
      
      case 'instance.removed':
        await this.handleInstanceRemoved(event);
        break;
      
      case 'instance.features.set':
        await this.handleInstanceFeaturesSet(event);
        break;
      
      case 'instance.features.reset':
        await this.handleInstanceFeaturesReset(event);
        break;
    }
  }

  private async handleInstanceAdded(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `INSERT INTO instances_projection (
        id, name, default_org_id, default_language, state, features,
        created_at, updated_at, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        default_org_id = EXCLUDED.default_org_id,
        default_language = EXCLUDED.default_language,
        state = EXCLUDED.state,
        features = EXCLUDED.features,
        updated_at = EXCLUDED.updated_at,
        sequence = EXCLUDED.sequence`,
      [
        payload.instanceId || event.aggregateID,
        payload.name,
        payload.defaultOrgId || null,
        payload.defaultLanguage || 'en',
        'active',
        JSON.stringify(payload.features || {}),
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleInstanceChanged(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `UPDATE instances_projection SET
        name = COALESCE($2, name),
        default_org_id = COALESCE($3, default_org_id),
        default_language = COALESCE($4, default_language),
        updated_at = $5,
        sequence = $6
      WHERE id = $1`,
      [
        payload.instanceId || event.aggregateID,
        payload.name,
        payload.defaultOrgId,
        payload.defaultLanguage,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleInstanceRemoved(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `UPDATE instances_projection SET
        state = 'removed',
        updated_at = $2,
        sequence = $3
      WHERE id = $1`,
      [
        payload.instanceId || event.aggregateID,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleInstanceFeaturesSet(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `UPDATE instances_projection SET
        features = $2,
        updated_at = $3,
        sequence = $4
      WHERE id = $1`,
      [
        payload.instanceId || event.aggregateID,
        JSON.stringify(payload.features || {}),
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleInstanceFeaturesReset(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `UPDATE instances_projection SET
        features = $2,
        updated_at = $3,
        sequence = $4
      WHERE id = $1`,
      [
        payload.instanceId || event.aggregateID,
        JSON.stringify({}),
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }
}

/**
 * Create instance projection configuration
 */
export function createInstanceProjectionConfig(): ProjectionConfig {
  return {
    name: 'instance_projection',
    tables: ['instances_projection'],
    eventTypes: [
      'instance.added',
      'instance.changed',
      'instance.removed',
      'instance.features.set',
      'instance.features.reset',
    ],
    aggregateTypes: ['instance'],
    batchSize: 100,
    interval: 1000,
    enableLocking: false,
  };
}
