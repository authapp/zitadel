/**
 * Message Interface Tests
 */

import { describe, it, expect } from '@jest/globals';
import {
  Message,
  EmailMessage,
  SMSMessage,
  VerificationMessage,
  MessageBuilder,
  MessageMetadata,
} from '../../../src/lib/notification/message';

describe('Message Interface', () => {
  describe('EmailMessage', () => {
    it('should create email message with basic fields', () => {
      const message = new EmailMessage(
        'test@example.com',
        'Test Subject',
        'Test content'
      );

      expect(message.getRecipient()).toBe('test@example.com');
      expect(message.getSubject()).toBe('Test Subject');
      expect(message.getContent()).toBe('Test content');
    });

    it('should support HTML content', () => {
      const message = new EmailMessage(
        'test@example.com',
        'Test',
        'Plain text',
        '<p>HTML content</p>'
      );

      expect(message.getContent()).toBe('Plain text');
      expect(message.getHtmlContent()).toBe('<p>HTML content</p>');
    });

    it('should support CC and BCC', () => {
      const message = new EmailMessage(
        'test@example.com',
        'Test',
        'Content',
        undefined,
        undefined,
        ['cc@example.com'],
        ['bcc@example.com']
      );

      expect(message.getCc()).toEqual(['cc@example.com']);
      expect(message.getBcc()).toEqual(['bcc@example.com']);
    });

    it('should support metadata', () => {
      const metadata: MessageMetadata = {
        instanceID: 'inst_123',
        userID: 'user_456',
        jobID: 'job_789',
      };

      const message = new EmailMessage(
        'test@example.com',
        'Test',
        'Content',
        undefined,
        metadata
      );

      expect(message.getMetadata()).toEqual(metadata);
    });

    it('should get all recipients', () => {
      const message = new EmailMessage(
        'test@example.com',
        'Test',
        'Content',
        undefined,
        undefined,
        ['cc1@example.com', 'cc2@example.com'],
        ['bcc@example.com']
      );

      const allRecipients = message.getAllRecipients();
      expect(allRecipients).toEqual([
        'test@example.com',
        'cc1@example.com',
        'cc2@example.com',
        'bcc@example.com',
      ]);
    });
  });

  describe('SMSMessage', () => {
    it('should create SMS message', () => {
      const message = new SMSMessage(
        '+1234567890',
        'Test SMS content'
      );

      expect(message.getRecipient()).toBe('+1234567890');
      expect(message.getContent()).toBe('Test SMS content');
    });

    it('should support metadata', () => {
      const metadata: MessageMetadata = {
        instanceID: 'inst_123',
        userID: 'user_456',
      };

      const message = new SMSMessage(
        '+1234567890',
        'Test',
        metadata
      );

      expect(message.getMetadata()).toEqual(metadata);
    });
  });

  describe('VerificationMessage', () => {
    it('should create verification message for SMS', () => {
      const message = new VerificationMessage(
        '+1234567890',
        'sms'
      );

      expect(message.getRecipient()).toBe('+1234567890');
      expect(message.getChannel()).toBe('sms');
      expect(message.getContent()).toContain('Verification request');
    });

    it('should create verification message for email', () => {
      const message = new VerificationMessage(
        'test@example.com',
        'email'
      );

      expect(message.getRecipient()).toBe('test@example.com');
      expect(message.getChannel()).toBe('email');
    });

    it('should create verification message for call', () => {
      const message = new VerificationMessage(
        '+1234567890',
        'call'
      );

      expect(message.getChannel()).toBe('call');
    });

    it('should support metadata', () => {
      const metadata: MessageMetadata = {
        instanceID: 'inst_123',
        userID: 'user_456',
      };

      const message = new VerificationMessage(
        '+1234567890',
        'sms',
        metadata
      );

      expect(message.getMetadata()).toEqual(metadata);
    });
  });

  describe('MessageBuilder', () => {
    it('should create email message', () => {
      const message = MessageBuilder.createEmail(
        'test@example.com',
        'Subject',
        'Content'
      );

      expect(message).toBeInstanceOf(EmailMessage);
      expect(message.getRecipient()).toBe('test@example.com');
      expect(message.getSubject()).toBe('Subject');
    });

    it('should create email with options', () => {
      const message = MessageBuilder.createEmail(
        'test@example.com',
        'Subject',
        'Content',
        {
          html: '<p>HTML</p>',
          cc: ['cc@example.com'],
          bcc: ['bcc@example.com'],
          metadata: { userID: 'user_123' },
        }
      );

      expect(message.getHtmlContent()).toBe('<p>HTML</p>');
      expect(message.getCc()).toEqual(['cc@example.com']);
      expect(message.getBcc()).toEqual(['bcc@example.com']);
      expect(message.getMetadata()?.userID).toBe('user_123');
    });

    it('should create SMS message', () => {
      const message = MessageBuilder.createSMS(
        '+1234567890',
        'SMS content'
      );

      expect(message).toBeInstanceOf(SMSMessage);
      expect(message.getRecipient()).toBe('+1234567890');
      expect(message.getContent()).toBe('SMS content');
    });

    it('should create SMS with metadata', () => {
      const message = MessageBuilder.createSMS(
        '+1234567890',
        'Content',
        { instanceID: 'inst_123' }
      );

      expect(message.getMetadata()?.instanceID).toBe('inst_123');
    });

    it('should create verification message', () => {
      const message = MessageBuilder.createVerification(
        'test@example.com',
        'email'
      );

      expect(message).toBeInstanceOf(VerificationMessage);
      expect(message.getRecipient()).toBe('test@example.com');
      expect(message.getChannel()).toBe('email');
    });

    it('should create verification with metadata', () => {
      const message = MessageBuilder.createVerification(
        '+1234567890',
        'sms',
        { userID: 'user_123' }
      );

      expect(message.getMetadata()?.userID).toBe('user_123');
    });
  });

  describe('Message Interface Contract', () => {
    it('should implement Message interface for EmailMessage', () => {
      const message: Message = new EmailMessage(
        'test@example.com',
        'Subject',
        'Content'
      );

      expect(message.getContent).toBeDefined();
      expect(message.getRecipient).toBeDefined();
      expect(typeof message.getContent()).toBe('string');
      expect(typeof message.getRecipient()).toBe('string');
    });

    it('should implement Message interface for SMSMessage', () => {
      const message: Message = new SMSMessage(
        '+1234567890',
        'Content'
      );

      expect(message.getContent).toBeDefined();
      expect(message.getRecipient).toBeDefined();
    });

    it('should implement Message interface for VerificationMessage', () => {
      const message: Message = new VerificationMessage(
        '+1234567890',
        'sms'
      );

      expect(message.getContent).toBeDefined();
      expect(message.getRecipient).toBeDefined();
    });
  });
});
