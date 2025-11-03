/**
 * SAML Session Commands
 * 
 * Handles SAML session creation and management
 * Based on Go: internal/command/saml_session.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { WriteModel, appendAndReduce, writeModelToObjectDetails, ObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { Command, Event } from '../../eventstore/types';
import { DatabasePool } from '../../database';

/**
 * SAML Session State
 */
export enum SAMLSessionState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  TERMINATED = 2,
}

/**
 * SAML Session Data
 */
export interface SAMLSessionData {
  id?: string;
  sessionID: string;
  samlResponseID: string;
  entityID: string;
  userID: string;
  audience: string[];
  expiration: Date;
  authMethods: string[];
  authTime: Date;
  preferredLanguage?: string;
}

/**
 * SAML Session Write Model
 */
class SAMLSessionWriteModel extends WriteModel {
  samlSessionID: string;
  state: SAMLSessionState = SAMLSessionState.UNSPECIFIED;
  sessionID: string = '';
  samlResponseID: string = '';
  entityID: string = '';
  userID: string = '';
  audience: string[] = [];
  expiration?: Date;
  authMethods: string[] = [];
  authTime?: Date;

  constructor(samlSessionID: string, instanceID: string) {
    super('saml_session');
    this.aggregateID = samlSessionID;
    this.resourceOwner = instanceID;
    this.samlSessionID = samlSessionID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'saml.session.added':
        this.state = SAMLSessionState.ACTIVE;
        this.sessionID = event.payload?.sessionID || '';
        this.samlResponseID = event.payload?.samlResponseID || '';
        this.entityID = event.payload?.entityID || '';
        this.userID = event.payload?.userID || '';
        this.audience = event.payload?.audience || [];
        if (event.payload?.expiration) {
          this.expiration = new Date(event.payload.expiration);
        }
        this.authMethods = event.payload?.authMethods || [];
        if (event.payload?.authTime) {
          this.authTime = new Date(event.payload.authTime);
        }
        break;

      case 'saml.session.terminated':
        this.state = SAMLSessionState.TERMINATED;
        break;
    }
  }
}

/**
 * Create SAML Session from SAML Request
 * 
 * Creates a SAML session after successful authentication
 * Based on Go: CreateSAMLSessionFromSAMLRequest
 */
export async function createSAMLSessionFromRequest(
  this: Commands,
  ctx: Context,
  samlRequestID: string,
  samlResponseID: string,
  samlResponseLifetime: number = 300 // 5 minutes default
): Promise<{ details: ObjectDetails; sessionID: string }> {
  // 1. Validation
  validateRequired(samlRequestID, 'samlRequestID');
  validateRequired(samlResponseID, 'samlResponseID');

  // 2. Load SAML request from projection
  // Note: In production, this would query from a proper projection table
  // For now, we'll create a minimal implementation
  const pool = (this as any).pool as DatabasePool;
  
  const requestQuery = `
    SELECT 
      sr.user_id,
      sr.session_id,
      sr.issuer,
      sr.auth_methods,
      sr.auth_time
    FROM saml_requests_projection sr
    WHERE sr.instance_id = $1
      AND sr.id = $2
      AND sr.state = 'added'
    LIMIT 1
  `;

  const result = await pool.query(requestQuery, [ctx.instanceID, samlRequestID]);

  if (result.rows.length === 0) {
    throwNotFound('SAML request not found or already processed', 'SAML-sess01');
  }

  const request = result.rows[0];

  // 3. Generate SAML session ID
  const sessionID = 'SAMLS_' + await this.nextID();

  // 4. Calculate expiration
  const expiration = new Date(Date.now() + samlResponseLifetime * 1000);

  // 5. Create SAML session
  const wm = new SAMLSessionWriteModel(sessionID, ctx.instanceID);
  await wm.load(this.getEventstore(), sessionID, ctx.instanceID);

  if (wm.state !== SAMLSessionState.UNSPECIFIED) {
    throwPreconditionFailed('SAML session already exists', 'SAML-sess02');
  }

  // 6. Create event
  const command: Command = {
    eventType: 'saml.session.added',
    aggregateType: 'saml_session',
    aggregateID: sessionID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      sessionID: request.session_id,
      samlResponseID,
      entityID: request.issuer,
      userID: request.user_id,
      audience: [request.issuer],
      expiration: expiration.toISOString(),
      authMethods: request.auth_methods || ['password'],
      authTime: request.auth_time || new Date().toISOString(),
    },
  };

  // 7. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  // 8. Mark SAML request as succeeded
  const succeedCommand: Command = {
    eventType: 'saml.request.succeeded',
    aggregateType: 'saml_request',
    aggregateID: samlRequestID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      timestamp: new Date().toISOString(),
    },
  };
  await this.getEventstore().push(succeedCommand);

  return {
    details: writeModelToObjectDetails(wm),
    sessionID,
  };
}

/**
 * Terminate SAML Session
 * 
 * Terminates an active SAML session (for Single Logout)
 */
export async function terminateSAMLSession(
  this: Commands,
  ctx: Context,
  samlSessionID: string
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(samlSessionID, 'samlSessionID');

  // 2. Load session
  const wm = new SAMLSessionWriteModel(samlSessionID, ctx.instanceID);
  await wm.load(this.getEventstore(), samlSessionID, ctx.instanceID);

  if (wm.state === SAMLSessionState.UNSPECIFIED) {
    throwNotFound('SAML session not found', 'SAML-sess03');
  }

  if (wm.state === SAMLSessionState.TERMINATED) {
    // Already terminated, idempotent
    return writeModelToObjectDetails(wm);
  }

  // 3. Create termination event
  const command: Command = {
    eventType: 'saml.session.terminated',
    aggregateType: 'saml_session',
    aggregateID: samlSessionID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      timestamp: new Date().toISOString(),
    },
  };

  // 4. Push event and reduce
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Get SAML Session
 * 
 * Retrieves a SAML session by ID
 */
export async function getSAMLSession(
  this: Commands,
  ctx: Context,
  samlSessionID: string
): Promise<SAMLSessionData | null> {
  validateRequired(samlSessionID, 'samlSessionID');

  const wm = new SAMLSessionWriteModel(samlSessionID, ctx.instanceID);
  await wm.load(this.getEventstore(), samlSessionID, ctx.instanceID);

  if (wm.state === SAMLSessionState.UNSPECIFIED) {
    return null;
  }

  return {
    id: samlSessionID,
    sessionID: wm.sessionID,
    samlResponseID: wm.samlResponseID,
    entityID: wm.entityID,
    userID: wm.userID,
    audience: wm.audience,
    expiration: wm.expiration || new Date(),
    authMethods: wm.authMethods,
    authTime: wm.authTime || new Date(),
  };
}

/**
 * Validate SAML Session
 * 
 * Checks if a SAML session is valid and active
 */
export async function validateSAMLSession(
  this: Commands,
  ctx: Context,
  samlSessionID: string
): Promise<boolean> {
  const session = await getSAMLSession.call(this, ctx, samlSessionID);

  if (!session) {
    return false;
  }

  // Check if expired
  if (session.expiration && session.expiration < new Date()) {
    return false;
  }

  const wm = new SAMLSessionWriteModel(samlSessionID, ctx.instanceID);
  await wm.load(this.getEventstore(), samlSessionID, ctx.instanceID);

  return wm.state === SAMLSessionState.ACTIVE;
}
