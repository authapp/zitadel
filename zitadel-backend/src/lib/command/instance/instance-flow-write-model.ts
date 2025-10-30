/**
 * Instance Flow Write Model
 * 
 * Tracks instance-level flow/trigger configuration state
 * Instance flows apply to all organizations in the instance
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';
import { FlowType, FlowState, TriggerType } from '../../domain/flow';

/**
 * Instance flow write model
 */
export class InstanceFlowWriteModel extends WriteModel {
  flowType: FlowType;
  state: FlowState = FlowState.ACTIVE;
  triggers: Map<TriggerType, string[]> = new Map();

  constructor(flowType: FlowType, instanceID: string) {
    super('instance');
    this.flowType = flowType;
    this.aggregateID = instanceID;
    this.resourceOwner = instanceID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'instance.trigger.actions.set':
        if (event.payload?.flowType === this.flowType) {
          const triggerType = event.payload?.triggerType as TriggerType;
          const actionIDs = event.payload?.actionIDs || [];
          this.triggers.set(triggerType, actionIDs);
        }
        break;

      case 'instance.trigger.actions.cascade.removed':
        if (event.payload?.flowType === this.flowType) {
          const triggerType = event.payload?.triggerType as TriggerType;
          const actionID = event.payload?.actionID;
          if (actionID) {
            const actions = this.triggers.get(triggerType) || [];
            const filtered = actions.filter(id => id !== actionID);
            this.triggers.set(triggerType, filtered);
          }
        }
        break;

      case 'instance.flow.cleared':
        if (event.payload?.flowType === this.flowType) {
          this.triggers.clear();
        }
        break;
    }
  }
}
