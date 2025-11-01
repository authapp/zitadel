/**
 * Instance Privacy Policy Commands
 * 
 * Manages instance-level terms of service, privacy links, and support information
 * Based on Go: internal/command/instance_policy_privacy.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwNotFound, throwInvalidArgument } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { OrgPrivacyPolicyWriteModel } from '../org/org-privacy-policy-write-model';

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
 * Change Default (Instance-level) Privacy Policy
 * Updates the instance-level privacy policy
 */
export async function changeDefaultPrivacyPolicy(
  this: Commands,
  ctx: Context,
  config: PrivacyPolicyConfig
): Promise<ObjectDetails> {
  // 1. Validate input
  const instanceID = ctx.instanceID;
  validateRequired(instanceID, 'instanceID');
  
  // At least one field must be provided
  if (!Object.keys(config).length) {
    throwInvalidArgument('at least one field must be provided', 'COMMAND-PrivacyPolicy10');
  }

  // 2. Check permissions (instance-level)
  await this.checkPermission(ctx, 'policy.privacy', 'update', instanceID);

  // 3. Load existing policy (reuse org write model with instance aggregate type)
  const wm = new OrgPrivacyPolicyWriteModel(instanceID);
  wm.aggregateType = 'instance';
  await wm.load(this.getEventstore(), instanceID, instanceID);

  if (!wm.exists()) {
    throwNotFound('default privacy policy not found', 'COMMAND-PrivacyPolicy11');
  }

  // 4. Check if there are actual changes
  const hasChanges = 
    (config.tosLink !== undefined && config.tosLink !== wm.tosLink) ||
    (config.privacyLink !== undefined && config.privacyLink !== wm.privacyLink) ||
    (config.helpLink !== undefined && config.helpLink !== wm.helpLink) ||
    (config.supportEmail !== undefined && config.supportEmail !== wm.supportEmail) ||
    (config.docsLink !== undefined && config.docsLink !== wm.docsLink) ||
    (config.customLink !== undefined && config.customLink !== wm.customLink) ||
    (config.customLinkText !== undefined && config.customLinkText !== wm.customLinkText);

  if (!hasChanges) {
    return writeModelToObjectDetails(wm); // Idempotent
  }

  // 5. Create command (instance-level event)
  const command: Command = {
    eventType: 'instance.privacy.policy.changed',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: instanceID,
    creator: ctx.userID || 'system',
    payload: {
      tosLink: config.tosLink !== undefined ? config.tosLink : wm.tosLink,
      privacyLink: config.privacyLink !== undefined ? config.privacyLink : wm.privacyLink,
      helpLink: config.helpLink !== undefined ? config.helpLink : wm.helpLink,
      supportEmail: config.supportEmail !== undefined ? config.supportEmail : wm.supportEmail,
      docsLink: config.docsLink !== undefined ? config.docsLink : wm.docsLink,
      customLink: config.customLink !== undefined ? config.customLink : wm.customLink,
      customLinkText: config.customLinkText !== undefined ? config.customLinkText : wm.customLinkText,
    },
  };

  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}
