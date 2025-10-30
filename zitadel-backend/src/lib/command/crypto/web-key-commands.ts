/**
 * Web Key Commands (Phase 3 - Sprint 3)
 * 
 * Manages JSON Web Keys (JWKS) for OIDC/OAuth token signing
 * Reference: internal/command/web_key.go
 */

import { Context } from '../context';
import { Commands } from '../commands';
import { ObjectDetails, WriteModel, writeModelToObjectDetails } from '../write-model';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { Command, Event } from '../../eventstore/types';
import * as crypto from 'crypto';

/**
 * Web Key State
 */
export enum WebKeyState {
  UNSPECIFIED = 0,
  INITIAL = 1,
  ACTIVE = 2,
  INACTIVE = 3,
}

/**
 * Web Key Algorithm
 */
export enum WebKeyAlgorithm {
  RS256 = 'RS256',
  RS384 = 'RS384',
  RS512 = 'RS512',
  ES256 = 'ES256',
  ES384 = 'ES384',
  ES512 = 'ES512',
}

/**
 * Web Key Usage
 */
export enum WebKeyUsage {
  SIGNING = 'sig',
  ENCRYPTION = 'enc',
}

/**
 * Web Key Write Model
 */
export class WebKeyWriteModel extends WriteModel {
  state: WebKeyState = WebKeyState.UNSPECIFIED;
  algorithm: WebKeyAlgorithm = WebKeyAlgorithm.RS256;
  usage: WebKeyUsage = WebKeyUsage.SIGNING;
  publicKey: string = '';
  privateKey: string = '';
  keyID: string = '';

  constructor() {
    super('web_key');
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'web_key.generated':
        this.state = WebKeyState.INITIAL;
        this.algorithm = event.payload?.algorithm || WebKeyAlgorithm.RS256;
        this.usage = event.payload?.usage || WebKeyUsage.SIGNING;
        this.publicKey = event.payload?.publicKey || '';
        this.privateKey = event.payload?.privateKey || '';
        this.keyID = event.payload?.keyID || '';
        break;

      case 'web_key.activated':
        this.state = WebKeyState.ACTIVE;
        break;

      case 'web_key.deactivated':
        this.state = WebKeyState.INACTIVE;
        break;

      case 'web_key.removed':
        this.state = WebKeyState.UNSPECIFIED;
        break;
    }
  }

  exists(): boolean {
    return this.state !== WebKeyState.UNSPECIFIED;
  }
}

/**
 * Generate Web Key command
 * 
 * Generates a new RSA or ECDSA key pair for JWT signing
 */
