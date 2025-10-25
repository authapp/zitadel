/**
 * Organization IDP Commands
 * 
 * Identity Provider configuration at organization level
 * Based on Go: internal/command/org_idp*.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { WriteModel, appendAndReduce, writeModelToObjectDetails, ObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command, Event } from '../../eventstore/types';
import { IDPType, IDPState, OAuthAuthStyle } from '../../query/idp/idp-types';

/**
 * IDP Write Model
 * Tracks IDP state for an organization
 * Based on Go: IDPWriteModel (org_idp_model.go)
 */
class OrgIDPWriteModel extends WriteModel {
  idpID: string;
  name: string = '';
  type: IDPType = IDPType.UNSPECIFIED;
  state: IDPState = IDPState.UNSPECIFIED;
  config: any = null;

  constructor(orgID: string, idpID: string) {
    super('org');
    this.aggregateID = orgID;
    this.resourceOwner = orgID;
    this.idpID = idpID;
  }

  reduce(event: Event): void {
    // Filter events for this specific IDP
    const eventIdpID = event.payload?.idpID || event.payload?.id;
    if (eventIdpID && eventIdpID !== this.idpID) {
      return;
    }

    switch (event.eventType) {
      case 'org.idp.added':
      case 'org.idp.oidc.added':
      case 'org.idp.oauth.added':
      case 'org.idp.jwt.added':
      case 'org.idp.ldap.added':
      case 'org.idp.saml.added':
      case 'org.idp.azure.added':
      case 'org.idp.google.added':
      case 'org.idp.apple.added':
        this.state = IDPState.ACTIVE;
        this.name = event.payload?.name || '';
        this.type = event.payload?.type || IDPType.UNSPECIFIED;
        this.config = event.payload?.config || null;
        break;

      case 'org.idp.changed':
      case 'org.idp.config.changed':
      case 'org.idp.oidc.changed':
      case 'org.idp.oauth.changed':
      case 'org.idp.jwt.changed':
      case 'org.idp.ldap.changed':
      case 'org.idp.saml.changed':
        if (event.payload?.name) {
          this.name = event.payload.name;
        }
        if (event.payload?.config) {
          this.config = event.payload.config;
        }
        break;

      case 'org.idp.removed':
        this.state = IDPState.REMOVED;
        break;

      case 'org.removed':
        this.state = IDPState.REMOVED;
        break;
    }
  }
}

/**
 * Generic IDP Data
 */
export interface OrgIDPData {
  idpID?: string;
  name: string;
  stylingType?: number;
  isCreationAllowed?: boolean;
  isLinkingAllowed?: boolean;
  isAutoCreation?: boolean;
  isAutoUpdate?: boolean;
}

/**
 * OIDC IDP Configuration Data
 */
export interface OIDCIDPData extends OrgIDPData {
  issuer: string;
  clientID: string;
  clientSecret: string;
  scopes: string[];
  displayNameMapping?: string;
  usernameMapping?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
}

/**
 * OAuth IDP Configuration Data
 */
export interface OAuthIDPData extends OrgIDPData {
  clientID: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userEndpoint: string;
  scopes: string[];
  idAttribute?: string;
  authStyle?: OAuthAuthStyle;
}

/**
 * Validation: IDP Name
 */
function validateIDPName(name: string): void {
  validateRequired(name, 'name');
  if (name.length < 1 || name.length > 200) {
    throwInvalidArgument('name must be between 1 and 200 characters', 'IDP-name01');
  }
}

/**
 * Validation: OIDC IDP Data
 */
function validateOIDCIDP(data: OIDCIDPData): void {
  validateIDPName(data.name);
  validateRequired(data.issuer, 'issuer');
  validateRequired(data.clientID, 'clientID');
  validateRequired(data.clientSecret, 'clientSecret');
  
  if (!data.scopes || data.scopes.length === 0) {
    throwInvalidArgument('at least one scope is required', 'IDP-oidc01');
  }
}

/**
 * Validation: OAuth IDP Data
 */
