/**
 * Project Grant Member Projection
 * Handles project grant-level member events
 */

import { Event, Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database';
import { Projection } from '../projection/projection';

/**
 * Project Grant Member Projection
 * Maintains projections.project_grant_members table
 */
export class ProjectGrantMemberProjection extends Projection {
  readonly name = 'project_grant_member_projection';
  readonly tables = ['project_grant_members'];

  /**
   * Initialize projection tables
   */
  async init(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS projections.project_grant_members (
        project_id TEXT NOT NULL,
        grant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        roles TEXT[] NOT NULL DEFAULT '{}',
        PRIMARY KEY (project_id, grant_id, user_id, instance_id)
      );

      CREATE INDEX IF NOT EXISTS project_grant_members_project_id_idx 
        ON projections.project_grant_members (project_id, instance_id);
      
      CREATE INDEX IF NOT EXISTS project_grant_members_grant_id_idx 
        ON projections.project_grant_members (grant_id, instance_id);
      
      CREATE INDEX IF NOT EXISTS project_grant_members_user_id_idx 
        ON projections.project_grant_members (user_id, instance_id);
      
      CREATE INDEX IF NOT EXISTS project_grant_members_resource_owner_idx 
        ON projections.project_grant_members (resource_owner, instance_id);
    `, []);
  }

  /**
   * Reduce event into projection
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'project.grant.member.added':
        await this.handleMemberAdded(event);
        break;

      case 'project.grant.member.changed':
        await this.handleMemberChanged(event);
        break;

      case 'project.grant.member.removed':
        await this.handleMemberRemoved(event);
        break;

      case 'project.grant.member.cascade.removed':
        await this.handleMemberCascadeRemoved(event);
        break;

      case 'project.grant.removed':
        await this.handleProjectGrantRemoved(event);
        break;

      case 'user.removed':
        await this.handleUserRemoved(event);
        break;
    }
  }

  /**
   * Handle project.grant.member.added event
   */
  private async handleMemberAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `INSERT INTO projections.project_grant_members (
        project_id, grant_id, user_id, instance_id, creation_date, change_date, 
        sequence, resource_owner, roles
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (project_id, grant_id, user_id, instance_id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        roles = EXCLUDED.roles`,
      [
        payload.projectID || event.aggregateID,
        payload.grantID || payload.grantId,
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
   * Handle project.grant.member.changed event
   */
  private async handleMemberChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `UPDATE projections.project_grant_members SET
        change_date = $1,
        sequence = $2,
        roles = $3
      WHERE project_id = $4 AND grant_id = $5 AND user_id = $6 AND instance_id = $7`,
      [
        event.createdAt,
        event.position?.position || 0,
        payload.roles || [],
        payload.projectID || event.aggregateID,
        payload.grantID || payload.grantId,
        payload.userID || payload.userId,
        event.instanceID,
      ]
    );
  }

  /**
   * Handle project.grant.member.removed event
   */
  private async handleMemberRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `DELETE FROM projections.project_grant_members
      WHERE project_id = $1 AND grant_id = $2 AND user_id = $3 AND instance_id = $4`,
      [
        payload.projectID || event.aggregateID,
        payload.grantID || payload.grantId,
        payload.userID || payload.userId,
        event.instanceID,
      ]
    );
  }

  /**
   * Handle project.grant.member.cascade.removed event
   */
  private async handleMemberCascadeRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `DELETE FROM projections.project_grant_members
      WHERE project_id = $1 AND grant_id = $2 AND user_id = $3 AND instance_id = $4`,
      [
        payload.projectID || event.aggregateID,
        payload.grantID || payload.grantId,
        payload.userID || payload.userId,
        event.instanceID,
      ]
    );
  }

  /**
   * Handle project.grant.removed event
   * Cascade delete all members for the project grant
   */
  private async handleProjectGrantRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    const grantID = payload.grantID || payload.id;
    
    await this.query(
      `DELETE FROM projections.project_grant_members
      WHERE grant_id = $1 AND instance_id = $2`,
      [grantID, event.instanceID]
    );
  }

  /**
   * Handle user.removed event
   * Cascade delete all memberships for the user
   */
  private async handleUserRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.project_grant_members
      WHERE user_id = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );
  }
}

/**
 * Create project grant member projection instance
 */
export function createProjectGrantMemberProjection(
  eventstore: Eventstore,
  database: DatabasePool
): ProjectGrantMemberProjection {
  return new ProjectGrantMemberProjection(eventstore, database);
}
