/**
 * Instance-Level IDP Commands
 * 
 * Manage Identity Providers at the instance level (system-wide default IDPs)
 * Based on Go: internal/command/instance_idp.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { WriteModel, appendAndReduce, writeModelToObjectDetails, ObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command, Event } from '../../eventstore/types';
import { IDPType, IDPState } from '../../query/idp/idp-types';

/**
 * Instance IDP Write Model
 * Tracks instance-level IDP state
 */
class InstanceIDPWriteModel extends WriteModel {
  idpID: string;
  name: string = '';
  type: IDPType = IDPType.UNSPECIFIED;
  state: IDPState = IDPState.UNSPECIFIED;

  constructor(instanceID: string, idpID: string) {
    super('instance');
    this.aggregateID = instanceID;
    this.resourceOwner = instanceID;
    this.idpID = idpID;
  }

  reduce(event: Event): void {
    // Filter events for this specific IDP
    const eventIdpID = event.payload?.idpID || event.payload?.id;
    if (eventIdpID && eventIdpID !== this.idpID) {
      return;
    }

    switch (event.eventType) {
      case 'instance.idp.oidc.added':
      case 'instance.idp.oauth.added':
      case 'instance.idp.jwt.added':
      case 'instance.idp.ldap.added':
      case 'instance.idp.saml.added':
        this.state = IDPState.ACTIVE;
        this.name = event.payload?.name || '';
        this.type = event.payload?.type || IDPType.UNSPECIFIED;
        break;

      case 'instance.idp.changed':
        if (event.payload?.name) {
          this.name = event.payload.name;
        }
        break;

      case 'instance.idp.removed':
        this.state = IDPState.REMOVED;
        break;

      case 'instance.removed':
        this.state = IDPState.REMOVED;
        break;
    }
  }
}

/**
 * Instance IDP Data
 */
export interface InstanceIDPData {
  idpID?: string;
  name: string;
  stylingType?: number;
}

/**
 * OIDC Configuration for Instance-Level IDP
 */
export interface InstanceOIDCIDPData extends InstanceIDPData {
  clientID: string;
  clientSecret: string;
  issuer: string;
  scopes?: string[];
  displayNameMapping?: string;
  usernameMapping?: string;
  isCreationAllowed?: boolean;
  isLinkingAllowed?: boolean;
  isAutoCreation?: boolean;
  isAutoUpdate?: boolean;
}

/**
 * OAuth Configuration for Instance-Level IDP
 */
