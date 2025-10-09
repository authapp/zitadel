/**
 * Instance Commands (Phase 3)
 * 
 * Implements instance-level operations and policies
 */

import { Context } from '../context';
import { Commands } from '../commands';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed, throwAlreadyExists } from '@/zerrors/errors';
import { InstanceWriteModel, InstanceState } from './instance-write-model';
import { Command } from '../../eventstore/types';

/**
 * Instance setup data
 */
export interface SetupInstanceData {
  instanceID?: string;
  instanceName: string;
  defaultOrgName: string;
  adminUser: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    password?: string;
  };
  customDomain?: string;
  defaultLanguage?: string;
}

/**
 * Domain data
 */
export interface AddInstanceDomainData {
  domain: string;
  isGenerated?: boolean;
}

/**
 * Feature configuration
 */
export interface FeatureConfig {
  loginDefaultOrg?: boolean;
  triggerIntrospectionProjections?: boolean;
  legacyIntrospection?: boolean;
  userSchema?: boolean;
  tokenExchange?: boolean;
  actions?: boolean;
  improvedPerformance?: boolean;
}

/**
 * Setup instance command
 */
export async function setupInstance(
  this: Commands,
  _ctx: Context,
  data: SetupInstanceData
): Promise<ObjectDetails & { instanceID: string; orgID: string; userID: string }> {
  // 1. Validate input
  if (!data.instanceName || !data.instanceName.trim()) {
    throwInvalidArgument('instance name is required', 'COMMAND-Instance01');
  }
  if (!data.defaultOrgName || !data.defaultOrgName.trim()) {
    throwInvalidArgument('default organization name is required', 'COMMAND-Instance02');
  }
  if (!data.adminUser.username || !data.adminUser.email) {
    throwInvalidArgument('admin user credentials are required', 'COMMAND-Instance03');
  }

  // 2. Generate instance ID if not provided
  if (!data.instanceID) {
    data.instanceID = await this.nextID();
  }

  // 3. Check if instance already exists
  const wm = new InstanceWriteModel();
  await wm.load(this.getEventstore(), data.instanceID, data.instanceID);

  if (wm.state !== InstanceState.UNSPECIFIED) {
    throwAlreadyExists('instance already exists', 'COMMAND-Instance04');
  }

  // 4. Generate IDs for org and admin user
  const orgID = await this.nextID();
  const userID = await this.nextID();

  // 5. Create instance setup command
  const command: Command = {
    eventType: 'instance.setup',
    aggregateType: 'instance',
    aggregateID: data.instanceID,
    owner: data.instanceID,
    instanceID: data.instanceID,
    creator: 'system',
    payload: {
      instanceName: data.instanceName,
      defaultOrgName: data.defaultOrgName,
      defaultOrgID: orgID,
      adminUserID: userID,
      adminUser: data.adminUser,
      customDomain: data.customDomain,
      defaultLanguage: data.defaultLanguage || 'en',
    },
  };

  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return {
    ...writeModelToObjectDetails(wm),
    instanceID: data.instanceID,
    orgID,
    userID,
  };
}

/**
 * Add instance domain command
 */
export async function addInstanceDomain(
  this: Commands,
  ctx: Context,
  instanceID: string,
  data: AddInstanceDomainData
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!data.domain || !data.domain.trim()) {
    throwInvalidArgument('domain is required', 'COMMAND-Instance10');
  }

  // 2. Load instance write model
  const wm = new InstanceWriteModel();
  await wm.load(this.getEventstore(), instanceID, instanceID);

  if (wm.state === InstanceState.UNSPECIFIED) {
    throwNotFound('instance not found', 'COMMAND-Instance11');
  }

  // 3. Check permissions (system level)
  await this.checkPermission(ctx, 'instance.domain', 'create', instanceID);

  // 4. Check if domain already exists
  if (wm.domains.has(data.domain)) {
    throwAlreadyExists('domain already exists', 'COMMAND-Instance12');
  }

  // 5. Create command
  const command: Command = {
    eventType: 'instance.domain.added',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: instanceID,
    creator: ctx.userID || 'system',
    payload: {
      domain: data.domain,
      isGenerated: data.isGenerated || false,
    },
  };

  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Set default domain command
 */
