/**
 * SMTP Configuration Commands
 * Manages SMTP email delivery configuration  
 * Based on Zitadel Go internal/command/smtp.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { WriteModel, appendAndReduce, writeModelToObjectDetails, ObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command, Event } from '../../eventstore/types';
import { SMTPConfigState } from '../../query/smtp/smtp-types';

/**
 * SMTP Write Model
 * Tracks the state of an SMTP configuration
 */
class SMTPWriteModel extends WriteModel {
  configID: string;
  state: SMTPConfigState = SMTPConfigState.UNSPECIFIED;
  description: string = '';
  tls: boolean = true;
  senderAddress: string = '';
  senderName: string = '';
  replyToAddress: string = '';
  host: string = '';
  user: string = '';

  constructor(orgID: string, configID: string) {
    super('org');
    this.aggregateID = orgID;
    this.resourceOwner = orgID;
    this.configID = configID;
  }

  reduce(event: Event): void {
    // Filter events for this specific config
    const eventConfigID = event.payload?.id;
    if (eventConfigID && eventConfigID !== this.configID) {
      return;
    }

    switch (event.eventType) {
      case 'org.smtp.config.added':
        this.state = SMTPConfigState.INACTIVE;
        this.description = event.payload?.description || '';
        this.tls = event.payload?.tls !== false;
        this.senderAddress = event.payload?.senderAddress || '';
        this.senderName = event.payload?.senderName || '';
        this.replyToAddress = event.payload?.replyToAddress || '';
        this.host = event.payload?.host || '';
        this.user = event.payload?.user || '';
        break;

      case 'org.smtp.config.changed':
        if (event.payload?.description !== undefined) {
          this.description = event.payload.description;
        }
        if (event.payload?.tls !== undefined) {
          this.tls = event.payload.tls;
        }
        if (event.payload?.senderAddress !== undefined) {
          this.senderAddress = event.payload.senderAddress;
        }
        if (event.payload?.senderName !== undefined) {
          this.senderName = event.payload.senderName;
        }
        if (event.payload?.replyToAddress !== undefined) {
          this.replyToAddress = event.payload.replyToAddress;
        }
        if (event.payload?.host !== undefined) {
          this.host = event.payload.host;
        }
        if (event.payload?.user !== undefined) {
          this.user = event.payload.user;
        }
        break;

      case 'org.smtp.config.activated':
        this.state = SMTPConfigState.ACTIVE;
        break;

      case 'org.smtp.config.deactivated':
        this.state = SMTPConfigState.INACTIVE;
        break;

      case 'org.smtp.config.removed':
      case 'org.removed':
        this.state = SMTPConfigState.UNSPECIFIED;
        break;
    }
  }
}

/**
 * SMTP Configuration Data
 */
export interface SMTPConfigData {
  description?: string;
  tls?: boolean;
  senderAddress: string;
  senderName?: string;
  replyToAddress?: string;
  host: string;
  user?: string;
  password?: string;
}

/**
 * Validate SMTP configuration
 */
function validateSMTPConfig(data: SMTPConfigData): void {
  validateRequired(data.senderAddress, 'senderAddress');
  validateRequired(data.host, 'host');

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.senderAddress)) {
    throwInvalidArgument('Invalid sender address format', 'SMTP-001');
  }

  if (data.replyToAddress && !emailRegex.test(data.replyToAddress)) {
    throwInvalidArgument('Invalid reply-to address format', 'SMTP-002');
  }
}

/**
 * Add SMTP Configuration to Organization
 */
export async function addSMTPConfigToOrg(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: SMTPConfigData
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateSMTPConfig(data);

  // 2. Generate config ID
  const configID = await this.nextID();

  // 3. Load write model (to check existence)
  const wm = new SMTPWriteModel(orgID, configID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state !== SMTPConfigState.UNSPECIFIED) {
    throwAlreadyExists('SMTP config already exists', 'SMTP-009');
  }

  // 4. Check permissions
  await this.checkPermission(ctx, 'org.smtp', 'create', orgID);

  // 5. Create event
  const command: Command = {
    eventType: 'org.smtp.config.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      id: configID,
      description: data.description || '',
      tls: data.tls !== false,
      senderAddress: data.senderAddress,
      senderName: data.senderName || '',
      replyToAddress: data.replyToAddress || '',
      host: data.host,
      user: data.user || '',
      password: data.password || '', // Should be encrypted
    },
  };

  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Change SMTP Configuration
 */
