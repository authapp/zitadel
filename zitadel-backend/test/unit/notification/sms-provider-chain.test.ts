/**
 * SMS Provider Chain Tests
 */

import { describe, it, expect } from '@jest/globals';
import { 
  SMSProviderChain,
  SMSProviderChainBuilder,
  createSMSFallbackChain,
  createSMSBroadcastChain 
} from '../../../src/lib/notification/sms-provider-chain';
import { MockSMSProvider } from '../../../src/lib/notification/sms-service';
import { SMSMetadata } from '../../../src/lib/notification/sms-service';

describe('SMSProviderChain', () => {
  describe('Configuration', () => {
    it('should create chain with providers', () => {
      const provider1 = new MockSMSProvider();
      const provider2 = new MockSMSProvider();

      const chain = new SMSProviderChain({
        providers: [provider1, provider2],
      });

      expect(chain.name).toBe('chain');
      expect(chain.getProviderCount()).toBe(2);
    });

    it('should throw error without providers', () => {
      expect(() => {
        new SMSProviderChain({ providers: [] });
      }).toThrow('At least one provider is required');
    });

    it('should accept single provider', () => {
      const provider = new MockSMSProvider();
      const chain = new SMSProviderChain({
        providers: [provider],
      });

      expect(chain.getProviderCount()).toBe(1);
    });
  });

  describe('Fallback Behavior', () => {
    it('should use first provider on success', async () => {
      const provider1 = new MockSMSProvider();
      const provider2 = new MockSMSProvider();

      const chain = new SMSProviderChain({
        providers: [provider1, provider2],
      });

      await chain.sendSMS('+1234567890', 'Test message');

      expect(provider1.sentMessages.length).toBe(1);
      expect(provider2.sentMessages.length).toBe(0);
    });

    it('should fallback to second provider on first failure', async () => {
      const provider1 = new MockSMSProvider();
      const provider2 = new MockSMSProvider();

      // Make first provider fail
      provider1.sendSMS = jest.fn().mockRejectedValue(new Error('Provider 1 failed'));

      const chain = new SMSProviderChain({
        providers: [provider1, provider2],
      });

      const result = await chain.sendSMS('+1234567890', 'Test message');

      expect(result.messageId).toBeDefined();
      expect(provider1.sendSMS).toHaveBeenCalled();
      expect(provider2.sentMessages.length).toBe(1);
    });

    it('should try all providers in sequence', async () => {
      const provider1 = new MockSMSProvider();
      const provider2 = new MockSMSProvider();
      const provider3 = new MockSMSProvider();

      provider1.sendSMS = jest.fn().mockRejectedValue(new Error('Failed'));
      provider2.sendSMS = jest.fn().mockRejectedValue(new Error('Failed'));

      const chain = new SMSProviderChain({
        providers: [provider1, provider2, provider3],
      });

      await chain.sendSMS('+1234567890', 'Test message');

      expect(provider1.sendSMS).toHaveBeenCalled();
      expect(provider2.sendSMS).toHaveBeenCalled();
      expect(provider3.sentMessages.length).toBe(1);
    });

    it('should throw if all providers fail', async () => {
      const provider1 = new MockSMSProvider();
      const provider2 = new MockSMSProvider();

      provider1.sendSMS = jest.fn().mockRejectedValue(new Error('Provider 1 failed'));
      provider2.sendSMS = jest.fn().mockRejectedValue(new Error('Provider 2 failed'));

      const chain = new SMSProviderChain({
        providers: [provider1, provider2],
      });

      await expect(
        chain.sendSMS('+1234567890', 'Test message')
      ).rejects.toThrow('All SMS providers failed');
    });

    it('should include all error messages when all fail', async () => {
      const provider1 = new MockSMSProvider();
      const provider2 = new MockSMSProvider();

      provider1.sendSMS = jest.fn().mockRejectedValue(new Error('Error 1'));
      provider2.sendSMS = jest.fn().mockRejectedValue(new Error('Error 2'));

      const chain = new SMSProviderChain({
        providers: [provider1, provider2],
      });

      try {
        await chain.sendSMS('+1234567890', 'Test');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Error 1');
        expect(error.message).toContain('Error 2');
        expect(error.message).toContain('mock');
      }
    });
  });

  describe('Broadcast Mode (continueOnError)', () => {
    it('should send to all providers when continueOnError is true', async () => {
      const provider1 = new MockSMSProvider();
      const provider2 = new MockSMSProvider();
      const provider3 = new MockSMSProvider();

      const chain = new SMSProviderChain({
        providers: [provider1, provider2, provider3],
        continueOnError: true,
      });

      await chain.sendSMS('+1234567890', 'Test message');

      expect(provider1.sentMessages.length).toBe(1);
      expect(provider2.sentMessages.length).toBe(1);
      expect(provider3.sentMessages.length).toBe(1);
    });

    it('should continue even if some providers fail', async () => {
      const provider1 = new MockSMSProvider();
      const provider2 = new MockSMSProvider();
      const provider3 = new MockSMSProvider();

      provider2.sendSMS = jest.fn().mockRejectedValue(new Error('Failed'));

      const chain = new SMSProviderChain({
        providers: [provider1, provider2, provider3],
        continueOnError: true,
      });

      const result = await chain.sendSMS('+1234567890', 'Test message');

      expect(result.messageId).toBeDefined();
      expect(provider1.sentMessages.length).toBe(1);
      expect(provider2.sendSMS).toHaveBeenCalled();
      expect(provider3.sentMessages.length).toBe(1);
    });
  });

  describe('Error Logging', () => {
    it('should log errors by default', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const provider1 = new MockSMSProvider();
      const provider2 = new MockSMSProvider();

      provider1.sendSMS = jest.fn().mockRejectedValue(new Error('Provider failed'));

      const chain = new SMSProviderChain({
        providers: [provider1, provider2],
      });

      await chain.sendSMS('+1234567890', 'Test message');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SMS Provider Chain]'),
        expect.stringContaining('Provider failed')
      );

      consoleSpy.mockRestore();
    });

    it('should not log errors when logErrors is false', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const provider1 = new MockSMSProvider();
      const provider2 = new MockSMSProvider();

      provider1.sendSMS = jest.fn().mockRejectedValue(new Error('Provider failed'));

      const chain = new SMSProviderChain({
        providers: [provider1, provider2],
        logErrors: false,
      });

      await chain.sendSMS('+1234567890', 'Test message');

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Builder Pattern', () => {
    it('should build chain with builder', () => {
      const provider1 = new MockSMSProvider();
      const provider2 = new MockSMSProvider();

      const chain = new SMSProviderChainBuilder()
        .addProvider(provider1)
        .addProvider(provider2)
        .build();

      expect(chain.getProviderCount()).toBe(2);
    });

    it('should support method chaining', () => {
      const provider = new MockSMSProvider();

      const chain = new SMSProviderChainBuilder()
        .addProvider(provider)
        .setContinueOnError(true)
        .setLogErrors(false)
        .build();

      expect(chain).toBeDefined();
    });

    it('should add multiple providers at once', () => {
      const provider1 = new MockSMSProvider();
      const provider2 = new MockSMSProvider();
      const provider3 = new MockSMSProvider();

      const chain = new SMSProviderChainBuilder()
        .addProviders(provider1, provider2, provider3)
        .build();

      expect(chain.getProviderCount()).toBe(3);
    });
  });

  describe('Helper Functions', () => {
    it('should create fallback chain', async () => {
      const primary = new MockSMSProvider();
      const fallback = new MockSMSProvider();

      primary.sendSMS = jest.fn().mockRejectedValue(new Error('Failed'));

      const chain = createSMSFallbackChain(primary, fallback);

      await chain.sendSMS('+1234567890', 'Test message');

      expect(primary.sendSMS).toHaveBeenCalled();
      expect(fallback.sentMessages.length).toBe(1);
    });

    it('should create broadcast chain', async () => {
      const provider1 = new MockSMSProvider();
      const provider2 = new MockSMSProvider();
      const provider3 = new MockSMSProvider();

      const chain = createSMSBroadcastChain(provider1, provider2, provider3);

      await chain.sendSMS('+1234567890', 'Test message');

      expect(provider1.sentMessages.length).toBe(1);
      expect(provider2.sentMessages.length).toBe(1);
      expect(provider3.sentMessages.length).toBe(1);
    });
  });

  describe('Provider Information', () => {
    it('should get provider names', () => {
      const provider1 = new MockSMSProvider();
      const provider2 = new MockSMSProvider();

      const chain = new SMSProviderChain({
        providers: [provider1, provider2],
      });

      const names = chain.getProviders();
      expect(names).toEqual(['mock', 'mock']);
    });

    it('should get provider count', () => {
      const provider1 = new MockSMSProvider();
      const provider2 = new MockSMSProvider();
      const provider3 = new MockSMSProvider();

      const chain = new SMSProviderChain({
        providers: [provider1, provider2, provider3],
      });

      expect(chain.getProviderCount()).toBe(3);
    });
  });

  describe('SMS Data Propagation', () => {
    it('should pass all SMS data to providers', async () => {
      const provider = new MockSMSProvider();

      const chain = new SMSProviderChain({
        providers: [provider],
      });

      await chain.sendSMS('+1234567890', 'Test message');

      const sent = provider.sentMessages[0];
      expect(sent.to).toBe('+1234567890');
      expect(sent.message).toBe('Test message');
    });

    it('should pass metadata to providers', async () => {
      const provider = new MockSMSProvider();

      const chain = new SMSProviderChain({
        providers: [provider],
      });

      const metadata: SMSMetadata = {
        instanceID: 'inst_123',
        jobID: 'job_456',
        userID: 'user_789',
      };

      await chain.sendSMS('+1234567890', 'Test message', metadata);

      const sent = provider.sentMessages[0];
      expect(sent.metadata).toEqual(metadata);
    });
  });
});
