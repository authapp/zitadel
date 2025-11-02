/**
 * Project Projection
 * 
 * Materializes project lifecycle events into read models
 */

import { Event } from '../../eventstore/types';
import { Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database/pool';
import { Projection } from '../projection/projection';
import { ProjectionConfig } from '../projection/projection-config';

/**
 * Project Projection - materializes project events into read model
 */
export class ProjectProjection extends Projection {
  readonly name = 'project_projection';
  readonly tables = ['projections.projects'];

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
      'project.added',
      'project.changed',
      'project.created',
      'project.deactivated',
      'project.deleted',
      'project.reactivated',
      'project.removed',
      'project.updated',
    ];
  }


  /**
   * Reduce a single event into the projection
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'project.added':
      case 'project.created': // Backward compatibility
        await this.handleProjectAdded(event);
        break;
      case 'project.changed':
      case 'project.updated': // Backward compatibility
        await this.handleProjectChanged(event);
        break;
      case 'project.deactivated':
        await this.handleProjectDeactivated(event);
        break;
      case 'project.reactivated':
        await this.handleProjectReactivated(event);
        break;
      case 'project.removed':
      case 'project.deleted': // Backward compatibility
        await this.handleProjectRemoved(event);
        break;
      default:
        // Unknown event type, ignore
        break;
    }
  }

  /**
   * Handle project.added event
   */
  private async handleProjectAdded(event: Event): Promise<void> {
    const data = event.payload as any;
    
    if (!data.name) {
      console.error('Missing name in project.added event:', event);
      return;
    }

    await this.database.query(
      `INSERT INTO projections.projects (
        id, instance_id, name, resource_owner, state, 
        project_role_assertion, project_role_check, has_project_check,
        private_labeling_setting,
        created_at, updated_at, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        name = EXCLUDED.name,
        resource_owner = EXCLUDED.resource_owner,
        project_role_assertion = EXCLUDED.project_role_assertion,
        project_role_check = EXCLUDED.project_role_check,
        has_project_check = EXCLUDED.has_project_check,
        private_labeling_setting = EXCLUDED.private_labeling_setting,
        updated_at = EXCLUDED.updated_at,
        change_date = EXCLUDED.change_date,
        sequence = GREATEST(projections.projects.sequence, EXCLUDED.sequence)`,
      [
        event.aggregateID,
        event.instanceID || 'default',
        data.name,
        event.owner,
        'active',
        data.projectRoleAssertion || false,
        data.projectRoleCheck || false,
        data.hasProjectCheck || false,
        data.privateLabelingSetting || 'unspecified',
        event.createdAt,
        event.createdAt,
        event.createdAt,
        event.aggregateVersion,
      ]
    );
  }

  /**
   * Handle project.changed event
   */
  private async handleProjectChanged(event: Event): Promise<void> {
    const data = event.payload as any;
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.projectRoleAssertion !== undefined) {
      updates.push(`project_role_assertion = $${paramIndex++}`);
      values.push(data.projectRoleAssertion);
    }
    if (data.projectRoleCheck !== undefined) {
      updates.push(`project_role_check = $${paramIndex++}`);
      values.push(data.projectRoleCheck);
    }
    if (data.hasProjectCheck !== undefined) {
      updates.push(`has_project_check = $${paramIndex++}`);
      values.push(data.hasProjectCheck);
    }
    if (data.privateLabelingSetting !== undefined) {
      updates.push(`private_labeling_setting = $${paramIndex++}`);
      values.push(data.privateLabelingSetting);
    }

    if (updates.length === 0) {
      return;
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(event.createdAt);
    updates.push(`change_date = $${paramIndex++}`);
    values.push(event.createdAt);
    updates.push(`sequence = $${paramIndex++}`);
    values.push(event.aggregateVersion);
    values.push(event.instanceID || 'default');
    values.push(event.aggregateID);

    await this.database.query(
      `UPDATE projections.projects 
       SET ${updates.join(', ')}
       WHERE instance_id = $${paramIndex++} AND id = $${paramIndex}`,
      values
    );
  }

  /**
   * Handle project.deactivated event
   */
  private async handleProjectDeactivated(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.projects 
       SET state = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      ['inactive', event.createdAt, event.createdAt, event.aggregateVersion, event.instanceID || 'default', event.aggregateID]
    );
  }

  /**
   * Handle project.reactivated event
   */
  private async handleProjectReactivated(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.projects 
       SET state = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      ['active', event.createdAt, event.createdAt, event.aggregateVersion, event.instanceID || 'default', event.aggregateID]
    );
  }

  /**
   * Handle project.removed event
   */
  private async handleProjectRemoved(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.projects 
       SET state = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      ['removed', event.createdAt, event.createdAt, event.aggregateVersion, event.instanceID || 'default', event.aggregateID]
    );
  }
}

/**
 * Create project projection instance
 */
export function createProjectProjection(
  eventstore: Eventstore,
  database: DatabasePool
): ProjectProjection {
  return new ProjectProjection(eventstore, database);
}

/**
 * Create project projection configuration
 */
export function createProjectProjectionConfig(): ProjectionConfig {
  return {
    name: 'project_projection',
    tables: ['projections.projects'],
    eventTypes: [
      'project.added',
      'project.created',
      'project.changed',
      'project.updated',
      'project.deactivated',
      'project.reactivated',
      'project.removed',
      'project.deleted',
    ],
    aggregateTypes: ['project'],
    batchSize: 100,
    interval: 1000,
    enableLocking: false,
  };
}
