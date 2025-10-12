/**
 * Organization Mail Template Policy Commands
 * 
 * Manages custom email templates for organizations
 * Based on Go: internal/command/org_policy_mail_template.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwNotFound, throwAlreadyExists, throwPreconditionFailed } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { OrgMailTemplatePolicyWriteModel, PolicyState } from './org-mail-template-policy-write-model';

/**
 * Mail Template Policy configuration
 */
export interface MailTemplatePolicyConfig {
  template: string;  // HTML template for emails
}

/**
 * Add Organization Mail Template Policy
 * Creates a custom mail template for the organization
 * Based on Go: AddMailTemplate (org_policy_mail_template.go:11-37)
 */
export async function addOrgMailTemplatePolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  config: MailTemplatePolicyConfig
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');
  validateRequired(config.template, 'template');

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.write', 'write', orgID);

  // Load existing policy
  const wm = new OrgMailTemplatePolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state === PolicyState.ACTIVE) {
    throwAlreadyExists('Mail template policy already exists', 'ORG-mailtemplate01');
  }

  // Validate template
  if (!wm.isValid(config.template)) {
    throwPreconditionFailed('Mail template is invalid', 'ORG-mailtemplate02');
  }

  // Create event
  const command: Command = {
    eventType: 'org.mail.template.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      template: config.template,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Change Organization Mail Template Policy
 * Updates the existing mail template
 * Based on Go: ChangeMailTemplate (org_policy_mail_template.go:39-70)
 */
export async function changeOrgMailTemplatePolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  config: MailTemplatePolicyConfig
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');
  validateRequired(config.template, 'template');

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.write', 'write', orgID);

  // Load existing policy
  const wm = new OrgMailTemplatePolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.exists()) {
    throwNotFound('Mail template policy not found', 'ORG-mailtemplate03');
  }

  // Validate template
  if (!wm.isValid(config.template)) {
    throwPreconditionFailed('Mail template is invalid', 'ORG-mailtemplate04');
  }

  // Check if anything changed
  if (!wm.hasChanged(config.template)) {
    // No changes, return current details
    return writeModelToObjectDetails(wm);
  }

  // Create event
  const command: Command = {
    eventType: 'org.mail.template.changed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      template: config.template,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove Organization Mail Template Policy
 * Removes the custom template, falling back to instance default
 * Based on Go: RemoveMailTemplate (org_policy_mail_template.go:72-89)
 */
export async function removeOrgMailTemplatePolicy(
  this: Commands,
  ctx: Context,
  orgID: string
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.delete', 'write', orgID);

  // Load existing policy
  const wm = new OrgMailTemplatePolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.exists()) {
    throwNotFound('Mail template policy not found', 'ORG-mailtemplate05');
  }

  // Create event
  const command: Command = {
    eventType: 'org.mail.template.removed',
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
