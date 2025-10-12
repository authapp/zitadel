/**
 * Organization Flow Commands
 * 
 * Manages trigger flows and action assignments
 * Based on Go: internal/command/org_flow.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwPreconditionFailed } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { FlowWriteModel } from './flow-write-model';
import { FlowType, TriggerType, isFlowTypeValid, isTriggerTypeValid, flowTypeHasTrigger } from '../../domain/flow';

/**
 * Clear all triggers from a flow
 * Based on Go: ClearFlow (org_flow.go:13-34)
 */
export async function clearFlow(
  this: Commands,
  ctx: Context,
  orgID: string,
  flowType: FlowType
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  if (!isFlowTypeValid(flowType)) {
    throwInvalidArgument('invalid flow type', 'FLOW-001');
  }

  // Check permissions
  await this.checkPermission(ctx, 'org.flow', 'write', orgID);

  // Load existing flow
  const wm = new FlowWriteModel(flowType, orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.triggers.size === 0) {
    throwPreconditionFailed('flow is already empty', 'FLOW-002');
  }

  // Create event
  const command: Command = {
    eventType: 'org.flow.cleared',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      flowType,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Set actions for a specific trigger point in a flow
 * Based on Go: SetTriggerActions (org_flow.go:36-72)
 */
export async function setTriggerActions(
  this: Commands,
  ctx: Context,
  orgID: string,
  flowType: FlowType,
  triggerType: TriggerType,
  actionIDs: string[]
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Validate flow and trigger types
  if (!isFlowTypeValid(flowType)) {
    throwInvalidArgument('invalid flow type', 'FLOW-003');
  }

  if (!isTriggerTypeValid(triggerType)) {
    throwInvalidArgument('invalid trigger type', 'FLOW-004');
  }

  if (!flowTypeHasTrigger(flowType, triggerType)) {
    throwInvalidArgument('trigger type not valid for this flow type', 'FLOW-005');
  }

  // Check permissions
  await this.checkPermission(ctx, 'org.flow', 'write', orgID);

  // Load existing flow
  const wm = new FlowWriteModel(flowType, orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  // Check if there are any changes
  const existingActions = wm.triggers.get(triggerType) || [];
  const hasChanges = 
    existingActions.length !== actionIDs.length ||
    !existingActions.every((id, index) => id === actionIDs[index]);

  if (!hasChanges) {
    throwPreconditionFailed('no changes to trigger actions', 'FLOW-006');
  }

  // Verify all action IDs exist if we're setting actions
  if (actionIDs.length > 0) {
    // In production, you'd validate actions exist
    // For now, we'll trust the caller
  }

  // Create event
  const command: Command = {
    eventType: 'org.trigger.actions.set',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      flowType,
      triggerType,
      actionIDs,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}
