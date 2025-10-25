/**
 * Personal Access Token Commands
 * Manages user API tokens for machine-to-machine authentication
 * Based on Zitadel Go internal/command/user_human_pat.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { WriteModel, appendAndReduce, writeModelToObjectDetails, ObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command, Event } from '../../eventstore/types';
import * as crypto from 'crypto';

/**
 * Personal Access Token State
 */
enum PATState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REMOVED = 2,
}

/**
 * Personal Access Token Write Model
 */
class PersonalAccessTokenWriteModel extends WriteModel {
  tokenID: string;
  state: PATState = PATState.UNSPECIFIED;
  tokenHash: string = '';
  scopes: string[] = [];
  expirationDate?: Date;

  constructor(userID: string, tokenID: string) {
    super('user');
    this.aggregateID = userID;
    this.tokenID = tokenID;
  }

  reduce(event: Event): void {
    // Filter events for this specific token
    const eventTokenID = event.payload?.id || event.payload?.tokenId;
    if (eventTokenID && eventTokenID !== this.tokenID) {
      return;
    }

    switch (event.eventType) {
      case 'user.personal.access.token.added':
      case 'user.token.added':
        this.state = PATState.ACTIVE;
        this.tokenHash = event.payload?.tokenHash || event.payload?.token || '';
        this.scopes = event.payload?.scopes || [];
        if (event.payload?.expirationDate) {
          this.expirationDate = new Date(event.payload.expirationDate);
        }
        break;

      case 'user.personal.access.token.removed':
      case 'user.token.removed':
        this.state = PATState.REMOVED;
        break;

      case 'user.removed':
        this.state = PATState.REMOVED;
        break;
    }
  }
}

/**
 * Personal Access Token Data
 */
export interface PersonalAccessTokenData {
  scopes?: string[];
  expirationDate?: Date;
}

/**
 * Hash token for storage
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate secure random token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Add Personal Access Token
 * Creates a new PAT for API authentication
 * Based on Go: AddPersonalAccessToken
 */
export async function addPersonalAccessToken(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  data: PersonalAccessTokenData
): Promise<{ token: string; details: ObjectDetails }> {
  // 1. Validation
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // 2. Generate token ID and token
  const tokenID = await this.nextID();
  const token = generateToken();
  const tokenHash = hashToken(token);

  // 3. Load write model
  const wm = new PersonalAccessTokenWriteModel(userID, tokenID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.state === PATState.ACTIVE) {
    throwAlreadyExists('Personal access token already exists', 'PAT-001');
  }

  // 4. Validate expiration
  if (data.expirationDate) {
    if (data.expirationDate <= new Date()) {
      throwInvalidArgument('Expiration date must be in the future', 'PAT-002');
    }
  }

  // 5. Create event
  const command: Command = {
    eventType: 'user.personal.access.token.added',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      id: tokenID,
      tokenHash,
      scopes: data.scopes || [],
      expirationDate: data.expirationDate?.toISOString(),
    },
  };

  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  // Return token (only time it's visible in plain text)
  return {
    token,
    details: writeModelToObjectDetails(wm),
  };
}

/**
 * Remove Personal Access Token
 * Revokes a PAT permanently
 * Based on Go: RemovePersonalAccessToken
 */
export async function removePersonalAccessToken(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  tokenID: string
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(tokenID, 'tokenID');

  // 2. Load write model
  const wm = new PersonalAccessTokenWriteModel(userID, tokenID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.state !== PATState.ACTIVE) {
    throwNotFound('Personal access token not found', 'PAT-003');
  }

  // 3. Create event
  const command: Command = {
    eventType: 'user.personal.access.token.removed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      id: tokenID,
    },
  };

  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Update Personal Access Token Usage (Internal)
 * Updates the last_used timestamp when token is verified
 * Based on Go: internal token usage tracking
 */
export async function updatePersonalAccessTokenUsage(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  tokenID: string
): Promise<void> {
  // 1. Validation
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(tokenID, 'tokenID');

  // 2. Create event (no write model needed for usage tracking)
  const command: Command = {
    eventType: 'user.personal.access.token.used',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: 'system',
    payload: {
      id: tokenID,
    },
  };

  // 3. Push event
  await this.getEventstore().push(command);
}
