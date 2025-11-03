/**
 * SAML Request Commands
 * 
 * Handles SAML authentication requests (SP-initiated SSO)
 * Based on Go: internal/command/saml_request.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { WriteModel, appendAndReduce, writeModelToObjectDetails, ObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { Command, Event } from '../../eventstore/types';

/**
 * SAML Request State
 */
export enum SAMLRequestState {
  UNSPECIFIED = 0,
  ADDED = 1,
  SUCCEEDED = 2,
  FAILED = 3,
}

/**
 * SAML Request Data
 */
export interface SAMLRequestData {
  id?: string;
  loginClient?: string;
  applicationID: string;
  acsURL: string;
  relayState?: string;
  requestID: string;
  binding: string;
  issuer: string;
  destination: string;
  responseIssuer?: string;
}

/**
 * Current SAML Request (with session info)
 */
export interface CurrentSAMLRequest extends SAMLRequestData {
  sessionID?: string;
  userID?: string;
  authMethods?: string[];
  authTime?: Date;
}

/**
 * SAML Request Write Model
 */
class SAMLRequestWriteModel extends WriteModel {
  samlRequestID: string;
  state: SAMLRequestState = SAMLRequestState.UNSPECIFIED;
  loginClient: string = '';
  applicationID: string = '';
  acsURL: string = '';
  relayState: string = '';
  requestID: string = '';
  binding: string = '';
  issuer: string = '';
  destination: string = '';
  responseIssuer: string = '';
  sessionID?: string;
  userID?: string;
  authMethods?: string[];
  authTime?: Date;

  constructor(samlRequestID: string, instanceID: string) {
    super('saml_request');
    this.aggregateID = samlRequestID;
    this.resourceOwner = instanceID;
    this.samlRequestID = samlRequestID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'saml.request.added':
        this.state = SAMLRequestState.ADDED;
        this.loginClient = event.payload?.loginClient || '';
        this.applicationID = event.payload?.applicationID || '';
        this.acsURL = event.payload?.acsURL || '';
        this.relayState = event.payload?.relayState || '';
        this.requestID = event.payload?.requestID || '';
        this.binding = event.payload?.binding || '';
        this.issuer = event.payload?.issuer || '';
        this.destination = event.payload?.destination || '';
        this.responseIssuer = event.payload?.responseIssuer || '';
        break;

      case 'saml.request.session.linked':
        this.sessionID = event.payload?.sessionID;
        this.userID = event.payload?.userID;
        this.authMethods = event.payload?.authMethods;
        if (event.payload?.authTime) {
          this.authTime = new Date(event.payload.authTime);
        }
        break;

      case 'saml.request.succeeded':
        this.state = SAMLRequestState.SUCCEEDED;
        break;

      case 'saml.request.failed':
        this.state = SAMLRequestState.FAILED;
        break;
    }
  }
}

/**
 * Add SAML Request
 * Creates a new SAML authentication request
 * Based on Go: AddSAMLRequest
 */
export async function addSAMLRequest(
  this: Commands,
  ctx: Context,
  data: SAMLRequestData
): Promise<{ details: ObjectDetails; samlRequest: CurrentSAMLRequest }> {
  // 1. Validation
  validateRequired(data.applicationID, 'applicationID');
  validateRequired(data.acsURL, 'acsURL');
  validateRequired(data.requestID, 'requestID');
  validateRequired(data.binding, 'binding');
  validateRequired(data.issuer, 'issuer');
  validateRequired(data.destination, 'destination');

  // 2. Generate ID if not provided
  if (!data.id) {
    data.id = 'SAMLR_' + await this.nextID();
  }

  // 3. Load write model
  const wm = new SAMLRequestWriteModel(data.id, ctx.instanceID);
  await wm.load(this.getEventstore(), data.id, ctx.instanceID);

  if (wm.state !== SAMLRequestState.UNSPECIFIED) {
    throwPreconditionFailed('SAML request already exists', 'SAML-req01');
  }

  // 4. Create event
  const command: Command = {
    eventType: 'saml.request.added',
    aggregateType: 'saml_request',
    aggregateID: data.id,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || data.loginClient || 'system',
    payload: {
      loginClient: data.loginClient,
      userID: data.loginClient,  // Set userID from loginClient for tracking
      applicationID: data.applicationID,
      acsURL: data.acsURL,
      relayState: data.relayState || '',
      requestID: data.requestID,
      binding: data.binding,
      issuer: data.issuer,
      destination: data.destination,
      responseIssuer: data.responseIssuer || '',
    },
  };

  // 5. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return {
    details: writeModelToObjectDetails(wm),
    samlRequest: {
      id: data.id,
      loginClient: data.loginClient,
      applicationID: data.applicationID,
      acsURL: data.acsURL,
      relayState: data.relayState,
      requestID: data.requestID,
      binding: data.binding,
      issuer: data.issuer,
      destination: data.destination,
      responseIssuer: data.responseIssuer,
    },
  };
}

/**
 * Link Session to SAML Request
 * Associates an authenticated session with a SAML request
 * Based on Go: LinkSessionToSAMLRequest
 */
