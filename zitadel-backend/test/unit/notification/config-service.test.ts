/**
 * Notification Configuration Service Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  NotificationConfigService
} from '../../../src/lib/notification/config-service';

// Mock DatabasePool
class MockDatabasePool {
  private data: Map<string, any[]> = new Map();

  async query(sql: string, params: any[]): Promise<{ rows: any[] }> {
    // Simple mock implementation
    if (sql.includes('SELECT * FROM email_configs')) {
      const instanceId = params[0];
      const rows = this.data.get(`email_${instanceId}`) || [];
      return { rows };
    } else if (sql.includes('SELECT * FROM sms_configs')) {
      const instanceId = params[0];
      const rows = this.data.get(`sms_${instanceId}`) || [];
      return { rows };
    } else if (sql.includes('INSERT INTO email_configs')) {
      // Mock insert
      return { rows: [] };
    } else if (sql.includes('INSERT INTO sms_configs')) {
      // Mock insert
      return { rows: [] };
    }
    return { rows: [] };
  }

  // Helper methods for testing
  setEmailConfig(instanceId: string, config: any): void {
    this.data.set(`email_${instanceId}`, [config]);
  }

  setSMSConfig(instanceId: string, config: any): void {
    this.data.set(`sms_${instanceId}`, [config]);
  }

  clear(): void {
    this.data.clear();
  }
}

describe('NotificationConfigService', () => {
  let mockDb: MockDatabasePool;
  let configService: NotificationConfigService;

  beforeEach(() => {
    mockDb = new MockDatabasePool();
    configService = new NotificationConfigService(mockDb as any);
  });

  describe('Email Configuration', () => {
    it('should get email config from database', async () => {
      mockDb.setEmailConfig('inst_123', {
        id: 'email_1',
        instance_id: 'inst_123',
        smtp_host: 'smtp.example.com',
        smtp_port: 587,
        smtp_user: 'user@example.com',
        smtp_password: 'password',
        smtp_from: 'noreply@example.com',
        smtp_from_name: 'Example App',
        smtp_reply_to: 'support@example.com',
        smtp_secure: false,
        enabled: true,
      });

      const config = await configService.getEmailConfig('inst_123');

      expect(config).toBeDefined();
      expect(config?.instanceId).toBe('inst_123');
      expect(config?.smtpHost).toBe('smtp.example.com');
      expect(config?.smtpPort).toBe(587);
      expect(config?.enabled).toBe(true);
    });

    it('should return null when no email config exists', async () => {
      const config = await configService.getEmailConfig('inst_nonexistent');
      expect(config).toBeNull();
    });

    it('should cache email config', async () => {
      mockDb.setEmailConfig('inst_123', {
        id: 'email_1',
        instance_id: 'inst_123',
        smtp_host: 'smtp.example.com',
        smtp_port: 587,
        enabled: true,
      });

      // First call - should hit database
      const config1 = await configService.getEmailConfig('inst_123');
      expect(config1).toBeDefined();

      // Clear database
      mockDb.clear();

      // Second call - should use cache
      const config2 = await configService.getEmailConfig('inst_123');
      expect(config2).toBeDefined();
      expect(config2?.smtpHost).toBe('smtp.example.com');
    });

    it('should create email provider from config', async () => {
      mockDb.setEmailConfig('inst_123', {
        id: 'email_1',
        instance_id: 'inst_123',
        smtp_host: 'smtp.example.com',
        smtp_port: 587,
        smtp_user: 'user@example.com',
        smtp_password: 'password',
        smtp_from: 'noreply@example.com',
        smtp_from_name: 'Example App',
        smtp_secure: false,
        enabled: true,
      });

      const provider = await configService.createEmailProvider('inst_123');

      expect(provider).toBeDefined();
      expect(provider?.name).toBe('smtp');
    });

    it('should return null when creating provider with missing config', async () => {
      mockDb.setEmailConfig('inst_123', {
        id: 'email_1',
        instance_id: 'inst_123',
        // Missing smtp_host and smtp_port
        enabled: true,
      });

      const provider = await configService.createEmailProvider('inst_123');
      expect(provider).toBeNull();
    });

    it('should return null when creating provider for disabled config', async () => {
      mockDb.setEmailConfig('inst_123', {
        id: 'email_1',
        instance_id: 'inst_123',
        smtp_host: 'smtp.example.com',
        smtp_port: 587,
        enabled: false, // Disabled
      });

      const provider = await configService.createEmailProvider('inst_123');
      expect(provider).toBeNull();
    });
  });

  describe('SMS Configuration', () => {
    it('should get SMS config from database', async () => {
      mockDb.setSMSConfig('inst_123', {
        id: 'sms_1',
        instance_id: 'inst_123',
        provider: 'twilio',
        twilio_account_sid: 'ACxxxxx',
        twilio_auth_token: 'token',
        twilio_phone_number: '+1234567890',
        twilio_verify_service_sid: 'VAxxxxx',
        enabled: true,
      });

      const config = await configService.getSMSConfig('inst_123');

      expect(config).toBeDefined();
      expect(config?.instanceId).toBe('inst_123');
      expect(config?.provider).toBe('twilio');
      expect(config?.twilioAccountSid).toBe('ACxxxxx');
      expect(config?.enabled).toBe(true);
    });

    it('should return null when no SMS config exists', async () => {
      const config = await configService.getSMSConfig('inst_nonexistent');
      expect(config).toBeNull();
    });

    it('should cache SMS config', async () => {
      mockDb.setSMSConfig('inst_123', {
        id: 'sms_1',
        instance_id: 'inst_123',
        provider: 'twilio',
        enabled: true,
      });

      // First call - should hit database
      const config1 = await configService.getSMSConfig('inst_123');
      expect(config1).toBeDefined();

      // Clear database
      mockDb.clear();

      // Second call - should use cache
      const config2 = await configService.getSMSConfig('inst_123');
      expect(config2).toBeDefined();
      expect(config2?.provider).toBe('twilio');
    });

    it('should create Twilio SMS provider from config', async () => {
      mockDb.setSMSConfig('inst_123', {
        id: 'sms_1',
        instance_id: 'inst_123',
        provider: 'twilio',
        twilio_account_sid: 'ACxxxxx',
        twilio_auth_token: 'token',
        twilio_phone_number: '+1234567890',
        enabled: true,
      });

      const provider = await configService.createSMSProvider('inst_123');

      expect(provider).toBeDefined();
      expect(provider?.name).toBe('twilio');
    });

    it('should create webhook SMS provider from config', async () => {
      mockDb.setSMSConfig('inst_123', {
        id: 'sms_1',
        instance_id: 'inst_123',
        provider: 'webhook',
        webhook_url: 'https://example.com/sms',
        webhook_headers: { 'X-API-Key': 'secret' },
        enabled: true,
      });

      const provider = await configService.createSMSProvider('inst_123');

      expect(provider).toBeDefined();
      expect(provider?.name).toBe('webhook');
    });

    it('should return null when creating provider with missing config', async () => {
      mockDb.setSMSConfig('inst_123', {
        id: 'sms_1',
        instance_id: 'inst_123',
        provider: 'twilio',
        // Missing required Twilio credentials
        enabled: true,
      });

      const provider = await configService.createSMSProvider('inst_123');
      expect(provider).toBeNull();
    });
  });

  describe('Per-Instance Configuration', () => {
    it('should support different configs for different instances', async () => {
      // Instance A config
      mockDb.setEmailConfig('inst_A', {
        id: 'email_A',
        instance_id: 'inst_A',
        smtp_host: 'smtp-a.example.com',
        smtp_port: 587,
        enabled: true,
      });

      // Instance B config
      mockDb.setEmailConfig('inst_B', {
        id: 'email_B',
        instance_id: 'inst_B',
        smtp_host: 'smtp-b.example.com',
        smtp_port: 465,
        enabled: true,
      });

      const configA = await configService.getEmailConfig('inst_A');
      const configB = await configService.getEmailConfig('inst_B');

      expect(configA?.smtpHost).toBe('smtp-a.example.com');
      expect(configB?.smtpHost).toBe('smtp-b.example.com');
    });

    it('should isolate SMS configs per instance', async () => {
      mockDb.setSMSConfig('inst_A', {
        id: 'sms_A',
        instance_id: 'inst_A',
        provider: 'twilio',
        twilio_phone_number: '+1111111111',
        enabled: true,
      });

      mockDb.setSMSConfig('inst_B', {
        id: 'sms_B',
        instance_id: 'inst_B',
        provider: 'webhook',
        webhook_url: 'https://b.example.com/sms',
        enabled: true,
      });

      const configA = await configService.getSMSConfig('inst_A');
      const configB = await configService.getSMSConfig('inst_B');

      expect(configA?.provider).toBe('twilio');
      expect(configB?.provider).toBe('webhook');
    });
  });

  describe('Configuration Reload', () => {
    it('should register reload callback', () => {
      let reloadCalled = false;
      let reloadedInstance = '';

      configService.onConfigReload((instanceId) => {
        reloadCalled = true;
        reloadedInstance = instanceId;
      });

      // Trigger reload manually
      configService.reloadConfig('inst_123');

      expect(reloadCalled).toBe(true);
      expect(reloadedInstance).toBe('inst_123');
    });

    it('should trigger reload callback on config save', async () => {
      let reloadCalled = false;

      configService.onConfigReload(() => {
        reloadCalled = true;
      });

      // Save config should trigger reload
      await configService.saveEmailConfig({
        instanceId: 'inst_123',
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        enabled: true,
      });

      expect(reloadCalled).toBe(true);
    });

    it('should invalidate cache on reload', async () => {
      mockDb.setEmailConfig('inst_123', {
        id: 'email_1',
        instance_id: 'inst_123',
        smtp_host: 'old-smtp.example.com',
        smtp_port: 587,
        enabled: true,
      });

      // First call - cache it
      const config1 = await configService.getEmailConfig('inst_123');
      expect(config1?.smtpHost).toBe('old-smtp.example.com');

      // Update database
      mockDb.setEmailConfig('inst_123', {
        id: 'email_1',
        instance_id: 'inst_123',
        smtp_host: 'new-smtp.example.com',
        smtp_port: 587,
        enabled: true,
      });

      // Reload config
      await configService.reloadConfig('inst_123');

      // Should get new config
      const config2 = await configService.getEmailConfig('inst_123');
      expect(config2?.smtpHost).toBe('new-smtp.example.com');
    });

    it('should clear all cache', async () => {
      mockDb.setEmailConfig('inst_123', {
        id: 'email_1',
        instance_id: 'inst_123',
        smtp_host: 'smtp.example.com',
        smtp_port: 587,
        enabled: true,
      });

      // Cache it
      await configService.getEmailConfig('inst_123');

      // Clear cache
      configService.clearCache();

      // Clear database
      mockDb.clear();

      // Should return null (cache cleared, database empty)
      const config = await configService.getEmailConfig('inst_123');
      expect(config).toBeNull();
    });
  });
});
