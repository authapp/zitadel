/**
 * Organization Login Policy Commands
 * 
 * Manages authentication policies including MFA, password requirements, and login methods
 * Based on Go: internal/command/org_policy_login.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwNotFound, throwAlreadyExists, throwInvalidArgument } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { OrgLoginPolicyWriteModel, LoginPolicyState } from './org-login-policy-write-model';

/**
 * Login policy configuration
 */
export interface OrgLoginPolicyConfig {
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
 * Add Organization Login Policy
 * Creates a custom login policy for the organization
 * Based on Go: AddOrgLoginPolicy (org_policy_login.go)
 */
export async function addOrgLoginPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  policy: OrgLoginPolicyConfig
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Validate lifetimes are positive
  if (policy.passwordCheckLifetime !== undefined && policy.passwordCheckLifetime < 0) {
    throwInvalidArgument('passwordCheckLifetime must be >= 0', 'ORG-LP01');
  }
  if (policy.externalLoginCheckLifetime !== undefined && policy.externalLoginCheckLifetime < 0) {
    throwInvalidArgument('externalLoginCheckLifetime must be >= 0', 'ORG-LP02');
  }
  if (policy.mfaInitSkipLifetime !== undefined && policy.mfaInitSkipLifetime < 0) {
    throwInvalidArgument('mfaInitSkipLifetime must be >= 0', 'ORG-LP03');
  }
  if (policy.secondFactorCheckLifetime !== undefined && policy.secondFactorCheckLifetime < 0) {
    throwInvalidArgument('secondFactorCheckLifetime must be >= 0', 'ORG-LP04');
  }
  if (policy.multiFactorCheckLifetime !== undefined && policy.multiFactorCheckLifetime < 0) {
    throwInvalidArgument('multiFactorCheckLifetime must be >= 0', 'ORG-LP05');
  }

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.write', 'write', orgID);

  // Load existing policy
  const wm = new OrgLoginPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state === LoginPolicyState.ACTIVE) {
    throwAlreadyExists('Login policy already exists', 'ORG-LP06');
  }

  // Create event
  const command: Command = {
    eventType: 'org.login.policy.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      allowUsernamePassword: policy.allowUsernamePassword ?? true,
      allowRegister: policy.allowRegister ?? true,
      allowExternalIDP: policy.allowExternalIDP ?? true,
      forceMFA: policy.forceMFA ?? false,
      forceMFALocalOnly: policy.forceMFALocalOnly ?? false,
      hidePasswordReset: policy.hidePasswordReset ?? false,
      ignoreUnknownUsernames: policy.ignoreUnknownUsernames ?? false,
      allowDomainDiscovery: policy.allowDomainDiscovery ?? true,
      disableLoginWithEmail: policy.disableLoginWithEmail ?? false,
      disableLoginWithPhone: policy.disableLoginWithPhone ?? false,
      defaultRedirectURI: policy.defaultRedirectURI || '',
      passwordCheckLifetime: policy.passwordCheckLifetime || 0,
      externalLoginCheckLifetime: policy.externalLoginCheckLifetime || 0,
      mfaInitSkipLifetime: policy.mfaInitSkipLifetime || 0,
      secondFactorCheckLifetime: policy.secondFactorCheckLifetime || 0,
      multiFactorCheckLifetime: policy.multiFactorCheckLifetime || 0,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Change Organization Login Policy
 * Updates the existing login policy
 * Based on Go: ChangeOrgLoginPolicy (org_policy_login.go)
 */
export async function changeOrgLoginPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  policy: OrgLoginPolicyConfig
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Validate lifetimes are positive
  if (policy.passwordCheckLifetime !== undefined && policy.passwordCheckLifetime < 0) {
    throwInvalidArgument('passwordCheckLifetime must be >= 0', 'ORG-LP01');
  }
  if (policy.externalLoginCheckLifetime !== undefined && policy.externalLoginCheckLifetime < 0) {
    throwInvalidArgument('externalLoginCheckLifetime must be >= 0', 'ORG-LP02');
  }
  if (policy.mfaInitSkipLifetime !== undefined && policy.mfaInitSkipLifetime < 0) {
    throwInvalidArgument('mfaInitSkipLifetime must be >= 0', 'ORG-LP03');
  }
  if (policy.secondFactorCheckLifetime !== undefined && policy.secondFactorCheckLifetime < 0) {
    throwInvalidArgument('secondFactorCheckLifetime must be >= 0', 'ORG-LP04');
  }
  if (policy.multiFactorCheckLifetime !== undefined && policy.multiFactorCheckLifetime < 0) {
    throwInvalidArgument('multiFactorCheckLifetime must be >= 0', 'ORG-LP05');
  }

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.write', 'write', orgID);

  // Load existing policy
  const wm = new OrgLoginPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.exists()) {
    throwNotFound('Login policy not found', 'ORG-LP07');
  }

  // Check if anything changed
  if (!wm.hasChanged(policy)) {
    // No changes, return current details
    return writeModelToObjectDetails(wm);
  }

  // Create event
  const command: Command = {
    eventType: 'org.login.policy.changed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      ...Object.fromEntries(
        Object.entries(policy).filter(([_, v]) => v !== undefined)
      ),
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove Organization Login Policy
 * Removes the custom policy, falling back to instance default
 * Based on Go: RemoveOrgLoginPolicy (org_policy_login.go)
 */
