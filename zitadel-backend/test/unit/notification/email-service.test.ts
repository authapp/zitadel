/**
 * Email Service Tests
 * Tests for CC/BCC and multi-recipient functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockEmailProvider, EmailService } from '../../../src/lib/notification/email-service';

describe('Email Service', () => {
  let mockProvider: MockEmailProvider;
  let emailService: EmailService;

  beforeEach(() => {
    mockProvider = new MockEmailProvider();
    emailService = new EmailService(mockProvider);
  });

  describe('MockEmailProvider', () => {
    it('should send email to single recipient', async () => {
      const result = await mockProvider.sendEmail(
        'user@example.com',
        'Test Subject',
        'Test Body',
        '<p>Test Body</p>'
      );

      expect(result.messageId).toBeDefined();
      expect(mockProvider.sentEmails.length).toBe(1);
      
      const sent = mockProvider.getLastEmail();
      expect(sent.to).toBe('user@example.com');
      expect(sent.subject).toBe('Test Subject');
      expect(sent.body).toBe('Test Body');
      expect(sent.html).toBe('<p>Test Body</p>');
    });

    it('should send email to multiple recipients', async () => {
      const recipients = ['user1@example.com', 'user2@example.com', 'user3@example.com'];
      
      const result = await mockProvider.sendEmail(
        recipients,
        'Multi-recipient Test',
        'Test Body'
      );

      expect(result.messageId).toBeDefined();
      
      const sent = mockProvider.getLastEmail();
      expect(Array.isArray(sent.to)).toBe(true);
      expect(sent.to).toEqual(recipients);
    });

    it('should send email with CC recipients', async () => {
      const result = await mockProvider.sendEmail(
        'primary@example.com',
        'Test with CC',
        'Test Body',
        undefined,
        ['cc1@example.com', 'cc2@example.com']
      );

      expect(result.messageId).toBeDefined();
      
      const sent = mockProvider.getLastEmail();
      expect(sent.to).toBe('primary@example.com');
      expect(sent.cc).toEqual(['cc1@example.com', 'cc2@example.com']);
    });

    it('should send email with BCC recipients', async () => {
      const result = await mockProvider.sendEmail(
        'primary@example.com',
        'Test with BCC',
        'Test Body',
        undefined,
        undefined,
        ['bcc1@example.com', 'bcc2@example.com']
      );

      expect(result.messageId).toBeDefined();
      
      const sent = mockProvider.getLastEmail();
      expect(sent.to).toBe('primary@example.com');
      expect(sent.bcc).toEqual(['bcc1@example.com', 'bcc2@example.com']);
    });

    it('should send email with multiple recipients, CC, and BCC', async () => {
      const result = await mockProvider.sendEmail(
        ['to1@example.com', 'to2@example.com'],
        'Complete Test',
        'Test Body',
        '<p>HTML Body</p>',
        ['cc1@example.com', 'cc2@example.com'],
        ['bcc1@example.com', 'bcc2@example.com']
      );

      expect(result.messageId).toBeDefined();
      
      const sent = mockProvider.getLastEmail();
      expect(sent.to).toEqual(['to1@example.com', 'to2@example.com']);
      expect(sent.cc).toEqual(['cc1@example.com', 'cc2@example.com']);
      expect(sent.bcc).toEqual(['bcc1@example.com', 'bcc2@example.com']);
      expect(sent.subject).toBe('Complete Test');
      expect(sent.body).toBe('Test Body');
      expect(sent.html).toBe('<p>HTML Body</p>');
    });

    it('should handle empty CC/BCC arrays', async () => {
      const result = await mockProvider.sendEmail(
        'user@example.com',
        'Test',
        'Body',
        undefined,
        [],
        []
      );

      expect(result.messageId).toBeDefined();
      
      const sent = mockProvider.getLastEmail();
      expect(sent.cc).toEqual([]);
      expect(sent.bcc).toEqual([]);
    });

    it('should track multiple sent emails', async () => {
      await mockProvider.sendEmail('user1@example.com', 'Email 1', 'Body 1');
      await mockProvider.sendEmail('user2@example.com', 'Email 2', 'Body 2');
      await mockProvider.sendEmail('user3@example.com', 'Email 3', 'Body 3');

      expect(mockProvider.sentEmails.length).toBe(3);
      expect(mockProvider.sentEmails[0].subject).toBe('Email 1');
      expect(mockProvider.sentEmails[1].subject).toBe('Email 2');
      expect(mockProvider.sentEmails[2].subject).toBe('Email 3');
    });

    it('should clear sent emails', async () => {
      await mockProvider.sendEmail('user@example.com', 'Test', 'Body');
      expect(mockProvider.sentEmails.length).toBe(1);

      mockProvider.clearEmails();
      expect(mockProvider.sentEmails.length).toBe(0);
    });

    it('should log CC and BCC in console output', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await mockProvider.sendEmail(
        'to@example.com',
        'Test',
        'Body',
        undefined,
        ['cc@example.com'],
        ['bcc@example.com']
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MOCK EMAIL] To: to@example.com')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CC: cc@example.com')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('BCC: bcc@example.com')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('EmailService Integration', () => {
    it('should use mock provider when no SMTP configured', () => {
      const service = new EmailService();
      expect(service.getProvider().name).toBe('mock');
    });

    it('should send verification code with custom provider', async () => {
      await emailService.sendVerificationCode('user@example.com', '123456');

      expect(mockProvider.sentEmails.length).toBe(1);
      const sent = mockProvider.getLastEmail();
      expect(sent.to).toBe('user@example.com');
      expect(sent.subject).toContain('Verify');
      expect(sent.body).toContain('123456');
      expect(sent.html).toContain('123456');
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with single recipient (legacy behavior)', async () => {
      const result = await mockProvider.sendEmail(
        'single@example.com',
        'Legacy Test',
        'Body'
      );

      expect(result.messageId).toBeDefined();
      expect(mockProvider.getLastEmail().to).toBe('single@example.com');
    });

    it('should work without CC/BCC (legacy behavior)', async () => {
      const result = await mockProvider.sendEmail(
        'user@example.com',
        'No CC/BCC',
        'Body'
      );

      expect(result.messageId).toBeDefined();
      const sent = mockProvider.getLastEmail();
      expect(sent.cc).toBeUndefined();
      expect(sent.bcc).toBeUndefined();
    });
  });
});
