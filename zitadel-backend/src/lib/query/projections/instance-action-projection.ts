/**
 * Instance Action Projection
 * Handles instance-level workflow actions (applies to all organizations)
 */

import { Event } from '../../eventstore/types';
import { Projection } from '../projection/projection';

export class InstanceActionProjection extends Projection {
  readonly name = 'instance_action_projection';
  readonly tables = ['projections.actions'];

  async init(): Promise<void> {
    // Table already created by migration
  }
  
  /**
   * Get event types handled by this projection
   * Required for real-time event subscription
   */
  getEventTypes(): string[] {
    return [
      'instance.action.added',
      'instance.action.changed',
      'instance.action.deactivated',
      'instance.action.reactivated',
      'instance.action.removed',
      'instance.removed',
    ];
  }


  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      // Instance action events
      case 'instance.action.added':
        await this.handleInstanceActionAdded(event);
        break;
      case 'instance.action.changed':
        await this.handleInstanceActionChanged(event);
        break;
      case 'instance.action.deactivated':
        await this.handleInstanceActionDeactivated(event);
        break;
      case 'instance.action.reactivated':
        await this.handleInstanceActionReactivated(event);
        break;
      case 'instance.action.removed':
        await this.handleInstanceActionRemoved(event);
        break;

      // Cleanup events
      case 'instance.removed':
        await this.handleInstanceRemoved(event);
        break;
    }
  }

  private async handleInstanceActionAdded(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    // Convert timeout to PostgreSQL interval format
    let timeoutInterval: string;
    if (typeof payload.timeout === 'number') {
      timeoutInterval = `${payload.timeout} milliseconds`;
    } else if (typeof payload.timeout === 'string') {
      timeoutInterval = payload.timeout;
    } else {
      timeoutInterval = '10 seconds';
    }

    await this.database.query(
      `INSERT INTO projections.actions (
        id, instance_id, resource_owner, name, script, timeout, 
        allowed_to_fail, state, creation_date, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6::interval, $7, $8, $9, $10, $11)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        name = EXCLUDED.name,
        script = EXCLUDED.script,
        timeout = EXCLUDED.timeout,
        allowed_to_fail = EXCLUDED.allowed_to_fail,
        change_date = EXCLUDED.change_date,
        sequence = GREATEST(projections.actions.sequence, EXCLUDED.sequence)`,
      [
        event.aggregateID, // Action ID
        event.instanceID,
        event.instanceID, // Instance-level actions are owned by instance
        payload.name,
        payload.script,
        timeoutInterval,
        payload.allowedToFail || false,
        2, // active state (ActionState.ACTIVE = 2)
        event.createdAt,
        event.createdAt,
        event.aggregateVersion,
      ]
    );
  }

  private async handleInstanceActionChanged(event: Event): Promise<void> {
    const payload = event.payload as any;
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (payload.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(payload.name);
    }
    if (payload.script !== undefined) {
      updates.push(`script = $${paramIndex++}`);
      values.push(payload.script);
    }
    if (payload.timeout !== undefined) {
      updates.push(`timeout = $${paramIndex++}::interval`);
      if (typeof payload.timeout === 'number') {
        values.push(`${payload.timeout} milliseconds`);
      } else {
        values.push(payload.timeout);
      }
    }
    if (payload.allowedToFail !== undefined) {
      updates.push(`allowed_to_fail = $${paramIndex++}`);
      values.push(payload.allowedToFail);
    }

    if (updates.length > 0) {
      updates.push(`change_date = $${paramIndex++}`);
      values.push(event.createdAt);
      updates.push(`sequence = $${paramIndex++}`);
      values.push(event.aggregateVersion);

      values.push(event.instanceID);
      values.push(event.aggregateID);

      await this.database.query(
        `UPDATE projections.actions SET ${updates.join(', ')}
         WHERE instance_id = $${paramIndex++} AND id = $${paramIndex}`,
        values
      );
    }
  }

  private async handleInstanceActionDeactivated(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.actions SET state = $1, change_date = $2, sequence = $3
       WHERE instance_id = $4 AND id = $5`,
      [
        1, // inactive state (ActionState.INACTIVE = 1)
        event.createdAt,
        event.aggregateVersion,
        event.instanceID,
        event.aggregateID,
      ]
    );
  }

  private async handleInstanceActionReactivated(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.actions SET state = $1, change_date = $2, sequence = $3
       WHERE instance_id = $4 AND id = $5`,
      [
        2, // active state (ActionState.ACTIVE = 2)
        event.createdAt,
        event.aggregateVersion,
        event.instanceID,
        event.aggregateID,
      ]
    );
  }

  private async handleInstanceActionRemoved(event: Event): Promise<void> {
    await this.database.query(
      `DELETE FROM projections.actions 
       WHERE instance_id = $1 AND id = $2`,
      [event.instanceID, event.aggregateID]
    );
  }

  private async handleInstanceRemoved(event: Event): Promise<void> {
    // Remove all instance-level actions (where resource_owner = instance_id)
    await this.database.query(
      `DELETE FROM projections.actions 
       WHERE instance_id = $1 AND resource_owner = $1`,
      [event.instanceID]
    );
  }
}

/**
 * Create projection config
 */
export function createInstanceActionProjectionConfig() {
  return {
    name: 'instance_action_projection',
    tables: ['projections.actions'],
    eventTypes: [
      'instance.action.added',
      'instance.action.changed',
      'instance.action.deactivated',
      'instance.action.reactivated',
      'instance.action.removed',
      'instance.removed',
    ],
    interval: 1000,
  };
}
