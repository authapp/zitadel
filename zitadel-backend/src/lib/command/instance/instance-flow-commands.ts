/**
 * Instance Flow Commands (Phase 4 - Advanced Features)
 * 
 * Manages instance-level trigger flows and action assignments
 * Instance flows apply across all organizations
 * Based on Go: internal/command/instance_flow.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwPreconditionFailed } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { InstanceFlowWriteModel } from './instance-flow-write-model';
import { FlowType, TriggerType, isFlowTypeValid, isTriggerTypeValid, flowTypeHasTrigger } from '../../domain/flow';

/**
 * Clear all triggers from an instance flow
 */
export async function clearInstanceFlow(
  this: Commands,
  ctx: Context,
  flowType: FlowType
): Promise<ObjectDetails> {
  if (!isFlowTypeValid(flowType)) {
    throwInvalidArgument('invalid flow type', 'INST-FLOW-001');
  }

  // Check instance-level permissions
  await this.checkPermission(ctx, 'instance.flow', 'write', ctx.instanceID);

  // Load existing flow
  const wm = new InstanceFlowWriteModel(flowType, ctx.instanceID);
  await wm.load(this.getEventstore(), ctx.instanceID, ctx.instanceID);

  if (wm.triggers.size === 0) {
    throwPreconditionFailed('instance flow is already empty', 'INST-FLOW-002');
  }

  // Create event
  const command: Command = {
    eventType: 'instance.flow.cleared',
    aggregateType: 'instance',
    aggregateID: ctx.instanceID,
    owner: ctx.instanceID,
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
 * Set actions for a specific trigger point in an instance flow
 */
export async function setInstanceTriggerActions(
  this: Commands,
  ctx: Context,
  flowType: FlowType,
  triggerType: TriggerType,
  actionIDs: string[]
): Promise<ObjectDetails> {
  // Validate flow and trigger types
  if (!isFlowTypeValid(flowType)) {
    throwInvalidArgument('invalid flow type', 'INST-FLOW-003');
  }

  if (!isTriggerTypeValid(triggerType)) {
    throwInvalidArgument('invalid trigger type', 'INST-FLOW-004');
  }

  if (!flowTypeHasTrigger(flowType, triggerType)) {
    throwInvalidArgument('trigger type not valid for this flow type', 'INST-FLOW-005');
  }

  // Check instance-level permissions
  await this.checkPermission(ctx, 'instance.flow', 'write', ctx.instanceID);

  // Load existing flow
  const wm = new InstanceFlowWriteModel(flowType, ctx.instanceID);
  await wm.load(this.getEventstore(), ctx.instanceID, ctx.instanceID);

  // Check if there are any changes
  const existingActions = wm.triggers.get(triggerType) || [];
  const hasChanges = 
    existingActions.length !== actionIDs.length ||
    !existingActions.every((id, index) => id === actionIDs[index]);

  if (!hasChanges) {
    throwPreconditionFailed('no changes to instance trigger actions', 'INST-FLOW-006');
  }

  // Verify all action IDs exist if we're setting actions
  if (actionIDs.length > 0) {
    // In production, you'd validate instance actions exist
    // For now, we'll trust the caller
  }

  // Create event
  const command: Command = {
    eventType: 'instance.trigger.actions.set',
    aggregateType: 'instance',
    aggregateID: ctx.instanceID,
    owner: ctx.instanceID,
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

/**
 * Remove a specific action from an instance flow trigger
 * Useful for removing an action without clearing the entire trigger
 */
export async function removeInstanceActionFromTrigger(
  this: Commands,
  ctx: Context,
  flowType: FlowType,
  triggerType: TriggerType,
  actionID: string
): Promise<ObjectDetails> {
  validateRequired(actionID, 'actionID');

  // Validate flow and trigger types
  if (!isFlowTypeValid(flowType)) {
    throwInvalidArgument('invalid flow type', 'INST-FLOW-007');
  }

  if (!isTriggerTypeValid(triggerType)) {
    throwInvalidArgument('invalid trigger type', 'INST-FLOW-008');
  }

  // Check instance-level permissions
  await this.checkPermission(ctx, 'instance.flow', 'write', ctx.instanceID);

  // Load existing flow
  const wm = new InstanceFlowWriteModel(flowType, ctx.instanceID);
  await wm.load(this.getEventstore(), ctx.instanceID, ctx.instanceID);

  const existingActions = wm.triggers.get(triggerType) || [];
  if (!existingActions.includes(actionID)) {
    throwPreconditionFailed('action not found in trigger', 'INST-FLOW-009');
  }

  // Filter out the action
  const newActions = existingActions.filter(id => id !== actionID);

  // Create event
  const command: Command = {
    eventType: 'instance.trigger.actions.set',
    aggregateType: 'instance',
    aggregateID: ctx.instanceID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      flowType,
      triggerType,
      actionIDs: newActions,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}
