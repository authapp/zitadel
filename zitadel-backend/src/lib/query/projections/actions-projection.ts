/**
 * Actions Projection
 * Handles workflow actions and execution flows
 */

import { Event } from '../../eventstore/types';
import { Projection } from '../projection/projection';

export class ActionsProjection extends Projection {
  readonly name = 'actions_projection';
  readonly tables = ['projections.actions', 'projections.action_flows', 'projections.executions', 'projections.execution_states'];

  async init(): Promise<void> {
    // Tables already created by migration
  }
  
  getEventTypes(): string[] {
    return [
      // Action events
      'action.added',
      'action.v2.added',
      'action.changed',
      'action.v2.changed',
      'action.deactivated',
      'action.v2.deactivated',
      'action.reactivated',
      'action.v2.reactivated',
      'action.removed',
      'action.v2.removed',
      // Execution/Flow events
      'execution.set',
      'execution.v2.set',
      'execution.removed',
      'execution.v2.removed',
      // Cleanup events
      'org.removed',
      'instance.removed',
    ];
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      // Action events
      case 'action.added':
      case 'action.v2.added':
        await this.handleActionAdded(event);
        break;
      case 'action.changed':
      case 'action.v2.changed':
        await this.handleActionChanged(event);
        break;
      case 'action.deactivated':
      case 'action.v2.deactivated':
        await this.handleActionDeactivated(event);
        break;
      case 'action.reactivated':
      case 'action.v2.reactivated':
        await this.handleActionReactivated(event);
        break;
      case 'action.removed':
      case 'action.v2.removed':
        await this.handleActionRemoved(event);
        break;

      // Execution/Flow events
      case 'execution.set':
      case 'execution.v2.set':
        await this.handleExecutionSet(event);
        break;
      case 'execution.removed':
      case 'execution.v2.removed':
        await this.handleExecutionRemoved(event);
        break;

      // Cleanup events
      case 'org.removed':
        await this.handleOrgRemoved(event);
        break;
      case 'instance.removed':
        await this.handleInstanceRemoved(event);
        break;
    }
  }

  private async handleActionAdded(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    // Convert timeout to PostgreSQL interval format
    let timeoutInterval: string;
    if (typeof payload.timeout === 'number') {
      // If it's a number, treat as milliseconds
      timeoutInterval = `${payload.timeout} milliseconds`;
    } else if (typeof payload.timeout === 'string') {
      // If it's already a string, use as-is (e.g., "10 seconds")
      timeoutInterval = payload.timeout;
    } else {
      // Default to 10 seconds
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
        event.aggregateID, // ID is always in aggregateID, not payload
        event.instanceID,
        event.owner,
        payload.name,
        payload.script,
        timeoutInterval, // Convert to interval string
        payload.allowedToFail || false,
        1, // active state (ActionState.ACTIVE = 1)
        event.createdAt,
        event.createdAt,
        event.aggregateVersion,
      ]
    );
  }

  private async handleActionChanged(event: Event): Promise<void> {
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
      // Handle both number (milliseconds) and string (interval) formats
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
      values.push(event.aggregateID); // ID is always in aggregateID

      await this.database.query(
        `UPDATE projections.actions SET ${updates.join(', ')}
         WHERE instance_id = $${paramIndex++} AND id = $${paramIndex}`,
        values
      );
    }
  }

  private async handleActionDeactivated(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.actions SET state = $1, change_date = $2, sequence = $3
       WHERE instance_id = $4 AND id = $5`,
      [
        2, // inactive state (ActionState.INACTIVE = 2)
        event.createdAt,
        event.aggregateVersion,
        event.instanceID,
        event.aggregateID, // ID is always in aggregateID
      ]
    );
  }

  private async handleActionReactivated(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.actions SET state = $1, change_date = $2, sequence = $3
       WHERE instance_id = $4 AND id = $5`,
      [
        1, // active state (ActionState.ACTIVE = 1)
        event.createdAt,
        event.aggregateVersion,
        event.instanceID,
        event.aggregateID, // ID is always in aggregateID
      ]
    );
  }

  private async handleActionRemoved(event: Event): Promise<void> {
    await this.database.query(
      `DELETE FROM projections.actions 
       WHERE instance_id = $1 AND id = $2`,
      [event.instanceID, event.aggregateID] // ID is always in aggregateID
    );
  }

  private async handleExecutionSet(event: Event): Promise<void> {
    const payload = event.payload as any;

    // Handle action flow mappings
    const targets = payload.targets || [];
    
    for (const target of targets) {
      if (target.type === 'action') {
        await this.database.query(
          `INSERT INTO projections.action_flows (
            flow_type, trigger_type, action_id, instance_id, resource_owner,
            trigger_sequence, creation_date, change_date, sequence
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (instance_id, flow_type, trigger_type, action_id) DO UPDATE SET
            trigger_sequence = EXCLUDED.trigger_sequence,
            change_date = EXCLUDED.change_date,
            sequence = GREATEST(projections.action_flows.sequence, EXCLUDED.sequence)`,
          [
            payload.condition?.type || 'unspecified',
            payload.condition?.request?.type || event.eventType,
            target.actionId || target.id,
            event.instanceID,
            event.owner,
            target.sequence || 0,
            event.createdAt,
            event.createdAt,
            event.aggregateVersion,
          ]
        );
      }
    }
  }

  private async handleExecutionRemoved(event: Event): Promise<void> {
    const payload = event.payload as any;

    // Remove action flow mappings
    await this.database.query(
      `DELETE FROM projections.action_flows 
       WHERE instance_id = $1 AND flow_type = $2 AND trigger_type = $3`,
      [
        event.instanceID,
        payload.condition?.type || 'unspecified',
        payload.condition?.request?.type || event.eventType,
      ]
    );
  }

  private async handleOrgRemoved(event: Event): Promise<void> {
    // Remove all actions for this organization
    await this.database.query(
      `DELETE FROM projections.actions 
       WHERE instance_id = $1 AND resource_owner = $2`,
      [event.instanceID, event.aggregateID]
    );

    await this.database.query(
      `DELETE FROM projections.action_flows 
       WHERE instance_id = $1 AND resource_owner = $2`,
      [event.instanceID, event.aggregateID]
    );
  }

  private async handleInstanceRemoved(event: Event): Promise<void> {
    // Remove all actions for this instance
    await this.database.query(
      `DELETE FROM projections.actions WHERE instance_id = $1`,
      [event.instanceID]
    );

    await this.database.query(
      `DELETE FROM projections.action_flows WHERE instance_id = $1`,
      [event.instanceID]
    );
  }
}

/**
 * Create projection config
 */
export function createActionsProjectionConfig() {
  return {
    name: 'actions_projection',
    tables: ['projections.actions', 'projections.action_flows', 'projections.executions', 'projections.execution_states'],
    eventTypes: [
      'action.added',
      'action.v2.added',
      'action.changed',
      'action.v2.changed',
      'action.deactivated',
      'action.v2.deactivated',
      'action.reactivated',
      'action.v2.reactivated',
      'action.removed',
      'action.v2.removed',
      'execution.set',
      'execution.v2.set',
      'execution.removed',
      'execution.v2.removed',
      'org.removed',
      'instance.removed',
    ],
    interval: 1000,
  };
}