export interface InstanceOAuthIDPData extends InstanceIDPData {
  clientID: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userEndpoint: string;
  scopes?: string[];
  idAttribute?: string;
  isCreationAllowed?: boolean;
  isLinkingAllowed?: boolean;
  isAutoCreation?: boolean;
  isAutoUpdate?: boolean;
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
 * Add OIDC IDP to Instance
 * Based on Go: AddInstanceOIDCIDP (instance_idp_oidc.go)
 */
export async function addOIDCIDPToInstance(
  this: Commands,
  ctx: Context,
  instanceID: string,
  data: InstanceOIDCIDPData
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(instanceID, 'instanceID');
  validateIDPName(data.name);
  validateRequired(data.clientID, 'clientID');
  validateRequired(data.clientSecret, 'clientSecret');
  validateRequired(data.issuer, 'issuer');

  // 2. Generate ID if not provided
  if (!data.idpID) {
    data.idpID = await this.nextID();
  }

  // 3. Check if IDP already exists
  const idpWM = new InstanceIDPWriteModel(instanceID, data.idpID);
  await idpWM.load(this.getEventstore(), instanceID, instanceID);

  if (idpWM.state === IDPState.ACTIVE) {
    throwAlreadyExists('Instance IDP already exists', 'IDP-inst01');
  }

  // 4. Check permissions (instance-level)
  await this.checkPermission(ctx, 'instance.idp', 'create', instanceID);

  // 5. Create event
  const command: Command = {
    eventType: 'instance.idp.oidc.added',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: instanceID,
    creator: ctx.userID || 'system',
    payload: {
      id: data.idpID,
      name: data.name,
      type: IDPType.OIDC,
      stylingType: data.stylingType || 0,
      clientID: data.clientID,
      clientSecret: data.clientSecret,
      issuer: data.issuer,
      scopes: data.scopes || ['openid', 'profile', 'email'],
      displayNameMapping: data.displayNameMapping,
      usernameMapping: data.usernameMapping,
      isCreationAllowed: data.isCreationAllowed !== false,
      isLinkingAllowed: data.isLinkingAllowed !== false,
      isAutoCreation: data.isAutoCreation || false,
      isAutoUpdate: data.isAutoUpdate || false,
    },
  };

  // 6. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(idpWM, event);

  return writeModelToObjectDetails(idpWM);
}

/**
 * Add OAuth IDP to Instance
 * Based on Go: AddInstanceOAuthIDP (instance_idp_oauth.go)
 */
export async function addOAuthIDPToInstance(
  this: Commands,
  ctx: Context,
  instanceID: string,
  data: InstanceOAuthIDPData
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(instanceID, 'instanceID');
  validateIDPName(data.name);
  validateRequired(data.clientID, 'clientID');
  validateRequired(data.clientSecret, 'clientSecret');
  validateRequired(data.authorizationEndpoint, 'authorizationEndpoint');
  validateRequired(data.tokenEndpoint, 'tokenEndpoint');
  validateRequired(data.userEndpoint, 'userEndpoint');

  // 2. Generate ID if not provided
  if (!data.idpID) {
    data.idpID = await this.nextID();
  }

  // 3. Check if IDP already exists
  const idpWM = new InstanceIDPWriteModel(instanceID, data.idpID);
  await idpWM.load(this.getEventstore(), instanceID, instanceID);

  if (idpWM.state === IDPState.ACTIVE) {
    throwAlreadyExists('Instance IDP already exists', 'IDP-inst01');
  }

  // 4. Check permissions
  await this.checkPermission(ctx, 'instance.idp', 'create', instanceID);

  // 5. Create event
  const command: Command = {
    eventType: 'instance.idp.oauth.added',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: instanceID,
    creator: ctx.userID || 'system',
    payload: {
      id: data.idpID,
      name: data.name,
      type: IDPType.OAUTH,
      stylingType: data.stylingType || 0,
      clientID: data.clientID,
      clientSecret: data.clientSecret,
      authorizationEndpoint: data.authorizationEndpoint,
      tokenEndpoint: data.tokenEndpoint,
      userEndpoint: data.userEndpoint,
      scopes: data.scopes || [],
      idAttribute: data.idAttribute || 'id',
      isCreationAllowed: data.isCreationAllowed !== false,
      isLinkingAllowed: data.isLinkingAllowed !== false,
      isAutoCreation: data.isAutoCreation || false,
      isAutoUpdate: data.isAutoUpdate || false,
    },
  };

  // 6. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(idpWM, event);

  return writeModelToObjectDetails(idpWM);
}

/**
 * Update Instance IDP
 * Based on Go: UpdateInstanceIDP (instance_idp.go)
 */
export async function updateInstanceIDP(
  this: Commands,
  ctx: Context,
  instanceID: string,
  idpID: string,
  data: Partial<InstanceIDPData>
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(instanceID, 'instanceID');
  validateRequired(idpID, 'idpID');

  if (data.name) {
    validateIDPName(data.name);
  }

  // 2. Load IDP
  const idpWM = new InstanceIDPWriteModel(instanceID, idpID);
  await idpWM.load(this.getEventstore(), instanceID, instanceID);

  if (idpWM.state !== IDPState.ACTIVE) {
    throwNotFound('Instance IDP not found', 'IDP-inst02');
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'instance.idp', 'update', instanceID);

  // 4. Check for changes
  if (!data.name || data.name === idpWM.name) {
    // No changes
    return writeModelToObjectDetails(idpWM);
  }

  // 5. Create event
  const command: Command = {
    eventType: 'instance.idp.changed',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: instanceID,
    creator: ctx.userID || 'system',
    payload: {
      idpID,
      name: data.name,
      stylingType: data.stylingType,
    },
  };

  // 6. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(idpWM, event);

  return writeModelToObjectDetails(idpWM);
}

/**
 * Remove Instance IDP
 * Based on Go: RemoveInstanceIDP (instance_idp.go)
 */
export async function removeInstanceIDP(
  this: Commands,
  ctx: Context,
  instanceID: string,
  idpID: string
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(instanceID, 'instanceID');
  validateRequired(idpID, 'idpID');

  // 2. Load IDP
  const idpWM = new InstanceIDPWriteModel(instanceID, idpID);
  await idpWM.load(this.getEventstore(), instanceID, instanceID);

  if (idpWM.state !== IDPState.ACTIVE) {
    throwNotFound('Instance IDP not found', 'IDP-inst02');
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'instance.idp', 'delete', instanceID);

  // 4. Create event
  const command: Command = {
    eventType: 'instance.idp.removed',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: instanceID,
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
