/**
 * SMS Metadata Tracking Tests
 * Tests for InstanceID, JobID, UserID, VerificationID tracking
 * Based on Zitadel Go: internal/notification/messages/sms.go
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  MockSMSProvider,
  SMSMetadata,
  TwilioSMSProvider 
} from '../../../src/lib/notification/sms-service';

describe('SMS Metadata Tracking', () => {
  describe('MockSMSProvider Metadata', () => {
    let mockProvider: MockSMSProvider;

    beforeEach(() => {
      mockProvider = new MockSMSProvider();
    });

    it('should send SMS without metadata', async () => {
      const result = await mockProvider.sendSMS('+1234567890', 'Test message');

      expect(result.messageId).toBeDefined();
      
      const sent = mockProvider.getLastMessage();
      expect(sent.metadata).toBeUndefined();
    });

    it('should send SMS with full metadata', async () => {
      const metadata: SMSMetadata = {
        instanceID: 'inst_123',
        jobID: 'job_456',
        userID: 'user_789',
      };

      const result = await mockProvider.sendSMS('+1234567890', 'Test message', metadata);

      expect(result.messageId).toBeDefined();
      
      const sent = mockProvider.getLastMessage();
      expect(sent.metadata).toBeDefined();
      expect(sent.metadata!.instanceID).toBe('inst_123');
      expect(sent.metadata!.jobID).toBe('job_456');
      expect(sent.metadata!.userID).toBe('user_789');
    });

    it('should send SMS with partial metadata', async () => {
      const metadata: SMSMetadata = {
        instanceID: 'inst_123',
        userID: 'user_789',
        // jobID omitted
      };

      await mockProvider.sendSMS('+1234567890', 'Test message', metadata);
      
      const sent = mockProvider.getLastMessage();
      expect(sent.metadata!.instanceID).toBe('inst_123');
      expect(sent.metadata!.userID).toBe('user_789');
      expect(sent.metadata!.jobID).toBeUndefined();
    });

    it('should track instanceID for multi-tenancy', async () => {
      const metadata: SMSMetadata = {
        instanceID: 'inst_tenant_A',
      };

      await mockProvider.sendSMS('+1111111111', 'Message 1', metadata);
      
      metadata.instanceID = 'inst_tenant_B';
      await mockProvider.sendSMS('+2222222222', 'Message 2', metadata);

      expect(mockProvider.sentMessages[0].metadata!.instanceID).toBe('inst_tenant_A');
      expect(mockProvider.sentMessages[1].metadata!.instanceID).toBe('inst_tenant_B');
    });

    it('should track jobID for notification jobs', async () => {
      const metadata: SMSMetadata = {
        jobID: 'job_verification_001',
      };

      await mockProvider.sendSMS('+1234567890', 'Test message', metadata);
      
      const sent = mockProvider.getLastMessage();
      expect(sent.metadata!.jobID).toBe('job_verification_001');
    });

    it('should track userID for target users', async () => {
      const metadata: SMSMetadata = {
        userID: 'user_john_doe_123',
      };

      await mockProvider.sendSMS('+1234567890', 'Test message', metadata);
      
      const sent = mockProvider.getLastMessage();
      expect(sent.metadata!.userID).toBe('user_john_doe_123');
    });

    it('should log metadata in console output', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const metadata: SMSMetadata = {
        instanceID: 'inst_123',
        jobID: 'job_456',
        userID: 'user_789',
      };

      await mockProvider.sendSMS('+1234567890', 'Test', metadata);

      // Check the single log call contains all metadata
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[MOCK SMS\].*inst_123.*job_456.*user_789/)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Verification Metadata Tracking', () => {
    let mockProvider: MockSMSProvider;

    beforeEach(() => {
      mockProvider = new MockSMSProvider();
    });

    it('should send verification without metadata', async () => {
      const result = await mockProvider.sendVerification!('+1234567890', 'sms');

      expect(result.verificationId).toBeDefined();
      
      const sent = mockProvider.getLastVerification();
      expect(sent.metadata).toBeDefined(); // Will have verificationID added
      expect(sent.metadata!.verificationID).toBe(result.verificationId);
    });

    it('should send verification with full metadata', async () => {
      const metadata: SMSMetadata = {
        instanceID: 'inst_123',
        jobID: 'job_456',
        userID: 'user_789',
      };

      const result = await mockProvider.sendVerification!('+1234567890', 'sms', metadata);

      expect(result.verificationId).toBeDefined();
      
      const sent = mockProvider.getLastVerification();
      expect(sent.metadata!.instanceID).toBe('inst_123');
      expect(sent.metadata!.jobID).toBe('job_456');
      expect(sent.metadata!.userID).toBe('user_789');
      expect(sent.metadata!.verificationID).toBe(result.verificationId);
    });

    it('should automatically populate verificationID in metadata', async () => {
      const metadata: SMSMetadata = {
        instanceID: 'inst_123',
        userID: 'user_789',
      };

      const result = await mockProvider.sendVerification!('+1234567890', 'sms', metadata);

      // Verification ID should be added to stored metadata (not mutating input)
      const sent = mockProvider.getLastVerification();
      expect(sent.metadata!.verificationID).toBe(result.verificationId);
      expect(sent.metadata!.instanceID).toBe('inst_123');
      expect(sent.metadata!.userID).toBe('user_789');
    });

    it('should track metadata across multiple verifications', async () => {
      await mockProvider.sendVerification!('+1111111111', 'sms', {
        instanceID: 'inst_A',
        userID: 'user_1',
      });

      await mockProvider.sendVerification!('+2222222222', 'call', {
        instanceID: 'inst_B',
        userID: 'user_2',
      });

      expect(mockProvider.sentVerifications[0].metadata!.instanceID).toBe('inst_A');
      expect(mockProvider.sentVerifications[0].metadata!.userID).toBe('user_1');
      expect(mockProvider.sentVerifications[1].metadata!.instanceID).toBe('inst_B');
      expect(mockProvider.sentVerifications[1].metadata!.userID).toBe('user_2');
    });

    it('should log verification metadata in console output', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const metadata: SMSMetadata = {
        instanceID: 'inst_123',
        jobID: 'job_456',
        userID: 'user_789',
      };

      await mockProvider.sendVerification!('+1234567890', 'sms', metadata);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MOCK SMS VERIFY]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Instance: inst_123')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job: job_456')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('User: user_789')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('TwilioSMSProvider Metadata', () => {
    it('should accept metadata in sendSMS', async () => {
      const provider = new TwilioSMSProvider(
        'test-sid',
        'test-token',
        '+1234567890'
      );

      const metadata: SMSMetadata = {
        instanceID: 'inst_123',
        jobID: 'job_456',
        userID: 'user_789',
      };

      // Will fail without SDK, but tests the interface
      try {
        await provider.sendSMS('+1234567890', 'Test', metadata);
      } catch (error: any) {
        // Expected to throw since Twilio SDK not initialized in tests
        expect(error.message).toContain('Twilio client not initialized');
      }
    });

    it('should accept metadata in sendVerification', async () => {
      const provider = new TwilioSMSProvider(
        'test-sid',
        'test-token',
        '+1234567890',
        'verify-service-sid'
      );

      const metadata: SMSMetadata = {
        instanceID: 'inst_123',
        jobID: 'job_456',
        userID: 'user_789',
      };

      // Will fail without SDK, but tests the interface
      try {
        await provider.sendVerification!('+1234567890', 'sms', metadata);
      } catch (error: any) {
        // Expected to throw since Twilio SDK not initialized in tests
        expect(error.message).toContain('Twilio client not initialized');
      }
    });
  });

  describe('Metadata Use Cases', () => {
    let mockProvider: MockSMSProvider;

    beforeEach(() => {
      mockProvider = new MockSMSProvider();
    });

    it('should track metadata for multi-tenant phone verification', async () => {
      // Tenant A verification
      await mockProvider.sendVerification!('+1111111111', 'sms', {
        instanceID: 'tenant_company_a',
        userID: 'user_alice',
        jobID: 'job_phone_verify_001',
      });

      // Tenant B verification
      await mockProvider.sendVerification!('+2222222222', 'sms', {
        instanceID: 'tenant_company_b',
        userID: 'user_bob',
        jobID: 'job_phone_verify_002',
      });

      const verification1 = mockProvider.sentVerifications[0];
      const verification2 = mockProvider.sentVerifications[1];

      expect(verification1.metadata!.instanceID).toBe('tenant_company_a');
      expect(verification1.metadata!.userID).toBe('user_alice');
      
      expect(verification2.metadata!.instanceID).toBe('tenant_company_b');
      expect(verification2.metadata!.userID).toBe('user_bob');
    });

    it('should track metadata for notification job tracking', async () => {
      const jobID = 'job_bulk_notify_12345';
      
      // Send to multiple users in same job
      await mockProvider.sendSMS('+1111111111', 'Alert 1', {
        jobID,
        userID: 'user_1',
      });

      await mockProvider.sendSMS('+2222222222', 'Alert 2', {
        jobID,
        userID: 'user_2',
      });

      // All messages should have same jobID
      expect(mockProvider.sentMessages[0].metadata!.jobID).toBe(jobID);
      expect(mockProvider.sentMessages[1].metadata!.jobID).toBe(jobID);
      
      // But different userIDs
      expect(mockProvider.sentMessages[0].metadata!.userID).toBe('user_1');
      expect(mockProvider.sentMessages[1].metadata!.userID).toBe('user_2');
    });

    it('should track separate metadata for different calls', async () => {
      const metadata1: SMSMetadata = {
        instanceID: 'inst_123',
        jobID: 'job_456',
        userID: 'user_789',
      };

      await mockProvider.sendSMS('+1111111111', 'Message 1', metadata1);
      
      const metadata2: SMSMetadata = {
        instanceID: 'inst_123',
        jobID: 'job_456',
        userID: 'user_999',
      };
      
      await mockProvider.sendSMS('+2222222222', 'Message 2', metadata2);

      // Each message should have its own metadata
      expect(mockProvider.sentMessages[0].metadata!.userID).toBe('user_789');
      expect(mockProvider.sentMessages[1].metadata!.userID).toBe('user_999');
    });
  });

  describe('Backward Compatibility', () => {
    let mockProvider: MockSMSProvider;

    beforeEach(() => {
      mockProvider = new MockSMSProvider();
    });

    it('should work without metadata (legacy behavior)', async () => {
      const result = await mockProvider.sendSMS('+1234567890', 'Test');
      
      expect(result.messageId).toBeDefined();
      expect(mockProvider.getLastMessage().metadata).toBeUndefined();
    });

    it('should work with verification without metadata (legacy)', async () => {
      const result = await mockProvider.sendVerification!('+1234567890', 'sms');
      
      expect(result.verificationId).toBeDefined();
      // Metadata will be auto-created with verificationID
      const sent = mockProvider.getLastVerification();
      expect(sent.metadata).toBeDefined();
      expect(sent.metadata!.verificationID).toBe(result.verificationId);
    });
  });
});
