/**
 * Notification module for Zitadel
 * 
 * Provides:
 * - Email notifications
 * - SMS notifications
 * - Template-based messaging
 * - Delivery tracking
 */

export * from './types';
export * from './notification-service';

// Re-export commonly used types
export type {
  NotificationMessage,
  EmailNotification,
  SmsNotification,
  NotificationTemplate,
  NotificationService,
  TemplateRenderer,
} from './types';

export {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationError,
  TemplateNotFoundError,
} from './types';

export {
  SimpleTemplateRenderer,
  InMemoryNotificationService,
  createNotificationService,
} from './notification-service';
