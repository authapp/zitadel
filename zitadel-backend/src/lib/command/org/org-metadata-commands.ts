/**
 * Organization Metadata Commands
 * 
 * Key-value metadata storage for organizations
 * Based on Go: internal/command/org_metadata.go
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
 * Organization Metadata Write Model (single key)
 */
class OrgMetadataWriteModel extends WriteModel {
  key: string;
  value: string = '';
  state: MetadataState = MetadataState.UNSPECIFIED;

  constructor(orgID: string, key: string) {
    super('org');
    this.aggregateID = orgID;
    this.key = key;
  }

  reduce(event: any): void {
    switch (event.eventType) {
      case 'org.metadata.set':
        if (event.payload?.key === this.key) {
          this.state = MetadataState.ACTIVE;
          this.value = event.payload?.value || '';
        }
        break;
      case 'org.metadata.removed':
        if (event.payload?.key === this.key) {
          this.state = MetadataState.REMOVED;
        }
        break;
    }
  }
}

/**
 * Organization Metadata List Write Model (for bulk operations)
 */
class OrgMetadataListWriteModel extends WriteModel {
  metadata: Map<string, string> = new Map();

  constructor(orgID: string) {
    super('org');
    this.aggregateID = orgID;
  }

  reduce(event: any): void {
    switch (event.eventType) {
      case 'org.metadata.set':
        if (event.payload?.key) {
          this.metadata.set(event.payload.key, event.payload.value || '');
        }
        break;
      case 'org.metadata.removed':
        if (event.payload?.key) {
          this.metadata.delete(event.payload.key);
        }
        break;
    }
  }
}

/**
 * Set organization metadata (single key-value)
 * Based on Go: SetOrgMetadata (org_metadata.go:12-33)
 */
export async function setOrgMetadata(
  this: Commands,
  ctx: Context,
  orgID: string,
  metadata: MetadataEntry
): Promise<MetadataEntry> {
  validateRequired(orgID, 'orgID');
  validateRequired(metadata.key, 'metadata.key');

  if (!metadata.value) {
    throwInvalidArgument('metadata value is required', 'META-001');
  }

  // Check org exists (in real implementation)
  await this.checkPermission(ctx, 'org.metadata', 'write', orgID);

  // Convert value to string if it's an object
  const valueStr = typeof metadata.value === 'string' 
    ? metadata.value 
    : JSON.stringify(metadata.value);

  const command: Command = {
    eventType: 'org.metadata.set',
    aggregateType: 'org',
    aggregateID: orgID,
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
 * Bulk set organization metadata (multiple key-value pairs)
 * Based on Go: BulkSetOrgMetadata (org_metadata.go:35-65)
 */
export async function bulkSetOrgMetadata(
  this: Commands,
  ctx: Context,
  orgID: string,
  metadatas: MetadataEntry[]
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  if (metadatas.length === 0) {
    throwPreconditionFailed('no metadata provided', 'META-002');
  }

  // Validate all metadata
  for (const metadata of metadatas) {
    if (!metadata.key) {
      throwInvalidArgument('metadata key is required', 'META-003');
    }
    if (!metadata.value) {
      throwInvalidArgument('metadata value is required', 'META-004');
    }
  }

  await this.checkPermission(ctx, 'org.metadata', 'write', orgID);

  // Create multiple commands
  const commands: Command[] = metadatas.map(metadata => {
    const valueStr = typeof metadata.value === 'string'
      ? metadata.value
      : JSON.stringify(metadata.value);

    return {
      eventType: 'org.metadata.set',
      aggregateType: 'org',
      aggregateID: orgID,
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

  const wm = new OrgMetadataListWriteModel(orgID);
  for (const event of events) {
    appendAndReduce(wm, event);
  }

  return writeModelToObjectDetails(wm);
}

/**
 * Remove organization metadata (single key)
 * Based on Go: RemoveOrgMetadata (org_metadata.go:79-109)
 */
export async function removeOrgMetadata(
  this: Commands,
  ctx: Context,
  orgID: string,
  key: string
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');
  validateRequired(key, 'key');

  await this.checkPermission(ctx, 'org.metadata', 'delete', orgID);

  // Load write model to check if it exists
  const wm = new OrgMetadataWriteModel(orgID, key);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state !== MetadataState.ACTIVE) {
    throwNotFound('metadata not found', 'META-005');
  }

  const command: Command = {
    eventType: 'org.metadata.removed',
    aggregateType: 'org',
    aggregateID: orgID,
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
 * Bulk remove organization metadata (multiple keys)
 * Based on Go: BulkRemoveOrgMetadata (org_metadata.go:111-150)
 */
export async function bulkRemoveOrgMetadata(
  this: Commands,
  ctx: Context,
  orgID: string,
  keys: string[]
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  if (keys.length === 0) {
    throwPreconditionFailed('no metadata keys provided', 'META-006');
  }

  await this.checkPermission(ctx, 'org.metadata', 'delete', orgID);

  // Create removal commands for all keys
  const commands: Command[] = keys.map(key => ({
    eventType: 'org.metadata.removed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      key,
    },
  }));

  // Push all events
  const events = await this.getEventstore().pushMany(commands);

  const wm = new OrgMetadataListWriteModel(orgID);
  for (const event of events) {
    appendAndReduce(wm, event);
  }

  return writeModelToObjectDetails(wm);
}
