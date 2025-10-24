/**
 * Instance domain projection for Zitadel query layer
 * Projects instance domain events into instance_domains_projection and instance_trusted_domains_projection
 */

import { Projection } from '../projection/projection';
import { ProjectionConfig } from '../projection/projection-config';
import { Event } from '../../eventstore/types';

export class InstanceDomainProjection extends Projection {
  readonly name = 'instance_domain_projection';
  readonly tables = ['instance_domains_projection', 'instance_trusted_domains_projection'];

  async init(): Promise<void> {
    // Tables created by migration, nothing to do
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'instance.domain.added':
        await this.handleInstanceDomainAdded(event);
        break;
      
      case 'instance.domain.removed':
        await this.handleInstanceDomainRemoved(event);
        break;
      
      case 'instance.domain.default.set':
      case 'instance.domain.primary.set':
        await this.handleInstanceDomainPrimarySet(event);
        break;
      
      case 'instance.trusted_domain.added':
        await this.handleInstanceTrustedDomainAdded(event);
        break;
      
      case 'instance.trusted_domain.removed':
        await this.handleInstanceTrustedDomainRemoved(event);
        break;
    }
  }

  private async handleInstanceDomainAdded(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `INSERT INTO instance_domains_projection (
        instance_id, domain, is_primary, is_generated,
        created_at, updated_at, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (instance_id, domain) DO UPDATE SET
        is_primary = EXCLUDED.is_primary,
        is_generated = EXCLUDED.is_generated,
        updated_at = EXCLUDED.updated_at,
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence`,
      [
        event.instanceID,
        payload.domain,
        payload.isPrimary || false,
        payload.isGenerated || false,
        event.createdAt,
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleInstanceDomainRemoved(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `DELETE FROM instance_domains_projection
      WHERE instance_id = $1 AND domain = $2`,
      [
        event.instanceID,
        payload.domain,
      ]
    );
  }

  private async handleInstanceDomainPrimarySet(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    // First, unset any existing primary domain for this instance
    await this.database.query(
      `UPDATE instance_domains_projection SET
        is_primary = false,
        updated_at = $2,
        change_date = $3,
        sequence = $4
      WHERE instance_id = $1 AND is_primary = true`,
      [
        event.instanceID,
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
    
    // Then set the new primary domain
    await this.database.query(
      `UPDATE instance_domains_projection SET
        is_primary = true,
        updated_at = $3,
        change_date = $4,
        sequence = $5
      WHERE instance_id = $1 AND domain = $2`,
      [
        event.instanceID,
        payload.domain,
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleInstanceTrustedDomainAdded(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `INSERT INTO instance_trusted_domains_projection (
        instance_id, domain, created_at, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (instance_id, domain) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence`,
      [
        event.instanceID,
        payload.domain,
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleInstanceTrustedDomainRemoved(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `DELETE FROM instance_trusted_domains_projection
      WHERE instance_id = $1 AND domain = $2`,
      [
        event.instanceID,
        payload.domain,
      ]
    );
  }
}

/**
 * Create instance domain projection configuration
 */
export function createInstanceDomainProjectionConfig(): ProjectionConfig {
  return {
    name: 'instance_domain_projection',
    tables: ['instance_domains_projection', 'instance_trusted_domains_projection'],
    eventTypes: [
      'instance.domain.added',
      'instance.domain.removed',
      'instance.domain.primary.set',
      'instance.trusted_domain.added',
      'instance.trusted_domain.removed',
    ],
    aggregateTypes: ['instance'],
    batchSize: 100,
    interval: 1000,
    enableLocking: false,
  };
}
