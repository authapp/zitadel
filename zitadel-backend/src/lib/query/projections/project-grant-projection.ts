/**
 * Project Grant Projection
 * Handles project grant events and maintains the project_grants table
 * 
 * ProjectGrant enables cross-organization project sharing, allowing
 * projects from one org to be accessed by users in another org.
 */

import { Event, Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database';
import { Projection } from '../projection/projection';

/**
 * Project Grant Projection
 * Maintains projections.project_grants table
 */
export class ProjectGrantProjection extends Projection {
  readonly name = 'project_grant_projection';
  readonly tables = ['projections.project_grants'];

  /**
   * Initialize projection - table created by migration 002_54
   */
  async init(): Promise<void> {
    // Table created by migration, no initialization needed
  }

  /**
   * Reduce event into projection
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'project.grant.added':
        await this.handleGrantAdded(event);
        break;

      case 'project.grant.changed':
        await this.handleGrantChanged(event);
        break;

      case 'project.grant.deactivated':
        await this.handleGrantDeactivated(event);
        break;

      case 'project.grant.reactivated':
        await this.handleGrantReactivated(event);
        break;

      case 'project.grant.removed':
        await this.handleGrantRemoved(event);
        break;

      case 'project.grant.cascade.removed':
        await this.handleGrantCascadeRemoved(event);
        break;

      case 'project.removed':
        await this.handleProjectRemoved(event);
        break;

      case 'org.removed':
        await this.handleOrgRemoved(event);
        break;
    }
  }

  /**
   * Handle project.grant.added event
   */
  private async handleGrantAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    const params = [
      payload.grantID || payload.id || event.aggregateID,
      event.createdAt,
      event.createdAt,
      Number(event.aggregateVersion || 1n),
      event.owner,
      event.instanceID,
      payload.projectID || event.aggregateID,
      payload.grantedOrgID || payload.grantedOrgId,
      1, // State.ACTIVE
      payload.roleKeys || payload.grantedRoles || [],
    ];
    
    await this.query(
      `INSERT INTO projections.project_grants (
        id, creation_date, change_date, sequence, resource_owner, instance_id,
        project_id, granted_org_id, state, granted_roles
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id, instance_id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        granted_org_id = EXCLUDED.granted_org_id,
        state = EXCLUDED.state,
        granted_roles = EXCLUDED.granted_roles`,
      params
    );
  }

  /**
   * Handle project.grant.changed event
   */
  private async handleGrantChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const grantID = payload.grantID || payload.id;
    
    await this.query(
      `UPDATE projections.project_grants SET
        change_date = $1,
        sequence = $2,
        granted_roles = $3
      WHERE id = $4 AND instance_id = $5`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        payload.roleKeys || payload.grantedRoles || [],
        grantID,
        event.instanceID,
      ]
    );
  }

  /**
   * Handle project.grant.deactivated event
   */
  private async handleGrantDeactivated(event: Event): Promise<void> {
    const payload = event.payload || {};
    const grantID = payload.grantID || payload.id;
    
    await this.query(
      `UPDATE projections.project_grants SET
        change_date = $1,
        sequence = $2,
        state = $3
      WHERE id = $4 AND instance_id = $5`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        2, // State.INACTIVE
        grantID,
        event.instanceID,
      ]
    );
  }

  /**
   * Handle project.grant.reactivated event
   */
  private async handleGrantReactivated(event: Event): Promise<void> {
    const payload = event.payload || {};
    const grantID = payload.grantID || payload.id;
    
    await this.query(
      `UPDATE projections.project_grants SET
        change_date = $1,
        sequence = $2,
        state = $3
      WHERE id = $4 AND instance_id = $5`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        1, // State.ACTIVE
        grantID,
        event.instanceID,
      ]
    );
  }

  /**
   * Handle project.grant.removed event
   */
  private async handleGrantRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    const grantID = payload.grantID || payload.id;
    
    await this.query(
      `DELETE FROM projections.project_grants
      WHERE id = $1 AND instance_id = $2`,
      [grantID, event.instanceID]
    );
  }

  /**
   * Handle project.grant.cascade.removed event
   */
  private async handleGrantCascadeRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    const grantID = payload.grantID || payload.id;
    
    await this.query(
      `DELETE FROM projections.project_grants
      WHERE id = $1 AND instance_id = $2`,
      [grantID, event.instanceID]
    );
  }

  /**
   * Handle project.removed event
   * Cascade delete all grants for the project
   */
  private async handleProjectRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.project_grants
      WHERE project_id = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );
  }

  /**
   * Handle org.removed event
   * Cascade delete all grants where org is the granted organization
   */
  private async handleOrgRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.project_grants
      WHERE granted_org_id = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );
  }
}

/**
 * Create project grant projection instance
 */
export function createProjectGrantProjection(
  eventstore: Eventstore,
  database: DatabasePool
): ProjectGrantProjection {
  return new ProjectGrantProjection(eventstore, database);
}
