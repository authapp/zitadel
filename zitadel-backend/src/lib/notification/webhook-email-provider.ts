/**
 * Webhook Email Provider
 * Sends emails via HTTP callback to external service
 * Based on Zitadel Go: internal/notification/channels/webhook/channel.go
 */

import { EmailProvider } from './email-service';

export interface WebhookConfig {
  url: string;                    // Webhook endpoint URL
  method?: 'POST' | 'PUT';       // HTTP method (default: POST)
  headers?: Record<string, string>; // Custom headers
  timeout?: number;               // Request timeout in ms (default: 30000)
  retries?: number;               // Number of retries (default: 0)
}

export interface WebhookEmailPayload {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Webhook Email Provider
 * Sends email data to external webhook endpoint
 */
export class WebhookEmailProvider implements EmailProvider {
  name = 'webhook';
  private config: WebhookConfig;

  constructor(config: WebhookConfig) {
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

  async sendEmail(
    to: string | string[],
    subject: string,
    body: string,
    html?: string,
    cc?: string[],
    bcc?: string[]
  ): Promise<{ messageId: string }> {
    const payload: WebhookEmailPayload = {
      to,
      subject,
      body,
      html,
      cc,
      bcc,
      timestamp: new Date().toISOString(),
    };

    const messageId = `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Use retry logic if configured
    if (this.config.retries && this.config.retries > 0) {
      return await this.sendWithRetry(payload, messageId, this.config.retries);
    }

    // No retries configured, single attempt
    await this.sendWebhook(payload, messageId);
    return { messageId };
  }

  private async sendWebhook(payload: WebhookEmailPayload, messageId: string): Promise<void> {
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

      console.log(`[Webhook Email] Sent successfully: ${messageId} to ${this.config.url}`);
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
    payload: WebhookEmailPayload,
    messageId: string,
    retriesLeft: number
  ): Promise<{ messageId: string }> {
    for (let attempt = 0; attempt <= retriesLeft; attempt++) {
      try {
        await this.sendWebhook(payload, messageId);
        if (attempt > 0) {
          console.log(`[Webhook Email] Succeeded on retry ${attempt}`);
        }
        return { messageId };
      } catch (error: any) {
        if (attempt === retriesLeft) {
          console.error(`[Webhook Email] Failed after ${retriesLeft + 1} attempts:`, error.message);
          throw error;
        }
        
        // Exponential backoff
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.warn(`[Webhook Email] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw new Error('Webhook send failed after all retries');
  }
}

/**
 * Create webhook provider from environment variables
 */
export function createWebhookProviderFromEnv(): WebhookEmailProvider | null {
  const url = process.env.WEBHOOK_EMAIL_URL;
  
  if (!url) {
    return null;
  }

  const config: WebhookConfig = {
    url,
    method: (process.env.WEBHOOK_EMAIL_METHOD as 'POST' | 'PUT') || 'POST',
    timeout: process.env.WEBHOOK_EMAIL_TIMEOUT 
      ? parseInt(process.env.WEBHOOK_EMAIL_TIMEOUT, 10) 
      : 30000,
    retries: process.env.WEBHOOK_EMAIL_RETRIES
      ? parseInt(process.env.WEBHOOK_EMAIL_RETRIES, 10)
      : 0,
  };

  // Parse custom headers if provided (JSON format)
  if (process.env.WEBHOOK_EMAIL_HEADERS) {
    try {
      config.headers = JSON.parse(process.env.WEBHOOK_EMAIL_HEADERS);
    } catch (error) {
      console.warn('[Webhook Email] Failed to parse WEBHOOK_EMAIL_HEADERS, ignoring');
    }
  }

  return new WebhookEmailProvider(config);
}
