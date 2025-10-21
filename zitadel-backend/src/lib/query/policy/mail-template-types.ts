/**
 * Mail Template Types
 * Email template for system notifications
 * Based on Zitadel Go internal/query/mail_template.go
 */

/**
 * Mail Template
 * HTML template for email notifications
 */
export interface MailTemplate {
  aggregateID: string;
  instanceID: string;
  organizationID?: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  
  // Template content
  template: string; // HTML template content
  
  isDefault: boolean;
}
