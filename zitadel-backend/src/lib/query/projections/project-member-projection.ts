/**
 * Project Member Projection
 * Handles project-level member events
 */

import { Event, Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database';
import { Projection } from '../projection/projection';

/**
 * Project Member Projection
 * Maintains projections.project_members table
 */
export class ProjectMemberProjection extends Projection {
  readonly name = 'project_member_projection';
  readonly tables = ['project_members'];

  /**
   * Initialize projection tables
   */
  async init(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS projections.project_members (
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        roles TEXT[] NOT NULL DEFAULT '{}',
        PRIMARY KEY (project_id, user_id, instance_id)
      );

      CREATE INDEX IF NOT EXISTS project_members_project_id_idx 
        ON projections.project_members (project_id, instance_id);
      
      CREATE INDEX IF NOT EXISTS project_members_user_id_idx 
        ON projections.project_members (user_id, instance_id);
      
      CREATE INDEX IF NOT EXISTS project_members_resource_owner_idx 
        ON projections.project_members (resource_owner, instance_id);
    `, []);
  }

  /**
   * Reduce event into projection
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'project.member.added':
        await this.handleMemberAdded(event);
        break;

      case 'project.member.changed':
        await this.handleMemberChanged(event);
        break;

      case 'project.member.removed':
        await this.handleMemberRemoved(event);
        break;

      case 'project.member.cascade.removed':
        await this.handleMemberCascadeRemoved(event);
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
   * Handle project.member.added event
   */
  private async handleMemberAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `INSERT INTO projections.project_members (
        project_id, user_id, instance_id, creation_date, change_date, sequence,
        resource_owner, roles
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (project_id, user_id, instance_id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        roles = EXCLUDED.roles`,
      [
        event.aggregateID,
        payload.userID || payload.userId,
        event.instanceID,
        event.createdAt,
        event.createdAt,
        event.position?.position || 0,
        event.owner,
        payload.roles || [],
      ]
    );
  }

  /**
   * Handle project.member.changed event
   */
  private async handleMemberChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `UPDATE projections.project_members SET
        change_date = $1,
        sequence = $2,
        roles = $3
      WHERE project_id = $4 AND user_id = $5 AND instance_id = $6`,
      [
        event.createdAt,
        event.position?.position || 0,
        payload.roles || [],
        event.aggregateID,
        payload.userID || payload.userId,
        event.instanceID,
      ]
    );
  }

  /**
   * Handle project.member.removed event
   */
  private async handleMemberRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `DELETE FROM projections.project_members
      WHERE project_id = $1 AND user_id = $2 AND instance_id = $3`,
      [event.aggregateID, payload.userID || payload.userId, event.instanceID]
    );
  }

  /**
   * Handle project.member.cascade.removed event
   */
  private async handleMemberCascadeRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `DELETE FROM projections.project_members
      WHERE project_id = $1 AND user_id = $2 AND instance_id = $3`,
      [event.aggregateID, payload.userID || payload.userId, event.instanceID]
    );
  }

  /**
   * Handle project.removed event
   * Cascade delete all members for the project
   */
  private async handleProjectRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.project_members
      WHERE project_id = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );
  }

  /**
   * Handle user.removed event
   * Cascade delete all memberships for the user
   */
  private async handleUserRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.project_members
      WHERE user_id = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );
  }
}

/**
 * Create project member projection instance
 */
export function createProjectMemberProjection(
  eventstore: Eventstore,
  database: DatabasePool
): ProjectMemberProjection {
  return new ProjectMemberProjection(eventstore, database);
}
