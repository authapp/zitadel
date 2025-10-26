/**
 * Custom Text Commands
 * 
 * Commands for managing custom text and translations:
 * - Organization-level text customization
 * - Login screen text customization
 * - Email template text customization
 * - Multi-language support (i18n)
 * 
 * Based on Zitadel Go:
 * - internal/command/org_custom_text.go
 * - internal/command/instance_custom_text.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { Command } from '../../eventstore/types';
import { throwInvalidArgument } from '../../zerrors/errors';

/**
 * Custom text data for organization
 */
export interface CustomTextData {
  language: string;          // Language code (e.g., 'en', 'de', 'fr')
  key: string;               // Text key (e.g., 'Login.Title', 'Login.Description')
  text: string;              // Custom text value
}

/**
 * Custom login text data
 */
export interface CustomLoginTextData {
  language: string;
  screen: string;            // Screen name (e.g., 'login', 'register', 'password_reset')
  key: string;               // Text key for the screen
  text: string;              // Custom text value
}

/**
 * Custom init message text data
 */
export interface CustomInitMessageTextData {
  language: string;
  title: string;
  preHeader: string;
  subject: string;
  greeting: string;
  text: string;
  buttonText?: string;
}

/**
 * Custom message text data
 */
export interface CustomMessageTextData {
  language: string;
  messageType: string;       // e.g., 'InitCode', 'PasswordReset', 'VerifyEmail'
  title?: string;
  preHeader?: string;
  subject?: string;
  greeting?: string;
  text?: string;
  buttonText?: string;
  footerText?: string;
}

/**
 * Set custom text for organization
 * 
 * @param this - Commands instance
 * @param ctx - Command context
 * @param orgID - Organization ID
 * @param data - Custom text data
 */
export async function setCustomText(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: CustomTextData
): Promise<void> {
  // 1. Validate input
  if (!orgID) {
    throwInvalidArgument('orgID is required', 'COMMAND-CustomText01');
  }
  if (!data.language) {
    throwInvalidArgument('language is required', 'COMMAND-CustomText02');
  }
  if (!data.key) {
    throwInvalidArgument('key is required', 'COMMAND-CustomText03');
  }
  if (!data.text) {
    throwInvalidArgument('text is required', 'COMMAND-CustomText04');
  }

  // 2. Validate language code format (ISO 639-1)
  const languageRegex = /^[a-z]{2}$/;
  if (!languageRegex.test(data.language)) {
    throwInvalidArgument('invalid language code format', 'COMMAND-CustomText05');
  }

  // 3. Create command
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'org.custom.text.set',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    creator: ctx.userID || 'system',
    payload: {
      language: data.language,
      key: data.key,
      text: data.text,
    },
  };

  // 4. Push event
  await this.getEventstore().push(command);
}

/**
 * Set custom login text (instance-level)
 * 
 * @param this - Commands instance
 * @param ctx - Command context
 * @param instanceID - Instance ID
 * @param data - Custom login text data
 */
export async function setCustomLoginText(
  this: Commands,
  ctx: Context,
  instanceID: string,
  data: CustomLoginTextData
): Promise<void> {
  // 1. Validate input
  if (!instanceID) {
    throwInvalidArgument('instanceID is required', 'COMMAND-CustomText11');
  }
  if (!data.language) {
    throwInvalidArgument('language is required', 'COMMAND-CustomText12');
  }
  if (!data.screen) {
    throwInvalidArgument('screen is required', 'COMMAND-CustomText13');
  }
  if (!data.key) {
    throwInvalidArgument('key is required', 'COMMAND-CustomText14');
  }
  if (!data.text) {
    throwInvalidArgument('text is required', 'COMMAND-CustomText15');
  }

  // 2. Validate language code
  const languageRegex = /^[a-z]{2}$/;
  if (!languageRegex.test(data.language)) {
    throwInvalidArgument('invalid language code format', 'COMMAND-CustomText16');
  }

  // 3. Create command
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'instance.login.custom.text.set',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    creator: ctx.userID || 'system',
    payload: {
      language: data.language,
      screen: data.screen,
      key: data.key,
      text: data.text,
    },
  };

  // 4. Push event
  await this.getEventstore().push(command);
}

