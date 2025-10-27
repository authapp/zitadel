/**
 * Project Role Projection
 * 
 * Materializes project role events into read models
 */

import { Event } from '../../eventstore/types';
import { Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database/pool';
import { Projection } from '../projection/projection';
import { ProjectionConfig } from '../projection/projection-config';

/**
 * Project Role Projection - materializes project role events into read model
 */
export class ProjectRoleProjection extends Projection {
  readonly name = 'project_role_projection';
  readonly tables = ['projections.project_roles'];

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
      case 'project.role.added':
      case 'project.role.created': // Backward compatibility
        await this.handleRoleAdded(event);
        break;
      case 'project.role.changed':
      case 'project.role.updated': // Backward compatibility
        await this.handleRoleChanged(event);
        break;
      case 'project.role.removed':
      case 'project.role.deleted': // Backward compatibility
        await this.handleRoleRemoved(event);
        break;
      default:
        // Unknown event type, ignore
        break;
    }
  }

  /**
   * Handle project.role.added event
   */
  private async handleRoleAdded(event: Event): Promise<void> {
    const data = event.payload as any;
    
    if (!data.roleKey) {
      console.error('Missing roleKey in project.role.added event:', event);
      return;
    }

    await this.database.query(
      `INSERT INTO projections.project_roles (
        instance_id, project_id, role_key, display_name, role_group,
        created_at, updated_at, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (instance_id, project_id, role_key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        role_group = EXCLUDED.role_group,
        updated_at = EXCLUDED.updated_at,
        change_date = EXCLUDED.change_date,
        sequence = GREATEST(projections.project_roles.sequence, EXCLUDED.sequence)`,
      [
        event.instanceID,
        event.aggregateID,
        data.roleKey,
        data.displayName || data.roleKey,
        data.group || null,
        event.createdAt,
        event.createdAt,
        event.createdAt,
        event.aggregateVersion,
      ]
    );
  }

  /**
   * Handle project.role.changed event
   */
  private async handleRoleChanged(event: Event): Promise<void> {
    const data = event.payload as any;
    
    if (!data.roleKey) {
      console.error('Missing roleKey in project.role.changed event:', event);
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.displayName !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      values.push(data.displayName);
    }
    if (data.group !== undefined) {
      updates.push(`role_group = $${paramIndex++}`);
      values.push(data.group);
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
    values.push(event.instanceID);
    values.push(event.aggregateID);
    values.push(data.roleKey);

    await this.database.query(
      `UPDATE projections.project_roles 
       SET ${updates.join(', ')}
       WHERE instance_id = $${paramIndex} AND project_id = $${paramIndex + 1} AND role_key = $${paramIndex + 2}`,
      values
    );
  }

  /**
   * Handle project.role.removed event
   */
  private async handleRoleRemoved(event: Event): Promise<void> {
    const data = event.payload as any;
    
    if (!data.roleKey) {
      console.error('Missing roleKey in project.role.removed event:', event);
      return;
    }

    await this.database.query(
      `DELETE FROM projections.project_roles 
       WHERE instance_id = $1 AND project_id = $2 AND role_key = $3`,
      [event.instanceID, event.aggregateID, data.roleKey]
    );
  }
}

/**
 * Create project role projection instance
 */
export function createProjectRoleProjection(
  eventstore: Eventstore,
  database: DatabasePool
): ProjectRoleProjection {
  return new ProjectRoleProjection(eventstore, database);
}

/**
 * Create project role projection configuration
 */
export function createProjectRoleProjectionConfig(): ProjectionConfig {
  return {
    name: 'project_role_projection',
    tables: ['projections.project_roles'],
    eventTypes: [
      'project.role.added',
      'project.role.created',
      'project.role.changed',
      'project.role.updated',
      'project.role.removed',
      'project.role.deleted',
    ],
    aggregateTypes: ['project'],
    batchSize: 100,
    interval: 1000,
    enableLocking: false,
  };
}
