/**
 * SMTP Configuration Types
 * Email delivery configuration
 * Based on Zitadel Go internal/query/smtp.go (simplified)
 */

/**
 * SMTP Config State
 */
export enum SMTPConfigState {
  UNSPECIFIED = 0,
  INACTIVE = 1,
  ACTIVE = 2,
}

/**
 * SMTP Configuration
 * Core email delivery settings
 */
export interface SMTPConfig {
  id: string;
  instanceID: string;
  resourceOwner: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  
  // Config details
  description: string;
  state: SMTPConfigState;
  
  // SMTP settings
  tls: boolean;
  senderAddress: string;
  senderName: string;
  replyToAddress: string;
  host: string;
  user: string;
  // Note: password is encrypted and not exposed in queries
}
