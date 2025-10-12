/**
 * Organization Domain Policy Commands
 * 
 * Manages username and domain validation requirements
 * Based on Go: internal/command/org_policy_domain.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { OrgDomainPolicyWriteModel, PolicyState } from './org-domain-policy-write-model';

/**
 * Domain Policy configuration
 */
export interface DomainPolicyConfig {
  userLoginMustBeDomain: boolean;                   // Username must be email format
  validateOrgDomains: boolean;                      // Validate org domain ownership
  smtpSenderAddressMatchesInstanceDomain: boolean;  // SMTP sender must match domain
}

/**
 * Add Organization Domain Policy
 * Creates a custom domain policy for the organization
 * Based on Go: AddOrgDomainPolicy (org_policy_domain.go:14-31)
 */
export async function addOrgDomainPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  config: DomainPolicyConfig
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.write', 'write', orgID);

  // Load existing policy
  const wm = new OrgDomainPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state === PolicyState.ACTIVE) {
    throwAlreadyExists('Domain policy already exists', 'ORG-policy01');
  }

  // Create event
  const command: Command = {
    eventType: 'org.domain.policy.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userLoginMustBeDomain: config.userLoginMustBeDomain,
      validateOrgDomains: config.validateOrgDomains,
      smtpSenderAddressMatchesInstanceDomain: config.smtpSenderAddressMatchesInstanceDomain,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Change Organization Domain Policy
 * Updates the existing domain policy
 * Based on Go: ChangeOrgDomainPolicy (org_policy_domain.go:33-47)
 */
export async function changeOrgDomainPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  config: DomainPolicyConfig
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.write', 'write', orgID);

  // Load existing policy
  const wm = new OrgDomainPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.exists()) {
    throwNotFound('Domain policy not found', 'ORG-policy02');
  }

  // Check if anything changed
  if (!wm.hasChanged(
    config.userLoginMustBeDomain,
    config.validateOrgDomains,
    config.smtpSenderAddressMatchesInstanceDomain
  )) {
    // No changes, return current details
    return writeModelToObjectDetails(wm);
  }

  // Create event
  const command: Command = {
    eventType: 'org.domain.policy.changed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userLoginMustBeDomain: config.userLoginMustBeDomain,
      validateOrgDomains: config.validateOrgDomains,
      smtpSenderAddressMatchesInstanceDomain: config.smtpSenderAddressMatchesInstanceDomain,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove Organization Domain Policy
 * Removes the custom policy, falling back to instance default
 * Based on Go: RemoveOrgDomainPolicy (org_policy_domain.go:49-63)
 */
export async function removeOrgDomainPolicy(
  this: Commands,
  ctx: Context,
  orgID: string
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.delete', 'write', orgID);

  // Load existing policy
  const wm = new OrgDomainPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.exists()) {
    throwNotFound('Domain policy not found', 'ORG-policy03');
  }

  // Create event
  const command: Command = {
    eventType: 'org.domain.policy.removed',
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
