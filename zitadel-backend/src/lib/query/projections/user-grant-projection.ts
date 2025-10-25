/**
 * User Grant Projection
 * Handles user grant events and maintains the user_grants table
 * 
 * UserGrant links users to projects with specific role assignments.
 * This is the core authorization mechanism in Zitadel.
 */

import { Event, Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database';
import { Projection } from '../projection/projection';

/**
 * User Grant Projection
 * Maintains projections.user_grants table
 */
export class UserGrantProjection extends Projection {
  readonly name = 'user_grant_projection';
  readonly tables = ['user_grants'];

  /**
   * Initialize projection tables
   */
  async init(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS projections.user_grants (
        id TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        project_grant_id TEXT,
        state SMALLINT NOT NULL DEFAULT 0,
        roles TEXT[] NOT NULL DEFAULT '{}',
        PRIMARY KEY (id, instance_id)
      );

      CREATE INDEX IF NOT EXISTS user_grants_user_id_idx 
        ON projections.user_grants (user_id, instance_id);
      
      CREATE INDEX IF NOT EXISTS user_grants_project_id_idx 
        ON projections.user_grants (project_id, instance_id);
      
      CREATE INDEX IF NOT EXISTS user_grants_project_grant_id_idx 
        ON projections.user_grants (project_grant_id, instance_id) 
        WHERE project_grant_id IS NOT NULL;
      
      CREATE INDEX IF NOT EXISTS user_grants_resource_owner_idx 
        ON projections.user_grants (resource_owner, instance_id);
      
      CREATE INDEX IF NOT EXISTS user_grants_state_idx 
        ON projections.user_grants (state, instance_id);
    `, []);
  }

  /**
   * Reduce event into projection
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'user.grant.added':
        await this.handleGrantAdded(event);
        break;

      case 'user.grant.changed':
        await this.handleGrantChanged(event);
        break;

      case 'user.grant.deactivated':
        await this.handleGrantDeactivated(event);
        break;

      case 'user.grant.reactivated':
        await this.handleGrantReactivated(event);
        break;

      case 'user.grant.removed':
        await this.handleGrantRemoved(event);
        break;

      case 'user.grant.cascade.removed':
        await this.handleGrantCascadeRemoved(event);
        break;

      case 'project.removed':
        await this.handleProjectRemoved(event);
        break;

      case 'user.removed':
        await this.handleUserRemoved(event);
        break;
    }
  }

  /**
   * Handle user.grant.added event
   */
  private async handleGrantAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `INSERT INTO projections.user_grants (
        id, creation_date, change_date, sequence, resource_owner, instance_id,
        user_id, project_id, project_grant_id, state, roles
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id, instance_id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        project_id = EXCLUDED.project_id,
        project_grant_id = EXCLUDED.project_grant_id,
        state = EXCLUDED.state,
        roles = EXCLUDED.roles`,
      [
        payload.userGrantID || payload.grantID || event.aggregateID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.owner,
        event.instanceID,
        payload.userID || event.aggregateID,
        payload.projectID,
        payload.projectGrantID || null,
        1, // State.ACTIVE
        payload.roleKeys || payload.roles || [],
      ]
    );
  }

  /**
   * Handle user.grant.changed event
   */
  private async handleGrantChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const grantID = payload.userGrantID || payload.grantID || payload.id;
    
    await this.query(
      `UPDATE projections.user_grants SET
        change_date = $1,
        sequence = $2,
        roles = $3
      WHERE id = $4 AND instance_id = $5`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        payload.roleKeys || payload.roles || [],
        grantID,
        event.instanceID,
      ]
    );
  }

  /**
   * Handle user.grant.deactivated event
   */
  private async handleGrantDeactivated(event: Event): Promise<void> {
    const payload = event.payload || {};
    const grantID = payload.userGrantID || payload.grantID || payload.id;
    
    await this.query(
      `UPDATE projections.user_grants SET
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
   * Handle user.grant.reactivated event
   */
  private async handleGrantReactivated(event: Event): Promise<void> {
    const payload = event.payload || {};
    const grantID = payload.userGrantID || payload.grantID || payload.id;
    
    await this.query(
      `UPDATE projections.user_grants SET
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
   * Handle user.grant.removed event
   */
  private async handleGrantRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    const grantID = payload.userGrantID || payload.grantID || payload.id;
    
    await this.query(
      `DELETE FROM projections.user_grants
      WHERE id = $1 AND instance_id = $2`,
      [grantID, event.instanceID]
    );
  }

  /**
   * Handle user.grant.cascade.removed event
   */
  private async handleGrantCascadeRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    const grantID = payload.userGrantID || payload.grantID || payload.id;
    
    await this.query(
      `DELETE FROM projections.user_grants
      WHERE id = $1 AND instance_id = $2`,
      [grantID, event.instanceID]
    );
  }

  /**
   * Handle project.removed event
   * Cascade delete all user grants for the project
   */
  private async handleProjectRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.user_grants
      WHERE project_id = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );
  }

  /**
   * Handle user.removed event
   * Cascade delete all user grants for the user
   */
  private async handleUserRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.user_grants
      WHERE user_id = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );
  }
}

/**
 * Create user grant projection instance
 */
export function createUserGrantProjection(
  eventstore: Eventstore,
  database: DatabasePool
): UserGrantProjection {
  return new UserGrantProjection(eventstore, database);
}