export async function removeOrgLoginPolicy(
  this: Commands,
  ctx: Context,
  orgID: string
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.delete', 'write', orgID);

  // Load existing policy
  const wm = new OrgLoginPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.exists()) {
    throwNotFound('Login policy not found', 'ORG-LP08');
  }

  // Create event
  const command: Command = {
    eventType: 'org.login.policy.removed',
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

/**
 * Add Second Factor to Organization Login Policy
 * Adds a second factor authentication method
 * Based on Go: AddSecondFactorToOrgLoginPolicy (org_policy_login.go)
 */
export async function addSecondFactorToOrgLoginPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  factorType: SecondFactorType
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  if (factorType === SecondFactorType.UNSPECIFIED) {
    throwInvalidArgument('factorType cannot be UNSPECIFIED', 'ORG-LP09');
  }

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.write', 'write', orgID);

  // Load existing policy
  const wm = new OrgLoginPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.exists()) {
    throwNotFound('Login policy not found', 'ORG-LP10');
  }

  if (wm.secondFactors.has(factorType)) {
    throwAlreadyExists('Second factor already exists', 'ORG-LP11');
  }

  // Create event
  const command: Command = {
    eventType: 'org.login.policy.second.factor.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      factorType,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove Second Factor from Organization Login Policy
 * Removes a second factor authentication method
 * Based on Go: RemoveSecondFactorFromOrgLoginPolicy (org_policy_login.go)
 */
export async function removeSecondFactorFromOrgLoginPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  factorType: SecondFactorType
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  if (factorType === SecondFactorType.UNSPECIFIED) {
    throwInvalidArgument('factorType cannot be UNSPECIFIED', 'ORG-LP12');
  }

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.write', 'write', orgID);

  // Load existing policy
  const wm = new OrgLoginPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.exists()) {
    throwNotFound('Login policy not found', 'ORG-LP13');
  }

  if (!wm.secondFactors.has(factorType)) {
    throwNotFound('Second factor not found', 'ORG-LP14');
  }

  // Create event
  const command: Command = {
    eventType: 'org.login.policy.second.factor.removed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      factorType,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Add Multi Factor to Organization Login Policy
 * Adds a multi-factor authentication method
 * Based on Go: AddMultiFactorToOrgLoginPolicy (org_policy_login.go)
 */
export async function addMultiFactorToOrgLoginPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  factorType: MultiFactorType
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  if (factorType === MultiFactorType.UNSPECIFIED) {
    throwInvalidArgument('factorType cannot be UNSPECIFIED', 'ORG-LP15');
  }

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.write', 'write', orgID);

  // Load existing policy
  const wm = new OrgLoginPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.exists()) {
    throwNotFound('Login policy not found', 'ORG-LP16');
  }

  if (wm.multiFactors.has(factorType)) {
    throwAlreadyExists('Multi factor already exists', 'ORG-LP17');
  }

  // Create event
  const command: Command = {
    eventType: 'org.login.policy.multi.factor.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      factorType,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove Multi Factor from Organization Login Policy
 * Removes a multi-factor authentication method
 * Based on Go: RemoveMultiFactorFromOrgLoginPolicy (org_policy_login.go)
 */
export async function removeMultiFactorFromOrgLoginPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  factorType: MultiFactorType
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  if (factorType === MultiFactorType.UNSPECIFIED) {
    throwInvalidArgument('factorType cannot be UNSPECIFIED', 'ORG-LP18');
  }

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.write', 'write', orgID);

  // Load existing policy
  const wm = new OrgLoginPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.exists()) {
    throwNotFound('Login policy not found', 'ORG-LP19');
  }

  if (!wm.multiFactors.has(factorType)) {
    throwNotFound('Multi factor not found', 'ORG-LP20');
  }

  // Create event
  const command: Command = {
    eventType: 'org.login.policy.multi.factor.removed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      factorType,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}
