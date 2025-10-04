/**
 * Notification types and interfaces
 */

/**
 * Notification channel types
 */
export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  WEBHOOK = 'webhook',
}

/**
 * Notification priority
 */
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Notification status
 */
export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  DELIVERED = 'delivered',
}

/**
 * Notification message
 */
export interface NotificationMessage {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
  template?: string;
  data?: Record<string, any>;
  priority: NotificationPriority;
  status: NotificationStatus;
  createdAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  error?: string;
}

/**
 * Email notification
 */
export interface EmailNotification {
  to: string[];
  cc?: string[];
  bcc?: string[];
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

/**
 * SMS notification
 */
export interface SmsNotification {
  to: string;
  message: string;
  from?: string;
}

/**
 * Notification template
 */
export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject?: string;
  body: string;
  variables: string[];
}

/**
 * Notification service interface
 */
export interface NotificationService {
  /**
   * Send email notification
   */
  sendEmail(notification: EmailNotification): Promise<string>;

  /**
   * Send SMS notification
   */
  sendSms(notification: SmsNotification): Promise<string>;

  /**
   * Send notification using template
   */
  sendFromTemplate(
    templateId: string,
    recipient: string,
    data: Record<string, any>
  ): Promise<string>;

  /**
   * Get notification status
   */
  getStatus(notificationId: string): Promise<NotificationStatus>;

  /**
   * Health check
   */
  health(): Promise<boolean>;
}

/**
 * Template renderer interface
 */
export interface TemplateRenderer {
  /**
   * Render template with data
   */
  render(template: string, data: Record<string, any>): string;
}

/**
 * Notification errors
 */
export class NotificationError extends Error {
  constructor(message: string, public code: string = 'NOTIFICATION_ERROR') {
    super(message);
    this.name = 'NotificationError';
  }
}

export class TemplateNotFoundError extends NotificationError {
  constructor(templateId: string) {
    super(`Template not found: ${templateId}`, 'TEMPLATE_NOT_FOUND');
    this.name = 'TemplateNotFoundError';
  }
}
