/**
 * User Metadata Commands
 * 
 * Key-value metadata storage for users
 * Based on Go: internal/command/user_metadata.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwPreconditionFailed, throwNotFound } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { WriteModel } from '../write-model';

/**
 * Metadata entry
 */
export interface MetadataEntry {
  key: string;
  value: string | Record<string, any>; // Can be string or JSON object
}

/**
 * Metadata State
 */
export enum MetadataState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REMOVED = 2,
}

/**
 * User Metadata Write Model (single key)
 */
class UserMetadataWriteModel extends WriteModel {
  key: string;
  value: string = '';
  state: MetadataState = MetadataState.UNSPECIFIED;

  constructor(userID: string, key: string) {
    super('user');
    this.aggregateID = userID;
    this.key = key;
  }

  reduce(event: any): void {
    switch (event.eventType) {
      case 'user.metadata.set':
        if (event.payload?.key === this.key) {
          this.state = MetadataState.ACTIVE;
          this.value = event.payload?.value || '';
        }
        break;
      case 'user.metadata.removed':
        if (event.payload?.key === this.key) {
          this.state = MetadataState.REMOVED;
        }
        break;
    }
  }
}

/**
 * User Metadata List Write Model (for bulk operations)
 */
class UserMetadataListWriteModel extends WriteModel {
  metadata: Map<string, string> = new Map();

  constructor(userID: string) {
    super('user');
    this.aggregateID = userID;
  }

  reduce(event: any): void {
    switch (event.eventType) {
      case 'user.metadata.set':
        if (event.payload?.key) {
          this.metadata.set(event.payload.key, event.payload.value || '');
        }
        break;
      case 'user.metadata.removed':
        if (event.payload?.key) {
          this.metadata.delete(event.payload.key);
        }
        break;
    }
  }
}

/**
 * Set user metadata (single key-value)
 * Based on Go: SetUserMetadata (user_metadata.go:14-53)
 */
export async function setUserMetadata(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  metadata: MetadataEntry
): Promise<MetadataEntry> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(metadata.key, 'metadata.key');

  if (!metadata.value) {
    throwInvalidArgument('metadata value is required', 'META-U001');
  }

  // Check permissions
  await this.checkPermission(ctx, 'user.metadata', 'write', orgID);

  // Convert value to string if it's an object
  const valueStr = typeof metadata.value === 'string' 
    ? metadata.value 
    : JSON.stringify(metadata.value);

  const command: Command = {
    eventType: 'user.metadata.set',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      key: metadata.key,
      value: valueStr,
    },
  };

  await this.getEventstore().push(command);

  return {
    key: metadata.key,
    value: valueStr,
  };
}

/**
 * Bulk set user metadata (multiple key-value pairs)
 * Based on Go: BulkSetUserMetadata (user_metadata.go:55-102)
 */
export async function bulkSetUserMetadata(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  metadatas: MetadataEntry[]
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  if (metadatas.length === 0) {
    throwPreconditionFailed('no metadata provided', 'META-U002');
  }

  // Validate all metadata
  for (const metadata of metadatas) {
    if (!metadata.key) {
      throwInvalidArgument('metadata key is required', 'META-U003');
    }
    if (!metadata.value) {
      throwInvalidArgument('metadata value is required', 'META-U004');
    }
  }

  await this.checkPermission(ctx, 'user.metadata', 'write', orgID);

  // Create multiple commands
  const commands: Command[] = metadatas.map(metadata => {
    const valueStr = typeof metadata.value === 'string'
      ? metadata.value
      : JSON.stringify(metadata.value);

    return {
      eventType: 'user.metadata.set',
      aggregateType: 'user',
      aggregateID: userID,
      owner: orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        key: metadata.key,
        value: valueStr,
      },
    };
  });

  // Push all events
  const events = await this.getEventstore().pushMany(commands);

  const wm = new UserMetadataListWriteModel(userID);
  for (const event of events) {
    appendAndReduce(wm, event);
  }

  return writeModelToObjectDetails(wm);
}

/**
 * Remove user metadata (single key)
 * Based on Go: RemoveUserMetadata (user_metadata.go:116-152)
 */
export async function removeUserMetadata(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  key: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(key, 'key');

  await this.checkPermission(ctx, 'user.metadata', 'delete', orgID);

  // Load write model to check if it exists
  const wm = new UserMetadataWriteModel(userID, key);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.state !== MetadataState.ACTIVE) {
    throwNotFound('metadata not found', 'META-U005');
  }

  const command: Command = {
    eventType: 'user.metadata.removed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      key,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Bulk remove user metadata (multiple keys)
 * Based on Go: BulkRemoveUserMetadata (user_metadata.go:154-198)
 */
export async function bulkRemoveUserMetadata(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  keys: string[]
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  if (keys.length === 0) {
    throwPreconditionFailed('no metadata keys provided', 'META-U006');
  }

  await this.checkPermission(ctx, 'user.metadata', 'delete', orgID);

  // Create removal commands for all keys
  const commands: Command[] = keys.map(key => ({
    eventType: 'user.metadata.removed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      key,
    },
  }));

  // Push all events
  const events = await this.getEventstore().pushMany(commands);

  const wm = new UserMetadataListWriteModel(userID);
  for (const event of events) {
    appendAndReduce(wm, event);
  }

  return writeModelToObjectDetails(wm);
}