export async function setDefaultInstanceDomain(
  this: Commands,
  ctx: Context,
  instanceID: string,
  domain: string
): Promise<ObjectDetails> {
  // 1. Load instance write model
  const wm = new InstanceWriteModel();
  await wm.load(this.getEventstore(), instanceID, instanceID);

  if (wm.state === InstanceState.UNSPECIFIED) {
    throwNotFound('instance not found', 'COMMAND-Instance20');
  }

  // 2. Check permissions
  await this.checkPermission(ctx, 'instance.domain', 'update', instanceID);

  // 3. Check if domain exists
  if (!wm.domains.has(domain)) {
    throwNotFound('domain not found', 'COMMAND-Instance21');
  }

  // 4. Check if already default
  if (wm.defaultDomain === domain) {
    throwPreconditionFailed('domain already default', 'COMMAND-Instance22');
  }

  // 5. Create command
  const command: Command = {
    eventType: 'instance.domain.default.set',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: instanceID,
    creator: ctx.userID || 'system',
    payload: {
      domain,
    },
  };

  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove instance domain command
 */
export async function removeInstanceDomain(
  this: Commands,
  ctx: Context,
  instanceID: string,
  domain: string
): Promise<ObjectDetails> {
  // 1. Load instance write model
  const wm = new InstanceWriteModel();
  await wm.load(this.getEventstore(), instanceID, instanceID);

  if (wm.state === InstanceState.UNSPECIFIED) {
    throwNotFound('instance not found', 'COMMAND-Instance30');
  }

  // 2. Check permissions
  await this.checkPermission(ctx, 'instance.domain', 'delete', instanceID);

  // 3. Check if domain exists
  if (!wm.domains.has(domain)) {
    throwNotFound('domain not found', 'COMMAND-Instance31');
  }

  // 4. Check if it's the default domain
  if (wm.defaultDomain === domain) {
    throwPreconditionFailed('cannot remove default domain', 'COMMAND-Instance32');
  }

  // 5. Create command
  const command: Command = {
    eventType: 'instance.domain.removed',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: instanceID,
    creator: ctx.userID || 'system',
    payload: {
      domain,
    },
  };

  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Set instance features command
 */
export async function setInstanceFeatures(
  this: Commands,
  ctx: Context,
  instanceID: string,
  features: FeatureConfig
): Promise<ObjectDetails> {
  // 1. Load instance write model
  const wm = new InstanceWriteModel();
  await wm.load(this.getEventstore(), instanceID, instanceID);

  if (wm.state === InstanceState.UNSPECIFIED) {
    throwNotFound('instance not found', 'COMMAND-Instance40');
  }

  // 2. Check permissions
  await this.checkPermission(ctx, 'instance.features', 'update', instanceID);

  // 3. Create command
  const command: Command = {
    eventType: 'instance.features.set',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: instanceID,
    creator: ctx.userID || 'system',
    payload: features,
  };

  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Reset instance features to defaults command
 */
export async function resetInstanceFeatures(
  this: Commands,
  ctx: Context,
  instanceID: string
): Promise<ObjectDetails> {
  // 1. Load instance write model
  const wm = new InstanceWriteModel();
  await wm.load(this.getEventstore(), instanceID, instanceID);

  if (wm.state === InstanceState.UNSPECIFIED) {
    throwNotFound('instance not found', 'COMMAND-Instance50');
  }

  // 2. Check permissions
  await this.checkPermission(ctx, 'instance.features', 'update', instanceID);

  // 3. Create command
  const command: Command = {
    eventType: 'instance.features.reset',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };

  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Add instance member command
 */
export async function addInstanceMember(
  this: Commands,
  ctx: Context,
  instanceID: string,
  userID: string,
  roles: string[]
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!userID) {
    throwInvalidArgument('userID is required', 'COMMAND-Instance60');
  }
  if (!roles || roles.length === 0) {
    throwInvalidArgument('at least one role is required', 'COMMAND-Instance61');
  }

  // 2. Load instance write model
  const wm = new InstanceWriteModel();
  await wm.load(this.getEventstore(), instanceID, instanceID);

  if (wm.state === InstanceState.UNSPECIFIED) {
    throwNotFound('instance not found', 'COMMAND-Instance62');
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'instance.member', 'create', instanceID);

  // 4. Check if member already exists
  if (wm.members.has(userID)) {
    throwAlreadyExists('member already exists', 'COMMAND-Instance63');
  }

  // 5. Create command
  const command: Command = {
    eventType: 'instance.member.added',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userID,
      roles,
    },
  };

  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Change instance member roles command
 */
export async function changeInstanceMember(
  this: Commands,
  ctx: Context,
  instanceID: string,
  userID: string,
  roles: string[]
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!roles || roles.length === 0) {
    throwInvalidArgument('at least one role is required', 'COMMAND-Instance70');
  }

  // 2. Load instance write model
  const wm = new InstanceWriteModel();
  await wm.load(this.getEventstore(), instanceID, instanceID);

  if (wm.state === InstanceState.UNSPECIFIED) {
    throwNotFound('instance not found', 'COMMAND-Instance71');
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'instance.member', 'update', instanceID);

  // 4. Check if member exists
  if (!wm.members.has(userID)) {
    throwNotFound('member not found', 'COMMAND-Instance72');
  }

  // 5. Create command
  const command: Command = {
    eventType: 'instance.member.changed',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userID,
      roles,
    },
  };

  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove instance member command
 */
export async function removeInstanceMember(
  this: Commands,
  ctx: Context,
  instanceID: string,
  userID: string
): Promise<ObjectDetails> {
  // 1. Load instance write model
  const wm = new InstanceWriteModel();
  await wm.load(this.getEventstore(), instanceID, instanceID);

  if (wm.state === InstanceState.UNSPECIFIED) {
    throwNotFound('instance not found', 'COMMAND-Instance80');
  }

  // 2. Check permissions
  await this.checkPermission(ctx, 'instance.member', 'delete', instanceID);

  // 3. Check if member exists
  if (!wm.members.has(userID)) {
    throwNotFound('member not found', 'COMMAND-Instance81');
  }

  // 4. Create command
  const command: Command = {
    eventType: 'instance.member.removed',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userID,
    },
  };

  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}
