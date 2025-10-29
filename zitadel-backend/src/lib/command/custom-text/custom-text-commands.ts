/**
 * Custom Text Commands
 * 
 * Organization-level text customization for i18n/localization
 * Based on Zitadel Go implementation
 */

import { Context } from '../context';
import { Commands } from '../commands';
import { ObjectDetails } from '../write-model';
import { Command } from '../../eventstore/types';
import { validateRequired } from '../validation';
import { throwInvalidArgument } from '../../zerrors/errors';

/**
 * Custom Text Data
 */
export interface CustomTextData {
  language: string;  // ISO 639-1 language code (e.g., 'en', 'de', 'fr')
  key: string;       // Text key (e.g., 'Login.Title', 'Login.Subtitle')
  text: string;      // Custom text value
}

/**
 * Set Custom Text for Organization
 * 
 * Allows customizing UI text per organization and language
 * Example: Change login screen title from default to custom text
 */
export async function setCustomText(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: CustomTextData
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(data.language, 'language');
  validateRequired(data.key, 'key');
  validateRequired(data.text, 'text');
  
  // Validate language is ISO 639-1 format (2 characters)
  if (data.language.length !== 2) {
    throwInvalidArgument(
      'invalid language code format',
      'CUSTOM-TEXT-01'
    );
  }
  
  // Validate key is not empty and has reasonable length
  if (data.key.length > 200) {
    throwInvalidArgument(
      'key must be less than 200 characters',
      'CUSTOM-TEXT-02'
    );
  }
  
  // Validate text has reasonable length (10KB max)
  if (data.text.length > 10000) {
    throwInvalidArgument(
      'text must be less than 10000 characters',
      'CUSTOM-TEXT-03'
    );
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'org', 'write', orgID);
  
  // 3. Create event
  const command: Command = {
    eventType: 'org.custom.text.set',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      language: data.language,
      key: data.key,
      text: data.text,
    },
  };
  
  // 4. Push event
  const event = await this.getEventstore().push(command);
  
  return {
    sequence: BigInt(Math.floor(event.position.position)),
    eventDate: event.createdAt,
    resourceOwner: orgID,
  };
}

/**
 * Reset Custom Text for Organization
 * 
 * Removes all custom text for a specific language, reverting to defaults
 */
export async function resetCustomText(
  this: Commands,
  ctx: Context,
  orgID: string,
  language: string
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(language, 'language');
  
  if (language.length !== 2) {
    throwInvalidArgument(
      'invalid language code format',
      'CUSTOM-TEXT-04'
    );
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'org', 'write', orgID);
  
  // 3. Create event
  const command: Command = {
    eventType: 'org.custom.text.reset',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      language,
    },
  };
  
  // 4. Push event
  const event = await this.getEventstore().push(command);
  
  return {
    sequence: BigInt(Math.floor(event.position.position)),
    eventDate: event.createdAt,
    resourceOwner: orgID,
  };
}

// ============================================================================
// Instance-level Custom Text Commands
// ============================================================================

/**
 * Set Custom Login Text for Instance
 * 
 * Customizes login screen UI text at instance level
 */
export async function setCustomLoginText(
  this: Commands,
  ctx: Context,
  instanceID: string,
  data: {
    language: string;
    screen: string;  // e.g., 'login', 'register', 'password-reset'
    key: string;     // e.g., 'Title', 'Subtitle'
    text: string;
  }
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(instanceID, 'instanceID');
  validateRequired(data.language, 'language');
  validateRequired(data.screen, 'screen');
  validateRequired(data.key, 'key');
  validateRequired(data.text, 'text');
  
  if (data.language.length !== 2) {
    throwInvalidArgument(
      'invalid language code format',
      'CUSTOM-TEXT-10'
    );
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'instance', 'write', instanceID);
  
  // 3. Create event
  const command: Command = {
    eventType: 'instance.login.custom.text.set',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      language: data.language,
      screen: data.screen,
      key: data.key,
      text: data.text,
    },
  };
  
  // 4. Push event
  const event = await this.getEventstore().push(command);
  
  return {
    sequence: BigInt(Math.floor(event.position.position)),
    eventDate: event.createdAt,
    resourceOwner: instanceID,
  };
}

/**
 * Set Custom Init Message Text for Instance
 * 
 * Customizes initialization/welcome email templates
 */
export async function setCustomInitMessageText(
  this: Commands,
  ctx: Context,
  instanceID: string,
  data: {
    language: string;
    title?: string;
    preHeader?: string;
    subject?: string;
    greeting?: string;
    text?: string;
    buttonText?: string;
  }
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(instanceID, 'instanceID');
  validateRequired(data.language, 'language');
  
  if (data.language.length !== 2) {
    throwInvalidArgument(
      'invalid language code format',
      'CUSTOM-TEXT-11'
    );
  }
  
  // Validate that if fields are provided, they are not empty
  if (data.title !== undefined && data.title === '') {
    throwInvalidArgument('title is required', 'CUSTOM-TEXT-11a');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'instance', 'write', instanceID);
  
  // 3. Create event
  const command: Command = {
    eventType: 'instance.init.message.text.set',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      language: data.language,
      ...(data.title && { title: data.title }),
      ...(data.preHeader && { preHeader: data.preHeader }),
      ...(data.subject && { subject: data.subject }),
      ...(data.greeting && { greeting: data.greeting }),
      ...(data.text && { text: data.text }),
      ...(data.buttonText && { buttonText: data.buttonText }),
    },
  };
  
  // 4. Push event
  const event = await this.getEventstore().push(command);
  
  return {
    sequence: BigInt(Math.floor(event.position.position)),
    eventDate: event.createdAt,
    resourceOwner: instanceID,
  };
}

