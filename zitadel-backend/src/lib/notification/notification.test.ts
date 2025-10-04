import {
  InMemoryNotificationService,
  SimpleTemplateRenderer,
  createNotificationService,
} from './notification-service';
import {
  NotificationChannel,
  NotificationStatus,
  TemplateNotFoundError,
} from './types';

describe('SimpleTemplateRenderer', () => {
  let renderer: SimpleTemplateRenderer;

  beforeEach(() => {
    renderer = new SimpleTemplateRenderer();
  });

  it('should render template with variables', () => {
    const template = 'Hello {{name}}, welcome to {{app}}!';
    const data = { name: 'John', app: 'Zitadel' };

    const result = renderer.render(template, data);

    expect(result).toBe('Hello John, welcome to Zitadel!');
  });

  it('should leave unmatched variables as-is', () => {
    const template = 'Hello {{name}}, your code is {{code}}';
    const data = { name: 'John' };

    const result = renderer.render(template, data);

    expect(result).toBe('Hello John, your code is {{code}}');
  });

  it('should handle multiple occurrences of same variable', () => {
    const template = '{{name}} said hello. {{name}} is happy!';
    const data = { name: 'Alice' };

    const result = renderer.render(template, data);

    expect(result).toBe('Alice said hello. Alice is happy!');
  });
});

describe('InMemoryNotificationService', () => {
  let service: InMemoryNotificationService;

  beforeEach(() => {
    service = createNotificationService() as InMemoryNotificationService;
  });

  describe('sendEmail', () => {
    it('should send email notification', async () => {
      const notification = {
        to: ['user@example.com'],
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      const id = await service.sendEmail(notification);

      expect(id).toBeDefined();
      const status = await service.getStatus(id);
      expect(status).toBe(NotificationStatus.SENT);
    });

    it('should handle multiple recipients', async () => {
      const notification = {
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Test Email',
        text: 'Test content',
      };

      const id = await service.sendEmail(notification);

      expect(id).toBeDefined();
      const notifications = service.getAllNotifications();
      const sent = notifications.find(n => n.id === id);
      expect(sent?.recipient).toContain('user1@example.com');
      expect(sent?.recipient).toContain('user2@example.com');
    });

    it('should eventually mark as delivered', async () => {
      const notification = {
        to: ['user@example.com'],
        subject: 'Test Email',
        html: 'Test',
      };

      const id = await service.sendEmail(notification);

      // Wait for async delivery
      await new Promise(resolve => setTimeout(resolve, 150));

      const status = await service.getStatus(id);
      expect(status).toBe(NotificationStatus.DELIVERED);
    });
  });

  describe('sendSms', () => {
    it('should send SMS notification', async () => {
      const notification = {
        to: '+1234567890',
        message: 'Your code is 123456',
      };

      const id = await service.sendSms(notification);

      expect(id).toBeDefined();
      const status = await service.getStatus(id);
      expect(status).toBe(NotificationStatus.SENT);
    });

    it('should track SMS in notifications list', async () => {
      const notification = {
        to: '+1234567890',
        message: 'Test message',
      };

      const id = await service.sendSms(notification);

      const notifications = service.getAllNotifications();
      const sent = notifications.find(n => n.id === id);
      expect(sent?.channel).toBe(NotificationChannel.SMS);
      expect(sent?.recipient).toBe('+1234567890');
    });
  });

  describe('sendFromTemplate', () => {
    it('should send email from template', async () => {
      const id = await service.sendFromTemplate(
        'welcome_email',
        'user@example.com',
        {
          username: 'testuser',
          appName: 'Zitadel',
        }
      );

      expect(id).toBeDefined();
      const notifications = service.getAllNotifications();
      const sent = notifications.find(n => n.id === id);
      expect(sent?.subject).toContain('Zitadel');
      expect(sent?.body).toContain('testuser');
    });

    it('should render template variables', async () => {
      const id = await service.sendFromTemplate(
        'password_reset',
        'user@example.com',
        {
          resetLink: 'https://example.com/reset?token=abc123',
        }
      );

      const notifications = service.getAllNotifications();
      const sent = notifications.find(n => n.id === id);
      expect(sent?.body).toContain('https://example.com/reset?token=abc123');
    });

    it('should throw error for non-existent template', async () => {
      await expect(
        service.sendFromTemplate('non_existent', 'user@example.com', {})
      ).rejects.toThrow(TemplateNotFoundError);
    });

    it('should support SMS templates', async () => {
      service.addTemplate(
        'sms_code',
        undefined,
        'Your verification code is {{code}}',
        NotificationChannel.SMS
      );

      const id = await service.sendFromTemplate(
        'sms_code',
        '+1234567890',
        { code: '123456' }
      );

      const notifications = service.getAllNotifications();
      const sent = notifications.find(n => n.id === id);
      expect(sent?.channel).toBe(NotificationChannel.SMS);
      expect(sent?.body).toBe('Your verification code is 123456');
    });
  });

  describe('getStatus', () => {
    it('should return status of notification', async () => {
      const id = await service.sendEmail({
        to: ['user@example.com'],
        subject: 'Test',
        text: 'Test',
      });

      const status = await service.getStatus(id);

      expect(status).toBe(NotificationStatus.SENT);
    });

    it('should return FAILED for non-existent notification', async () => {
      const status = await service.getStatus('non-existent-id');

      expect(status).toBe(NotificationStatus.FAILED);
    });
  });

  describe('health', () => {
    it('should return true for healthy service', async () => {
      const healthy = await service.health();

      expect(healthy).toBe(true);
    });
  });

  describe('addTemplate', () => {
    it('should add custom template', async () => {
      service.addTemplate(
        'custom_template',
        'Custom Subject',
        'Custom body with {{variable}}',
        NotificationChannel.EMAIL
      );

      const id = await service.sendFromTemplate(
        'custom_template',
        'user@example.com',
        { variable: 'value' }
      );

      const notifications = service.getAllNotifications();
      const sent = notifications.find(n => n.id === id);
      expect(sent?.subject).toBe('Custom Subject');
      expect(sent?.body).toBe('Custom body with value');
    });
  });

  describe('getAllNotifications', () => {
    it('should return all sent notifications', async () => {
      await service.sendEmail({
        to: ['user1@example.com'],
        subject: 'Test 1',
        text: 'Test 1',
      });
      await service.sendEmail({
        to: ['user2@example.com'],
        subject: 'Test 2',
        text: 'Test 2',
      });

      const notifications = service.getAllNotifications();

      expect(notifications.length).toBe(2);
    });

    it('should include notification metadata', async () => {
      const id = await service.sendEmail({
        to: ['user@example.com'],
        subject: 'Test',
        text: 'Test',
      });

      const notifications = service.getAllNotifications();
      const notification = notifications.find(n => n.id === id);

      expect(notification).toBeDefined();
      expect(notification?.id).toBe(id);
      expect(notification?.channel).toBe(NotificationChannel.EMAIL);
      expect(notification?.createdAt).toBeInstanceOf(Date);
      expect(notification?.sentAt).toBeInstanceOf(Date);
    });
  });
});
