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

/**
 * Remove application key command
 * Based on Go: RemoveApplicationKey (project_application_key.go:112-135)
 */
export async function removeAppKey(
  this: Commands,
  ctx: Context,
  projectID: string,
  appID: string,
  keyID: string
): Promise<ObjectDetails> {
  validateRequired(projectID, 'projectID');
  validateRequired(appID, 'appID');
  validateRequired(keyID, 'keyID');
  
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), appID, ctx.orgID);
  
  if (wm.state === AppState.UNSPECIFIED) {
    throwNotFound('application not found', 'COMMAND-App70');
  }
  
  await this.checkPermission(ctx, 'application', 'update', ctx.orgID);
  
  const command: Command = {
    eventType: 'application.key.removed',
    aggregateType: 'application',
    aggregateID: appID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: { projectID, keyID },
  };
  
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  return writeModelToObjectDetails(wm);
}

/**
 * Add SAML application command
 * Based on Go: AddSAMLApplication (project_application_saml.go:15-57)
 */
export interface AddSAMLAppData {
  projectID: string;
  name: string;
  metadata: string; // SAML metadata XML
  metadataURL?: string;
}

export async function addSAMLApp(
  this: Commands,
  ctx: Context,
  data: AddSAMLAppData
): Promise<{ appID: string; details: ObjectDetails }> {
  validateRequired(data.projectID, 'projectID');
  validateRequired(data.name, 'name');
  validateRequired(data.metadata, 'metadata');
  
  // Note: In production, parse and validate SAML metadata XML
  const appID = await this.nextID();
  
  await this.checkPermission(ctx, 'application', 'create', ctx.orgID);
  
  const commands: Command[] = [
    {
      eventType: 'application.added',
      aggregateType: 'project',
      aggregateID: data.projectID,
      owner: ctx.orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: { appID, name: data.name },
    },
    {
      eventType: 'application.saml.config.added',
      aggregateType: 'project',
      aggregateID: data.projectID,
      owner: ctx.orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        appID,
        metadata: data.metadata,
        metadataURL: data.metadataURL,
      },
    },
  ];
  
  await this.getEventstore().pushMany(commands);
  
  return {
    appID,
    details: {
      sequence: 0n,
      eventDate: new Date(),
      resourceOwner: ctx.orgID,
    },
  };
}

/**
 * Update SAML application command
 * Based on Go: UpdateSAMLApplication (project_application_saml.go:97-169)
 */
export interface UpdateSAMLAppData {
  projectID: string;
  appID: string;
  metadata?: string;
  metadataURL?: string;
}

export async function updateSAMLApp(
  this: Commands,
  ctx: Context,
  data: UpdateSAMLAppData
): Promise<ObjectDetails> {
  validateRequired(data.projectID, 'projectID');
  validateRequired(data.appID, 'appID');
  
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), data.appID, ctx.orgID);
  
  if (wm.state === AppState.UNSPECIFIED) {
    throwNotFound('application not found', 'COMMAND-App80');
  }
  
  await this.checkPermission(ctx, 'application', 'update', ctx.orgID);
  
  const command: Command = {
    eventType: 'application.saml.config.changed',
    aggregateType: 'project',
    aggregateID: data.projectID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      appID: data.appID,
      metadata: data.metadata,
      metadataURL: data.metadataURL,
    },
  };
  
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  return writeModelToObjectDetails(wm);
}

/**
 * Deactivate application command
 * Based on Go: DeactivateApplication (project_application.go:54-86)
 */
export async function deactivateApplication(
  this: Commands,
  ctx: Context,
  projectID: string,
  appID: string
): Promise<ObjectDetails> {
  validateRequired(projectID, 'projectID');
  validateRequired(appID, 'appID');
  
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), appID, ctx.orgID);
  
  if (wm.state === AppState.UNSPECIFIED) {
    throwNotFound('application not found', 'COMMAND-App90');
  }
  
  if (wm.state !== AppState.ACTIVE) {
    throwPreconditionFailed('application is not active', 'COMMAND-App91');
  }
  
  await this.checkPermission(ctx, 'application', 'update', ctx.orgID);
  
  const command: Command = {
    eventType: 'application.deactivated',
    aggregateType: 'application',
    aggregateID: appID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: { appID },
  };
  
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  return writeModelToObjectDetails(wm);
}