function validateOAuthIDP(data: OAuthIDPData): void {
  validateIDPName(data.name);
  validateRequired(data.clientID, 'clientID');
  validateRequired(data.clientSecret, 'clientSecret');
  validateRequired(data.authorizationEndpoint, 'authorizationEndpoint');
  validateRequired(data.tokenEndpoint, 'tokenEndpoint');
  validateRequired(data.userEndpoint, 'userEndpoint');
  
  if (!data.scopes || data.scopes.length === 0) {
    throwInvalidArgument('at least one scope is required', 'IDP-oauth01');
  }
}

/**
 * Add Generic IDP to Organization
 * Based on Go: AddOrgIDP (org_idp.go)
 */
export async function addIDPToOrg(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: OrgIDPData,
  type: IDPType,
  config: any
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateIDPName(data.name);

  // 2. Generate ID if not provided
  if (!data.idpID) {
    data.idpID = await this.nextID();
  }

  // 3. Check if IDP already exists
  const idpWM = new OrgIDPWriteModel(orgID, data.idpID);
  await idpWM.load(this.getEventstore(), orgID, orgID);

  if (idpWM.state === IDPState.ACTIVE) {
    throwAlreadyExists('IDP already exists', 'IDP-exist01');
  }

  // 4. Check permissions
  await this.checkPermission(ctx, 'org.idp', 'create', orgID);

  // 5. Create event
  const command: Command = {
    eventType: 'org.idp.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      id: data.idpID,
      name: data.name,
      type,
      stylingType: data.stylingType || 0,
      isCreationAllowed: data.isCreationAllowed !== false,
      isLinkingAllowed: data.isLinkingAllowed !== false,
      isAutoCreation: data.isAutoCreation || false,
      isAutoUpdate: data.isAutoUpdate || false,
      config,
    },
  };

  // 6. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(idpWM, event);

  return writeModelToObjectDetails(idpWM);
}

/**
 * Add OIDC IDP to Organization
 * Based on Go: AddOrgOIDCIDP (org_idp_oidc.go)
 */
export async function addOIDCIDPToOrg(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: OIDCIDPData
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateOIDCIDP(data);

  // 2. Generate ID if not provided
  if (!data.idpID) {
    data.idpID = await this.nextID();
  }

  // 3. Check if IDP already exists
  const idpWM = new OrgIDPWriteModel(orgID, data.idpID);
  await idpWM.load(this.getEventstore(), orgID, orgID);

  if (idpWM.state === IDPState.ACTIVE) {
    throwAlreadyExists('OIDC IDP already exists', 'IDP-oidc02');
  }

  // 4. Check permissions
  await this.checkPermission(ctx, 'org.idp', 'create', orgID);

  // 5. Create OIDC config
  const oidcConfig = {
    issuer: data.issuer,
    clientID: data.clientID,
    clientSecret: data.clientSecret,
    scopes: data.scopes,
    displayNameMapping: data.displayNameMapping,
    usernameMapping: data.usernameMapping,
    authorizationEndpoint: data.authorizationEndpoint,
    tokenEndpoint: data.tokenEndpoint,
  };

  // 6. Create event
  const command: Command = {
    eventType: 'org.idp.oidc.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      id: data.idpID,
      name: data.name,
      type: IDPType.OIDC,
      stylingType: data.stylingType || 0,
      isCreationAllowed: data.isCreationAllowed !== false,
      isLinkingAllowed: data.isLinkingAllowed !== false,
      isAutoCreation: data.isAutoCreation || false,
      isAutoUpdate: data.isAutoUpdate || false,
      config: oidcConfig,
    },
  };

  // 7. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(idpWM, event);

  return writeModelToObjectDetails(idpWM);
}

/**
 * Add OAuth IDP to Organization
 * Based on Go: AddOrgOAuthIDP (org_idp_oauth.go)
 */
