/**
 * Application Commands (Zitadel v2)
 * 
 * All application-related write operations
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { AppWriteModel, AppState, AppType, OIDCAppType, OIDCAuthMethodType } from './app-write-model';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired, validateLength, validateURL } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists, throwPreconditionFailed } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { ProjectWriteModel, ProjectState } from '../project/project-write-model';

/**
 * Add OIDC App Data
 */
export interface AddOIDCAppData {
  appID?: string;
  projectID: string;
  orgID: string;
  name: string;
  oidcAppType: OIDCAppType;
  redirectURIs: string[];
  responseTypes?: string[];
  grantTypes?: string[];
  authMethodType?: OIDCAuthMethodType;
  postLogoutRedirectURIs?: string[];
  devMode?: boolean;
  accessTokenType?: number;
  accessTokenRoleAssertion?: boolean;
  idTokenRoleAssertion?: boolean;
  idTokenUserinfoAssertion?: boolean;
  clockSkew?: number;
  additionalOrigins?: string[];
}

/**
 * Add OIDC application command
 */
export async function addOIDCApp(
  this: Commands,
  ctx: Context,
  data: AddOIDCAppData
): Promise<ObjectDetails & { appID: string }> {
  // 1. Validate input
  validateRequired(data.name, 'name');
  validateLength(data.name, 'name', 1, 200);
  validateRequired(data.projectID, 'projectID');
  validateRequired(data.orgID, 'orgID');
  
  if (!data.redirectURIs || data.redirectURIs.length === 0) {
    throwInvalidArgument('at least one redirect URI required', 'COMMAND-App10');
  }
  
  // Validate redirect URIs
  for (const uri of data.redirectURIs) {
    validateURL(uri, 'redirectURI');
  }
  
  // 2. Generate app ID if not provided
  if (!data.appID) {
    data.appID = await this.nextID();
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'application', 'create', data.orgID);
  
  // 4. Verify project exists
  const projectWM = new ProjectWriteModel();
  await projectWM.load(this.getEventstore(), data.projectID, data.orgID);
  
  if (projectWM.state !== ProjectState.ACTIVE) {
    throwNotFound('project not found or inactive', 'COMMAND-App11');
  }
  
  // 5. Load app write model
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), data.appID, data.orgID);
  
  if (wm.state !== AppState.UNSPECIFIED) {
    throwAlreadyExists('application already exists', 'COMMAND-App12');
  }
  
  // 6. Create command
  const command: Command = {
    eventType: 'application.oidc.added',
    aggregateType: 'application',
    aggregateID: data.appID,
    owner: data.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      name: data.name,
      projectID: data.projectID,
      oidcAppType: data.oidcAppType,
      redirectURIs: data.redirectURIs,
      responseTypes: data.responseTypes || ['code'],
      grantTypes: data.grantTypes || ['authorization_code'],
      authMethodType: data.authMethodType ?? OIDCAuthMethodType.BASIC,
      postLogoutRedirectURIs: data.postLogoutRedirectURIs || [],
      devMode: data.devMode ?? false,
      accessTokenType: data.accessTokenType ?? 0,
      accessTokenRoleAssertion: data.accessTokenRoleAssertion ?? false,
      idTokenRoleAssertion: data.idTokenRoleAssertion ?? false,
      idTokenUserinfoAssertion: data.idTokenUserinfoAssertion ?? false,
      clockSkew: data.clockSkew ?? 0,
      additionalOrigins: data.additionalOrigins || [],
    },
  };
  
  // 7. Push to eventstore
  const event = await this.getEventstore().push(command);
  
  // 8. Update write model
  appendAndReduce(wm, event);
  
  return {
    ...writeModelToObjectDetails(wm),
    appID: data.appID,
  };
}

/**
 * Update OIDC App Data
 */
export interface UpdateOIDCAppData {
  name?: string;
  redirectURIs?: string[];
  responseTypes?: string[];
  grantTypes?: string[];
  authMethodType?: OIDCAuthMethodType;
  postLogoutRedirectURIs?: string[];
  devMode?: boolean;
  accessTokenType?: number;
  accessTokenRoleAssertion?: boolean;
  idTokenRoleAssertion?: boolean;
  idTokenUserinfoAssertion?: boolean;
  clockSkew?: number;
  additionalOrigins?: string[];
}

