/**
 * Flow Write Model
 * 
 * Tracks flow/trigger configuration state
 * Based on Go: internal/command/org_flow_model.go and flow_model.go
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';
import { FlowType, FlowState, TriggerType } from '../../domain/flow';

/**
 * Flow write model
 */
export class FlowWriteModel extends WriteModel {
  flowType: FlowType;
  state: FlowState = FlowState.ACTIVE;
  triggers: Map<TriggerType, string[]> = new Map();

  constructor(flowType: FlowType, orgID: string) {
    super('org');
    this.flowType = flowType;
    this.aggregateID = orgID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'org.trigger.actions.set':
        if (event.payload?.flowType === this.flowType) {
          const triggerType = event.payload?.triggerType as TriggerType;
          const actionIDs = event.payload?.actionIDs || [];
          this.triggers.set(triggerType, actionIDs);
        }
        break;

      case 'org.trigger.actions.cascade.removed':
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

      case 'org.flow.cleared':
        if (event.payload?.flowType === this.flowType) {
          this.triggers.clear();
        }
        break;
    }
  }
}
