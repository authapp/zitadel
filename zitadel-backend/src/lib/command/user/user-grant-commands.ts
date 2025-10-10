/**
 * User Grant Commands (Zitadel v2)
 * 
 * User grant operations - granting users access to projects
 * Based on Go: internal/command/user_grant.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { WriteModel } from '../write-model';

/**
 * User Grant Write Model (simplified)
 */
class UserGrantWriteModel extends WriteModel {
  userID?: string;
  projectID?: string;
  projectGrantID?: string;
  roleKeys: string[] = [];
  state: 'UNSPECIFIED' | 'ACTIVE' | 'REMOVED' = 'UNSPECIFIED';

  constructor() {
    super('usergrant');
  }

  reduce(event: any): void {
    switch (event.eventType) {
      case 'user.grant.added':
        this.state = 'ACTIVE';
        this.userID = event.payload?.userID;
        this.projectID = event.payload?.projectID;
        this.projectGrantID = event.payload?.projectGrantID;
        this.roleKeys = event.payload?.roleKeys || [];
        break;
      case 'user.grant.changed':
        this.roleKeys = event.payload?.roleKeys || [];
        break;
      case 'user.grant.removed':
        this.state = 'REMOVED';
        break;
    }
  }
}

/**
 * Add user grant data
 */
export interface AddUserGrantData {
  userID: string;
  projectID: string;
  projectGrantID?: string;
  roleKeys: string[];
}

/**
 * Add user grant command
 * Based on Go: AddUserGrant (user_grant.go:21-39)
 */
export async function addUserGrant(
  this: Commands,
  ctx: Context,
  data: AddUserGrantData
): Promise<ObjectDetails & { grantID: string }> {
  validateRequired(data.userID, 'userID');
  validateRequired(data.projectID, 'projectID');
  
  if (!data.roleKeys || data.roleKeys.length === 0) {
    throwInvalidArgument('at least one role required', 'COMMAND-UGr10');
  }
  
  // Generate grant ID
  const grantID = await this.nextID();
  
  // Check permissions
  await this.checkPermission(ctx, 'user.grant', 'create', ctx.orgID);
  
  const command: Command = {
    eventType: 'user.grant.added',
    aggregateType: 'usergrant',
    aggregateID: grantID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userID: data.userID,
      projectID: data.projectID,
      projectGrantID: data.projectGrantID,
      roleKeys: data.roleKeys,
    },
  };
  
  const wm = new UserGrantWriteModel();
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return {
    ...writeModelToObjectDetails(wm),
    grantID,
  };
}

/**
 * Change user grant data
 */
export interface ChangeUserGrantData {
  grantID: string;
  roleKeys: string[];
}

/**
 * Change user grant command
 * Based on Go: ChangeUserGrant (user_grant.go:67-120)
 */
export async function changeUserGrant(
  this: Commands,
  ctx: Context,
  data: ChangeUserGrantData
): Promise<ObjectDetails> {
  validateRequired(data.grantID, 'grantID');
  
  if (!data.roleKeys || data.roleKeys.length === 0) {
    throwInvalidArgument('at least one role required', 'COMMAND-UGr20');
  }
  
  // Load existing grant
  const wm = new UserGrantWriteModel();
  await wm.load(this.getEventstore(), data.grantID, ctx.orgID);
  
  if (wm.state === 'UNSPECIFIED' || wm.state === 'REMOVED') {
    throwNotFound('user grant not found', 'COMMAND-UGr21');
  }
  
  // Check if roles changed
  const rolesEqual = wm.roleKeys.length === data.roleKeys.length &&
    wm.roleKeys.every(role => data.roleKeys.includes(role));
  
  if (rolesEqual) {
    throwPreconditionFailed('user grant not changed', 'COMMAND-UGr22');
  }
  
  // Check permissions
  await this.checkPermission(ctx, 'user.grant', 'update', ctx.orgID);
  
  const command: Command = {
    eventType: 'user.grant.changed',
    aggregateType: 'usergrant',
    aggregateID: data.grantID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      roleKeys: data.roleKeys,
    },
  };
  
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Remove user grant command
 * Based on Go: RemoveUserGrant (user_grant.go:219-236)
 */