/**
 * Update OIDC application command
 */
export async function updateOIDCApp(
  this: Commands,
  ctx: Context,
  appID: string,
  projectID: string,
  orgID: string,
  data: UpdateOIDCAppData
): Promise<ObjectDetails> {
  // 1. Validate at least one field
  if (!data.name && 
      !data.redirectURIs && 
      !data.responseTypes &&
      !data.grantTypes &&
      data.authMethodType === undefined &&
      !data.postLogoutRedirectURIs &&
      data.devMode === undefined &&
      data.accessTokenType === undefined &&
      data.accessTokenRoleAssertion === undefined &&
      data.idTokenRoleAssertion === undefined &&
      data.idTokenUserinfoAssertion === undefined &&
      data.clockSkew === undefined &&
      !data.additionalOrigins) {
    throwInvalidArgument('at least one field must be provided', 'COMMAND-App20');
  }
  
  if (data.name) {
    validateLength(data.name, 'name', 1, 200);
  }
  
  // Validate redirect URIs if provided
  if (data.redirectURIs) {
    if (data.redirectURIs.length === 0) {
      throwInvalidArgument('at least one redirect URI required', 'COMMAND-App21');
    }
    for (const uri of data.redirectURIs) {
      validateURL(uri, 'redirectURI');
    }
  }
  
  // 2. Load app write model
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), appID, orgID);
  
  if (wm.state === AppState.UNSPECIFIED) {
    throwNotFound('application not found', 'COMMAND-App22');
  }
  if (wm.appType !== AppType.OIDC) {
    throwPreconditionFailed('not an OIDC application', 'COMMAND-App23');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'application', 'update', orgID);
  
  // 4. Create command
  const command: Command = {
    eventType: 'application.oidc.changed',
    aggregateType: 'application',
    aggregateID: appID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      projectID,
      name: data.name,
      redirectURIs: data.redirectURIs,
      responseTypes: data.responseTypes,
      grantTypes: data.grantTypes,
      authMethodType: data.authMethodType,
      postLogoutRedirectURIs: data.postLogoutRedirectURIs,
      devMode: data.devMode,
      accessTokenType: data.accessTokenType,
      accessTokenRoleAssertion: data.accessTokenRoleAssertion,
      idTokenRoleAssertion: data.idTokenRoleAssertion,
      idTokenUserinfoAssertion: data.idTokenUserinfoAssertion,
      clockSkew: data.clockSkew,
      additionalOrigins: data.additionalOrigins,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Add API App Data
 */
export interface AddAPIAppData {
  appID?: string;
  projectID: string;
  orgID: string;
  name: string;
  authMethodType?: OIDCAuthMethodType;
}

/**
 * Add API application command
 */
export async function addAPIApp(
  this: Commands,
  ctx: Context,
  data: AddAPIAppData
): Promise<ObjectDetails & { appID: string; clientID: string; clientSecret: string }> {
  // 1. Validate input
  validateRequired(data.name, 'name');
  validateLength(data.name, 'name', 1, 200);
  validateRequired(data.projectID, 'projectID');
  validateRequired(data.orgID, 'orgID');
  
  // 2. Generate app ID if not provided
  if (!data.appID) {
    data.appID = await this.nextID();
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'application', 'create', data.orgID);
  
  // 4. Verify project exists
  const projectWM = new ProjectWriteModel();
  await projectWM.load(this.getEventstore(), data.projectID, data.orgID);
  
  if (projectWM.state !== ProjectState.ACTIVE) {
    throwNotFound('project not found or inactive', 'COMMAND-App30');
  }
  
  // 5. Load app write model
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), data.appID, data.orgID);
  
  if (wm.state !== AppState.UNSPECIFIED) {
    throwAlreadyExists('application already exists', 'COMMAND-App31');
  }
  
  // 6. Generate client credentials
  const clientID = `${data.appID}@${data.projectID}`;
  const clientSecret = await this.nextID(); // Simple secret generation
  
  // 7. Create command
  const command: Command = {
    eventType: 'application.api.added',
    aggregateType: 'application',
    aggregateID: data.appID,
    owner: data.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      name: data.name,
      projectID: data.projectID,
      authMethodType: data.authMethodType ?? OIDCAuthMethodType.BASIC,
      clientID,
      clientSecret,
    },
  };
  
  // 8. Push to eventstore
  const event = await this.getEventstore().push(command);
  
  // 9. Update write model
  appendAndReduce(wm, event);
  
  return {
    ...writeModelToObjectDetails(wm),
    appID: data.appID,
    clientID,
    clientSecret,
  };
}

