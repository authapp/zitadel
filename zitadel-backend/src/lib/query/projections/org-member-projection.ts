/**
 * Organization Member Projection
 * Handles organization-level member events
 */

import { Event, Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database';
import { Projection } from '../projection/projection';

/**
 * Organization Member Projection
 * Maintains projections.org_members table
 */
export class OrgMemberProjection extends Projection {
  readonly name = 'org_member_projection';
  readonly tables = ['projections.org_members'];

  /**
   * Initialize projection tables
   */
  async init(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS projections.org_members (
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        roles TEXT[] NOT NULL DEFAULT '{}',
        PRIMARY KEY (org_id, user_id, instance_id)
      );

      CREATE INDEX IF NOT EXISTS org_members_org_id_idx 
        ON projections.org_members (org_id, instance_id);
      
      CREATE INDEX IF NOT EXISTS org_members_user_id_idx 
        ON projections.org_members (user_id, instance_id);
      
      CREATE INDEX IF NOT EXISTS org_members_resource_owner_idx 
        ON projections.org_members (resource_owner, instance_id);
    `, []);
  }

  /**
   * Reduce event into projection
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'org.member.added':
        await this.handleMemberAdded(event);
        break;

      case 'org.member.changed':
        await this.handleMemberChanged(event);
        break;

      case 'org.member.removed':
        await this.handleMemberRemoved(event);
        break;

      case 'org.member.cascade.removed':
        await this.handleMemberCascadeRemoved(event);
        break;

      case 'org.removed':
        await this.handleOrgRemoved(event);
        break;

      case 'user.removed':
        await this.handleUserRemoved(event);
        break;
    }
  }

  /**
   * Handle org.member.added event
   */
  private async handleMemberAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `INSERT INTO projections.org_members (
        org_id, user_id, instance_id, creation_date, change_date, sequence,
        resource_owner, roles
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (org_id, user_id, instance_id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        roles = EXCLUDED.roles`,
      [
        event.aggregateID,
        payload.userID || payload.userId,
        event.instanceID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n), // Convert bigint to number for sequence
        event.owner,
        payload.roles || [],
      ]
    );
  }

  /**
   * Handle org.member.changed event
   */
  private async handleMemberChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `UPDATE projections.org_members SET
        change_date = $1,
        sequence = $2,
        roles = $3
      WHERE org_id = $4 AND user_id = $5 AND instance_id = $6`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n), // Convert bigint to number for sequence
        payload.roles || [],
        event.aggregateID,
        payload.userID || payload.userId,
        event.instanceID,
      ]
    );
  }

  /**
   * Handle org.member.removed event
   */
  private async handleMemberRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `DELETE FROM projections.org_members
      WHERE org_id = $1 AND user_id = $2 AND instance_id = $3`,
      [event.aggregateID, payload.userID || payload.userId, event.instanceID]
    );
  }

  /**
   * Handle org.member.cascade.removed event
   */
  private async handleMemberCascadeRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `DELETE FROM projections.org_members
      WHERE org_id = $1 AND user_id = $2 AND instance_id = $3`,
      [event.aggregateID, payload.userID || payload.userId, event.instanceID]
    );
  }

  /**
   * Handle org.removed event
   * Cascade delete all members for the organization
   */
  private async handleOrgRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.org_members
      WHERE org_id = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );
  }

  /**
   * Handle user.removed event
   * Cascade delete all memberships for the user
   */
  private async handleUserRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.org_members
      WHERE user_id = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );
  }
}

/**
 * Create org member projection instance
 */
export function createOrgMemberProjection(
  eventstore: Eventstore,
  database: DatabasePool
): OrgMemberProjection {
  return new OrgMemberProjection(eventstore, database);
}
