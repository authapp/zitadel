/**
 * Login Policy Commands (Phase 3)
 * 
 * Implements login policy management following Zitadel Go patterns
 * Based on: internal/command/instance_policy_login.go
 */

import { Context } from '../context';
import { Commands } from '../commands';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { LoginPolicyWriteModel, LoginPolicyState } from './login-policy-write-model';
import { Command } from '../../eventstore/types';
import { prepareCommands, Validation } from '../preparation';

/**
 * Login policy data
 */
export interface LoginPolicyData {
  allowUsernamePassword?: boolean;
  allowRegister?: boolean;
  allowExternalIDP?: boolean;
  forceMFA?: boolean;
  forceMFALocalOnly?: boolean;
  hidePasswordReset?: boolean;
  ignoreUnknownUsernames?: boolean;
  allowDomainDiscovery?: boolean;
  disableLoginWithEmail?: boolean;
  disableLoginWithPhone?: boolean;
  defaultRedirectURI?: string;
  passwordCheckLifetime?: number; // in seconds
  externalLoginCheckLifetime?: number; // in seconds
  mfaInitSkipLifetime?: number; // in seconds
  secondFactorCheckLifetime?: number; // in seconds
  multiFactorCheckLifetime?: number; // in seconds
}

/**
 * Multi-factor type
 */
export enum MultiFactorType {
  UNSPECIFIED = 0,
  OTP = 1,
  U2F = 2,
}

/**
 * Second factor type
 */
export enum SecondFactorType {
  UNSPECIFIED = 0,
  OTP = 1,
  U2F = 2,
  OTP_EMAIL = 3,
  OTP_SMS = 4,
}

/**
 * Add default login policy command
 */
export async function addDefaultLoginPolicy(
  this: Commands,
  ctx: Context,
  policy: LoginPolicyData
): Promise<ObjectDetails> {
  // 1. Validate input
  validateLoginPolicyData(policy);

  // 2. Use preparation pattern
  const validation: Validation<ObjectDetails> = () => 
    prepareAddDefaultLoginPolicy.call(this, ctx.instanceID, policy);

  const result = await prepareCommands(ctx, this.getEventstore(), [validation]);
  return result[0];
}

/**
 * Change default login policy command
 */
export async function changeDefaultLoginPolicy(
  this: Commands,
  ctx: Context,
  policy: LoginPolicyData
): Promise<ObjectDetails> {
  // 1. Validate input
  validateLoginPolicyData(policy);

  // 2. Load existing policy
  const existingPolicy = await getDefaultLoginPolicyWriteModel.call(this, ctx);
  if (existingPolicy.state === LoginPolicyState.UNSPECIFIED) {
    throwNotFound('login policy not found', 'COMMAND-LoginPolicy10');
  }

  // 3. Use preparation pattern
  const validation: Validation<ObjectDetails> = () => 
    prepareChangeDefaultLoginPolicy.call(this, ctx.instanceID, policy, existingPolicy);

  const result = await prepareCommands(ctx, this.getEventstore(), [validation]);
  return result[0];
}

/**
 * Add second factor to default login policy
 */
export async function addSecondFactorToDefaultLoginPolicy(
  this: Commands,
  ctx: Context,
  factorType: SecondFactorType
): Promise<ObjectDetails> {
  // 1. Validate input
  if (factorType === SecondFactorType.UNSPECIFIED) {
    throwInvalidArgument('factor type cannot be unspecified', 'COMMAND-LoginPolicy20');
  }

  // 2. Load existing policy
  const existingPolicy = await getDefaultLoginPolicyWriteModel.call(this, ctx);
  if (existingPolicy.state === LoginPolicyState.UNSPECIFIED) {
    throwNotFound('login policy not found', 'COMMAND-LoginPolicy21');
  }

  // 3. Check if factor already exists
  if (existingPolicy.secondFactors.includes(factorType)) {
    throwPreconditionFailed('second factor already exists', 'COMMAND-LoginPolicy22');
  }

  // 4. Use preparation pattern
  const validation: Validation<ObjectDetails> = () => 
    prepareAddSecondFactorToDefaultLoginPolicy.call(this, ctx.instanceID, factorType, existingPolicy);

  const result = await prepareCommands(ctx, this.getEventstore(), [validation]);
  return result[0];
}

