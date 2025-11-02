/**
 * Webhook SMS Provider
 * Sends SMS via HTTP callback to external service
 * Based on Zitadel Go: internal/notification/channels/webhook/channel.go
 */

import { SMSProvider, SMSMetadata } from './sms-service';

export interface WebhookSMSConfig {
  url: string;                    // Webhook endpoint URL
  method?: 'POST' | 'PUT';       // HTTP method (default: POST)
  headers?: Record<string, string>; // Custom headers
  timeout?: number;               // Request timeout in ms (default: 30000)
  retries?: number;               // Number of retries (default: 0)
}

export interface WebhookSMSPayload {
  to: string;
  message: string;
  metadata?: SMSMetadata;
  timestamp: string;
}

/**
 * Webhook SMS Provider
 * Sends SMS data to external webhook endpoint
 */
export class WebhookSMSProvider implements SMSProvider {
  name = 'webhook';
  private config: WebhookSMSConfig;

  constructor(config: WebhookSMSConfig) {
    if (!config.url) {
      throw new Error('Webhook URL is required');
    }
    
    this.config = {
      method: 'POST',
      timeout: 30000,
      retries: 0,
      ...config,
    };
  }

  async sendSMS(to: string, message: string, metadata?: SMSMetadata): Promise<{ messageId: string }> {
    const payload: WebhookSMSPayload = {
      to,
      message,
      metadata,
      timestamp: new Date().toISOString(),
    };

    const messageId = `webhook_sms_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Use retry logic if configured
    if (this.config.retries && this.config.retries > 0) {
      return await this.sendWithRetry(payload, messageId, this.config.retries);
    }

    // No retries configured, single attempt
    await this.sendWebhook(payload, messageId);
    return { messageId };
  }

  private async sendWebhook(payload: WebhookSMSPayload, messageId: string): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.url, {
        method: this.config.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Message-ID': messageId,
          ...this.config.headers,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Webhook request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      console.log(`[Webhook SMS] Sent successfully: ${messageId} to ${this.config.url}`);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Webhook request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async sendWithRetry(
    payload: WebhookSMSPayload,
    messageId: string,
    retriesLeft: number
  ): Promise<{ messageId: string }> {
    for (let attempt = 0; attempt <= retriesLeft; attempt++) {
      try {
        await this.sendWebhook(payload, messageId);
        if (attempt > 0) {
          console.log(`[Webhook SMS] Succeeded on retry ${attempt}`);
        }
        return { messageId };
      } catch (error: any) {
        if (attempt === retriesLeft) {
          console.error(`[Webhook SMS] Failed after ${retriesLeft + 1} attempts:`, error.message);
          throw error;
        }
        
        // Exponential backoff
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.warn(`[Webhook SMS] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`);
        await new Promise(resolve => {
          const timer = setTimeout(resolve, delayMs);
          timer.unref(); // Allow process to exit if this is the only thing keeping it alive
        });
      }
    }

    throw new Error('Webhook SMS send failed after all retries');
  }
}

/**
 * Create webhook provider from environment variables
 */
export function createWebhookSMSProviderFromEnv(): WebhookSMSProvider | null {
  const url = process.env.WEBHOOK_SMS_URL;
  
  if (!url) {
    return null;
  }

  const config: WebhookSMSConfig = {
    url,
    method: (process.env.WEBHOOK_SMS_METHOD as 'POST' | 'PUT') || 'POST',
    timeout: process.env.WEBHOOK_SMS_TIMEOUT 
      ? parseInt(process.env.WEBHOOK_SMS_TIMEOUT, 10) 
      : 30000,
    retries: process.env.WEBHOOK_SMS_RETRIES
      ? parseInt(process.env.WEBHOOK_SMS_RETRIES, 10)
      : 0,
  };

  // Parse custom headers if provided (JSON format)
  if (process.env.WEBHOOK_SMS_HEADERS) {
    try {
      config.headers = JSON.parse(process.env.WEBHOOK_SMS_HEADERS);
    } catch (error) {
      console.warn('[Webhook SMS] Failed to parse WEBHOOK_SMS_HEADERS, ignoring');
    }
  }

  return new WebhookSMSProvider(config);
}
