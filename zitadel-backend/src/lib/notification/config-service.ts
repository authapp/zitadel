/**
 * Notification Configuration Service
 * Manages database-driven, per-instance notification configurations
 * Based on Zitadel Go: internal/notification/repository
 */

import { DatabasePool } from '../database/pool';
import { EmailProvider } from './email-service';
import { SMSProvider } from './sms-service';
import { SMTPEmailProvider } from './smtp-email-service';
import { TwilioSMSProvider } from './sms-service';
import { WebhookSMSProvider } from './webhook-sms-provider';

export interface EmailConfig {
  id: string;
  instanceId: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  smtpFromName?: string;
  smtpReplyTo?: string;
  smtpSecure?: boolean;
  enabled: boolean;
}

export interface SMSConfig {
  id: string;
  instanceId: string;
  provider: 'twilio' | 'webhook';
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  twilioVerifyServiceSid?: string;
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;
  enabled: boolean;
}

export interface NotificationConfig {
  email?: EmailConfig;
  sms?: SMSConfig;
}

/**
 * Configuration Service
 * Manages notification configurations from database
 */
export class NotificationConfigService {
  private configCache: Map<string, NotificationConfig> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes
  private reloadCallbacks: Array<(instanceId: string) => void> = [];

  constructor(private db: DatabasePool) {}