/**
 * Set custom init message text (instance-level)
 * 
 * @param this - Commands instance
 * @param ctx - Command context
 * @param instanceID - Instance ID
 * @param data - Custom init message text data
 */
export async function setCustomInitMessageText(
  this: Commands,
  ctx: Context,
  instanceID: string,
  data: CustomInitMessageTextData
): Promise<void> {
  // 1. Validate input
  if (!instanceID) {
    throwInvalidArgument('instanceID is required', 'COMMAND-CustomText21');
  }
  if (!data.language) {
    throwInvalidArgument('language is required', 'COMMAND-CustomText22');
  }
  if (!data.title) {
    throwInvalidArgument('title is required', 'COMMAND-CustomText23');
  }

  // 2. Validate language code
  const languageRegex = /^[a-z]{2}$/;
  if (!languageRegex.test(data.language)) {
    throwInvalidArgument('invalid language code format', 'COMMAND-CustomText24');
  }

  // 3. Create command
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'instance.init.message.text.set',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    creator: ctx.userID || 'system',
    payload: {
      language: data.language,
      title: data.title,
      preHeader: data.preHeader,
      subject: data.subject,
      greeting: data.greeting,
      text: data.text,
      buttonText: data.buttonText,
    },
  };

  // 4. Push event
  await this.getEventstore().push(command);
}

/**
 * Reset custom text to defaults (organization-level)
 * 
 * @param this - Commands instance
 * @param ctx - Command context
 * @param orgID - Organization ID
 * @param language - Language code
 */
export async function resetCustomText(
  this: Commands,
  ctx: Context,
  orgID: string,
  language: string
): Promise<void> {
  // 1. Validate input
  if (!orgID) {
    throwInvalidArgument('orgID is required', 'COMMAND-CustomText31');
  }
  if (!language) {
    throwInvalidArgument('language is required', 'COMMAND-CustomText32');
  }

  // 2. Validate language code
  const languageRegex = /^[a-z]{2}$/;
  if (!languageRegex.test(language)) {
    throwInvalidArgument('invalid language code format', 'COMMAND-CustomText33');
  }

  // 3. Create command
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'org.custom.text.reset',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    creator: ctx.userID || 'system',
    payload: {
      language,
    },
  };

  // 4. Push event
  await this.getEventstore().push(command);
}

/**
 * Reset custom login text to defaults (instance-level)
 * 
 * @param this - Commands instance
 * @param ctx - Command context
 * @param instanceID - Instance ID
 * @param language - Language code
 */
export async function resetCustomLoginText(
  this: Commands,
  ctx: Context,
  instanceID: string,
  language: string
): Promise<void> {
  // 1. Validate input
  if (!instanceID) {
    throwInvalidArgument('instanceID is required', 'COMMAND-CustomText41');
  }
  if (!language) {
    throwInvalidArgument('language is required', 'COMMAND-CustomText42');
  }

  // 2. Validate language code
  const languageRegex = /^[a-z]{2}$/;
  if (!languageRegex.test(language)) {
    throwInvalidArgument('invalid language code format', 'COMMAND-CustomText43');
  }

  // 3. Create command
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'instance.login.custom.text.reset',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    creator: ctx.userID || 'system',
    payload: {
      language,
    },
  };

  // 4. Push event
  await this.getEventstore().push(command);
}

/**
 * Set custom message text (instance-level)
 * 
 * @param this - Commands instance
 * @param ctx - Command context
 * @param instanceID - Instance ID
 * @param data - Custom message text data
 */
export async function setCustomMessageText(
  this: Commands,
  ctx: Context,
  instanceID: string,
  data: CustomMessageTextData
): Promise<void> {
  // 1. Validate input
  if (!instanceID) {
    throwInvalidArgument('instanceID is required', 'COMMAND-CustomText51');
  }
  if (!data.language) {
    throwInvalidArgument('language is required', 'COMMAND-CustomText52');
  }
  if (!data.messageType) {
    throwInvalidArgument('messageType is required', 'COMMAND-CustomText53');
  }

  // 2. Validate language code
  const languageRegex = /^[a-z]{2}$/;
  if (!languageRegex.test(data.language)) {
    throwInvalidArgument('invalid language code format', 'COMMAND-CustomText54');
  }

  // 3. Create command
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'instance.custom.message.text.set',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    creator: ctx.userID || 'system',
    payload: {
      language: data.language,
      messageType: data.messageType,
      title: data.title,
      preHeader: data.preHeader,
      subject: data.subject,
      greeting: data.greeting,
      text: data.text,
      buttonText: data.buttonText,
      footerText: data.footerText,
    },
  };

  // 4. Push event
  await this.getEventstore().push(command);
}