/**
 * Remove second factor from default login policy
 */
export async function removeSecondFactorFromDefaultLoginPolicy(
  this: Commands,
  ctx: Context,
  factorType: SecondFactorType
): Promise<ObjectDetails> {
  // 1. Validate input
  if (factorType === SecondFactorType.UNSPECIFIED) {
    throwInvalidArgument('factor type cannot be unspecified', 'COMMAND-LoginPolicy30');
  }

  // 2. Load existing policy
  const existingPolicy = await getDefaultLoginPolicyWriteModel.call(this, ctx);
  if (existingPolicy.state === LoginPolicyState.UNSPECIFIED) {
    throwNotFound('login policy not found', 'COMMAND-LoginPolicy31');
  }

  // 3. Check if factor exists
  if (!existingPolicy.secondFactors.includes(factorType)) {
    throwPreconditionFailed('second factor does not exist', 'COMMAND-LoginPolicy32');
  }

  // 4. Use preparation pattern
  const validation: Validation<ObjectDetails> = () => 
    prepareRemoveSecondFactorFromDefaultLoginPolicy.call(this, ctx.instanceID, factorType, existingPolicy);

  const result = await prepareCommands(ctx, this.getEventstore(), [validation]);
  return result[0];
}

/**
 * Add multi factor to default login policy
 */
export async function addMultiFactorToDefaultLoginPolicy(
  this: Commands,
  ctx: Context,
  factorType: MultiFactorType
): Promise<ObjectDetails> {
  // 1. Validate input
  if (factorType === MultiFactorType.UNSPECIFIED) {
    throwInvalidArgument('factor type cannot be unspecified', 'COMMAND-LoginPolicy40');
  }

  // 2. Load existing policy
  const existingPolicy = await getDefaultLoginPolicyWriteModel.call(this, ctx);
  if (existingPolicy.state === LoginPolicyState.UNSPECIFIED) {
    throwNotFound('login policy not found', 'COMMAND-LoginPolicy41');
  }

  // 3. Check if factor already exists
  if (existingPolicy.multiFactors.includes(factorType)) {
    throwPreconditionFailed('multi factor already exists', 'COMMAND-LoginPolicy42');
  }

  // 4. Use preparation pattern
  const validation: Validation<ObjectDetails> = () => 
    prepareAddMultiFactorToDefaultLoginPolicy.call(this, ctx.instanceID, factorType, existingPolicy);

  const result = await prepareCommands(ctx, this.getEventstore(), [validation]);
  return result[0];
}

/**
 * Validation helper
 */
function validateLoginPolicyData(policy: LoginPolicyData): void {
  if (policy.passwordCheckLifetime !== undefined && policy.passwordCheckLifetime < 0) {
    throwInvalidArgument('passwordCheckLifetime must be non-negative', 'COMMAND-LoginPolicy01');
  }
  if (policy.externalLoginCheckLifetime !== undefined && policy.externalLoginCheckLifetime < 0) {
    throwInvalidArgument('externalLoginCheckLifetime must be non-negative', 'COMMAND-LoginPolicy02');
  }
  if (policy.mfaInitSkipLifetime !== undefined && policy.mfaInitSkipLifetime < 0) {
    throwInvalidArgument('mfaInitSkipLifetime must be non-negative', 'COMMAND-LoginPolicy03');
  }
  if (policy.secondFactorCheckLifetime !== undefined && policy.secondFactorCheckLifetime < 0) {
    throwInvalidArgument('secondFactorCheckLifetime must be non-negative', 'COMMAND-LoginPolicy04');
  }
  if (policy.multiFactorCheckLifetime !== undefined && policy.multiFactorCheckLifetime < 0) {
    throwInvalidArgument('multiFactorCheckLifetime must be non-negative', 'COMMAND-LoginPolicy05');
  }
}

/**
 * Preparation functions
 */
