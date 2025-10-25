/**
 * SMS Configuration Commands
 * Manages SMS delivery configuration
 * Based on Zitadel Go internal/command/sms.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { WriteModel, appendAndReduce, writeModelToObjectDetails, ObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command, Event } from '../../eventstore/types';
import { SMSConfigState, SMSProviderType } from '../../query/sms/sms-types';

/**
 * SMS Write Model
 * Tracks the state of an SMS configuration
 */
class SMSWriteModel extends WriteModel {
  configID: string;
  state: SMSConfigState = SMSConfigState.UNSPECIFIED;
  description: string = '';
  providerType: SMSProviderType = SMSProviderType.TWILIO;
  twilioSID: string = '';
  twilioSenderNumber: string = '';
  twilioVerifyServiceSID: string = '';
  httpEndpoint: string = '';

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
      case 'org.sms.config.twilio.added':
        this.state = SMSConfigState.INACTIVE;
        this.providerType = SMSProviderType.TWILIO;
        this.description = event.payload?.description || '';
        this.twilioSID = event.payload?.sid || '';
        this.twilioSenderNumber = event.payload?.senderNumber || '';
        this.twilioVerifyServiceSID = event.payload?.verifyServiceSID || '';
        break;

      case 'org.sms.config.twilio.changed':
        if (event.payload?.description !== undefined) {
          this.description = event.payload.description;
        }
        if (event.payload?.sid !== undefined) {
          this.twilioSID = event.payload.sid;
        }
        if (event.payload?.senderNumber !== undefined) {
          this.twilioSenderNumber = event.payload.senderNumber;
        }
        if (event.payload?.verifyServiceSID !== undefined) {
          this.twilioVerifyServiceSID = event.payload.verifyServiceSID;
        }
        break;

      case 'org.sms.config.http.added':
        this.state = SMSConfigState.INACTIVE;
        this.providerType = SMSProviderType.HTTP;
        this.description = event.payload?.description || '';
        this.httpEndpoint = event.payload?.endpoint || '';
        break;

      case 'org.sms.config.http.changed':
        if (event.payload?.description !== undefined) {
          this.description = event.payload.description;
        }
        if (event.payload?.endpoint !== undefined) {
          this.httpEndpoint = event.payload.endpoint;
        }
        break;

      case 'org.sms.config.activated':
        this.state = SMSConfigState.ACTIVE;
        break;

      case 'org.sms.config.deactivated':
        this.state = SMSConfigState.INACTIVE;
        break;

      case 'org.sms.config.removed':
      case 'org.removed':
        this.state = SMSConfigState.UNSPECIFIED;
        break;
    }
  }
}

/**
 * Twilio SMS Configuration Data
 */
export interface TwilioSMSConfigData {
  description?: string;
  sid: string;
  token: string;
  senderNumber: string;
  verifyServiceSID?: string;
}

/**
 * HTTP SMS Configuration Data
 */
export interface HTTPSMSConfigData {
  description?: string;
  endpoint: string;
}

/**
 * Validate Twilio SMS configuration
 */
function validateTwilioConfig(data: TwilioSMSConfigData): void {
  validateRequired(data.sid, 'sid');
  validateRequired(data.token, 'token');
  validateRequired(data.senderNumber, 'senderNumber');
}

/**
 * Validate HTTP SMS configuration
 */
function validateHTTPConfig(data: HTTPSMSConfigData): void {
  validateRequired(data.endpoint, 'endpoint');

  try {
    new URL(data.endpoint);
  } catch {
    throwInvalidArgument('Invalid HTTP endpoint URL', 'SMS-001');
  }
}

/**
 * Add Twilio SMS Configuration to Organization
 */
export async function addTwilioSMSConfigToOrg(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: TwilioSMSConfigData
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateTwilioConfig(data);

  // 2. Generate config ID
  const configID = await this.nextID();

  // 3. Load write model (to check existence)
  const wm = new SMSWriteModel(orgID, configID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state !== SMSConfigState.UNSPECIFIED) {
    throwAlreadyExists('SMS config already exists', 'SMS-002');
  }

  // 4. Check permissions
  await this.checkPermission(ctx, 'org.sms', 'create', orgID);

  // 5. Create event
  const command: Command = {
    eventType: 'org.sms.config.twilio.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      id: configID,
      description: data.description || '',
      sid: data.sid,
      token: data.token, // Should be encrypted
      senderNumber: data.senderNumber,
      verifyServiceSID: data.verifyServiceSID || '',
    },
  };

  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Change Twilio SMS Configuration
 */
