/**
 * Organization Action Commands
 * 
 * Manages custom action scripts for organizations
 * Based on Go: internal/command/org_action.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { ActionWriteModel } from './action-write-model';
import { Action, ActionState, actionStateExists, isActionValid } from '../../domain/action';

/**
 * Add action with auto-generated ID
 * Based on Go: AddAction (org_action.go:30-41)
 */
export async function addAction(
  this: Commands,
  ctx: Context,
  orgID: string,
  action: Action
): Promise<{ id: string; details: ObjectDetails }> {
  validateRequired(orgID, 'orgID');

  if (!isActionValid(action)) {
    throwInvalidArgument('action is invalid', 'ACTION-001');
  }

  // Generate ID
  const actionID = await this.generateID();

  return await addActionWithID.call(this, ctx, orgID, actionID, action);
}

/**
 * Add action with specific ID
 * Based on Go: AddActionWithID (org_action.go:15-28)
 */
export async function addActionWithID(
  this: Commands,
  ctx: Context,
  orgID: string,
  actionID: string,
  action: Action
): Promise<{ id: string; details: ObjectDetails }> {
  validateRequired(orgID, 'orgID');
  validateRequired(actionID, 'actionID');

  if (!isActionValid(action)) {
    throwInvalidArgument('action is invalid', 'ACTION-002');
  }

  // Check permissions
  await this.checkPermission(ctx, 'org.action', 'write', orgID);

  // Check if action already exists
  const wm = new ActionWriteModel(actionID, orgID);
  await wm.load(this.getEventstore(), actionID, orgID);

  if (wm.state !== ActionState.UNSPECIFIED) {
    throwPreconditionFailed('action already exists', 'ACTION-003');
  }

  // Create event
  const command: Command = {
    eventType: 'action.added',
    aggregateType: 'action',
    aggregateID: actionID,
    owner: orgID,
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
 * Change/update existing action
 * Based on Go: ChangeAction (org_action.go:66-99)
 */
export async function changeAction(
  this: Commands,
  ctx: Context,
  orgID: string,
  actionID: string,
  action: Action
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');
  validateRequired(actionID, 'actionID');

  if (!isActionValid(action)) {
    throwInvalidArgument('action is invalid', 'ACTION-004');
  }

  // Check permissions
  await this.checkPermission(ctx, 'org.action', 'write', orgID);

  // Load existing action
  const wm = new ActionWriteModel(actionID, orgID);
  await wm.load(this.getEventstore(), actionID, orgID);

  if (!actionStateExists(wm.state)) {
    throwNotFound('action not found', 'ACTION-005');
  }

  // Build changes payload
  const changes: any = {};
  let hasChanges = false;

  if (wm.name !== action.name) {
    changes.name = action.name;
    changes.oldName = wm.name; // For event tracking
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
    eventType: 'action.changed',
    aggregateType: 'action',
    aggregateID: actionID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: changes,
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Deactivate action (disable without deleting)
 * Based on Go: DeactivateAction (org_action.go:101-129)
 */
export async function deactivateAction(
  this: Commands,
  ctx: Context,
  orgID: string,
  actionID: string
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');
  validateRequired(actionID, 'actionID');

  // Check permissions
  await this.checkPermission(ctx, 'org.action', 'write', orgID);

  // Load existing action
  const wm = new ActionWriteModel(actionID, orgID);
  await wm.load(this.getEventstore(), actionID, orgID);

  if (!actionStateExists(wm.state)) {
    throwNotFound('action not found', 'ACTION-006');
  }

  if (wm.state !== ActionState.ACTIVE) {
    throwPreconditionFailed('action is not active', 'ACTION-007');
  }

  // Create event
  const command: Command = {
    eventType: 'action.deactivated',
    aggregateType: 'action',
    aggregateID: actionID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Reactivate previously deactivated action
 * Based on Go: ReactivateAction (org_action.go:131-160)
 */
export async function reactivateAction(
  this: Commands,
  ctx: Context,
  orgID: string,
  actionID: string
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');
  validateRequired(actionID, 'actionID');

  // Check permissions
  await this.checkPermission(ctx, 'org.action', 'write', orgID);

  // Load existing action
  const wm = new ActionWriteModel(actionID, orgID);
  await wm.load(this.getEventstore(), actionID, orgID);

  if (!actionStateExists(wm.state)) {
    throwNotFound('action not found', 'ACTION-008');
  }

  if (wm.state !== ActionState.INACTIVE) {
    throwPreconditionFailed('action is not inactive', 'ACTION-009');
  }

  // Create event
  const command: Command = {
    eventType: 'action.reactivated',
    aggregateType: 'action',
    aggregateID: actionID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Delete action permanently
 * Based on Go: DeleteAction (org_action.go:162-191)
 * 
 * Also cascades to remove action from any flows
 */
export async function deleteAction(
  this: Commands,
  ctx: Context,
  orgID: string,
  actionID: string,
  flowTypes?: number[]
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');
  validateRequired(actionID, 'actionID');

  // Check permissions
  await this.checkPermission(ctx, 'org.action', 'delete', orgID);

  // Load existing action
  const wm = new ActionWriteModel(actionID, orgID);
  await wm.load(this.getEventstore(), actionID, orgID);

  if (!actionStateExists(wm.state)) {
    throwNotFound('action not found', 'ACTION-010');
  }

  // Create events - action removal + cascade removals
  const commands: Command[] = [
    {
      eventType: 'action.removed',
      aggregateType: 'action',
      aggregateID: actionID,
      owner: orgID,
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
        eventType: 'org.trigger.actions.cascade.removed',
        aggregateType: 'org',
        aggregateID: orgID,
        owner: orgID,
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