/**
 * Set custom message text (organization-level)
 * 
 * @param this - Commands instance
 * @param ctx - Command context
 * @param orgID - Organization ID
 * @param data - Custom message text data
 */
export async function setOrgCustomMessageText(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: CustomMessageTextData
): Promise<void> {
  // 1. Validate input
  if (!orgID) {
    throwInvalidArgument('orgID is required', 'COMMAND-CustomText61');
  }
  if (!data.language) {
    throwInvalidArgument('language is required', 'COMMAND-CustomText62');
  }
  if (!data.messageType) {
    throwInvalidArgument('messageType is required', 'COMMAND-CustomText63');
  }

  // 2. Validate language code
  const languageRegex = /^[a-z]{2}$/;
  if (!languageRegex.test(data.language)) {
    throwInvalidArgument('invalid language code format', 'COMMAND-CustomText64');
  }

  // 3. Create command
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'org.custom.message.text.set',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    creator: ctx.userID || 'system',
    payload: {
      language: data.language,
      messageType: data.messageType,
      title: data.title,
      preHeader: data.preHeader,
      subject: data.subject,
      greeting: data.greeting,
      text: data.text,
      buttonText: data.buttonText,
      footerText: data.footerText,
    },
  };

  // 4. Push event
  await this.getEventstore().push(command);
}

/**
 * Reset custom message text to defaults (instance-level)
 * 
 * @param this - Commands instance
 * @param ctx - Command context
 * @param instanceID - Instance ID
 * @param language - Language code
 * @param messageType - Message type
 */
export async function resetCustomMessageText(
  this: Commands,
  ctx: Context,
  instanceID: string,
  language: string,
  messageType: string
): Promise<void> {
  // 1. Validate input
  if (!instanceID) {
    throwInvalidArgument('instanceID is required', 'COMMAND-CustomText71');
  }
  if (!language) {
    throwInvalidArgument('language is required', 'COMMAND-CustomText72');
  }
  if (!messageType) {
    throwInvalidArgument('messageType is required', 'COMMAND-CustomText73');
  }

  // 2. Validate language code
  const languageRegex = /^[a-z]{2}$/;
  if (!languageRegex.test(language)) {
    throwInvalidArgument('invalid language code format', 'COMMAND-CustomText74');
  }

  // 3. Create command
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'instance.custom.message.text.reset',
    aggregateType: 'instance',
    aggregateID: instanceID,
    owner: instanceID,
    creator: ctx.userID || 'system',
    payload: {
      language,
      messageType,
    },
  };

  // 4. Push event
  await this.getEventstore().push(command);
}

/**
 * Reset custom message text to defaults (organization-level)
 * 
 * @param this - Commands instance
 * @param ctx - Command context
 * @param orgID - Organization ID
 * @param language - Language code
 * @param messageType - Message type
 */
export async function resetOrgCustomMessageText(
  this: Commands,
  ctx: Context,
  orgID: string,
  language: string,
  messageType: string
): Promise<void> {
  // 1. Validate input
  if (!orgID) {
    throwInvalidArgument('orgID is required', 'COMMAND-CustomText81');
  }
  if (!language) {
    throwInvalidArgument('language is required', 'COMMAND-CustomText82');
  }
  if (!messageType) {
    throwInvalidArgument('messageType is required', 'COMMAND-CustomText83');
  }

  // 2. Validate language code
  const languageRegex = /^[a-z]{2}$/;
  if (!languageRegex.test(language)) {
    throwInvalidArgument('invalid language code format', 'COMMAND-CustomText84');
  }

  // 3. Create command
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'org.custom.message.text.reset',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    creator: ctx.userID || 'system',
    payload: {
      language,
      messageType,
    },
  };

  // 4. Push event
  await this.getEventstore().push(command);
}