export async function linkSessionToSAMLRequest(
  this: Commands,
  ctx: Context,
  samlRequestID: string,
  sessionID: string,
  sessionToken: string,
  checkLoginClient: boolean = true
): Promise<{ details: ObjectDetails; samlRequest: CurrentSAMLRequest }> {
  // 1. Validation
  validateRequired(samlRequestID, 'samlRequestID');
  validateRequired(sessionID, 'sessionID');
  validateRequired(sessionToken, 'sessionToken');

  // 2. Load SAML request write model
  const wm = new SAMLRequestWriteModel(samlRequestID, ctx.instanceID);
  await wm.load(this.getEventstore(), samlRequestID, ctx.instanceID);

  if (wm.state === SAMLRequestState.UNSPECIFIED) {
    throwNotFound('SAML request not found', 'SAML-req02');
  }

  if (wm.state !== SAMLRequestState.ADDED) {
    throwPreconditionFailed('SAML request already handled', 'SAML-req03');
  }

  // 3. Check login client if needed
  if (checkLoginClient && wm.loginClient && ctx.userID !== wm.loginClient) {
    await this.checkPermission(ctx, 'session', 'link', wm.resourceOwner);
  }

  // 4. Verify session (simplified - in production, verify token and check session state)
  // TODO: Add proper session validation
  const userID = ctx.userID || 'user-from-session';
  const authMethods = ['password']; // TODO: Get from session
  const authTime = new Date();

  // 5. Create event
  const command: Command = {
    eventType: 'saml.request.session.linked',
    aggregateType: 'saml_request',
    aggregateID: samlRequestID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      sessionID,
      userID,
      authMethods,
      authTime: authTime.toISOString(),
    },
  };

  // 6. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return {
    details: writeModelToObjectDetails(wm),
    samlRequest: {
      id: samlRequestID,
      loginClient: wm.loginClient,
      applicationID: wm.applicationID,
      acsURL: wm.acsURL,
      relayState: wm.relayState,
      requestID: wm.requestID,
      binding: wm.binding,
      issuer: wm.issuer,
      destination: wm.destination,
      responseIssuer: wm.responseIssuer,
      sessionID: wm.sessionID,
      userID: wm.userID,
      authMethods: wm.authMethods,
      authTime: wm.authTime,
    },
  };
}

/**
 * Fail SAML Request
 * Marks a SAML request as failed with an error reason
 * Based on Go: FailSAMLRequest
 */
export async function failSAMLRequest(
  this: Commands,
  ctx: Context,
  samlRequestID: string,
  errorReason: string,
  errorDescription?: string
): Promise<{ details: ObjectDetails; samlRequest: CurrentSAMLRequest }> {
  // 1. Validation
  validateRequired(samlRequestID, 'samlRequestID');
  validateRequired(errorReason, 'errorReason');

  // 2. Load SAML request write model
  const wm = new SAMLRequestWriteModel(samlRequestID, ctx.instanceID);
  await wm.load(this.getEventstore(), samlRequestID, ctx.instanceID);

  if (wm.state === SAMLRequestState.UNSPECIFIED) {
    throwNotFound('SAML request not found', 'SAML-req04');
  }

  if (wm.state !== SAMLRequestState.ADDED) {
    throwPreconditionFailed('SAML request already handled', 'SAML-req05');
  }

  // 3. Create event
  const command: Command = {
    eventType: 'saml.request.failed',
    aggregateType: 'saml_request',
    aggregateID: samlRequestID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      errorReason,
      errorDescription: errorDescription || '',
    },
  };

  // 4. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return {
    details: writeModelToObjectDetails(wm),
    samlRequest: {
      id: samlRequestID,
      loginClient: wm.loginClient,
      applicationID: wm.applicationID,
      acsURL: wm.acsURL,
      relayState: wm.relayState,
      requestID: wm.requestID,
      binding: wm.binding,
      issuer: wm.issuer,
      destination: wm.destination,
      responseIssuer: wm.responseIssuer,
      sessionID: wm.sessionID,
      userID: wm.userID,
      authMethods: wm.authMethods,
      authTime: wm.authTime,
    },
  };
}

/**
 * Get SAML Request
 * Retrieves a SAML request by ID
 */
export async function getSAMLRequest(
  this: Commands,
  ctx: Context,
  samlRequestID: string
): Promise<CurrentSAMLRequest | null> {
  validateRequired(samlRequestID, 'samlRequestID');

  const wm = new SAMLRequestWriteModel(samlRequestID, ctx.instanceID);
  await wm.load(this.getEventstore(), samlRequestID, ctx.instanceID);

  if (wm.state === SAMLRequestState.UNSPECIFIED) {
    return null;
  }

  return {
    id: samlRequestID,
    loginClient: wm.loginClient,
    applicationID: wm.applicationID,
    acsURL: wm.acsURL,
    relayState: wm.relayState,
    requestID: wm.requestID,
    binding: wm.binding,
    issuer: wm.issuer,
    destination: wm.destination,
    responseIssuer: wm.responseIssuer,
    sessionID: wm.sessionID,
    userID: wm.userID,
    authMethods: wm.authMethods,
    authTime: wm.authTime,
  };
}
