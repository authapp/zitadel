/**
 * Instance Member Projection (IAM Member)
 * Handles instance-level member events for global administrators
 */

import { Event, Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database';
import { Projection } from '../projection/projection';

/**
 * Instance Member Projection
 * Maintains projections.instance_members table
 */
export class InstanceMemberProjection extends Projection {
  readonly name = 'instance_member_projection';
  readonly tables = ['instance_members'];

  /**
   * Initialize projection tables
   */
  async init(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS projections.instance_members (
        instance_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        roles TEXT[] NOT NULL DEFAULT '{}',
        PRIMARY KEY (instance_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS instance_members_user_id_idx 
        ON projections.instance_members (user_id);
      
      CREATE INDEX IF NOT EXISTS instance_members_resource_owner_idx 
        ON projections.instance_members (resource_owner);
    `, []);
  }

  /**
   * Reduce event into projection
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'instance.member.added':
        await this.handleMemberAdded(event);
        break;

      case 'instance.member.changed':
        await this.handleMemberChanged(event);
        break;

      case 'instance.member.removed':
        await this.handleMemberRemoved(event);
        break;

      case 'instance.member.cascade.removed':
        await this.handleMemberCascadeRemoved(event);
        break;

      case 'user.removed':
        await this.handleUserRemoved(event);
        break;
    }
  }

  /**
   * Handle instance.member.added event
   */
  private async handleMemberAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `INSERT INTO projections.instance_members (
        instance_id, user_id, creation_date, change_date, sequence,
        resource_owner, roles
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (instance_id, user_id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        roles = EXCLUDED.roles`,
      [
        event.instanceID,
        payload.userID || payload.userId,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n), // Convert bigint to number for sequence
        event.owner,
        payload.roles || [],
      ]
    );
  }

  /**
   * Handle instance.member.changed event
   */
  private async handleMemberChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `UPDATE projections.instance_members SET
        change_date = $1,
        sequence = $2,
        roles = $3
      WHERE instance_id = $4 AND user_id = $5`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n), // Convert bigint to number for sequence
        payload.roles || [],
        event.instanceID,
        payload.userID || payload.userId,
      ]
    );
  }

  /**
   * Handle instance.member.removed event
   */
  private async handleMemberRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `DELETE FROM projections.instance_members
      WHERE instance_id = $1 AND user_id = $2`,
      [event.instanceID, payload.userID || payload.userId]
    );
  }

  /**
   * Handle instance.member.cascade.removed event
   */
  private async handleMemberCascadeRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.query(
      `DELETE FROM projections.instance_members
      WHERE instance_id = $1 AND user_id = $2`,
      [event.instanceID, payload.userID || payload.userId]
    );
  }

  /**
   * Handle user.removed event
   * Cascade delete all memberships for the user
   */
  private async handleUserRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.instance_members
      WHERE user_id = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );
  }
}

/**
 * Create instance member projection instance
 */
export function createInstanceMemberProjection(
  eventstore: Eventstore,
  database: DatabasePool
): InstanceMemberProjection {
  return new InstanceMemberProjection(eventstore, database);
}
