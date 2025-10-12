/**
 * Organization Notification Policy Commands
 * 
 * Manages email notification settings
 * Based on Go: internal/command/org_policy_notification.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { OrgNotificationPolicyWriteModel, PolicyState } from './org-notification-policy-write-model';

/**
 * Notification Policy configuration
 */
export interface NotificationPolicyConfig {
  passwordChange: boolean;  // Send email notification on password change
}

/**
 * Add Organization Notification Policy
 * Creates a custom notification policy for the organization
 * Based on Go: AddNotificationPolicy (org_policy_notification.go:13-27)
 */
export async function addOrgNotificationPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  config: NotificationPolicyConfig
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.write', 'write', orgID);

  // Load existing policy
  const wm = new OrgNotificationPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state === PolicyState.ACTIVE) {
    throwAlreadyExists('Notification policy already exists', 'ORG-notification01');
  }

  // Create event
  const command: Command = {
    eventType: 'org.notification.policy.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      passwordChange: config.passwordChange,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Change Organization Notification Policy
 * Updates the existing notification policy
 * Based on Go: ChangeNotificationPolicy (org_policy_notification.go:54-68)
 */
export async function changeOrgNotificationPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  config: NotificationPolicyConfig
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.write', 'write', orgID);

  // Load existing policy
  const wm = new OrgNotificationPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.exists()) {
    throwNotFound('Notification policy not found', 'ORG-notification02');
  }

  // Check if anything changed
  if (!wm.hasChanged(config.passwordChange)) {
    // No changes, return current details
    return writeModelToObjectDetails(wm);
  }

  // Create event
  const command: Command = {
    eventType: 'org.notification.policy.changed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      passwordChange: config.passwordChange,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove Organization Notification Policy
 * Removes the custom policy, falling back to instance default
 * Based on Go: RemoveNotificationPolicy (org_policy_notification.go:100-114)
 */
export async function removeOrgNotificationPolicy(
  this: Commands,
  ctx: Context,
  orgID: string
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'org.policy.delete', 'write', orgID);

  // Load existing policy
  const wm = new OrgNotificationPolicyWriteModel(orgID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (!wm.exists()) {
    throwNotFound('Notification policy not found', 'ORG-notification03');
  }

  // Create event
  const command: Command = {
    eventType: 'org.notification.policy.removed',
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