export async function addOAuthIDPToOrg(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: OAuthIDPData
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateOAuthIDP(data);

  // 2. Generate ID if not provided
  if (!data.idpID) {
    data.idpID = await this.nextID();
  }

  // 3. Check if IDP already exists
  const idpWM = new OrgIDPWriteModel(orgID, data.idpID);
  await idpWM.load(this.getEventstore(), orgID, orgID);

  if (idpWM.state === IDPState.ACTIVE) {
    throwAlreadyExists('OAuth IDP already exists', 'IDP-oauth02');
  }

  // 4. Check permissions
  await this.checkPermission(ctx, 'org.idp', 'create', orgID);

  // 5. Create OAuth config
  const oauthConfig = {
    clientID: data.clientID,
    clientSecret: data.clientSecret,
    authorizationEndpoint: data.authorizationEndpoint,
    tokenEndpoint: data.tokenEndpoint,
    userEndpoint: data.userEndpoint,
    scopes: data.scopes,
    idAttribute: data.idAttribute,
    authStyle: data.authStyle || OAuthAuthStyle.IN_PARAMS,
  };

  // 6. Create event
  const command: Command = {
    eventType: 'org.idp.oauth.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      id: data.idpID,
      name: data.name,
      type: IDPType.OAUTH,
      stylingType: data.stylingType || 0,
      isCreationAllowed: data.isCreationAllowed !== false,
      isLinkingAllowed: data.isLinkingAllowed !== false,
      isAutoCreation: data.isAutoCreation || false,
      isAutoUpdate: data.isAutoUpdate || false,
      config: oauthConfig,
    },
  };

  // 7. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(idpWM, event);

  return writeModelToObjectDetails(idpWM);
}

/**
 * Update Organization IDP
 * Based on Go: UpdateOrgIDP (org_idp.go)
 */
export async function updateOrgIDP(
  this: Commands,
  ctx: Context,
  orgID: string,
  idpID: string,
  data: Partial<OrgIDPData>
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(idpID, 'idpID');

  if (data.name) {
    validateIDPName(data.name);
  }

  // 2. Load IDP write model
  const idpWM = new OrgIDPWriteModel(orgID, idpID);
  await idpWM.load(this.getEventstore(), orgID, orgID);

  if (idpWM.state !== IDPState.ACTIVE) {
    throwNotFound('IDP not found', 'IDP-notfound01');
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'org.idp', 'update', orgID);

  // 4. Build payload with only changed fields
  const payload: any = { idpID };

  if (data.name && data.name !== idpWM.name) {
    payload.name = data.name;
  }

  if (data.stylingType !== undefined) {
    payload.stylingType = data.stylingType;
  }

  if (data.isCreationAllowed !== undefined) {
    payload.isCreationAllowed = data.isCreationAllowed;
  }

  if (data.isLinkingAllowed !== undefined) {
    payload.isLinkingAllowed = data.isLinkingAllowed;
  }

  if (data.isAutoCreation !== undefined) {
    payload.isAutoCreation = data.isAutoCreation;
  }

  if (data.isAutoUpdate !== undefined) {
    payload.isAutoUpdate = data.isAutoUpdate;
  }

  // Skip if no changes
  if (Object.keys(payload).length === 1) {
    return writeModelToObjectDetails(idpWM);
  }

  // 5. Create event
  const command: Command = {
    eventType: 'org.idp.changed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload,
  };

  // 6. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(idpWM, event);

  return writeModelToObjectDetails(idpWM);
}

/**
 * Remove IDP from Organization
 * Based on Go: RemoveOrgIDP (org_idp.go)
 */
export async function removeIDPFromOrg(
  this: Commands,
  ctx: Context,
  orgID: string,
  idpID: string
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(idpID, 'idpID');

  // 2. Load IDP write model
  const idpWM = new OrgIDPWriteModel(orgID, idpID);
  await idpWM.load(this.getEventstore(), orgID, orgID);

  // Idempotent: Already removed
  if (idpWM.state === IDPState.REMOVED || idpWM.state === IDPState.UNSPECIFIED) {
    return writeModelToObjectDetails(idpWM);
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'org.idp', 'delete', orgID);

  // 4. Create event
  const command: Command = {
    eventType: 'org.idp.removed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      idpID,
    },
  };

  // 5. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(idpWM, event);

  return writeModelToObjectDetails(idpWM);
}
