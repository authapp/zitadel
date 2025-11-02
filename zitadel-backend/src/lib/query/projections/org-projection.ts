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
  readonly tables = ['projections.orgs'];

  /**
   * Initialize the projection
   * Tables are already created by migrations, so this is a no-op
   */
  async init(): Promise<void> {
    // Table already exists from migrations
    // No additional setup needed
  }
  
  /**
   * Get event types handled by this projection
   * Required for real-time event subscription
   */
  getEventTypes(): string[] {
    return [
      'org.added',
      'org.changed',
      'org.created',
      'org.deactivated',
      'org.deleted',
      'org.domain.primary.set',
      'org.reactivated',
      'org.removed',
      'org.updated',
    ];
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
      `INSERT INTO projections.orgs (
        id, instance_id, name, state, resource_owner, created_at, updated_at, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        name = EXCLUDED.name,
        state = EXCLUDED.state,
        updated_at = EXCLUDED.updated_at,
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence`,
      [
        event.aggregateID,
        event.instanceID || 'default',
        data.name || 'Unnamed Organization',
        'active',
        event.owner || event.aggregateID, // resource_owner is usually the org itself
        event.createdAt,
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
      
      updates.push(`change_date = $${paramIndex++}`);
      values.push(event.createdAt);
      
      updates.push(`sequence = $${paramIndex++}`);
      values.push(event.aggregateVersion);
      
      values.push(event.instanceID || 'default');
      values.push(event.aggregateID);
      
      await this.database.query(
        `UPDATE projections.orgs SET ${updates.join(', ')} WHERE instance_id = $${paramIndex++} AND id = $${paramIndex}`,
        values
      );
    }
  }

  /**
   * Handle org.deactivated event
   */
  private async handleOrgDeactivated(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.orgs 
       SET state = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      ['inactive', event.createdAt, event.createdAt, event.aggregateVersion, event.instanceID || 'default', event.aggregateID]
    );
  }

  /**
   * Handle org.reactivated event
   */
  private async handleOrgReactivated(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.orgs 
       SET state = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      ['active', event.createdAt, event.createdAt, event.aggregateVersion, event.instanceID || 'default', event.aggregateID]
    );
  }

  /**
   * Handle org.removed event
   */
  private async handleOrgRemoved(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.orgs 
       SET state = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      ['removed', event.createdAt, event.createdAt, event.aggregateVersion, event.instanceID || 'default', event.aggregateID]
    );
  }

  /**
   * Handle org.domain.primary.set event
   * Updates the primary_domain field in the org
   */
  private async handleOrgDomainPrimarySet(event: Event): Promise<void> {
    const data = event.payload as any;
    
    await this.database.query(
      `UPDATE projections.orgs
       SET primary_domain = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      [data.domain || null, event.createdAt, event.createdAt, event.aggregateVersion, event.instanceID || 'default', event.aggregateID]
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
    tables: ['projections.orgs'],
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
