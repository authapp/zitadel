/**
 * Organization Projection
 * 
 * Materializes organization events into read models.
 * Based on Zitadel Go internal/query/projection/org.go
 */

import { Event } from '../../eventstore/types';
import { Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database/pool';
import { Projection } from '../projection/projection';
import { ProjectionConfig } from '../projection/projection-config';

/**
 * Organization Projection - materializes org events into read model
 */
export class OrgProjection extends Projection {
  readonly name = 'org_projection';
  readonly tables = ['orgs_projection'];

  /**
   * Initialize the projection
   * Tables are already created by migrations, so this is a no-op
   */
  async init(): Promise<void> {
    // Table already exists from migrations
    // No additional setup needed
  }

  /**
   * Reduce a single event into the projection
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'org.added':
      case 'org.created':  // Old event type
        await this.handleOrgAdded(event);
        break;
      
      case 'org.changed':
      case 'org.updated':  // Old event type
        await this.handleOrgChanged(event);
        break;
      
      case 'org.deactivated':
        await this.handleOrgDeactivated(event);
        break;
      
      case 'org.reactivated':
        await this.handleOrgReactivated(event);
        break;
      
      case 'org.removed':
      case 'org.deleted':  // Old event type
        await this.handleOrgRemoved(event);
        break;
      
      case 'org.domain.primary.set':
        await this.handleOrgDomainPrimarySet(event);
        break;
      
      default:
        // Unknown event type, ignore
        break;
    }
  }

  /**
   * Handle org.added event
   */
  private async handleOrgAdded(event: Event): Promise<void> {
    const data = event.payload as any;
    
    await this.database.query(
      `INSERT INTO orgs_projection (
        id, name, state, created_at, updated_at, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING`,
      [
        event.aggregateID,
        data.name || 'Unnamed Organization',
        'active',
        event.createdAt,
        event.createdAt,
        event.aggregateVersion,
      ]
    );
  }

  /**
   * Handle org.changed event
   */
  private async handleOrgChanged(event: Event): Promise<void> {
    const data = event.payload as any;
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (data.name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    
    if (updates.length > 0) {
      updates.push(`updated_at = $${paramIndex++}`);
      values.push(event.createdAt);
      
      updates.push(`sequence = $${paramIndex++}`);
      values.push(event.aggregateVersion);
      
      values.push(event.aggregateID);
      
      await this.database.query(
        `UPDATE orgs_projection SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }
  }

  /**
   * Handle org.deactivated event
   */
  private async handleOrgDeactivated(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE orgs_projection 
       SET state = $1, updated_at = $2, sequence = $3
       WHERE id = $4`,
      ['inactive', event.createdAt, event.aggregateVersion, event.aggregateID]
    );
  }

  /**
   * Handle org.reactivated event
   */
  private async handleOrgReactivated(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE orgs_projection 
       SET state = $1, updated_at = $2, sequence = $3
       WHERE id = $4`,
      ['active', event.createdAt, event.aggregateVersion, event.aggregateID]
    );
  }

  /**
   * Handle org.removed event
   */
  private async handleOrgRemoved(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE orgs_projection 
       SET state = $1, updated_at = $2, sequence = $3
       WHERE id = $4`,
      ['removed', event.createdAt, event.aggregateVersion, event.aggregateID]
    );
  }

  /**
   * Handle org.domain.primary.set event
   * Updates the primary_domain field in the org
   */
  private async handleOrgDomainPrimarySet(event: Event): Promise<void> {
    const data = event.payload as any;
    
    await this.database.query(
      `UPDATE orgs_projection
       SET primary_domain = $1, updated_at = $2, sequence = $3
       WHERE id = $4`,
      [data.domain || null, event.createdAt, event.aggregateVersion, event.aggregateID]
    );
  }
}

/**
 * Create org projection instance
 */
export function createOrgProjection(
  eventstore: Eventstore,
  database: DatabasePool
): OrgProjection {
  return new OrgProjection(eventstore, database);
}

/**
 * Create org projection configuration
 */
export function createOrgProjectionConfig(): ProjectionConfig {
  return {
    name: 'org_projection',
    tables: ['orgs_projection'],
    eventTypes: [
      'org.added',
      'org.created',  // Old event type
      'org.changed',
      'org.updated',  // Old event type
      'org.deactivated',
      'org.reactivated',
      'org.removed',
      'org.deleted',  // Old event type
      'org.domain.primary.set',  // Update primary domain
    ],
    aggregateTypes: ['org'],
    batchSize: 100,
    interval: 1000,
    enableLocking: false,
  };
}