/**
 * Reactivate application command
 * Based on Go: ReactivateApplication (project_application.go:88-119)
 */
export async function reactivateApplication(
  this: Commands,
  ctx: Context,
  projectID: string,
  appID: string
): Promise<ObjectDetails> {
  validateRequired(projectID, 'projectID');
  validateRequired(appID, 'appID');
  
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), appID, ctx.orgID);
  
  if (wm.state === AppState.UNSPECIFIED) {
    throwNotFound('application not found', 'COMMAND-AppA0');
  }
  
  if (wm.state !== AppState.INACTIVE) {
    throwPreconditionFailed('application is not inactive', 'COMMAND-AppA1');
  }
  
  await this.checkPermission(ctx, 'application', 'update', ctx.orgID);
  
  const command: Command = {
    eventType: 'application.reactivated',
    aggregateType: 'application',
    aggregateID: appID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: { appID },
  };
  
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  return writeModelToObjectDetails(wm);
}

/**
 * Remove application command
 * Based on Go: RemoveApplication (project_application.go:121-157)
 */
export async function removeApplication(
  this: Commands,
  ctx: Context,
  projectID: string,
  appID: string
): Promise<ObjectDetails> {
  validateRequired(projectID, 'projectID');
  validateRequired(appID, 'appID');
  
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), appID, ctx.orgID);
  
  if (wm.state === AppState.UNSPECIFIED) {
    throwNotFound('application not found', 'COMMAND-AppB0');
  }
  
  await this.checkPermission(ctx, 'application', 'delete', ctx.orgID);
  
  const command: Command = {
    eventType: 'application.removed',
    aggregateType: 'application',
    aggregateID: appID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      appID,
      name: wm.name,
    },
  };
  
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  return writeModelToObjectDetails(wm);
}

/**
 * Add OIDC Redirect URI
 * Add a new redirect URI to an existing OIDC application
 */
export async function addOIDCRedirectURI(
  this: Commands,
  ctx: Context,
  appID: string,
  orgID: string,
  redirectURI: string
): Promise<ObjectDetails> {
  // 1. Validate URI
  validateRequired(redirectURI, 'redirectURI');
  validateURL(redirectURI, 'redirectURI');
  
  // 2. Load app write model
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), appID, orgID);
  
  if (wm.state === AppState.UNSPECIFIED) {
    throwNotFound('application not found', 'COMMAND-AppOIDC01');
  }
  if (wm.appType !== AppType.OIDC) {
    throwPreconditionFailed('not an OIDC application', 'COMMAND-AppOIDC02');
  }
  
  // 3. Check if URI already exists
  if (wm.redirectURIs.includes(redirectURI)) {
    throwAlreadyExists('redirect URI already exists', 'COMMAND-AppOIDC03');
  }
  
  // 4. Check permissions
  await this.checkPermission(ctx, 'application', 'update', orgID);
  
  // 5. Add URI to array
  const updatedURIs = [...wm.redirectURIs, redirectURI];
  
  // 6. Create command
  const command: Command = {
    eventType: 'application.oidc.config.changed',
    aggregateType: 'application',
    aggregateID: appID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      redirectURIs: updatedURIs,
    },
  };
  
  // 7. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Remove OIDC Redirect URI
 * Remove a redirect URI from an existing OIDC application
 */
export async function removeOIDCRedirectURI(
  this: Commands,
  ctx: Context,
  appID: string,
  orgID: string,
  redirectURI: string
): Promise<ObjectDetails> {
  // 1. Validate URI
  validateRequired(redirectURI, 'redirectURI');
  
  // 2. Load app write model
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), appID, orgID);
  
  if (wm.state === AppState.UNSPECIFIED) {
    throwNotFound('application not found', 'COMMAND-AppOIDC04');
  }
  if (wm.appType !== AppType.OIDC) {
    throwPreconditionFailed('not an OIDC application', 'COMMAND-AppOIDC05');
  }
  
  // 3. Check if URI exists
  if (!wm.redirectURIs.includes(redirectURI)) {
    throwNotFound('redirect URI not found', 'COMMAND-AppOIDC06');
  }
  
  // 4. Cannot remove last redirect URI
  if (wm.redirectURIs.length === 1) {
    throwPreconditionFailed('cannot remove last redirect URI', 'COMMAND-AppOIDC07');
  }
  
  // 5. Check permissions
  await this.checkPermission(ctx, 'application', 'update', orgID);
  
  // 6. Remove URI from array
  const updatedURIs = wm.redirectURIs.filter(uri => uri !== redirectURI);
  
  // 7. Create command
  const command: Command = {
    eventType: 'application.oidc.config.changed',
    aggregateType: 'application',
    aggregateID: appID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      redirectURIs: updatedURIs,
    },
  };
  
  // 8. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Change OIDC App to Confidential Client
 * Changes the OIDC application type to confidential (requires client secret)
 */
