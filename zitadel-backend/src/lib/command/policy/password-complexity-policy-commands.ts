/**
 * Password Complexity Policy Commands (Zitadel v2)
 * 
 * Manages password requirements (length, character types)
 * Based on Go: internal/command/org_policy_password_complexity.go & instance_policy_password_complexity.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { WriteModel } from '../write-model';

/**
 * Password Complexity Policy data
 */
export interface PasswordComplexityPolicyData {
  minLength: number;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

/**
 * Password Complexity Policy Write Model
 */
class PasswordComplexityPolicyWriteModel extends WriteModel {
  minLength: number = 8;
  hasLowercase: boolean = true;
  hasUppercase: boolean = true;
  hasNumber: boolean = true;
  hasSymbol: boolean = true;
  isDefault: boolean = true; // true = using default/instance policy, false = has org-specific policy

  constructor(aggregateType: 'instance' | 'org' = 'org') {
    super(aggregateType);
  }

  reduce(event: any): void {
    switch (event.eventType) {
      case 'instance.password.complexity.policy.added':
      case 'org.password.complexity.policy.added':
        this.isDefault = false;
        this.minLength = event.payload?.minLength ?? 8;
        this.hasLowercase = event.payload?.hasLowercase ?? true;
        this.hasUppercase = event.payload?.hasUppercase ?? true;
        this.hasNumber = event.payload?.hasNumber ?? true;
        this.hasSymbol = event.payload?.hasSymbol ?? true;
        break;
      case 'instance.password.complexity.policy.changed':
      case 'org.password.complexity.policy.changed':
        if (event.payload?.minLength !== undefined) {
          this.minLength = event.payload.minLength;
        }
        if (event.payload?.hasLowercase !== undefined) {
          this.hasLowercase = event.payload.hasLowercase;
        }
        if (event.payload?.hasUppercase !== undefined) {
          this.hasUppercase = event.payload.hasUppercase;
        }
        if (event.payload?.hasNumber !== undefined) {
          this.hasNumber = event.payload.hasNumber;
        }
        if (event.payload?.hasSymbol !== undefined) {
          this.hasSymbol = event.payload.hasSymbol;
        }
        break;
      case 'org.password.complexity.policy.removed':
        this.isDefault = true;
        break;
    }
  }
}

/**
 * Add default (instance-level) password complexity policy
 * Based on Go: AddDefaultPasswordComplexityPolicy (instance_policy_password_complexity.go:15-26)
 */
export async function addDefaultPasswordComplexityPolicy(
  this: Commands,
  ctx: Context,
  data: PasswordComplexityPolicyData
): Promise<ObjectDetails> {
  if (data.minLength < 1) {
    throwInvalidArgument('minLength must be at least 1', 'POLICY-PC10');
  }

  await this.checkPermission(ctx, 'instance.policy', 'create', ctx.instanceID);

  const command: Command = {
    eventType: 'instance.password.complexity.policy.added',
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
 * Change default (instance-level) password complexity policy
 * Based on Go: ChangeDefaultPasswordComplexityPolicy (instance_policy_password_complexity.go:28-57)
 */
export async function changeDefaultPasswordComplexityPolicy(
  this: Commands,
  ctx: Context,
  data: Partial<PasswordComplexityPolicyData>
): Promise<ObjectDetails> {
  if (data.minLength !== undefined && data.minLength < 1) {
    throwInvalidArgument('minLength must be at least 1', 'POLICY-PC20');
  }

  await this.checkPermission(ctx, 'instance.policy', 'update', ctx.instanceID);

  const command: Command = {
    eventType: 'instance.password.complexity.policy.changed',
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
 * Remove default password complexity policy (revert to system defaults)
 * Based on Go: RemoveDefaultPasswordComplexityPolicy (instance_policy_password_complexity.go)
 */
export async function removeDefaultPasswordComplexityPolicy(
  this: Commands,
  ctx: Context
): Promise<ObjectDetails> {
  await this.checkPermission(ctx, 'instance.policy', 'delete', ctx.instanceID);

  const command: Command = {
    eventType: 'instance.password.complexity.policy.removed',
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
 * Add organization-specific password complexity policy
 * Based on Go: AddPasswordComplexityPolicy (org_policy_password_complexity.go:35-73)
 */
export async function addOrgPasswordComplexityPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: PasswordComplexityPolicyData
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  if (data.minLength < 1) {
    throwInvalidArgument('minLength must be at least 1', 'POLICY-PC30');
  }

  await this.checkPermission(ctx, 'org.policy', 'create', orgID);

  // Check if policy already exists
  const wm = new PasswordComplexityPolicyWriteModel('org');
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.isDefault) {
    throwAlreadyExists('password complexity policy already exists', 'POLICY-PC31');
  }

  const command: Command = {
    eventType: 'org.password.complexity.policy.added',
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
 * Change organization password complexity policy
 * Based on Go: ChangePasswordComplexityPolicy (org_policy_password_complexity.go:75-107)
 */
export async function changeOrgPasswordComplexityPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: Partial<PasswordComplexityPolicyData>
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  if (data.minLength !== undefined && data.minLength < 1) {
    throwInvalidArgument('minLength must be at least 1', 'POLICY-PC40');
  }

  await this.checkPermission(ctx, 'org.policy', 'update', orgID);

  const wm = new PasswordComplexityPolicyWriteModel('org');
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.isDefault) {
    throwNotFound('password complexity policy not found', 'POLICY-PC41');
  }

  const command: Command = {
    eventType: 'org.password.complexity.policy.changed',
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
 * Remove organization password complexity policy (revert to default)
 * Based on Go: RemovePasswordComplexityPolicy (org_policy_password_complexity.go:109-127)
 */
export async function removeOrgPasswordComplexityPolicy(
  this: Commands,
  ctx: Context,
  orgID: string
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  await this.checkPermission(ctx, 'org.policy', 'delete', orgID);

  const wm = new PasswordComplexityPolicyWriteModel('org');
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.isDefault) {
    throwNotFound('password complexity policy not found', 'POLICY-PC50');
  }

  const command: Command = {
    eventType: 'org.password.complexity.policy.removed',
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