  /**
   * Get email configuration for instance
   */
  async getEmailConfig(instanceId: string): Promise<EmailConfig | null> {
    // Check cache first
    const cached = this.getCachedConfig(instanceId);
    if (cached?.email) {
      return cached.email;
    }

    const result = await this.db.query(
      'SELECT * FROM email_configs WHERE instance_id = $1 AND enabled = true',
      [instanceId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const config: EmailConfig = {
      id: row.id,
      instanceId: row.instance_id,
      smtpHost: row.smtp_host,
      smtpPort: row.smtp_port,
      smtpUser: row.smtp_user,
      smtpPassword: row.smtp_password, // TODO: Decrypt
      smtpFrom: row.smtp_from,
      smtpFromName: row.smtp_from_name,
      smtpReplyTo: row.smtp_reply_to,
      smtpSecure: row.smtp_secure,
      enabled: row.enabled,
    };

    // Update cache
    this.updateCache(instanceId, { email: config });

    return config;
  }

  /**
   * Get SMS configuration for instance
   */
  async getSMSConfig(instanceId: string): Promise<SMSConfig | null> {
    // Check cache first
    const cached = this.getCachedConfig(instanceId);
    if (cached?.sms) {
      return cached.sms;
    }

    const result = await this.db.query(
      'SELECT * FROM sms_configs WHERE instance_id = $1 AND enabled = true',
      [instanceId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const config: SMSConfig = {
      id: row.id,
      instanceId: row.instance_id,
      provider: row.provider,
      twilioAccountSid: row.twilio_account_sid,
      twilioAuthToken: row.twilio_auth_token, // TODO: Decrypt
      twilioPhoneNumber: row.twilio_phone_number,
      twilioVerifyServiceSid: row.twilio_verify_service_sid,
      webhookUrl: row.webhook_url,
      webhookHeaders: row.webhook_headers,
      enabled: row.enabled,
    };

    // Update cache
    this.updateCache(instanceId, { sms: config });

    return config;
  }

  /**
   * Save email configuration
   */
  async saveEmailConfig(config: Omit<EmailConfig, 'id'>): Promise<EmailConfig> {
    const id = `email_${config.instanceId}_${Date.now()}`;

    await this.db.query(
      `INSERT INTO email_configs (
        id, instance_id, smtp_host, smtp_port, smtp_user, smtp_password,
        smtp_from, smtp_from_name, smtp_reply_to, smtp_secure, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (instance_id) DO UPDATE SET
        smtp_host = EXCLUDED.smtp_host,
        smtp_port = EXCLUDED.smtp_port,
        smtp_user = EXCLUDED.smtp_user,
        smtp_password = EXCLUDED.smtp_password,
        smtp_from = EXCLUDED.smtp_from,
        smtp_from_name = EXCLUDED.smtp_from_name,
        smtp_reply_to = EXCLUDED.smtp_reply_to,
        smtp_secure = EXCLUDED.smtp_secure,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()`,
      [
        id,
        config.instanceId,
        config.smtpHost,
        config.smtpPort,
        config.smtpUser,
        config.smtpPassword, // TODO: Encrypt
        config.smtpFrom,
        config.smtpFromName,
        config.smtpReplyTo,
        config.smtpSecure,
        config.enabled,
      ]
    );

    // Invalidate cache
    this.invalidateCache(config.instanceId);

    // Trigger reload callbacks
    this.triggerReload(config.instanceId);

    return { id, ...config };
  }

  /**
   * Save SMS configuration
   */
  async saveSMSConfig(config: Omit<SMSConfig, 'id'>): Promise<SMSConfig> {
    const id = `sms_${config.instanceId}_${Date.now()}`;

    await this.db.query(
      `INSERT INTO sms_configs (
        id, instance_id, provider, twilio_account_sid, twilio_auth_token,
        twilio_phone_number, twilio_verify_service_sid, webhook_url,
        webhook_headers, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (instance_id) DO UPDATE SET
        provider = EXCLUDED.provider,
        twilio_account_sid = EXCLUDED.twilio_account_sid,
        twilio_auth_token = EXCLUDED.twilio_auth_token,
        twilio_phone_number = EXCLUDED.twilio_phone_number,
        twilio_verify_service_sid = EXCLUDED.twilio_verify_service_sid,
        webhook_url = EXCLUDED.webhook_url,
        webhook_headers = EXCLUDED.webhook_headers,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()`,
      [
        id,
        config.instanceId,
        config.provider,
        config.twilioAccountSid,
        config.twilioAuthToken, // TODO: Encrypt
        config.twilioPhoneNumber,
        config.twilioVerifyServiceSid,
        config.webhookUrl,
        JSON.stringify(config.webhookHeaders || {}),
        config.enabled,
      ]
    );

    // Invalidate cache
    this.invalidateCache(config.instanceId);

    // Trigger reload callbacks
    this.triggerReload(config.instanceId);

    return { id, ...config };
  }

  /**
   * Create email provider from database config
   */
  async createEmailProvider(instanceId: string): Promise<EmailProvider | null> {
    const config = await this.getEmailConfig(instanceId);
    
    if (!config || !config.enabled) {
      return null;
    }

    if (!config.smtpHost || !config.smtpPort) {
      return null;
    }

    const providerConfig: any = {
      host: config.smtpHost,
      port: config.smtpPort,
      user: config.smtpUser,
      password: config.smtpPassword,
      from: config.smtpFrom || 'noreply@zitadel.com',
      secure: config.smtpSecure ?? false,
    };

    if (config.smtpFromName) {
      providerConfig.fromName = config.smtpFromName;
    }
    if (config.smtpReplyTo) {
      providerConfig.replyTo = config.smtpReplyTo;
    }

    return new SMTPEmailProvider(providerConfig);
  }

  /**
   * Create SMS provider from database config
   */
  async createSMSProvider(instanceId: string): Promise<SMSProvider | null> {
    const config = await this.getSMSConfig(instanceId);
    
    if (!config || !config.enabled) {
      return null;
    }

    if (config.provider === 'twilio') {
      if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioPhoneNumber) {
        return null;
      }

      return new TwilioSMSProvider(
        config.twilioAccountSid,
        config.twilioAuthToken,
        config.twilioPhoneNumber,
        config.twilioVerifyServiceSid
      );
    } else if (config.provider === 'webhook') {
      if (!config.webhookUrl) {
        return null;
      }

      return new WebhookSMSProvider({
        url: config.webhookUrl,
        headers: config.webhookHeaders,
      });
    }

    return null;
  }

  /**
   * Register callback for configuration reload
   */
  onConfigReload(callback: (instanceId: string) => void): void {
    this.reloadCallbacks.push(callback);
  }

  /**
   * Manually reload configuration for instance
   */
  async reloadConfig(instanceId: string): Promise<void> {
    this.invalidateCache(instanceId);
    this.triggerReload(instanceId);
  }

  /**
   * Clear all cached configurations
   */
  clearCache(): void {
    this.configCache.clear();
    this.cacheExpiry.clear();
  }

  // Private helper methods

  private getCachedConfig(instanceId: string): NotificationConfig | null {
    const expiry = this.cacheExpiry.get(instanceId);
    if (!expiry || Date.now() > expiry) {
      this.configCache.delete(instanceId);
      this.cacheExpiry.delete(instanceId);
      return null;
    }

    return this.configCache.get(instanceId) || null;
  }

  private updateCache(instanceId: string, config: NotificationConfig): void {
    const existing = this.configCache.get(instanceId) || {};
    this.configCache.set(instanceId, { ...existing, ...config });
    this.cacheExpiry.set(instanceId, Date.now() + this.cacheTTL);
  }

  private invalidateCache(instanceId: string): void {
    this.configCache.delete(instanceId);
    this.cacheExpiry.delete(instanceId);
  }

  private triggerReload(instanceId: string): void {
    this.reloadCallbacks.forEach(callback => {
      try {
        callback(instanceId);
      } catch (error) {
        console.error('[Config Service] Error in reload callback:', error);
      }
    });
  }
}

// Singleton instance
let configServiceInstance: NotificationConfigService | null = null;

export function getNotificationConfigService(db?: DatabasePool): NotificationConfigService {
  if (!configServiceInstance) {
    if (!db) {
      throw new Error('DatabasePool is required to initialize NotificationConfigService');
    }
    configServiceInstance = new NotificationConfigService(db);
  }
  return configServiceInstance;
}

export function setNotificationConfigService(service: NotificationConfigService): void {
  configServiceInstance = service;
}
