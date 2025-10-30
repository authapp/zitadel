/**
 * Instance Action Commands (Phase 4 - Advanced Features)
 * 
 * Manages instance-level custom action scripts
 * Instance actions apply across all organizations
 * Based on Go: internal/command/instance_action.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { InstanceActionWriteModel } from './instance-action-write-model';
import { Action, ActionState, actionStateExists, isActionValid } from '../../domain/action';

/**
 * Add instance-level action with auto-generated ID
 */
export async function addInstanceAction(
  this: Commands,
  ctx: Context,
  action: Action
): Promise<{ id: string; details: ObjectDetails }> {
  if (!isActionValid(action)) {
    throwInvalidArgument('action is invalid', 'INST-ACTION-001');
  }

  // Generate ID
  const actionID = await this.generateID();

  return await addInstanceActionWithID.call(this, ctx, actionID, action);
}

/**
 * Add instance-level action with specific ID
 */
export async function addInstanceActionWithID(
  this: Commands,
  ctx: Context,
  actionID: string,
  action: Action
): Promise<{ id: string; details: ObjectDetails }> {
  validateRequired(actionID, 'actionID');

  if (!isActionValid(action)) {
    throwInvalidArgument('action is invalid', 'INST-ACTION-002');
  }

  // Check instance-level permissions
  await this.checkPermission(ctx, 'instance.action', 'write', ctx.instanceID);

  // Check if action already exists
  const wm = new InstanceActionWriteModel(actionID, ctx.instanceID);
  await wm.load(this.getEventstore(), actionID, ctx.instanceID);

  if (wm.state !== ActionState.UNSPECIFIED) {
    throwPreconditionFailed('instance action already exists', 'INST-ACTION-003');
  }

  // Create event
  const command: Command = {
    eventType: 'instance.action.added',
    aggregateType: 'instance_action',
    aggregateID: actionID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      name: action.name,
      script: action.script,
      timeout: action.timeout,
      allowedToFail: action.allowedToFail,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return {
    id: actionID,
    details: writeModelToObjectDetails(wm),
  };
}

/**
 * Change/update existing instance action
 */
export async function changeInstanceAction(
  this: Commands,
  ctx: Context,
  actionID: string,
  action: Action
): Promise<ObjectDetails> {
  validateRequired(actionID, 'actionID');

  if (!isActionValid(action)) {
    throwInvalidArgument('action is invalid', 'INST-ACTION-004');
  }

  // Check permissions
  await this.checkPermission(ctx, 'instance.action', 'write', ctx.instanceID);

  // Load existing action
  const wm = new InstanceActionWriteModel(actionID, ctx.instanceID);
  await wm.load(this.getEventstore(), actionID, ctx.instanceID);

  if (!actionStateExists(wm.state)) {
    throwNotFound('instance action not found', 'INST-ACTION-005');
  }

  // Build changes payload
  const changes: any = {};
  let hasChanges = false;

  if (wm.name !== action.name) {
    changes.name = action.name;
    changes.oldName = wm.name;
    hasChanges = true;
  }
  if (wm.script !== action.script) {
    changes.script = action.script;
    hasChanges = true;
  }
  if (wm.timeout !== action.timeout) {
    changes.timeout = action.timeout;
    hasChanges = true;
  }
  if (wm.allowedToFail !== action.allowedToFail) {
    changes.allowedToFail = action.allowedToFail;
    hasChanges = true;
  }

  if (!hasChanges) {
    return writeModelToObjectDetails(wm);
  }

  // Create event
  const command: Command = {
    eventType: 'instance.action.changed',
    aggregateType: 'instance_action',
    aggregateID: actionID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: changes,
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Deactivate instance action (disable without deleting)
 */
export async function deactivateInstanceAction(
  this: Commands,
  ctx: Context,
  actionID: string
): Promise<ObjectDetails> {
  validateRequired(actionID, 'actionID');

  // Check permissions
  await this.checkPermission(ctx, 'instance.action', 'write', ctx.instanceID);

  // Load existing action
  const wm = new InstanceActionWriteModel(actionID, ctx.instanceID);
  await wm.load(this.getEventstore(), actionID, ctx.instanceID);

  if (!actionStateExists(wm.state)) {
    throwNotFound('instance action not found', 'INST-ACTION-006');
  }

  if (wm.state !== ActionState.ACTIVE) {
    throwPreconditionFailed('instance action is not active', 'INST-ACTION-007');
  }

  // Create event
  const command: Command = {
    eventType: 'instance.action.deactivated',
    aggregateType: 'instance_action',
    aggregateID: actionID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Reactivate previously deactivated instance action
 */
export async function reactivateInstanceAction(
  this: Commands,
  ctx: Context,
  actionID: string
): Promise<ObjectDetails> {
  validateRequired(actionID, 'actionID');

  // Check permissions
  await this.checkPermission(ctx, 'instance.action', 'write', ctx.instanceID);

  // Load existing action
  const wm = new InstanceActionWriteModel(actionID, ctx.instanceID);
  await wm.load(this.getEventstore(), actionID, ctx.instanceID);

  if (!actionStateExists(wm.state)) {
    throwNotFound('instance action not found', 'INST-ACTION-008');
  }

  if (wm.state !== ActionState.INACTIVE) {
    throwPreconditionFailed('instance action is not inactive', 'INST-ACTION-009');
  }

  // Create event
  const command: Command = {
    eventType: 'instance.action.reactivated',
    aggregateType: 'instance_action',
    aggregateID: actionID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Delete instance action permanently
 * Also cascades to remove action from any instance flows
 */
export async function deleteInstanceAction(
  this: Commands,
  ctx: Context,
  actionID: string,
  flowTypes?: number[]
): Promise<ObjectDetails> {
  validateRequired(actionID, 'actionID');

  // Check permissions
  await this.checkPermission(ctx, 'instance.action', 'delete', ctx.instanceID);

  // Load existing action
  const wm = new InstanceActionWriteModel(actionID, ctx.instanceID);
  await wm.load(this.getEventstore(), actionID, ctx.instanceID);

  if (!actionStateExists(wm.state)) {
    throwNotFound('instance action not found', 'INST-ACTION-010');
  }

  // Create events - action removal + cascade removals
  const commands: Command[] = [
    {
      eventType: 'instance.action.removed',
      aggregateType: 'instance_action',
      aggregateID: actionID,
      owner: ctx.instanceID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        name: wm.name,
      },
    },
  ];

  // Add cascade removal events for flows if specified
  if (flowTypes && flowTypes.length > 0) {
    for (const flowType of flowTypes) {
      commands.push({
        eventType: 'instance.trigger.actions.cascade.removed',
        aggregateType: 'instance',
        aggregateID: ctx.instanceID,
        owner: ctx.instanceID,
        instanceID: ctx.instanceID,
        creator: ctx.userID || 'system',
        payload: {
          flowType,
          actionID,
        },
      });
    }
  }

  // Push all events
  const events = await this.getEventstore().pushMany(commands);
  for (const event of events) {
    appendAndReduce(wm, event);
  }

  return writeModelToObjectDetails(wm);
}
