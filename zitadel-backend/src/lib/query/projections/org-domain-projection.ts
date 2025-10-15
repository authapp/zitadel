/**
 * Organization Domain Projection
 * 
 * Materializes organization domain events into read models.
 * Based on Zitadel Go internal/query/projection/org_domain.go
 */

import { Event } from '../../eventstore/types';
import { Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database/pool';
import { Projection } from '../projection/projection';
import { ProjectionConfig } from '../projection/projection-config';

/**
 * Organization Domain Projection - materializes org domain events into read model
 */
export class OrgDomainProjection extends Projection {
  readonly name = 'org_domain_projection';
  readonly tables = ['org_domains_projection'];

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
      case 'org.domain.added':
        await this.handleDomainAdded(event);
        break;
      
      case 'org.domain.verified':
        await this.handleDomainVerified(event);
        break;
      
      case 'org.domain.primary.set':
        await this.handleDomainPrimarySet(event);
        break;
      
      case 'org.domain.removed':
        await this.handleDomainRemoved(event);
        break;
      
      default:
        // Unknown event type, ignore
        break;
    }
  }

  /**
   * Handle org.domain.added event
   */
  private async handleDomainAdded(event: Event): Promise<void> {
    const data = event.payload as any;
    
    if (!data.domain) {
      console.error('Missing domain in org.domain.added event:', event);
      return;
    }
    
    await this.database.query(
      `INSERT INTO org_domains_projection (
        org_id, domain, is_verified, is_primary, validation_type, validation_code,
        created_at, updated_at, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (domain) DO UPDATE SET
        org_id = EXCLUDED.org_id,
        validation_type = EXCLUDED.validation_type,
        validation_code = EXCLUDED.validation_code,
        updated_at = EXCLUDED.updated_at,
        sequence = GREATEST(org_domains_projection.sequence, EXCLUDED.sequence)`,
      [
        event.aggregateID,
        data.domain,
        false,
        false,
        data.validationType || 'dns',
        data.validationCode || null,
        event.createdAt,
        event.createdAt,
        event.aggregateVersion,
      ]
    );
  }

  /**
   * Handle org.domain.verified event
   */
  private async handleDomainVerified(event: Event): Promise<void> {
    const data = event.payload as any;
    
    if (!data.domain) {
      console.error('Missing domain in org.domain.verified event:', event);
      return;
    }
    
    await this.database.query(
      `UPDATE org_domains_projection 
       SET is_verified = $1, updated_at = $2, sequence = $3
       WHERE org_id = $4 AND domain = $5`,
      [true, event.createdAt, event.aggregateVersion, event.aggregateID, data.domain]
    );
  }

  /**
   * Handle org.domain.primary.set event
   */
  private async handleDomainPrimarySet(event: Event): Promise<void> {
    const data = event.payload as any;
    
    if (!data.domain) {
      console.error('Missing domain in org.domain.primary.set event:', event);
      return;
    }
    
    // Unset all other primary domains for this org
    await this.database.query(
      `UPDATE org_domains_projection 
       SET is_primary = FALSE, updated_at = $1
       WHERE org_id = $2 AND is_primary = TRUE`,
      [event.createdAt, event.aggregateID]
    );
    
    // Set new primary domain
    await this.database.query(
      `UPDATE org_domains_projection 
       SET is_primary = TRUE, updated_at = $1, sequence = $2
       WHERE org_id = $3 AND domain = $4`,
      [event.createdAt, event.aggregateVersion, event.aggregateID, data.domain]
    );
    
    // Update org's primary_domain field
    await this.database.query(
      `UPDATE orgs_projection 
       SET primary_domain = $1, updated_at = $2
       WHERE id = $3`,
      [data.domain, event.createdAt, event.aggregateID]
    );
  }

  /**
   * Handle org.domain.removed event
   */
  private async handleDomainRemoved(event: Event): Promise<void> {
    const data = event.payload as any;
    
    if (!data.domain) {
      console.error('Missing domain in org.domain.removed event:', event);
      return;
    }
    
    // Check if this was the primary domain
    const result = await this.database.query(
      `SELECT is_primary FROM org_domains_projection 
       WHERE org_id = $1 AND domain = $2`,
      [event.aggregateID, data.domain]
    );
    
    const wasPrimary = result.rows[0]?.is_primary || false;
    
    // Delete the domain
    await this.database.query(
      `DELETE FROM org_domains_projection 
       WHERE org_id = $1 AND domain = $2`,
      [event.aggregateID, data.domain]
    );
    
    // If this was primary, clear org's primary_domain
    if (wasPrimary) {
      await this.database.query(
        `UPDATE orgs_projection 
         SET primary_domain = NULL, updated_at = $1
         WHERE id = $2`,
        [event.createdAt, event.aggregateID]
      );
    }
  }
}

/**
 * Create org domain projection instance
 */
export function createOrgDomainProjection(
  eventstore: Eventstore,
  database: DatabasePool
): OrgDomainProjection {
  return new OrgDomainProjection(eventstore, database);
}

/**
 * Create org domain projection configuration
 */
export function createOrgDomainProjectionConfig(): ProjectionConfig {
  return {
    name: 'org_domain_projection',
    tables: ['org_domains_projection'],
    eventTypes: [
      'org.domain.added',
      'org.domain.verified',
      'org.domain.primary.set',
      'org.domain.removed',
    ],
    aggregateTypes: ['org'],
    batchSize: 100,
    interval: 1000,
    enableLocking: false,
  };
}
