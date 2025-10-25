/**
 * Machine Key Commands
 * Manages authentication keys for machine users (service accounts)
 * Based on Zitadel Go internal/command/user_machine_key.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { WriteModel, appendAndReduce, writeModelToObjectDetails, ObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command, Event } from '../../eventstore/types';
import { AuthNKeyType } from '../../query/authn-key/authn-key-types';

/**
 * Machine Key State
 */
enum MachineKeyState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REMOVED = 2,
}

/**
 * Machine Key Write Model
 */
class MachineKeyWriteModel extends WriteModel {
  keyID: string;
  state: MachineKeyState = MachineKeyState.UNSPECIFIED;
  publicKey: Buffer = Buffer.from('');
  type: AuthNKeyType = AuthNKeyType.UNSPECIFIED;
  expirationDate?: Date;

  constructor(userID: string, keyID: string) {
    super('user');
    this.aggregateID = userID;
    this.keyID = keyID;
  }

  reduce(event: Event): void {
    // Filter events for this specific key
    const eventKeyID = event.payload?.keyID || event.payload?.id;
    if (eventKeyID && eventKeyID !== this.keyID) {
      return;
    }

    switch (event.eventType) {
      case 'user.machine.key.added':
        this.state = MachineKeyState.ACTIVE;
        const publicKey = event.payload?.publicKey;
        if (publicKey) {
          this.publicKey = Buffer.isBuffer(publicKey) 
            ? publicKey 
            : Buffer.from(publicKey, 'base64');
        }
        this.type = event.payload?.type || AuthNKeyType.JSON;
        if (event.payload?.expirationDate) {
          this.expirationDate = new Date(event.payload.expirationDate);
        }
        break;

      case 'user.machine.key.removed':
        this.state = MachineKeyState.REMOVED;
        break;

      case 'user.removed':
      case 'user.deleted':
        this.state = MachineKeyState.REMOVED;
        break;
    }
  }
}

/**
 * Machine Key Data
 */
export interface MachineKeyData {
  type: AuthNKeyType;
  expirationDate?: Date;
  publicKey: Buffer | string; // RSA/EC public key (PEM format or Buffer)
}

/**
 * Add Machine Key
 * Creates a new authentication key for a machine user
 * Based on Go: AddMachineKey
 */
export async function addMachineKey(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  data: MachineKeyData
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(data.publicKey, 'publicKey');

  if (data.type === AuthNKeyType.UNSPECIFIED) {
    throwInvalidArgument('Key type must be specified', 'KEY-001');
  }

  // 2. Generate key ID
  const keyID = await this.nextID();

  // 3. Load write model
  const wm = new MachineKeyWriteModel(userID, keyID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.state === MachineKeyState.ACTIVE) {
    throwAlreadyExists('Machine key already exists', 'KEY-002');
  }

  // 4. Validate expiration
  if (data.expirationDate) {
    if (data.expirationDate <= new Date()) {
      throwInvalidArgument('Expiration date must be in the future', 'KEY-003');
    }
  }

  // 5. Process public key
  let publicKeyBuffer: Buffer;
  if (Buffer.isBuffer(data.publicKey)) {
    publicKeyBuffer = data.publicKey;
  } else {
    // Assume PEM format string, encode to base64 for storage
    publicKeyBuffer = Buffer.from(data.publicKey, 'utf-8');
  }

  // Validate key format (basic check)
  const publicKeyStr = publicKeyBuffer.toString('utf-8');
  if (!publicKeyStr.includes('BEGIN') || !publicKeyStr.includes('END')) {
    throwInvalidArgument('Invalid public key format - must be PEM format', 'KEY-004');
  }

  // 6. Create event
  const command: Command = {
    eventType: 'user.machine.key.added',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      keyID,
      type: data.type,
      expirationDate: data.expirationDate?.toISOString(),
      publicKey: publicKeyBuffer.toString('base64'),
    },
  };

  // 7. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove Machine Key
 * Revokes a machine key permanently
 * Based on Go: RemoveMachineKey
 */
export async function removeMachineKey(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  keyID: string
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(keyID, 'keyID');

  // 2. Load write model
  const wm = new MachineKeyWriteModel(userID, keyID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.state !== MachineKeyState.ACTIVE) {
    throwNotFound('Machine key not found', 'KEY-005');
  }

  // 3. Create event
  const command: Command = {
    eventType: 'user.machine.key.removed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      keyID,
    },
  };

  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Get Machine Key Public Key (Query)
 * Retrieves the public key for JWT verification
 * This would integrate with AuthNKeyQueries in production
 */
export async function getMachineKeyPublicKey(
  this: Commands,
  _ctx: Context,
  userID: string,
  keyID: string
): Promise<Buffer | null> {
  // This is a query operation that would use AuthNKeyQueries
  // Placeholder for actual query layer integration
  validateRequired(userID, 'userID');
  validateRequired(keyID, 'keyID');
  
  // In production: return await authNKeyQueries.getPublicKey(keyID, ctx.instanceID);
  return null;
}