export async function removeUserGrant(
  this: Commands,
  ctx: Context,
  grantID: string
): Promise<ObjectDetails> {
  validateRequired(grantID, 'grantID');
  
  // Load existing grant
  const wm = new UserGrantWriteModel();
  await wm.load(this.getEventstore(), grantID, ctx.orgID);
  
  if (wm.state === 'UNSPECIFIED' || wm.state === 'REMOVED') {
    throwNotFound('user grant not found', 'COMMAND-UGr30');
  }
  
  // Check permissions
  await this.checkPermission(ctx, 'user.grant', 'delete', ctx.orgID);
  
  const command: Command = {
    eventType: 'user.grant.removed',
    aggregateType: 'usergrant',
    aggregateID: grantID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };
  
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Generate machine user secret command
 * Based on Go: GenerateMachineSecret (user_machine_secret.go:18-35)
 */
export interface GenerateMachineSecretResult {
  clientID: string;
  clientSecret: string;
  details: ObjectDetails;
}

export async function generateMachineSecret(
  this: Commands,
  ctx: Context,
  userID: string
): Promise<GenerateMachineSecretResult> {
  validateRequired(userID, 'userID');
  
  // Check permissions
  await this.checkPermission(ctx, 'user.machine', 'update', ctx.orgID);
  
  // Generate client secret (simplified - in production, use proper crypto)
  const clientSecret = await this.nextID();
  
  const command: Command = {
    eventType: 'user.machine.secret.set',
    aggregateType: 'user',
    aggregateID: userID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      clientSecret, // In production, hash this before storing
    },
  };
  
  await this.getEventstore().push(command);
  
  return {
    clientID: userID,
    clientSecret,
    details: {
      sequence: 0n,
      eventDate: new Date(),
      resourceOwner: ctx.orgID,
    },
  };
}

/**
 * Remove machine user secret command
 * Based on Go: RemoveMachineSecret (user_machine_secret.go:66-83)
 */
export async function removeMachineSecret(
  this: Commands,
  ctx: Context,
  userID: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  
  // Check permissions
  await this.checkPermission(ctx, 'user.machine', 'update', ctx.orgID);
  
  const command: Command = {
    eventType: 'user.machine.secret.removed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };
  
  await this.getEventstore().push(command);
  
  return {
    sequence: 0n,
    eventDate: new Date(),
    resourceOwner: ctx.orgID,
  };
}

/**
 * Add personal access token command
 * Based on Go: AddPersonalAccessToken (user_personal_access_token.go)
 */
export interface AddPersonalAccessTokenData {
  userID: string;
  expirationDate?: Date;
  scopes?: string[];
}

export interface AddPersonalAccessTokenResult {
  tokenID: string;
  token: string;
  details: ObjectDetails;
}

export async function addPersonalAccessToken(
  this: Commands,
  ctx: Context,
  data: AddPersonalAccessTokenData
): Promise<AddPersonalAccessTokenResult> {
  validateRequired(data.userID, 'userID');
  
  // Check permissions
  await this.checkPermission(ctx, 'user.token', 'create', ctx.orgID);
  
  // Generate token ID and token (simplified)
  const tokenID = await this.nextID();
  const token = await this.nextID();
  
  const command: Command = {
    eventType: 'user.token.added',
    aggregateType: 'user',
    aggregateID: data.userID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      tokenID,
      expirationDate: data.expirationDate?.toISOString(),
      scopes: data.scopes || [],
    },
  };
  
  await this.getEventstore().push(command);
  
  return {
    tokenID,
    token,
    details: {
      sequence: 0n,
      eventDate: new Date(),
      resourceOwner: ctx.orgID,
    },
  };
}

/**
 * Remove personal access token command
 * Based on Go: RemovePersonalAccessToken (user_personal_access_token.go)
 */
export async function removePersonalAccessToken(
  this: Commands,
  ctx: Context,
  userID: string,
  tokenID: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(tokenID, 'tokenID');
  
  // Check permissions
  await this.checkPermission(ctx, 'user.token', 'delete', ctx.orgID);
  
  const command: Command = {
    eventType: 'user.token.removed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: { tokenID },
  };
  
  await this.getEventstore().push(command);
  
  return {
    sequence: 0n,
    eventDate: new Date(),
    resourceOwner: ctx.orgID,
  };
}
