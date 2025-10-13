/**
 * Twilio Verify API - Email Channel Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockSMSProvider } from '../../../src/lib/notification/sms-service';

describe('Twilio Verify API - Email Channel', () => {
  let mockProvider: MockSMSProvider;

  beforeEach(() => {
    mockProvider = new MockSMSProvider();
  });

  describe('Email Channel Support', () => {
    it('should send verification via email channel', async () => {
      const result = await mockProvider.sendVerification!(
        'test@example.com',
        'email'
      );

      expect(result.verificationId).toBeDefined();
      expect(result.status).toBe('pending');
    });

    it('should store email channel in verification record', async () => {
      await mockProvider.sendVerification!('test@example.com', 'email');

      const sent = mockProvider.getLastVerification();
      expect(sent.channel).toBe('email');
      expect(sent.to).toBe('test@example.com');
    });

    it('should accept email addresses for email channel', async () => {
      const emails = [
        'user@example.com',
        'test.user@domain.co.uk',
        'name+tag@company.org',
      ];

      for (const email of emails) {
        const result = await mockProvider.sendVerification!(email, 'email');
        expect(result.verificationId).toBeDefined();
      }

      expect(mockProvider.sentVerifications.length).toBe(3);
    });

    it('should support metadata with email channel', async () => {
      await mockProvider.sendVerification!(
        'test@example.com',
        'email',
        {
          instanceID: 'inst_123',
          jobID: 'job_456',
          userID: 'user_789',
        }
      );

      const sent = mockProvider.getLastVerification();
      expect(sent.metadata?.instanceID).toBe('inst_123');
      expect(sent.metadata?.jobID).toBe('job_456');
      expect(sent.metadata?.userID).toBe('user_789');
    });

    it('should auto-populate verificationID for email channel', async () => {
      const result = await mockProvider.sendVerification!(
        'test@example.com',
        'email',
        { userID: 'user_123' }
      );

      const sent = mockProvider.getLastVerification();
      expect(sent.metadata?.verificationID).toBe(result.verificationId);
    });
  });

  describe('Channel Comparison', () => {
    it('should support all three channels: sms, call, email', async () => {
      await mockProvider.sendVerification!('+1234567890', 'sms');
      await mockProvider.sendVerification!('+1234567890', 'call');
      await mockProvider.sendVerification!('test@example.com', 'email');

      expect(mockProvider.sentVerifications.length).toBe(3);
      expect(mockProvider.sentVerifications[0].channel).toBe('sms');
      expect(mockProvider.sentVerifications[1].channel).toBe('call');
      expect(mockProvider.sentVerifications[2].channel).toBe('email');
    });

    it('should generate unique verification IDs for each channel', async () => {
      const result1 = await mockProvider.sendVerification!('+1234567890', 'sms');
      const result2 = await mockProvider.sendVerification!('+1234567890', 'call');
      const result3 = await mockProvider.sendVerification!('test@example.com', 'email');

      expect(result1.verificationId).not.toBe(result2.verificationId);
      expect(result2.verificationId).not.toBe(result3.verificationId);
      expect(result1.verificationId).not.toBe(result3.verificationId);
    });

    it('should default to sms channel when not specified', async () => {
      await mockProvider.sendVerification!('+1234567890');

      const sent = mockProvider.getLastVerification();
      expect(sent.channel).toBe('sms');
    });
  });

  describe('Email Channel Use Cases', () => {
    it('should handle email verification with metadata', async () => {
      const result = await mockProvider.sendVerification!(
        'user@example.com',
        'email',
        {
          instanceID: 'tenant_a',
          userID: 'user_123',
          jobID: 'email_verify_job',
        }
      );

      expect(result.verificationId).toBeDefined();
      
      const sent = mockProvider.getLastVerification();
      expect(sent.to).toBe('user@example.com');
      expect(sent.channel).toBe('email');
      expect(sent.metadata?.instanceID).toBe('tenant_a');
    });

    it('should track multiple email verifications', async () => {
      await mockProvider.sendVerification!('user1@example.com', 'email');
      await mockProvider.sendVerification!('user2@example.com', 'email');
      await mockProvider.sendVerification!('user3@example.com', 'email');

      const emailVerifications = mockProvider.sentVerifications.filter(
        v => v.channel === 'email'
      );

      expect(emailVerifications.length).toBe(3);
      expect(emailVerifications[0].to).toBe('user1@example.com');
      expect(emailVerifications[1].to).toBe('user2@example.com');
      expect(emailVerifications[2].to).toBe('user3@example.com');
    });

    it('should support mixed channel verifications for same user', async () => {
      const userPhone = '+1234567890';
      const userEmail = 'user@example.com';
      const userId = 'user_123';

      await mockProvider.sendVerification!(userPhone, 'sms', { userID: userId });
      await mockProvider.sendVerification!(userEmail, 'email', { userID: userId });

      const userVerifications = mockProvider.sentVerifications.filter(
        v => v.metadata?.userID === userId
      );

      expect(userVerifications.length).toBe(2);
      expect(userVerifications[0].channel).toBe('sms');
      expect(userVerifications[1].channel).toBe('email');
    });
  });

  describe('Console Logging', () => {
    it('should log email channel in console output', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await mockProvider.sendVerification!(
        'test@example.com',
        'email',
        {
          instanceID: 'inst_123',
          userID: 'user_456',
        }
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MOCK SMS VERIFY]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('test@example.com')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('email')
      );

      consoleSpy.mockRestore();
    });
  });
});
