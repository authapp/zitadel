/**
 * Text & Translation Types
 * Custom text and message text for UI customization
 * Based on Zitadel Go internal/query/custom_text.go and message_text.go
 */

/**
 * Custom Text for UI customization
 */
export interface CustomText {
  aggregateID: string;
  instanceID: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  language: string;
  template: string; // e.g., "Login", "InitMessage"
  key: string; // Text key within template
  text: string; // Actual custom text
  isDefault: boolean;
}

/**
 * Message Text for notification messages
 */
export interface MessageText {
  aggregateID: string;
  instanceID: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  messageType: string; // e.g., "InitCode", "PasswordReset"
  language: string;
  title: string;
  preHeader: string;
  subject: string;
  greeting: string;
  text: string;
  buttonText: string;
  footerText: string;
  isDefault: boolean;
}

/**
 * Message text types
 */
export const MESSAGE_TEXT_TYPES = [
  'InitCode',
  'PasswordReset',
  'VerifyEmail',
  'VerifyPhone',
  'DomainClaimed',
  'PasswordChange',
] as const;

export type MessageTextType = typeof MESSAGE_TEXT_TYPES[number];