export async function changeOIDCAppToConfidential(
  this: Commands,
  ctx: Context,
  appID: string,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Load app write model
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), appID, orgID);
  
  if (wm.state === AppState.UNSPECIFIED) {
    throwNotFound('application not found', 'COMMAND-AppOIDC08');
  }
  if (wm.appType !== AppType.OIDC) {
    throwPreconditionFailed('not an OIDC application', 'COMMAND-AppOIDC09');
  }
  
  // 2. Check if already confidential
  if (wm.oidcAppType === OIDCAppType.WEB) {
    throwPreconditionFailed('application is already confidential', 'COMMAND-AppOIDC10');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'application', 'update', orgID);
  
  // 4. Create command
  const command: Command = {
    eventType: 'application.oidc.config.changed',
    aggregateType: 'application',
    aggregateID: appID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      oidcAppType: OIDCAppType.WEB,
      authMethodType: OIDCAuthMethodType.BASIC,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Change OIDC App to Public Client
 * Changes the OIDC application type to public (no client secret, requires PKCE)
 */
export async function changeOIDCAppToPublic(
  this: Commands,
  ctx: Context,
  appID: string,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Load app write model
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), appID, orgID);
  
  if (wm.state === AppState.UNSPECIFIED) {
    throwNotFound('application not found', 'COMMAND-AppOIDC11');
  }
  if (wm.appType !== AppType.OIDC) {
    throwPreconditionFailed('not an OIDC application', 'COMMAND-AppOIDC12');
  }
  
  // 2. Check if already public
  if (wm.oidcAppType === OIDCAppType.USER_AGENT || wm.oidcAppType === OIDCAppType.NATIVE) {
    throwPreconditionFailed('application is already public', 'COMMAND-AppOIDC13');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'application', 'update', orgID);
  
  // 4. Create command - Change to USER_AGENT (SPA)
  const command: Command = {
    eventType: 'application.oidc.config.changed',
    aggregateType: 'application',
    aggregateID: appID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      oidcAppType: OIDCAppType.USER_AGENT,
      authMethodType: OIDCAuthMethodType.NONE,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Change API App Authentication Method
 * Changes the authentication method for an API application (BASIC or PRIVATE_KEY_JWT)
 */
export async function changeAPIAppAuthMethod(
  this: Commands,
  ctx: Context,
  appID: string,
  orgID: string,
  authMethodType: OIDCAuthMethodType
): Promise<ObjectDetails> {
  // 1. Validate auth method
  validateRequired(authMethodType, 'authMethodType');
  
  if (authMethodType !== OIDCAuthMethodType.BASIC && 
      authMethodType !== OIDCAuthMethodType.PRIVATE_KEY_JWT) {
    throwInvalidArgument('invalid auth method for API app', 'COMMAND-AppAPI01');
  }
  
  // 2. Load app write model
  const wm = new AppWriteModel();
  await wm.load(this.getEventstore(), appID, orgID);
  
  if (wm.state === AppState.UNSPECIFIED) {
    throwNotFound('application not found', 'COMMAND-AppAPI02');
  }
  if (wm.appType !== AppType.API) {
    throwPreconditionFailed('not an API application', 'COMMAND-AppAPI03');
  }
  
  // 3. Check if same as current
  if (wm.apiAuthMethodType === authMethodType) {
    return writeModelToObjectDetails(wm); // Idempotent
  }
  
  // 4. Check permissions
  await this.checkPermission(ctx, 'application', 'update', orgID);
  
  // 5. Create command
  const command: Command = {
    eventType: 'application.api.config.changed',
    aggregateType: 'application',
    aggregateID: appID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      authMethodType,
    },
  };
  
  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}
