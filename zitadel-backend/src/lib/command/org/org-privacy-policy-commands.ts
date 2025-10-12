/**
 * Organization Privacy Policy Commands
 * 
 * Manages terms of service, privacy links, and support information
 * Based on Go: internal/command/org_policy_privacy.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { OrgPrivacyPolicyWriteModel, PolicyState } from './org-privacy-policy-write-model';

/**
 * Privacy Policy configuration
 */
export interface PrivacyPolicyConfig {
  tosLink?: string;          // Terms of service URL
  privacyLink?: string;      // Privacy policy URL
  helpLink?: string;         // Help/support URL
  supportEmail?: string;     // Support email address
  docsLink?: string;         // Documentation URL
  customLink?: string;       // Custom link URL
  customLinkText?: string;   // Custom link display text
}

/**
 * Add Organization Privacy Policy
 * Creates a custom privacy policy for the organization
 * Based on Go: AddPrivacyPolicy (org_policy_privacy.go:32-76)
 */
export async function addOrgPrivacyPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  config: PrivacyPolicyConfig
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.write', 'write', orgID);

  // Load existing policy
  const wm = new OrgPrivacyPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state === PolicyState.ACTIVE) {
    throwAlreadyExists('Privacy policy already exists', 'ORG-privacy01');
  }

  // Create event
  const command: Command = {
    eventType: 'org.privacy.policy.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      tosLink: config.tosLink || '',
      privacyLink: config.privacyLink || '',
      helpLink: config.helpLink || '',
      supportEmail: config.supportEmail || '',
      docsLink: config.docsLink || '',
      customLink: config.customLink || '',
      customLinkText: config.customLinkText || '',
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Change Organization Privacy Policy
 * Updates the existing privacy policy
 * Based on Go: ChangePrivacyPolicy (org_policy_privacy.go:78-114)
 */
export async function changeOrgPrivacyPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  config: PrivacyPolicyConfig
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.write', 'write', orgID);

  // Load existing policy
  const wm = new OrgPrivacyPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.exists()) {
    throwNotFound('Privacy policy not found', 'ORG-privacy02');
  }

  // Check if anything changed
  if (!wm.hasChanged(
    config.tosLink || '',
    config.privacyLink || '',
    config.helpLink || '',
    config.supportEmail || '',
    config.docsLink || '',
    config.customLink || '',
    config.customLinkText || ''
  )) {
    // No changes, but not an error - return current details
    return writeModelToObjectDetails(wm);
  }

  // Create event
  const command: Command = {
    eventType: 'org.privacy.policy.changed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      tosLink: config.tosLink || '',
      privacyLink: config.privacyLink || '',
      helpLink: config.helpLink || '',
      supportEmail: config.supportEmail || '',
      docsLink: config.docsLink || '',
      customLink: config.customLink || '',
      customLinkText: config.customLinkText || '',
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove Organization Privacy Policy
 * Removes the custom policy, falling back to instance default
 * Based on Go: RemovePrivacyPolicy (org_policy_privacy.go:116-134)
 */
export async function removeOrgPrivacyPolicy(
  this: Commands,
  ctx: Context,
  orgID: string
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.delete', 'write', orgID);

  // Load existing policy
  const wm = new OrgPrivacyPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.exists()) {
    throwNotFound('Privacy policy not found', 'ORG-privacy03');
  }

  // Create event
  const command: Command = {
    eventType: 'org.privacy.policy.removed',
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
