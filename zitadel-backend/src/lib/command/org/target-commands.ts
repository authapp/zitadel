/**
 * Target Commands
 * 
 * Commands for managing targets (external endpoints for action execution)
 * Based on Zitadel Go: internal/command/action_v2_target.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { TargetWriteModel } from './target-write-model';
import { TargetType, isTargetValid, isTimeoutValid } from '../../domain/target';
import * as crypto from 'crypto';

/**
 * Generate a signing key for webhook signatures
 */
function generateSigningKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Add target (external endpoint)
 * Based on Go: AddTarget (action_v2_target.go:44)
 */
export async function addTarget(
  this: Commands,
  ctx: Context,
  orgID: string,
  target: {
    name: string;
    targetType: TargetType;
    endpoint: string;
    timeout: number;
    interruptOnError: boolean;
  }
): Promise<{ id: string; signingKey: string; details: ObjectDetails }> {
  validateRequired(orgID, 'orgID');

  // Validate timeout first (more specific error)
  if (!isTimeoutValid(target.timeout)) {
    throwInvalidArgument('timeout must be positive and <= 300000ms', 'TARGET-002');
  }

  // Validate target
  if (!isTargetValid(target)) {
    throwInvalidArgument('target is invalid', 'TARGET-001');
  }

  // Check permissions
  await this.checkPermission(ctx, 'org.target', 'write', orgID);

  // Generate ID
  const targetID = await this.generateID();

  // Generate signing key for webhook signature verification
  const signingKey = generateSigningKey();

  // Check if target already exists
  const wm = new TargetWriteModel(targetID, orgID);
  await wm.load(this.getEventstore(), targetID, orgID);

  if (wm.exists()) {
    throwPreconditionFailed('target already exists', 'TARGET-003');
  }

  // Create event
  const command: Command = {
    eventType: 'target.added',
    aggregateType: 'target',
    aggregateID: targetID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      name: target.name,
      targetType: target.targetType,
      endpoint: target.endpoint,
      timeout: target.timeout,
      interruptOnError: target.interruptOnError,
      signingKey: signingKey, // Store for signature verification
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return {
    id: targetID,
    signingKey, // Return to user (one-time only!)
    details: writeModelToObjectDetails(wm),
  };
}

/**
 * Change/update existing target
 * Based on Go: ChangeTarget (action_v2_target.go:122)
 */
export async function changeTarget(
  this: Commands,
  ctx: Context,
  orgID: string,
  targetID: string,
  changes: {
    name?: string;
    targetType?: TargetType;
    endpoint?: string;
    timeout?: number;
    interruptOnError?: boolean;
    rotateSigningKey?: boolean;
  }
): Promise<{ signingKey?: string; details: ObjectDetails }> {
  validateRequired(orgID, 'orgID');
  validateRequired(targetID, 'targetID');

  // Validate changes
  if (changes.name !== undefined && changes.name.trim() === '') {
    throwInvalidArgument('name cannot be empty', 'TARGET-004');
  }

  if (changes.timeout !== undefined && !isTimeoutValid(changes.timeout)) {
    throwInvalidArgument('timeout must be positive and <= 300000ms', 'TARGET-005');
  }

  if (changes.endpoint !== undefined) {
    try {
      new URL(changes.endpoint);
    } catch {
      throwInvalidArgument('invalid URL', 'TARGET-006');
    }
  }

  // Check permissions
  await this.checkPermission(ctx, 'org.target', 'write', orgID);

  // Load existing target
  const wm = new TargetWriteModel(targetID, orgID);
  await wm.load(this.getEventstore(), targetID, orgID);

  if (!wm.exists()) {
    throwNotFound('target not found', 'TARGET-007');
  }

  // Generate new signing key if requested
  let newSigningKey: string | undefined;
  if (changes.rotateSigningKey) {
    newSigningKey = generateSigningKey();
  }

  // Check if there are actual changes
  const hasChanges = wm.hasChanges(changes) || changes.rotateSigningKey;
  if (!hasChanges) {
    return {
      signingKey: undefined,
      details: writeModelToObjectDetails(wm),
    };
  }

  // Build change payload
  const payload = wm.buildChangePayload({
    ...changes,
    signingKey: newSigningKey,
  });

  // Create event
  const command: Command = {
    eventType: 'target.changed',
    aggregateType: 'target',
    aggregateID: targetID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload,
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return {
    signingKey: newSigningKey, // Return new key if rotated
    details: writeModelToObjectDetails(wm),
  };
}

/**
 * Delete target permanently
 * Based on Go: DeleteTarget (action_v2_target.go:174)
 */
export async function removeTarget(
  this: Commands,
  ctx: Context,
  orgID: string,
  targetID: string
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');
  validateRequired(targetID, 'targetID');

  // Check permissions
  await this.checkPermission(ctx, 'org.target', 'delete', orgID);

  // Load existing target
  const wm = new TargetWriteModel(targetID, orgID);
  await wm.load(this.getEventstore(), targetID, orgID);

  if (!wm.exists()) {
    throwNotFound('target not found', 'TARGET-008');
  }

  // Create event
  const command: Command = {
    eventType: 'target.removed',
    aggregateType: 'target',
    aggregateID: targetID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      name: wm.name,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}
