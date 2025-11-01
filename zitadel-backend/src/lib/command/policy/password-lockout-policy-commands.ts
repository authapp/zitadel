/**
 * Password Lockout Policy Commands (Zitadel v2)
 * 
 * Manages account lockout settings after failed login attempts
 * Based on Go: internal/command/org_policy_lockout.go & instance_policy_password_lockout.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { WriteModel } from '../write-model';

/**
 * Password Lockout Policy data
 */
export interface PasswordLockoutPolicyData {
  maxPasswordAttempts?: number; // Max failed password attempts before lockout
  maxOTPAttempts?: number;       // Max failed OTP attempts before lockout
  showLockoutFailures?: boolean; // Show remaining attempts to user
}

/**
 * Password Lockout Policy Write Model
 */
class PasswordLockoutPolicyWriteModel extends WriteModel {
  maxPasswordAttempts: number = 5;
  maxOTPAttempts: number = 5;
  showLockoutFailures: boolean = true;
  isDefault: boolean = true; // true = using default/instance policy, false = has org-specific policy

  constructor(aggregateType: 'instance' | 'org' = 'org') {
    super(aggregateType);
  }

  reduce(event: any): void {
    switch (event.eventType) {
      case 'instance.password.lockout.policy.added':
      case 'org.lockout.policy.added':
        this.isDefault = false;
        this.maxPasswordAttempts = event.payload?.maxPasswordAttempts ?? 5;
        this.maxOTPAttempts = event.payload?.maxOTPAttempts ?? 5;
        this.showLockoutFailures = event.payload?.showLockoutFailures ?? true;
        break;
      case 'instance.password.lockout.policy.changed':
      case 'org.lockout.policy.changed':
        if (event.payload?.maxPasswordAttempts !== undefined) {
          this.maxPasswordAttempts = event.payload.maxPasswordAttempts;
        }
        if (event.payload?.maxOTPAttempts !== undefined) {
          this.maxOTPAttempts = event.payload.maxOTPAttempts;
        }
        if (event.payload?.showLockoutFailures !== undefined) {
          this.showLockoutFailures = event.payload.showLockoutFailures;
        }
        break;
      case 'org.lockout.policy.removed':
        this.isDefault = true;
        break;
    }
  }
}

/**
 * Add default (instance-level) password lockout policy
 * Based on Go: AddDefaultPasswordLockoutPolicy (instance_policy_password_lockout.go)
 */
export async function addDefaultPasswordLockoutPolicy(
  this: Commands,
  ctx: Context,
  data: PasswordLockoutPolicyData
): Promise<ObjectDetails> {
  if (data.maxPasswordAttempts !== undefined && data.maxPasswordAttempts < 1) {
    throwInvalidArgument('maxPasswordAttempts must be at least 1', 'POLICY-PL10');
  }
  if (data.maxOTPAttempts !== undefined && data.maxOTPAttempts < 1) {
    throwInvalidArgument('maxOTPAttempts must be at least 1', 'POLICY-PL11');
  }

  await this.checkPermission(ctx, 'instance.policy', 'create', ctx.instanceID);

  const command: Command = {
    eventType: 'instance.password.lockout.policy.added',
    aggregateType: 'instance',
    aggregateID: ctx.instanceID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: data,
  };

  await this.getEventstore().push(command);

  return {
    sequence: 0n,
    eventDate: new Date(),
    resourceOwner: ctx.instanceID,
  };
}

/**
 * Change default (instance-level) password lockout policy
 * Based on Go: ChangeDefaultPasswordLockoutPolicy (instance_policy_password_lockout.go)
 */
export async function changeDefaultPasswordLockoutPolicy(
  this: Commands,
  ctx: Context,
  data: Partial<PasswordLockoutPolicyData>
): Promise<ObjectDetails> {
  if (data.maxPasswordAttempts !== undefined && data.maxPasswordAttempts < 1) {
    throwInvalidArgument('maxPasswordAttempts must be at least 1', 'POLICY-PL20');
  }
  if (data.maxOTPAttempts !== undefined && data.maxOTPAttempts < 1) {
    throwInvalidArgument('maxOTPAttempts must be at least 1', 'POLICY-PL21');
  }

  await this.checkPermission(ctx, 'instance.policy', 'update', ctx.instanceID);

  const command: Command = {
    eventType: 'instance.password.lockout.policy.changed',
    aggregateType: 'instance',
    aggregateID: ctx.instanceID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: data,
  };

  await this.getEventstore().push(command);

  return {
    sequence: 0n,
    eventDate: new Date(),
    resourceOwner: ctx.instanceID,
  };
}

/**
 * Remove default password lockout policy (revert to system defaults)
 * Based on Go: RemoveDefaultPasswordLockoutPolicy (instance_policy_password_lockout.go)
 */
export async function removeDefaultPasswordLockoutPolicy(
  this: Commands,
  ctx: Context
): Promise<ObjectDetails> {
  await this.checkPermission(ctx, 'instance.policy', 'delete', ctx.instanceID);

  const command: Command = {
    eventType: 'instance.password.lockout.policy.removed',
    aggregateType: 'instance',
    aggregateID: ctx.instanceID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };

  await this.getEventstore().push(command);

  return {
    sequence: 0n,
    eventDate: new Date(),
    resourceOwner: ctx.instanceID,
  };
}

/**
 * Add organization-specific password lockout policy
 * Based on Go: AddLockoutPolicy (org_policy_lockout.go:13-44)
 */
export async function addOrgPasswordLockoutPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: PasswordLockoutPolicyData
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  if (data.maxPasswordAttempts !== undefined && data.maxPasswordAttempts < 1) {
    throwInvalidArgument('maxPasswordAttempts must be at least 1', 'POLICY-PL30');
  }
  if (data.maxOTPAttempts !== undefined && data.maxOTPAttempts < 1) {
    throwInvalidArgument('maxOTPAttempts must be at least 1', 'POLICY-PL31');
  }

  await this.checkPermission(ctx, 'org.policy', 'create', orgID);

  // Check if policy already exists
  const wm = new PasswordLockoutPolicyWriteModel('org');
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.isDefault) {
    throwAlreadyExists('password lockout policy already exists', 'POLICY-PL31');
  }

  const command: Command = {
    eventType: 'org.lockout.policy.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: data,
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Change organization password lockout policy
 * Based on Go: ChangeLockoutPolicy (org_policy_lockout.go:46-73)
 */
export async function changeOrgPasswordLockoutPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: Partial<PasswordLockoutPolicyData>
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  if (data.maxPasswordAttempts !== undefined && data.maxPasswordAttempts < 1) {
    throwInvalidArgument('maxPasswordAttempts must be at least 1', 'POLICY-PL40');
  }

  await this.checkPermission(ctx, 'org.policy', 'update', orgID);

  const wm = new PasswordLockoutPolicyWriteModel('org');
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.isDefault) {
    throwNotFound('password lockout policy not found', 'POLICY-PL41');
  }

  const command: Command = {
    eventType: 'org.lockout.policy.changed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: data,
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove organization password lockout policy (revert to default)
 * Based on Go: RemoveLockoutPolicy (org_policy_lockout.go:75-92)
 */
export async function removeOrgPasswordLockoutPolicy(
  this: Commands,
  ctx: Context,
  orgID: string
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  await this.checkPermission(ctx, 'org.policy', 'delete', orgID);

  const wm = new PasswordLockoutPolicyWriteModel('org');
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.isDefault) {
    throwNotFound('password lockout policy not found', 'POLICY-PL50');
  }

  const command: Command = {
    eventType: 'org.lockout.policy.removed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}