export async function changeTwilioSMSConfig(
  this: Commands,
  ctx: Context,
  orgID: string,
  configID: string,
  data: Partial<TwilioSMSConfigData>
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(configID, 'configID');

  // 2. Load write model
  const wm = new SMSWriteModel(orgID, configID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state === SMSConfigState.UNSPECIFIED) {
    throwNotFound('SMS config not found', 'SMS-003');
  }

  if (wm.providerType !== SMSProviderType.TWILIO) {
    throwInvalidArgument('Config is not Twilio type', 'SMS-004');
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'org.sms', 'update', orgID);

  // 4. Build changes
  const changes: any = {};
  let hasChanges = false;

  if (data.description !== undefined && data.description !== wm.description) {
    changes.description = data.description;
    hasChanges = true;
  }
  if (data.sid !== undefined && data.sid !== wm.twilioSID) {
    changes.sid = data.sid;
    hasChanges = true;
  }
  if (data.token !== undefined) {
    changes.token = data.token;
    hasChanges = true;
  }
  if (data.senderNumber !== undefined && data.senderNumber !== wm.twilioSenderNumber) {
    changes.senderNumber = data.senderNumber;
    hasChanges = true;
  }
  if (data.verifyServiceSID !== undefined && data.verifyServiceSID !== wm.twilioVerifyServiceSID) {
    changes.verifyServiceSID = data.verifyServiceSID;
    hasChanges = true;
  }

  if (!hasChanges) {
    return writeModelToObjectDetails(wm);
  }

  // 5. Create event
  const command: Command = {
    eventType: 'org.sms.config.twilio.changed',
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
 * Add HTTP SMS Configuration to Organization
 */
export async function addHTTPSMSConfigToOrg(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: HTTPSMSConfigData
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateHTTPConfig(data);

  // 2. Generate config ID
  const configID = await this.nextID();

  // 3. Load write model (to check existence)
  const wm = new SMSWriteModel(orgID, configID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state !== SMSConfigState.UNSPECIFIED) {
    throwAlreadyExists('SMS config already exists', 'SMS-005');
  }

  // 4. Check permissions
  await this.checkPermission(ctx, 'org.sms', 'create', orgID);

  // 5. Create event
  const command: Command = {
    eventType: 'org.sms.config.http.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      id: configID,
      description: data.description || '',
      endpoint: data.endpoint,
    },
  };

  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Change HTTP SMS Configuration
 */
export async function changeHTTPSMSConfig(
  this: Commands,
  ctx: Context,
  orgID: string,
  configID: string,
  data: Partial<HTTPSMSConfigData>
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(configID, 'configID');

  // 2. Load write model
  const wm = new SMSWriteModel(orgID, configID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state === SMSConfigState.UNSPECIFIED) {
    throwNotFound('SMS config not found', 'SMS-006');
  }

  if (wm.providerType !== SMSProviderType.HTTP) {
    throwInvalidArgument('Config is not HTTP type', 'SMS-007');
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'org.sms', 'update', orgID);

  // 4. Build changes
  const changes: any = {};
  let hasChanges = false;

  if (data.description !== undefined && data.description !== wm.description) {
    changes.description = data.description;
    hasChanges = true;
  }
  if (data.endpoint !== undefined && data.endpoint !== wm.httpEndpoint) {
    try {
      new URL(data.endpoint);
    } catch {
      throwInvalidArgument('Invalid HTTP endpoint URL', 'SMS-008');
    }
    changes.endpoint = data.endpoint;
    hasChanges = true;
  }

  if (!hasChanges) {
    return writeModelToObjectDetails(wm);
  }

  // 5. Create event
  const command: Command = {
    eventType: 'org.sms.config.http.changed',
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
 * Activate SMS Configuration
 */
export async function activateSMSConfig(
  this: Commands,
  ctx: Context,
  orgID: string,
  configID: string
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(configID, 'configID');

  // 2. Load write model
  const wm = new SMSWriteModel(orgID, configID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state === SMSConfigState.UNSPECIFIED) {
    throwNotFound('SMS config not found', 'SMS-009');
  }

  if (wm.state === SMSConfigState.ACTIVE) {
    return writeModelToObjectDetails(wm);
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'org.sms', 'update', orgID);

  // 4. Create event
  const command: Command = {
    eventType: 'org.sms.config.activated',
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
 * Deactivate SMS Configuration
 */
export async function deactivateSMSConfig(
  this: Commands,
  ctx: Context,
  orgID: string,
  configID: string
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(configID, 'configID');

  // 2. Load write model
  const wm = new SMSWriteModel(orgID, configID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state === SMSConfigState.UNSPECIFIED) {
    throwNotFound('SMS config not found', 'SMS-010');
  }

  if (wm.state === SMSConfigState.INACTIVE) {
    return writeModelToObjectDetails(wm);
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'org.sms', 'update', orgID);

  // 4. Create event
  const command: Command = {
    eventType: 'org.sms.config.deactivated',
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
 * Remove SMS Configuration
 */
export async function removeSMSConfig(
  this: Commands,
  ctx: Context,
  orgID: string,
  configID: string
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(configID, 'configID');

  // 2. Load write model
  const wm = new SMSWriteModel(orgID, configID);
  await wm.load(this.getEventstore(), orgID, orgID);

  if (wm.state === SMSConfigState.UNSPECIFIED) {
    throwNotFound('SMS config not found', 'SMS-011');
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'org.sms', 'delete', orgID);

  // 4. Create event
  const command: Command = {
    eventType: 'org.sms.config.removed',
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
