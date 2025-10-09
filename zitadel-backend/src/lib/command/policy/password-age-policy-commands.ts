/**
 * Password Age Policy Commands (Phase 3)
 * 
 * Implements password age policy management following Zitadel Go patterns
 * Based on: internal/command/instance_policy_password_age.go
 */

import { Context } from '../context';
import { Commands } from '../commands';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { PasswordAgePolicyWriteModel, PasswordAgePolicyState } from './password-age-policy-write-model';
import { Command } from '../../eventstore/types';
import { prepareCommands, Validation } from '../preparation';

/**
 * Password age policy data
 */
export interface PasswordAgePolicyData {
  expireWarnDays: number;
  maxAgeDays: number;
}

/**
 * Add default password age policy command
 */
export async function addDefaultPasswordAgePolicy(
  this: Commands,
  ctx: Context,
  expireWarnDays: number,
  maxAgeDays: number
): Promise<ObjectDetails> {
  // 1. Validate input
  if (expireWarnDays < 0) {
    throwInvalidArgument('expireWarnDays must be non-negative', 'COMMAND-Policy01');
  }
  if (maxAgeDays < 0) {
    throwInvalidArgument('maxAgeDays must be non-negative', 'COMMAND-Policy02');
  }
  if (expireWarnDays > maxAgeDays && maxAgeDays > 0) {
    throwInvalidArgument('expireWarnDays cannot be greater than maxAgeDays', 'COMMAND-Policy03');
  }

  // 2. Use preparation pattern like Go implementation
  const validation: Validation<ObjectDetails> = () => 
    prepareAddDefaultPasswordAgePolicy.call(this, ctx.instanceID, expireWarnDays, maxAgeDays);

  const result = await prepareCommands(ctx, this.getEventstore(), [validation]);
  return result[0];
}

/**
 * Change default password age policy command
 */
export async function changeDefaultPasswordAgePolicy(
  this: Commands,
  ctx: Context,
  policy: PasswordAgePolicyData
): Promise<ObjectDetails> {
  // 1. Validate input
  if (policy.expireWarnDays < 0) {
    throwInvalidArgument('expireWarnDays must be non-negative', 'COMMAND-Policy10');
  }
  if (policy.maxAgeDays < 0) {
    throwInvalidArgument('maxAgeDays must be non-negative', 'COMMAND-Policy11');
  }
  if (policy.expireWarnDays > policy.maxAgeDays && policy.maxAgeDays > 0) {
    throwInvalidArgument('expireWarnDays cannot be greater than maxAgeDays', 'COMMAND-Policy12');
  }

  // 2. Load existing policy
  const existingPolicy = await getDefaultPasswordAgePolicyWriteModel.call(this, ctx);
  if (existingPolicy.state === PasswordAgePolicyState.UNSPECIFIED) {
    throwNotFound('password age policy not found', 'COMMAND-Policy13');
  }

  // 3. Check if anything changed
  if (existingPolicy.expireWarnDays === policy.expireWarnDays && 
      existingPolicy.maxAgeDays === policy.maxAgeDays) {
    throwPreconditionFailed('no changes detected', 'COMMAND-Policy14');
  }

  // 4. Use preparation pattern
  const validation: Validation<ObjectDetails> = () => 
    prepareChangeDefaultPasswordAgePolicy.call(this, ctx.instanceID, policy, existingPolicy);

  const result = await prepareCommands(ctx, this.getEventstore(), [validation]);
  return result[0];
}

/**
 * Remove default password age policy command
 */
export async function removeDefaultPasswordAgePolicy(
  this: Commands,
  ctx: Context
): Promise<ObjectDetails> {
  // 1. Load existing policy
  const existingPolicy = await getDefaultPasswordAgePolicyWriteModel.call(this, ctx);
  if (existingPolicy.state === PasswordAgePolicyState.UNSPECIFIED) {
    throwNotFound('password age policy not found', 'COMMAND-Policy20');
  }

  // 2. Use preparation pattern
  const validation: Validation<ObjectDetails> = () => 
    prepareRemoveDefaultPasswordAgePolicy.call(this, ctx.instanceID, existingPolicy);

  const result = await prepareCommands(ctx, this.getEventstore(), [validation]);
  return result[0];
}

/**
 * Add organization password age policy command
 */