async function prepareAddDefaultLoginPolicy(
  this: Commands,
  instanceID: string,
  policy: LoginPolicyData
) {
  return async (ctx: Context, eventstore: any): Promise<ObjectDetails> => {
    // Load write model to check if policy already exists
    const wm = new LoginPolicyWriteModel();
    await wm.load(eventstore, instanceID, instanceID);

    if (wm.state !== LoginPolicyState.UNSPECIFIED) {
      throwPreconditionFailed('login policy already exists', 'COMMAND-LoginPolicy06');
    }

    // Create command
    const command: Command = {
      eventType: 'instance.policy.login.added',
      aggregateType: 'instance',
      aggregateID: instanceID,
      owner: instanceID,
      instanceID: instanceID,
      creator: ctx.userID || 'system',
      payload: policy,
    };

    // Push and update
    const event = await eventstore.push(command);
    appendAndReduce(wm, event);

    return writeModelToObjectDetails(wm);
  };
}

async function prepareChangeDefaultLoginPolicy(
  this: Commands,
  instanceID: string,
  policy: LoginPolicyData,
  existingPolicy: LoginPolicyWriteModel
) {
  return async (ctx: Context, eventstore: any): Promise<ObjectDetails> => {
    // Create command
    const command: Command = {
      eventType: 'instance.policy.login.changed',
      aggregateType: 'instance',
      aggregateID: instanceID,
      owner: instanceID,
      instanceID: instanceID,
      creator: ctx.userID || 'system',
      payload: policy,
    };

    // Push and update
    const event = await eventstore.push(command);
    appendAndReduce(existingPolicy, event);

    return writeModelToObjectDetails(existingPolicy);
  };
}

async function prepareAddSecondFactorToDefaultLoginPolicy(
  this: Commands,
  instanceID: string,
  factorType: SecondFactorType,
  existingPolicy: LoginPolicyWriteModel
) {
  return async (ctx: Context, eventstore: any): Promise<ObjectDetails> => {
    // Create command
    const command: Command = {
      eventType: 'instance.policy.login.second_factor.added',
      aggregateType: 'instance',
      aggregateID: instanceID,
      owner: instanceID,
      instanceID: instanceID,
      creator: ctx.userID || 'system',
      payload: {
        factorType,
      },
    };

    // Push and update
    const event = await eventstore.push(command);
    appendAndReduce(existingPolicy, event);

    return writeModelToObjectDetails(existingPolicy);
  };
}

async function prepareRemoveSecondFactorFromDefaultLoginPolicy(
  this: Commands,
  instanceID: string,
  factorType: SecondFactorType,
  existingPolicy: LoginPolicyWriteModel
) {
  return async (ctx: Context, eventstore: any): Promise<ObjectDetails> => {
    // Create command
    const command: Command = {
      eventType: 'instance.policy.login.second_factor.removed',
      aggregateType: 'instance',
      aggregateID: instanceID,
      owner: instanceID,
      instanceID: instanceID,
      creator: ctx.userID || 'system',
      payload: {
        factorType,
      },
    };

    // Push and update
    const event = await eventstore.push(command);
    appendAndReduce(existingPolicy, event);

    return writeModelToObjectDetails(existingPolicy);
  };
}

async function prepareAddMultiFactorToDefaultLoginPolicy(
  this: Commands,
  instanceID: string,
  factorType: MultiFactorType,
  existingPolicy: LoginPolicyWriteModel
) {
  return async (ctx: Context, eventstore: any): Promise<ObjectDetails> => {
    // Create command
    const command: Command = {
      eventType: 'instance.policy.login.multi_factor.added',
      aggregateType: 'instance',
      aggregateID: instanceID,
      owner: instanceID,
      instanceID: instanceID,
      creator: ctx.userID || 'system',
      payload: {
        factorType,
      },
    };

    // Push and update
    const event = await eventstore.push(command);
    appendAndReduce(existingPolicy, event);

    return writeModelToObjectDetails(existingPolicy);
  };
}

/**
 * Helper method to get login policy write model
 */
async function getDefaultLoginPolicyWriteModel(
  this: Commands,
  ctx: Context
): Promise<LoginPolicyWriteModel> {
  const wm = new LoginPolicyWriteModel();
  await wm.load(this.getEventstore(), ctx.instanceID, ctx.instanceID);
  return wm;
}