/**
 * Update API App Data
 */
export interface UpdateAPIAppData {
  name?: string;
  authMethodType?: OIDCAuthMethodType;
}

/**
 * Update API application command
 */
export async function updateAPIApp(
  this: Commands,
  ctx: Context,
  appID: string,
  projectID: string,
  orgID: string,
  data: UpdateAPIAppData
): Promise<ObjectDetails> {
  // 1. Validate at least one field
  if (!data.name && data.authMethodType === undefined) {
    throwInvalidArgument('at least one field must be provided', 'COMMAND-App40');
  }
  
  if (data.name) {
    validateLength(data.name, 'name', 1, 200);
  }
  
  // 2. Load app write model
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), appID, orgID);
  
  if (wm.state === AppState.UNSPECIFIED) {
    throwNotFound('application not found', 'COMMAND-App41');
  }
  if (wm.appType !== AppType.API) {
    throwPreconditionFailed('not an API application', 'COMMAND-App42');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'application', 'update', orgID);
  
  // 4. Create command
  const command: Command = {
    eventType: 'application.api.changed',
    aggregateType: 'application',
    aggregateID: appID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      projectID,
      name: data.name,
      authMethodType: data.authMethodType,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Change application secret command
 */
export async function changeAppSecret(
  this: Commands,
  ctx: Context,
  appID: string,
  projectID: string,
  orgID: string
): Promise<ObjectDetails & { clientSecret: string }> {
  // 1. Load app write model
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), appID, orgID);
  
  if (wm.state === AppState.UNSPECIFIED) {
    throwNotFound('application not found', 'COMMAND-App50');
  }
  if (wm.appType === AppType.UNSPECIFIED) {
    throwPreconditionFailed('invalid application type', 'COMMAND-App51');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'application', 'update', orgID);
  
  // 3. Generate new secret
  const clientSecret = await this.nextID();
  
  // 4. Create command
  const command: Command = {
    eventType: 'application.secret.changed',
    aggregateType: 'application',
    aggregateID: appID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      projectID,
      clientSecret,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return {
    ...writeModelToObjectDetails(wm),
    clientSecret,
  };
}

/**
 * Add application key data
 */
export interface AddAppKeyData {
  type: string; // e.g., 'json', 'pkcs12'
  expirationDate?: Date;
}

/**
 * Add application key command
 */
export async function addAppKey(
  this: Commands,
  ctx: Context,
  appID: string,
  projectID: string,
  orgID: string,
  data: AddAppKeyData
): Promise<ObjectDetails & { keyID: string; keyData: string }> {
  // 1. Validate
  validateRequired(data.type, 'type');
  
  // 2. Load app write model
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), appID, orgID);
  
  if (wm.state === AppState.UNSPECIFIED) {
    throwNotFound('application not found', 'COMMAND-App60');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'application', 'update', orgID);
  
  // 4. Generate key ID and data (simplified)
  const keyID = await this.nextID();
  const keyData = await this.nextID(); // In production, generate actual key pair
  
  // 5. Create command
  const command: Command = {
    eventType: 'application.key.added',
    aggregateType: 'application',
    aggregateID: appID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      projectID,
      keyID,
      type: data.type,
      expirationDate: data.expirationDate,
    },
  };
  
  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return {
    ...writeModelToObjectDetails(wm),
    keyID,
    keyData,
  };
}