/**
 * Reset Custom Login Text for Instance
 * 
 * Removes all custom login text for a specific language
 */
export async function resetCustomLoginText(
  this: Commands,
  ctx: Context,
  instanceID: string,
  language: string
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(instanceID, 'instanceID');
  validateRequired(language, 'language');
  
  if (language.length !== 2) {
    throwInvalidArgument(
      'invalid language code format',
      'CUSTOM-TEXT-12'
    );
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'instance', 'write', instanceID);
  
  // 3. Create event
  const command: Command = {
    eventType: 'instance.login.custom.text.reset',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      language,
    },
  };
  
  // 4. Push event
  const event = await this.getEventstore().push(command);
  
  return {
    sequence: BigInt(Math.floor(event.position.position)),
    eventDate: event.createdAt,
    resourceOwner: instanceID,
  };
}

/**
 * Set Custom Message Text for Instance
 * 
 * Customizes email/SMS message templates (e.g., password reset, verification)
 */
export async function setCustomMessageText(
  this: Commands,
  ctx: Context,
  instanceID: string,
  data: {
    language: string;
    messageType: string;  // e.g., 'PasswordReset', 'VerifyEmail', 'InitCode'
    title?: string;
    preHeader?: string;
    subject?: string;
    greeting?: string;
    text?: string;
    buttonText?: string;
    footerText?: string;
  }
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(instanceID, 'instanceID');
  validateRequired(data.language, 'language');
  validateRequired(data.messageType, 'messageType');
  
  if (data.language.length !== 2) {
    throwInvalidArgument(
      'invalid language code format',
      'CUSTOM-TEXT-13'
    );
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'instance', 'write', instanceID);
  
  // 3. Create event
  const command: Command = {
    eventType: 'instance.custom.message.text.set',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      language: data.language,
      messageType: data.messageType,
      ...(data.title && { title: data.title }),
      ...(data.preHeader && { preHeader: data.preHeader }),
      ...(data.subject && { subject: data.subject }),
      ...(data.greeting && { greeting: data.greeting }),
      ...(data.text && { text: data.text }),
      ...(data.buttonText && { buttonText: data.buttonText }),
      ...(data.footerText && { footerText: data.footerText }),
    },
  };
  
  // 4. Push event
  const event = await this.getEventstore().push(command);
  
  return {
    sequence: BigInt(Math.floor(event.position.position)),
    eventDate: event.createdAt,
    resourceOwner: instanceID,
  };
}

/**
 * Set Custom Message Text for Organization
 * 
 * Customizes email/SMS message templates at org level
 */
export async function setOrgCustomMessageText(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: {
    language: string;
    messageType: string;
    title?: string;
    preHeader?: string;
    subject?: string;
    greeting?: string;
    text?: string;
    buttonText?: string;
    footerText?: string;
  }
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(data.language, 'language');
  validateRequired(data.messageType, 'messageType');
  
  if (data.language.length !== 2) {
    throwInvalidArgument(
      'invalid language code format',
      'CUSTOM-TEXT-14'
    );
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'org', 'write', orgID);
  
  // 3. Create event
  const command: Command = {
    eventType: 'org.custom.message.text.set',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      language: data.language,
      messageType: data.messageType,
      ...(data.title && { title: data.title }),
      ...(data.preHeader && { preHeader: data.preHeader }),
      ...(data.subject && { subject: data.subject }),
      ...(data.greeting && { greeting: data.greeting }),
      ...(data.text && { text: data.text }),
      ...(data.buttonText && { buttonText: data.buttonText }),
      ...(data.footerText && { footerText: data.footerText }),
    },
  };
  
  // 4. Push event
  const event = await this.getEventstore().push(command);
  
  return {
    sequence: BigInt(Math.floor(event.position.position)),
    eventDate: event.createdAt,
    resourceOwner: orgID,
  };
}

/**
 * Reset Custom Message Text for Instance
 * 
 * Removes custom message text for a specific message type and language
 */
export async function resetCustomMessageText(
  this: Commands,
  ctx: Context,
  instanceID: string,
  language: string,
  messageType: string
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(instanceID, 'instanceID');
  validateRequired(language, 'language');
  validateRequired(messageType, 'messageType');
  
  if (language.length !== 2) {
    throwInvalidArgument(
      'invalid language code format',
      'CUSTOM-TEXT-15'
    );
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'instance', 'write', instanceID);
  
  // 3. Create event
  const command: Command = {
    eventType: 'instance.custom.message.text.reset',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      language,
      messageType,
    },
  };
  
  // 4. Push event
  const event = await this.getEventstore().push(command);
  
  return {
    sequence: BigInt(Math.floor(event.position.position)),
    eventDate: event.createdAt,
    resourceOwner: instanceID,
  };
}

/**
 * Reset Custom Message Text for Organization
 * 
 * Removes custom message text for a specific message type and language at org level
 */
export async function resetOrgCustomMessageText(
  this: Commands,
  ctx: Context,
  orgID: string,
  language: string,
  messageType: string
): Promise<ObjectDetails> {
  // 1. Validation
  validateRequired(orgID, 'orgID');
  validateRequired(language, 'language');
  validateRequired(messageType, 'messageType');
  
  if (language.length !== 2) {
    throwInvalidArgument(
      'invalid language code format',
      'CUSTOM-TEXT-16'
    );
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'org', 'write', orgID);
  
  // 3. Create event
  const command: Command = {
    eventType: 'org.custom.message.text.reset',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      language,
      messageType,
    },
  };
  
  // 4. Push event
  const event = await this.getEventstore().push(command);
  
  return {
    sequence: BigInt(Math.floor(event.position.position)),
    eventDate: event.createdAt,
    resourceOwner: orgID,
  };
}
