/**
 * Notification Policy Types
 * Defines notification settings for various events
 * Based on Zitadel Go internal/query/notification_policy.go
 */

/**
 * Notification Policy
 * Controls when and how notifications are sent
 */
export interface NotificationPolicy {
  id: string;
  instanceID: string;
  organizationID?: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  resourceOwner: string;
  
  // Notification settings
  passwordChange: boolean;
  
  isDefault: boolean;
}