export async function generateWebKey(
  this: Commands,
  ctx: Context,
  algorithm: WebKeyAlgorithm = WebKeyAlgorithm.RS256,
  usage: WebKeyUsage = WebKeyUsage.SIGNING
): Promise<ObjectDetails & { keyID: string }> {
  // 1. Validate input
  if (!Object.values(WebKeyAlgorithm).includes(algorithm)) {
    throwInvalidArgument('Invalid algorithm', 'COMMAND-WebKey01');
  }
  if (!Object.values(WebKeyUsage).includes(usage)) {
    throwInvalidArgument('Invalid usage', 'COMMAND-WebKey02');
  }

  // 2. Generate key ID
  const keyID = await this.nextID();

  // 3. Check permissions
  await this.checkPermission(ctx, 'crypto.webkey', 'generate', ctx.instanceID);

  // 4. Generate key pair based on algorithm
  let publicKey: string;
  let privateKey: string;

  if (algorithm.startsWith('RS')) {
    // RSA key generation
    const modulusLength = algorithm === 'RS256' ? 2048 : algorithm === 'RS384' ? 3072 : 4096;
    const { publicKey: pubKey, privateKey: privKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    publicKey = pubKey;
    privateKey = privKey;
  } else {
    // ECDSA key generation
    const namedCurve = algorithm === 'ES256' ? 'prime256v1' : 
                       algorithm === 'ES384' ? 'secp384r1' : 'secp521r1';
    const { publicKey: pubKey, privateKey: privKey } = crypto.generateKeyPairSync('ec', {
      namedCurve,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    publicKey = pubKey;
    privateKey = privKey;
  }

  // 5. Create key generation event
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'web_key.generated',
    aggregateType: 'web_key',
    aggregateID: keyID,
    owner: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      keyID,
      algorithm,
      usage,
      publicKey,
      privateKey, // In production, this should be encrypted
      generatedAt: new Date(),
    },
  };

  await this.getEventstore().push(command);

  return {
    keyID,
    sequence: BigInt(1),
    eventDate: new Date(),
    resourceOwner: ctx.instanceID,
  };
}

/**
 * Activate Web Key command
 * 
 * Activates a generated web key for use in signing
 */
export async function activateWebKey(
  this: Commands,
  ctx: Context,
  keyID: string
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!keyID) {
    throwInvalidArgument('keyID is required', 'COMMAND-WebKey10');
  }

  // 2. Check permissions
  await this.checkPermission(ctx, 'crypto.webkey', 'activate', ctx.instanceID);

  // 3. Load key write model
  const wm = new WebKeyWriteModel();
  await wm.load(this.getEventstore(), keyID, ctx.instanceID);

  if (!wm.exists()) {
    throwNotFound('web key not found', 'COMMAND-WebKey11');
  }

  if (wm.state === WebKeyState.ACTIVE) {
    throwPreconditionFailed('web key already active', 'COMMAND-WebKey12');
  }

  if (wm.state === WebKeyState.INACTIVE) {
    throwPreconditionFailed('cannot activate inactive key', 'COMMAND-WebKey13');
  }

  // 4. Create activation event
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'web_key.activated',
    aggregateType: 'web_key',
    aggregateID: keyID,
    owner: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      activatedAt: new Date(),
    },
  };

  await this.getEventstore().push(command);

  return writeModelToObjectDetails(wm);
}

/**
 * Deactivate Web Key command
 * 
 * Deactivates a web key (stops using for new signatures)
 */
export async function deactivateWebKey(
  this: Commands,
  ctx: Context,
  keyID: string
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!keyID) {
    throwInvalidArgument('keyID is required', 'COMMAND-WebKey20');
  }

  // 2. Check permissions
  await this.checkPermission(ctx, 'crypto.webkey', 'deactivate', ctx.instanceID);

  // 3. Load key write model
  const wm = new WebKeyWriteModel();
  await wm.load(this.getEventstore(), keyID, ctx.instanceID);

  if (!wm.exists()) {
    throwNotFound('web key not found', 'COMMAND-WebKey21');
  }

  if (wm.state !== WebKeyState.ACTIVE) {
    throwPreconditionFailed('web key not active', 'COMMAND-WebKey22');
  }

  // 4. Create deactivation event
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'web_key.deactivated',
    aggregateType: 'web_key',
    aggregateID: keyID,
    owner: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      deactivatedAt: new Date(),
    },
  };

  await this.getEventstore().push(command);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove Web Key command
 * 
 * Permanently removes a web key
 */
export async function removeWebKey(
  this: Commands,
  ctx: Context,
  keyID: string
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!keyID) {
    throwInvalidArgument('keyID is required', 'COMMAND-WebKey30');
  }

  // 2. Check permissions
  await this.checkPermission(ctx, 'crypto.webkey', 'remove', ctx.instanceID);

  // 3. Load key write model
  const wm = new WebKeyWriteModel();
  await wm.load(this.getEventstore(), keyID, ctx.instanceID);

  if (!wm.exists()) {
    throwNotFound('web key not found', 'COMMAND-WebKey31');
  }

  if (wm.state === WebKeyState.ACTIVE) {
    throwPreconditionFailed('cannot remove active key', 'COMMAND-WebKey32');
  }

  // 4. Create removal event
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'web_key.removed',
    aggregateType: 'web_key',
    aggregateID: keyID,
    owner: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      removedAt: new Date(),
    },
  };

  await this.getEventstore().push(command);

  return writeModelToObjectDetails(wm);
}
