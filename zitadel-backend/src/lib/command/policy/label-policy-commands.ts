/**
 * Label Policy Commands
 * 
 * Commands for managing organization and instance branding/theming policies
 * Based on Zitadel Go: internal/command/org_label_policy.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { LabelPolicyWriteModel, LabelPolicyData } from './label-policy-write-model';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';

/**
 * Add organization label policy
 */
export async function addOrgLabelPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: LabelPolicyData
): Promise<ObjectDetails> {
  // 1. Validate input
  validateRequired(orgID, 'orgID');
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'policy.label', 'create', orgID);
  
  // 3. Load write model
  const wm = new LabelPolicyWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (wm.exists()) {
    throwAlreadyExists('label policy already exists', 'COMMAND-LabelPolicy01');
  }
  
  // 4. Apply defaults if not provided
  const policyData = {
    primaryColor: data.primaryColor || '#5469d4',
    backgroundColor: data.backgroundColor || '#ffffff',
    warnColor: data.warnColor || '#ff3b5b',
    fontColor: data.fontColor || '#000000',
    primaryColorDark: data.primaryColorDark || '#2073c4',
    backgroundColorDark: data.backgroundColorDark || '#111827',
    warnColorDark: data.warnColorDark || '#ff3b5b',
    fontColorDark: data.fontColorDark || '#ffffff',
    logoURL: data.logoURL,
    iconURL: data.iconURL,
    logoURLDark: data.logoURLDark,
    iconURLDark: data.iconURLDark,
    fontURL: data.fontURL,
    hideLoginNameSuffix: data.hideLoginNameSuffix ?? false,
    errorMsgPopup: data.errorMsgPopup ?? false,
    disableWatermark: data.disableWatermark ?? false,
    themeMode: data.themeMode || 'auto',
  };
  
  // 5. Create command
  const command: Command = {
    eventType: 'org.label.policy.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: policyData,
  };
  
  // 6. Push to eventstore
  const event = await this.getEventstore().push(command);
  
  // 7. Update write model
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Change organization label policy
 */
export async function changeOrgLabelPolicy(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: LabelPolicyData
): Promise<ObjectDetails> {
  // 1. Validate input
  validateRequired(orgID, 'orgID');
  
  // At least one field must be provided
  if (!Object.keys(data).length) {
    throwInvalidArgument('at least one field must be provided', 'COMMAND-LabelPolicy02');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'policy.label', 'update', orgID);
  
  // 3. Load write model
  const wm = new LabelPolicyWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (!wm.exists()) {
    throwNotFound('label policy not found', 'COMMAND-LabelPolicy03');
  }
  
  // 4. Check if there are actual changes
  if (!wm.hasChanged(data)) {
    return writeModelToObjectDetails(wm); // Idempotent
  }
  
  // 5. Create command
  const command: Command = {
    eventType: 'org.label.policy.changed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: data,
  };
  
  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Remove organization label policy
 */
export async function removeOrgLabelPolicy(
  this: Commands,
  ctx: Context,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Validate input
  validateRequired(orgID, 'orgID');
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'policy.label', 'delete', orgID);
  
  // 3. Load write model
  const wm = new LabelPolicyWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (!wm.exists()) {
    throwNotFound('label policy not found', 'COMMAND-LabelPolicy04');
  }
  
  // 4. Create command
  const command: Command = {
    eventType: 'org.label.policy.removed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Add instance label policy
 */
export async function addInstanceLabelPolicy(
  this: Commands,
  ctx: Context,
  data: LabelPolicyData
): Promise<ObjectDetails> {
  // 1. Check permissions (instance level)
  await this.checkPermission(ctx, 'policy.label', 'create', ctx.instanceID);
  
  // 2. Load write model
  const wm = new LabelPolicyWriteModel('instance');
  await wm.load(this.getEventstore(), ctx.instanceID, ctx.instanceID);
  
  if (wm.exists()) {
    throwAlreadyExists('instance label policy already exists', 'COMMAND-LabelPolicy05');
  }
  
  // 3. Apply defaults if not provided
  const policyData = {
    primaryColor: data.primaryColor || '#5469d4',
    backgroundColor: data.backgroundColor || '#ffffff',
    warnColor: data.warnColor || '#ff3b5b',
    fontColor: data.fontColor || '#000000',
    primaryColorDark: data.primaryColorDark || '#2073c4',
    backgroundColorDark: data.backgroundColorDark || '#111827',
    warnColorDark: data.warnColorDark || '#ff3b5b',
    fontColorDark: data.fontColorDark || '#ffffff',
    logoURL: data.logoURL,
    iconURL: data.iconURL,
    logoURLDark: data.logoURLDark,
    iconURLDark: data.iconURLDark,
    fontURL: data.fontURL,
    hideLoginNameSuffix: data.hideLoginNameSuffix ?? false,
    errorMsgPopup: data.errorMsgPopup ?? false,
    disableWatermark: data.disableWatermark ?? false,
    themeMode: data.themeMode || 'auto',
  };
  
  // 4. Create command
  const command: Command = {
    eventType: 'instance.label.policy.added',
    aggregateType: 'instance',
    aggregateID: ctx.instanceID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: policyData,
  };
  
  // 5. Push to eventstore
  const event = await this.getEventstore().push(command);
  
  // 6. Update write model
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Change instance label policy
 */
export async function changeInstanceLabelPolicy(
  this: Commands,
  ctx: Context,
  data: LabelPolicyData
): Promise<ObjectDetails> {
  // 1. At least one field must be provided
  if (!Object.keys(data).length) {
    throwInvalidArgument('at least one field must be provided', 'COMMAND-LabelPolicy06');
  }
  
  // 2. Check permissions (instance level)
  await this.checkPermission(ctx, 'policy.label', 'update', ctx.instanceID);
  
  // 3. Load write model
  const wm = new LabelPolicyWriteModel('instance');
  await wm.load(this.getEventstore(), ctx.instanceID, ctx.instanceID);
  
  if (!wm.exists()) {
    throwNotFound('instance label policy not found', 'COMMAND-LabelPolicy07');
  }
  
  // 4. Check if there are actual changes
  if (!wm.hasChanged(data)) {
    return writeModelToObjectDetails(wm); // Idempotent
  }
  
  // 5. Create command
  const command: Command = {
    eventType: 'instance.label.policy.changed',
    aggregateType: 'instance',
    aggregateID: ctx.instanceID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: data,
  };
  
  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Remove instance label policy (not typically used, but included for completeness)
 */
export async function removeInstanceLabelPolicy(
  this: Commands,
  ctx: Context
): Promise<ObjectDetails> {
  // 1. Check permissions (instance level)
  await this.checkPermission(ctx, 'policy.label', 'delete', ctx.instanceID);
  
  // 2. Load write model
  const wm = new LabelPolicyWriteModel('instance');
  await wm.load(this.getEventstore(), ctx.instanceID, ctx.instanceID);
  
  if (!wm.exists()) {
    throwNotFound('instance label policy not found', 'COMMAND-LabelPolicy08');
  }
  
  // 3. Create command (note: instance policies typically reset rather than remove)
  const command: Command = {
    eventType: 'instance.label.policy.removed',
    aggregateType: 'instance',
    aggregateID: ctx.instanceID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };
  
  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}
