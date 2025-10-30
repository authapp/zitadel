/**
 * Instance Flow Projection
 * Handles instance-level trigger flows (applies to all organizations)
 */

import { Event } from '../../eventstore/types';
import { Projection } from '../projection/projection';

export class InstanceFlowProjection extends Projection {
  readonly name = 'instance_flow_projection';
  readonly tables = ['projections.action_flows'];

  async init(): Promise<void> {
    // Table already created by migration
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      // Instance flow events
      case 'instance.trigger.actions.set':
        await this.handleInstanceTriggerActionsSet(event);
        break;
      case 'instance.flow.cleared':
        await this.handleInstanceFlowCleared(event);
        break;

      // Cleanup events
      case 'instance.removed':
        await this.handleInstanceRemoved(event);
        break;
    }
  }

  private async handleInstanceTriggerActionsSet(event: Event): Promise<void> {
    const payload = event.payload as any;
    const flowType = payload.flowType;
    const triggerType = payload.triggerType;
    const actionIDs = payload.actionIDs || [];

    // First, remove existing mappings for this flow/trigger combo
    await this.database.query(
      `DELETE FROM projections.action_flows 
       WHERE instance_id = $1 AND resource_owner = $1 
         AND flow_type = $2 AND trigger_type = $3`,
      [event.instanceID, flowType, triggerType]
    );

    // Then insert new mappings
    for (let i = 0; i < actionIDs.length; i++) {
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
          flowType,
          triggerType,
          actionIDs[i],
          event.instanceID,
          event.instanceID, // Instance-level flows are owned by instance
          i, // Sequence order
          event.createdAt,
          event.createdAt,
          event.aggregateVersion,
        ]
      );
    }
  }

  private async handleInstanceFlowCleared(event: Event): Promise<void> {
    const payload = event.payload as any;
    const flowType = payload.flowType;

    // Remove all triggers for this flow
    await this.database.query(
      `DELETE FROM projections.action_flows 
       WHERE instance_id = $1 AND resource_owner = $1 AND flow_type = $2`,
      [event.instanceID, flowType]
    );
  }

  private async handleInstanceRemoved(event: Event): Promise<void> {
    // Remove all instance-level flows (where resource_owner = instance_id)
    await this.database.query(
      `DELETE FROM projections.action_flows 
       WHERE instance_id = $1 AND resource_owner = $1`,
      [event.instanceID]
    );
  }
}

/**
 * Create projection config
 */
export function createInstanceFlowProjectionConfig() {
  return {
    name: 'instance_flow_projection',
    tables: ['projections.action_flows'],
    eventTypes: [
      'instance.trigger.actions.set',
      'instance.flow.cleared',
      'instance.removed',
    ],
    interval: 1000,
  };
}
