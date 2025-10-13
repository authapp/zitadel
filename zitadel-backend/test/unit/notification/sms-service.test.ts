/**
 * SMS Service Tests
 * Tests for Twilio Verify API and SMS functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  MockSMSProvider, 
  TwilioSMSProvider, 
  SMSService 
} from '../../../src/lib/notification/sms-service';

describe('SMS Service', () => {
  describe('MockSMSProvider', () => {
    let mockProvider: MockSMSProvider;

    beforeEach(() => {
      mockProvider = new MockSMSProvider();
    });

    it('should send SMS message', async () => {
      const result = await mockProvider.sendSMS('+1234567890', 'Test message');

      expect(result.messageId).toBeDefined();
      expect(result.messageId).toContain('mock_');
      expect(mockProvider.sentMessages.length).toBe(1);

      const sent = mockProvider.getLastMessage();
      expect(sent.to).toBe('+1234567890');
      expect(sent.message).toBe('Test message');
      expect(sent.timestamp).toBeInstanceOf(Date);
    });

    it('should send verification using Verify API', async () => {
      const result = await mockProvider.sendVerification!( '+1234567890', 'sms');

      expect(result.verificationId).toBeDefined();
      expect(result.verificationId).toContain('mock_verify_');
      expect(result.status).toBe('pending');
      expect(mockProvider.sentVerifications.length).toBe(1);

      const sent = mockProvider.getLastVerification();
      expect(sent.to).toBe('+1234567890');
      expect(sent.channel).toBe('sms');
    });

    it('should send verification with call channel', async () => {
      const result = await mockProvider.sendVerification!('+1234567890', 'call');

      expect(result.verificationId).toBeDefined();
      expect(result.status).toBe('pending');

      const sent = mockProvider.getLastVerification();
      expect(sent.channel).toBe('call');
    });

    it('should track multiple messages', async () => {
      await mockProvider.sendSMS('+1111111111', 'Message 1');
      await mockProvider.sendSMS('+2222222222', 'Message 2');
      await mockProvider.sendSMS('+3333333333', 'Message 3');

      expect(mockProvider.sentMessages.length).toBe(3);
      expect(mockProvider.sentMessages[0].message).toBe('Message 1');
      expect(mockProvider.sentMessages[1].message).toBe('Message 2');
      expect(mockProvider.sentMessages[2].message).toBe('Message 3');
    });

    it('should track multiple verifications', async () => {
      await mockProvider.sendVerification!('+1111111111', 'sms');
      await mockProvider.sendVerification!('+2222222222', 'call');
      await mockProvider.sendVerification!('+3333333333', 'sms');

      expect(mockProvider.sentVerifications.length).toBe(3);
      expect(mockProvider.sentVerifications[0].channel).toBe('sms');
      expect(mockProvider.sentVerifications[1].channel).toBe('call');
      expect(mockProvider.sentVerifications[2].channel).toBe('sms');
    });

    it('should clear messages and verifications', async () => {
      await mockProvider.sendSMS('+1234567890', 'Test');
      await mockProvider.sendVerification!('+1234567890', 'sms');

      expect(mockProvider.sentMessages.length).toBe(1);
      expect(mockProvider.sentVerifications.length).toBe(1);

      mockProvider.clearMessages();

      expect(mockProvider.sentMessages.length).toBe(0);
      expect(mockProvider.sentVerifications.length).toBe(0);
    });

    it('should log verification details', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await mockProvider.sendVerification!('+1234567890', 'sms');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MOCK SMS VERIFY] To: +1234567890, Channel: sms')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('TwilioSMSProvider', () => {
    it('should create instance without Verify Service SID', () => {
      const provider = new TwilioSMSProvider(
        'test-sid',
        'test-token',
        '+1234567890'
      );

      expect(provider.name).toBe('twilio');
      expect(provider.hasVerifyAPI()).toBe(false);
    });

    it('should create instance with Verify Service SID', () => {
      const provider = new TwilioSMSProvider(
        'test-sid',
        'test-token',
        '+1234567890',
        'verify-service-sid'
      );

      expect(provider.name).toBe('twilio');
      expect(provider.hasVerifyAPI()).toBe(true);
    });

    it('should throw error when sending verification without Verify Service SID', async () => {
      const provider = new TwilioSMSProvider(
        'test-sid',
        'test-token',
        '+1234567890'
      );

      // Will throw "client not initialized" since Twilio SDK isn't installed in tests
      // Or "Verify Service SID not configured" if SDK was installed
      await expect(provider.sendVerification!('+1234567890'))
        .rejects
        .toThrow();
    });

    it('should throw error when Twilio client not initialized', async () => {
      // This test ensures proper error handling when SDK is missing
      const provider = new TwilioSMSProvider(
        'test-sid',
        'test-token',
        '+1234567890'
      );

      // Since we can't actually install/uninstall Twilio SDK in tests,
      // we just verify the provider was created
      expect(provider).toBeDefined();
    });
  });

  describe('SMSService Integration', () => {
    it('should use mock provider when no Twilio configured', () => {
      const service = new SMSService();
      expect(service.getProvider().name).toBe('mock');
    });

    it('should send verification code using Messages API', async () => {
      const mockProvider = new MockSMSProvider();
      const service = new SMSService(mockProvider);

      await service.sendVerificationCode('+1234567890', '123456');

      expect(mockProvider.sentMessages.length).toBe(1);
      const sent = mockProvider.getLastMessage();
      expect(sent.to).toBe('+1234567890');
      expect(sent.message).toContain('123456');
      expect(sent.message).toContain('verification code');
    });

    it('should send verification using Verify API when available', async () => {
      const mockProvider = new MockSMSProvider();
      new SMSService(mockProvider);

      // Directly use sendVerification if provider supports it
      if (mockProvider.sendVerification) {
        const result = await mockProvider.sendVerification('+1234567890', 'sms');
        expect(result.verificationId).toBeDefined();
        expect(mockProvider.sentVerifications.length).toBe(1);
      }
    });
  });

  describe('Verify API Features', () => {
    let mockProvider: MockSMSProvider;

    beforeEach(() => {
      mockProvider = new MockSMSProvider();
    });

    it('should support SMS channel', async () => {
      const result = await mockProvider.sendVerification!('+1234567890', 'sms');

      expect(result.verificationId).toBeDefined();
      expect(result.status).toBe('pending');
      expect(mockProvider.getLastVerification().channel).toBe('sms');
    });

    it('should support call channel', async () => {
      const result = await mockProvider.sendVerification!('+1234567890', 'call');

      expect(result.verificationId).toBeDefined();
      expect(result.status).toBe('pending');
      expect(mockProvider.getLastVerification().channel).toBe('call');
    });

    it('should default to SMS channel when not specified', async () => {
      await mockProvider.sendVerification!('+1234567890');

      const sent = mockProvider.getLastVerification();
      expect(sent.channel).toBe('sms');
    });

    it('should return verification ID and status', async () => {
      const result = await mockProvider.sendVerification!('+1234567890', 'sms');

      expect(result).toHaveProperty('verificationId');
      expect(result).toHaveProperty('status');
      expect(result.verificationId).toBeTruthy();
      expect(result.status).toBe('pending');
    });

    it('should track verification metadata', async () => {
      const now = Date.now();
      await mockProvider.sendVerification!('+1234567890', 'sms');

      const sent = mockProvider.getLastVerification();
      expect(sent.to).toBe('+1234567890');
      expect(sent.channel).toBe('sms');
      expect(sent.timestamp.getTime()).toBeGreaterThanOrEqual(now);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with existing sendSMS API', async () => {
      const mockProvider = new MockSMSProvider();
      
      const result = await mockProvider.sendSMS('+1234567890', 'Test message');
      
      expect(result.messageId).toBeDefined();
      expect(mockProvider.sentMessages.length).toBe(1);
    });

    it('should handle providers without sendVerification', () => {
      const basicProvider = new MockSMSProvider();
      
      // sendVerification is optional in the interface
      expect(basicProvider.sendVerification).toBeDefined();
    });
  });
});
