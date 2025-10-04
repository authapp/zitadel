/**
 * Notification service implementation
 */

import { generateId } from '../id/snowflake';
import {
  NotificationService,
  EmailNotification,
  SmsNotification,
  NotificationStatus,
  NotificationMessage,
  NotificationChannel,
  NotificationPriority,
  TemplateRenderer,
  TemplateNotFoundError,
} from './types';

/**
 * Simple template renderer using string replacement
 */
export class SimpleTemplateRenderer implements TemplateRenderer {
  render(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }
}

/**
 * In-memory notification service for testing
 */
export class InMemoryNotificationService implements NotificationService {
  private notifications = new Map<string, NotificationMessage>();
  private templates = new Map<string, { subject?: string; body: string; channel: NotificationChannel }>();
  
  constructor(private renderer: TemplateRenderer = new SimpleTemplateRenderer()) {
    // Add default templates
    this.templates.set('welcome_email', {
      subject: 'Welcome to {{appName}}',
      body: 'Hello {{username}}, welcome to our platform!',
      channel: NotificationChannel.EMAIL,
    });
    
    this.templates.set('password_reset', {
      subject: 'Reset your password',
      body: 'Click here to reset your password: {{resetLink}}',
      channel: NotificationChannel.EMAIL,
    });
  }

  /**
   * Send email notification
   */
  async sendEmail(notification: EmailNotification): Promise<string> {
    const id = generateId();
    const message: NotificationMessage = {
      id,
      channel: NotificationChannel.EMAIL,
      recipient: notification.to.join(','),
      subject: notification.subject,
      body: notification.html || notification.text || '',
      priority: NotificationPriority.NORMAL,
      status: NotificationStatus.SENT,
      createdAt: new Date(),
      sentAt: new Date(),
    };

    this.notifications.set(id, message);
    
    // Simulate async sending
    setTimeout(() => {
      message.status = NotificationStatus.DELIVERED;
      message.deliveredAt = new Date();
    }, 100);

    return id;
  }

  /**
   * Send SMS notification
   */
  async sendSms(notification: SmsNotification): Promise<string> {
    const id = generateId();
    const message: NotificationMessage = {
      id,
      channel: NotificationChannel.SMS,
      recipient: notification.to,
      body: notification.message,
      priority: NotificationPriority.NORMAL,
      status: NotificationStatus.SENT,
      createdAt: new Date(),
      sentAt: new Date(),
    };

    this.notifications.set(id, message);
    
    // Simulate async sending
    setTimeout(() => {
      message.status = NotificationStatus.DELIVERED;
      message.deliveredAt = new Date();
    }, 100);

    return id;
  }

  /**
   * Send notification using template
   */
  async sendFromTemplate(
    templateId: string,
    recipient: string,
    data: Record<string, any>
  ): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new TemplateNotFoundError(templateId);
    }

    const subject = template.subject ? this.renderer.render(template.subject, data) : undefined;
    const body = this.renderer.render(template.body, data);

    if (template.channel === NotificationChannel.EMAIL) {
      return this.sendEmail({
        to: [recipient],
        subject: subject || 'Notification',
        html: body,
      });
    } else if (template.channel === NotificationChannel.SMS) {
      return this.sendSms({
        to: recipient,
        message: body,
      });
    }

    throw new Error(`Unsupported channel: ${template.channel}`);
  }

  /**
   * Get notification status
   */
  async getStatus(notificationId: string): Promise<NotificationStatus> {
    const notification = this.notifications.get(notificationId);
    return notification?.status || NotificationStatus.FAILED;
  }

  /**
   * Health check
   */
  async health(): Promise<boolean> {
    return true;
  }

  /**
   * Add template (for testing)
   */
  addTemplate(id: string, subject: string | undefined, body: string, channel: NotificationChannel): void {
    this.templates.set(id, { subject, body, channel });
  }

  /**
   * Get all notifications (for testing)
   */
  getAllNotifications(): NotificationMessage[] {
    return Array.from(this.notifications.values());
  }
}

/**
 * Create notification service
 */
export function createNotificationService(): NotificationService {
  return new InMemoryNotificationService();
}