export async function addOrgPasswordAgePolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  expireWarnDays: number,
  maxAgeDays: number
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!orgID) {
    throwInvalidArgument('orgID is required', 'COMMAND-Policy30');
  }
  if (expireWarnDays < 0) {
    throwInvalidArgument('expireWarnDays must be non-negative', 'COMMAND-Policy31');
  }
  if (maxAgeDays < 0) {
    throwInvalidArgument('maxAgeDays must be non-negative', 'COMMAND-Policy32');
  }

  // 2. Check permissions
  await this.checkPermission(ctx, 'org.policy', 'create', orgID);

  // 3. Use preparation pattern
  const validation: Validation<ObjectDetails> = () => 
    prepareAddOrgPasswordAgePolicy.call(this, orgID, expireWarnDays, maxAgeDays);

  const result = await prepareCommands(ctx, this.getEventstore(), [validation]);
  return result[0];
}

/**
 * Preparation functions (following Go patterns)
 */
async function prepareAddDefaultPasswordAgePolicy(
  this: Commands,
  instanceID: string,
  expireWarnDays: number,
  maxAgeDays: number
) {
  return async (ctx: Context, eventstore: any): Promise<ObjectDetails> => {
    // Load write model to check if policy already exists
    const wm = new PasswordAgePolicyWriteModel();
    await wm.load(eventstore, instanceID, instanceID);

    if (wm.state !== PasswordAgePolicyState.UNSPECIFIED) {
      throwPreconditionFailed('password age policy already exists', 'COMMAND-Policy04');
    }

    // Create command
    const command: Command = {
      eventType: 'instance.policy.password_age.added',
      aggregateType: 'instance',
      aggregateID: instanceID,
      owner: instanceID,
      instanceID: instanceID,
      creator: ctx.userID || 'system',
      payload: {
        expireWarnDays,
        maxAgeDays,
      },
    };

    // Push and update
    const event = await eventstore.push(command);
    appendAndReduce(wm, event);

    return writeModelToObjectDetails(wm);
  };
}

async function prepareChangeDefaultPasswordAgePolicy(
  this: Commands,
  instanceID: string,
  policy: PasswordAgePolicyData,
  existingPolicy: PasswordAgePolicyWriteModel
) {
  return async (ctx: Context, eventstore: any): Promise<ObjectDetails> => {
    // Create command
    const command: Command = {
      eventType: 'instance.policy.password_age.changed',
      aggregateType: 'instance',
      aggregateID: instanceID,
      owner: instanceID,
      instanceID: instanceID,
      creator: ctx.userID || 'system',
      payload: {
        expireWarnDays: policy.expireWarnDays,
        maxAgeDays: policy.maxAgeDays,
      },
    };

    // Push and update
    const event = await eventstore.push(command);
    appendAndReduce(existingPolicy, event);

    return writeModelToObjectDetails(existingPolicy);
  };
}

async function prepareRemoveDefaultPasswordAgePolicy(
  this: Commands,
  instanceID: string,
  existingPolicy: PasswordAgePolicyWriteModel
) {
  return async (ctx: Context, eventstore: any): Promise<ObjectDetails> => {
    // Create command
    const command: Command = {
      eventType: 'instance.policy.password_age.removed',
      aggregateType: 'instance',
      aggregateID: instanceID,
      owner: instanceID,
      instanceID: instanceID,
      creator: ctx.userID || 'system',
      payload: {},
    };

    // Push and update
    const event = await eventstore.push(command);
    appendAndReduce(existingPolicy, event);

    return writeModelToObjectDetails(existingPolicy);
  };
}

async function prepareAddOrgPasswordAgePolicy(
  this: Commands,
  orgID: string,
  expireWarnDays: number,
  maxAgeDays: number
) {
  return async (ctx: Context, eventstore: any): Promise<ObjectDetails> => {
    // Load write model to check if policy already exists
    const wm = new PasswordAgePolicyWriteModel();
    await wm.load(eventstore, orgID, orgID);

    if (wm.state !== PasswordAgePolicyState.UNSPECIFIED) {
      throwPreconditionFailed('password age policy already exists', 'COMMAND-Policy33');
    }

    // Create command
    const command: Command = {
      eventType: 'org.policy.password_age.added',
      aggregateType: 'org',
      aggregateID: orgID,
      owner: orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        expireWarnDays,
        maxAgeDays,
      },
    };

    // Push and update
    const event = await eventstore.push(command);
    appendAndReduce(wm, event);

    return writeModelToObjectDetails(wm);
  };
}

/**
 * Helper method to get password age policy write model
 */
async function getDefaultPasswordAgePolicyWriteModel(
  this: Commands,
  ctx: Context
): Promise<PasswordAgePolicyWriteModel> {
  const wm = new PasswordAgePolicyWriteModel();
  await wm.load(this.getEventstore(), ctx.instanceID, ctx.instanceID);
  return wm;
}