export async function changeSMTPConfig(
  this: Commands,
  ctx: Context,
  orgID: string,
  configID: string,
  data: Partial<SMTPConfigData>
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(configID, 'configID');

  // 2. Load write model
  const wm = new SMTPWriteModel(orgID, configID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state === SMTPConfigState.UNSPECIFIED) {
    throwNotFound('SMTP config not found', 'SMTP-003');
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'org.smtp', 'update', orgID);

  // 4. Build changes
  const changes: any = {};
  let hasChanges = false;

  if (data.description !== undefined && data.description !== wm.description) {
    changes.description = data.description;
    hasChanges = true;
  }
  if (data.tls !== undefined && data.tls !== wm.tls) {
    changes.tls = data.tls;
    hasChanges = true;
  }
  if (data.senderAddress !== undefined && data.senderAddress !== wm.senderAddress) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.senderAddress)) {
      throwInvalidArgument('Invalid sender address format', 'SMTP-004');
    }
    changes.senderAddress = data.senderAddress;
    hasChanges = true;
  }
  if (data.senderName !== undefined && data.senderName !== wm.senderName) {
    changes.senderName = data.senderName;
    hasChanges = true;
  }
  if (data.replyToAddress !== undefined && data.replyToAddress !== wm.replyToAddress) {
    if (data.replyToAddress) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.replyToAddress)) {
        throwInvalidArgument('Invalid reply-to address format', 'SMTP-005');
      }
    }
    changes.replyToAddress = data.replyToAddress;
    hasChanges = true;
  }
  if (data.host !== undefined && data.host !== wm.host) {
    changes.host = data.host;
    hasChanges = true;
  }
  if (data.user !== undefined && data.user !== wm.user) {
    changes.user = data.user;
    hasChanges = true;
  }
  if (data.password !== undefined) {
    changes.password = data.password;
    hasChanges = true;
  }

  if (!hasChanges) {
    return writeModelToObjectDetails(wm);
  }

  // 5. Create event
  const command: Command = {
    eventType: 'org.smtp.config.changed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      id: configID,
      ...changes,
    },
  };

  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Activate SMTP Configuration
 */
export async function activateSMTPConfig(
  this: Commands,
  ctx: Context,
  orgID: string,
  configID: string
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(configID, 'configID');

  // 2. Load write model
  const wm = new SMTPWriteModel(orgID, configID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state === SMTPConfigState.UNSPECIFIED) {
    throwNotFound('SMTP config not found', 'SMTP-006');
  }

  if (wm.state === SMTPConfigState.ACTIVE) {
    return writeModelToObjectDetails(wm);
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'org.smtp', 'update', orgID);

  // 4. Create event
  const command: Command = {
    eventType: 'org.smtp.config.activated',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: { id: configID },
  };

  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Deactivate SMTP Configuration
 */
export async function deactivateSMTPConfig(
  this: Commands,
  ctx: Context,
  orgID: string,
  configID: string
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(configID, 'configID');

  // 2. Load write model
  const wm = new SMTPWriteModel(orgID, configID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state === SMTPConfigState.UNSPECIFIED) {
    throwNotFound('SMTP config not found', 'SMTP-007');
  }

  if (wm.state === SMTPConfigState.INACTIVE) {
    return writeModelToObjectDetails(wm);
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'org.smtp', 'update', orgID);

  // 4. Create event
  const command: Command = {
    eventType: 'org.smtp.config.deactivated',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: { id: configID },
  };

  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove SMTP Configuration
 */
export async function removeSMTPConfig(
  this: Commands,
  ctx: Context,
  orgID: string,
  configID: string
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(configID, 'configID');

  // 2. Load write model
  const wm = new SMTPWriteModel(orgID, configID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state === SMTPConfigState.UNSPECIFIED) {
    throwNotFound('SMTP config not found', 'SMTP-008');
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'org.smtp', 'delete', orgID);

  // 4. Create event
  const command: Command = {
    eventType: 'org.smtp.config.removed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: { id: configID },
  };

  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}
