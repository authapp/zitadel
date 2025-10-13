/**
 * Email Provider Chain Tests
 */

import { describe, it, expect } from '@jest/globals';
import { 
  EmailProviderChain,
  EmailProviderChainBuilder,
  createFallbackChain,
  createBroadcastChain 
} from '../../../src/lib/notification/email-provider-chain';
import { MockEmailProvider } from '../../../src/lib/notification/email-service';

describe('EmailProviderChain', () => {
  describe('Configuration', () => {
    it('should create chain with providers', () => {
      const provider1 = new MockEmailProvider();
      const provider2 = new MockEmailProvider();

      const chain = new EmailProviderChain({
        providers: [provider1, provider2],
      });

      expect(chain.name).toBe('chain');
      expect(chain.getProviderCount()).toBe(2);
    });

    it('should throw error without providers', () => {
      expect(() => {
        new EmailProviderChain({ providers: [] });
      }).toThrow('At least one provider is required');
    });

    it('should accept single provider', () => {
      const provider = new MockEmailProvider();
      const chain = new EmailProviderChain({
        providers: [provider],
      });

      expect(chain.getProviderCount()).toBe(1);
    });
  });

  describe('Fallback Behavior', () => {
    it('should use first provider on success', async () => {
      const provider1 = new MockEmailProvider();
      const provider2 = new MockEmailProvider();

      const chain = new EmailProviderChain({
        providers: [provider1, provider2],
      });

      await chain.sendEmail('test@example.com', 'Subject', 'Body');

      expect(provider1.sentEmails.length).toBe(1);
      expect(provider2.sentEmails.length).toBe(0);
    });

    it('should fallback to second provider on first failure', async () => {
      const provider1 = new MockEmailProvider();
      const provider2 = new MockEmailProvider();

      // Make first provider fail
      provider1.sendEmail = jest.fn().mockRejectedValue(new Error('Provider 1 failed'));

      const chain = new EmailProviderChain({
        providers: [provider1, provider2],
      });

      const result = await chain.sendEmail('test@example.com', 'Subject', 'Body');

      expect(result.messageId).toBeDefined();
      expect(provider1.sendEmail).toHaveBeenCalled();
      expect(provider2.sentEmails.length).toBe(1);
    });

    it('should try all providers in sequence', async () => {
      const provider1 = new MockEmailProvider();
      const provider2 = new MockEmailProvider();
      const provider3 = new MockEmailProvider();

      provider1.sendEmail = jest.fn().mockRejectedValue(new Error('Failed'));
      provider2.sendEmail = jest.fn().mockRejectedValue(new Error('Failed'));

      const chain = new EmailProviderChain({
        providers: [provider1, provider2, provider3],
      });

      await chain.sendEmail('test@example.com', 'Subject', 'Body');

      expect(provider1.sendEmail).toHaveBeenCalled();
      expect(provider2.sendEmail).toHaveBeenCalled();
      expect(provider3.sentEmails.length).toBe(1);
    });

    it('should throw if all providers fail', async () => {
      const provider1 = new MockEmailProvider();
      const provider2 = new MockEmailProvider();

      provider1.sendEmail = jest.fn().mockRejectedValue(new Error('Provider 1 failed'));
      provider2.sendEmail = jest.fn().mockRejectedValue(new Error('Provider 2 failed'));

      const chain = new EmailProviderChain({
        providers: [provider1, provider2],
      });

      await expect(
        chain.sendEmail('test@example.com', 'Subject', 'Body')
      ).rejects.toThrow('All email providers failed');
    });

    it('should include all error messages when all fail', async () => {
      const provider1 = new MockEmailProvider();
      const provider2 = new MockEmailProvider();

      provider1.sendEmail = jest.fn().mockRejectedValue(new Error('Error 1'));
      provider2.sendEmail = jest.fn().mockRejectedValue(new Error('Error 2'));

      const chain = new EmailProviderChain({
        providers: [provider1, provider2],
      });

      try {
        await chain.sendEmail('test@example.com', 'Subject', 'Body');
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
      const provider1 = new MockEmailProvider();
      const provider2 = new MockEmailProvider();
      const provider3 = new MockEmailProvider();

      const chain = new EmailProviderChain({
        providers: [provider1, provider2, provider3],
        continueOnError: true,
      });

      await chain.sendEmail('test@example.com', 'Subject', 'Body');

      expect(provider1.sentEmails.length).toBe(1);
      expect(provider2.sentEmails.length).toBe(1);
      expect(provider3.sentEmails.length).toBe(1);
    });

    it('should continue even if some providers fail', async () => {
      const provider1 = new MockEmailProvider();
      const provider2 = new MockEmailProvider();
      const provider3 = new MockEmailProvider();

      provider2.sendEmail = jest.fn().mockRejectedValue(new Error('Failed'));

      const chain = new EmailProviderChain({
        providers: [provider1, provider2, provider3],
        continueOnError: true,
      });

      const result = await chain.sendEmail('test@example.com', 'Subject', 'Body');

      expect(result.messageId).toBeDefined();
      expect(provider1.sentEmails.length).toBe(1);
      expect(provider2.sendEmail).toHaveBeenCalled();
      expect(provider3.sentEmails.length).toBe(1);
    });
  });

  describe('Error Logging', () => {
    it('should log errors by default', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const provider1 = new MockEmailProvider();
      const provider2 = new MockEmailProvider();

      provider1.sendEmail = jest.fn().mockRejectedValue(new Error('Provider failed'));

      const chain = new EmailProviderChain({
        providers: [provider1, provider2],
      });

      await chain.sendEmail('test@example.com', 'Subject', 'Body');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Provider Chain]'),
        expect.stringContaining('Provider failed')
      );

      consoleSpy.mockRestore();
    });

    it('should not log errors when logErrors is false', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const provider1 = new MockEmailProvider();
      const provider2 = new MockEmailProvider();

      provider1.sendEmail = jest.fn().mockRejectedValue(new Error('Provider failed'));

      const chain = new EmailProviderChain({
        providers: [provider1, provider2],
        logErrors: false,
      });

      await chain.sendEmail('test@example.com', 'Subject', 'Body');

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Builder Pattern', () => {
    it('should build chain with builder', () => {
      const provider1 = new MockEmailProvider();
      const provider2 = new MockEmailProvider();

      const chain = new EmailProviderChainBuilder()
        .addProvider(provider1)
        .addProvider(provider2)
        .build();

      expect(chain.getProviderCount()).toBe(2);
    });

    it('should support method chaining', () => {
      const provider = new MockEmailProvider();

      const chain = new EmailProviderChainBuilder()
        .addProvider(provider)
        .setContinueOnError(true)
        .setLogErrors(false)
        .build();

      expect(chain).toBeDefined();
    });

    it('should add multiple providers at once', () => {
      const provider1 = new MockEmailProvider();
      const provider2 = new MockEmailProvider();
      const provider3 = new MockEmailProvider();

      const chain = new EmailProviderChainBuilder()
        .addProviders(provider1, provider2, provider3)
        .build();

      expect(chain.getProviderCount()).toBe(3);
    });
  });

  describe('Helper Functions', () => {
    it('should create fallback chain', async () => {
      const primary = new MockEmailProvider();
      const fallback = new MockEmailProvider();

      primary.sendEmail = jest.fn().mockRejectedValue(new Error('Failed'));

      const chain = createFallbackChain(primary, fallback);

      await chain.sendEmail('test@example.com', 'Subject', 'Body');

      expect(primary.sendEmail).toHaveBeenCalled();
      expect(fallback.sentEmails.length).toBe(1);
    });

    it('should create broadcast chain', async () => {
      const provider1 = new MockEmailProvider();
      const provider2 = new MockEmailProvider();
      const provider3 = new MockEmailProvider();

      const chain = createBroadcastChain(provider1, provider2, provider3);

      await chain.sendEmail('test@example.com', 'Subject', 'Body');

      expect(provider1.sentEmails.length).toBe(1);
      expect(provider2.sentEmails.length).toBe(1);
      expect(provider3.sentEmails.length).toBe(1);
    });
  });

  describe('Provider Information', () => {
    it('should get provider names', () => {
      const provider1 = new MockEmailProvider();
      const provider2 = new MockEmailProvider();

      const chain = new EmailProviderChain({
        providers: [provider1, provider2],
      });

      const names = chain.getProviders();
      expect(names).toEqual(['mock', 'mock']);
    });

    it('should get provider count', () => {
      const provider1 = new MockEmailProvider();
      const provider2 = new MockEmailProvider();
      const provider3 = new MockEmailProvider();

      const chain = new EmailProviderChain({
        providers: [provider1, provider2, provider3],
      });

      expect(chain.getProviderCount()).toBe(3);
    });
  });

  describe('Email Data Propagation', () => {
    it('should pass all email data to providers', async () => {
      const provider = new MockEmailProvider();

      const chain = new EmailProviderChain({
        providers: [provider],
      });

      await chain.sendEmail(
        ['test1@example.com', 'test2@example.com'],
        'Test Subject',
        'Test Body',
        '<p>HTML</p>',
        ['cc@example.com'],
        ['bcc@example.com']
      );

      const sent = provider.sentEmails[0];
      expect(sent.to).toEqual(['test1@example.com', 'test2@example.com']);
      expect(sent.subject).toBe('Test Subject');
      expect(sent.body).toBe('Test Body');
      expect(sent.html).toBe('<p>HTML</p>');
      expect(sent.cc).toEqual(['cc@example.com']);
      expect(sent.bcc).toEqual(['bcc@example.com']);
    });
  });
});
