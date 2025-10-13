/**
 * SMTP Email Service
 * Based on Zitadel Go: internal/notification/channels/smtp/
 * 
 * Supports any SMTP provider: Gmail, SendGrid, AWS SES, Mailgun, etc.
 */

import * as nodemailer from 'nodemailer';
import { EmailProvider } from './email-service';

export interface SMTPConfig {
  host: string;           // e.g., smtp.gmail.com, smtp.sendgrid.net
  port: number;           // 587 (TLS), 465 (SSL), 25 (plain)
  secure: boolean;        // true for 465, false for other ports (uses STARTTLS)
  auth?: {
    user: string;         // SMTP username
    pass: string;         // SMTP password or API key
  };
  from: string;           // Sender email (e.g., noreply@yourdomain.com)
  fromName: string;       // Sender name (e.g., "Your App")
  replyTo?: string;       // Reply-to address
  enableTlsFallback?: boolean; // Auto-fallback to different TLS methods (default: false)
}

/**
 * SMTP Email Provider using nodemailer
 * Compatible with all major email services
 */
export class SMTPEmailProvider implements EmailProvider {
  name = 'smtp';
  private transporter: nodemailer.Transporter;
  private config: SMTPConfig;

  constructor(config: SMTPConfig) {
    this.config = config;
    this.transporter = this.createTransporter(config);
  }

  private createTransporter(config: SMTPConfig): nodemailer.Transporter {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure, // true for 465 (SSL), false for 587 (STARTTLS)
      auth: config.auth ? {
        user: config.auth.user,
        pass: config.auth.pass,
      } : undefined,
      // Enable TLS fallback options
      tls: {
        // Allow fallback to less secure TLS if needed
        rejectUnauthorized: true,
      },
    });
  }

  async sendEmail(
    to: string | string[],
    subject: string,
    body: string,
    html?: string,
    cc?: string[],
    bcc?: string[]
  ): Promise<{ messageId: string }> {
    // Try with TLS fallback if enabled
    if (this.config.enableTlsFallback) {
      return await this.sendWithTlsFallback(to, subject, body, html, cc, bcc);
    }

    return await this.sendEmailDirect(to, subject, body, html, cc, bcc);
  }

  private async sendEmailDirect(
    to: string | string[],
    subject: string,
    body: string,
    html?: string,
    cc?: string[],
    bcc?: string[]
  ): Promise<{ messageId: string }> {
    const mailOptions: any = {
      from: this.config.fromName
        ? `"${this.config.fromName}" <${this.config.from}>`
        : this.config.from,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      text: body,
      html: html || body,
      replyTo: this.config.replyTo,
    };

    // Add CC if provided
    if (cc && cc.length > 0) {
      mailOptions.cc = cc.join(', ');
    }

    // Add BCC if provided
    if (bcc && bcc.length > 0) {
      mailOptions.bcc = bcc.join(', ');
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      return { messageId: info.messageId };
    } catch (error) {
      console.error('[SMTP] Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send email with automatic TLS fallback
   * Tries: TLS (465) -> STARTTLS (587) -> Plain (25)
   * Based on Zitadel Go: internal/notification/channels/smtp/channel.go
   */
  private async sendWithTlsFallback(
    to: string | string[],
    subject: string,
    body: string,
    html?: string,
    cc?: string[],
    bcc?: string[]
  ): Promise<{ messageId: string }> {
    const fallbackConfigs = this.getTlsFallbackConfigs();
    const errors: string[] = [];

    for (let i = 0; i < fallbackConfigs.length; i++) {
      const fallbackConfig = fallbackConfigs[i];
      
      try {
        console.log(`[SMTP TLS Fallback] Attempting ${fallbackConfig.name}...`);
        
        // Create temporary transporter with fallback config
        const tempTransporter = this.createTransporter(fallbackConfig.config);
        
        const mailOptions: any = {
          from: this.config.fromName 
            ? `"${this.config.fromName}" <${this.config.from}>`
            : this.config.from,
          to: Array.isArray(to) ? to.join(', ') : to,
          subject,
          text: body,
          html,
          cc: cc?.join(', '),
          bcc: bcc?.join(', '),
          replyTo: this.config.replyTo,
        };

        const info = await tempTransporter.sendMail(mailOptions);
        
        console.log(`[SMTP TLS Fallback] Success with ${fallbackConfig.name}`);
        
        // Update main transporter to use successful config
        this.transporter = tempTransporter;
        this.config = { ...this.config, ...fallbackConfig.config };
        
        return { messageId: info.messageId };
      } catch (error: any) {
        errors.push(`${fallbackConfig.name}: ${error.message}`);
        console.warn(`[SMTP TLS Fallback] ${fallbackConfig.name} failed:`, error.message);
        
        // If this is the last config, throw
        if (i === fallbackConfigs.length - 1) {
          throw new Error(
            `All SMTP connection methods failed. Errors: ${errors.join('; ')}`
          );
        }
      }
    }

    throw new Error('SMTP TLS fallback failed unexpectedly');
  }

  /**
   * Get fallback configurations in order of preference
   */
  private getTlsFallbackConfigs(): Array<{ name: string; config: SMTPConfig }> {
    const configs: Array<{ name: string; config: SMTPConfig }> = [];

    // 1. Try TLS (port 465) if not already using it
    if (this.config.port !== 465) {
      configs.push({
        name: 'TLS (port 465)',
        config: {
          ...this.config,
          port: 465,
          secure: true,
          enableTlsFallback: false, // Prevent recursive fallback
        },
      });
    }

    // 2. Try STARTTLS (port 587) if not already using it
    if (this.config.port !== 587) {
      configs.push({
        name: 'STARTTLS (port 587)',
        config: {
          ...this.config,
          port: 587,
          secure: false,
          enableTlsFallback: false,
        },
      });
    }

    // 3. Try plain (port 25) as last resort
    if (this.config.port !== 25) {
      configs.push({
        name: 'Plain (port 25)',
        config: {
          ...this.config,
          port: 25,
          secure: false,
          enableTlsFallback: false,
        },
      });
    }

    // Always try the original config first
    configs.unshift({
      name: `Original (port ${this.config.port})`,
      config: {
        ...this.config,
        enableTlsFallback: false,
      },
    });

    return configs;
  }

  /**
   * Verify SMTP connection (like Zitadel's TestConfiguration)
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('[SMTP] Connection verification failed:', error);
      return false;
    }
  }
}

/**
 * Pre-configured SMTP configs for popular providers
 * Based on common Zitadel deployments
 */
export const SMTP_PRESETS = {
  /**
   * Gmail SMTP
   * Note: Requires "App Password" (not regular password)
   * https://support.google.com/accounts/answer/185833
   */
  gmail: (email: string, appPassword: string): SMTPConfig => ({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: email, pass: appPassword },
    from: email,
    fromName: 'Zitadel',
  }),

  /**
   * SendGrid SMTP
   * API Key as password
   */
  sendgrid: (apiKey: string, fromEmail: string): SMTPConfig => ({
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    auth: { user: 'apikey', pass: apiKey },
    from: fromEmail,
    fromName: 'Zitadel',
  }),

  /**
   * AWS SES SMTP
   * Requires SMTP credentials (not IAM credentials)
   */
  awsSES: (smtpUser: string, smtpPassword: string, region: string, fromEmail: string): SMTPConfig => ({
    host: `email-smtp.${region}.amazonaws.com`,
    port: 587,
    secure: false,
    auth: { user: smtpUser, pass: smtpPassword },
    from: fromEmail,
    fromName: 'Zitadel',
  }),

  /**
   * Mailgun SMTP
   */
  mailgun: (domain: string, apiKey: string, fromEmail: string): SMTPConfig => ({
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false,
    auth: { user: `postmaster@${domain}`, pass: apiKey },
    from: fromEmail,
    fromName: 'Zitadel',
  }),

  /**
   * Custom SMTP server
   */
  custom: (config: SMTPConfig): SMTPConfig => config,
};

/**
 * Create SMTP provider from environment variables
 * Matches Zitadel's configuration approach
 */
export function createSMTPProviderFromEnv(): SMTPEmailProvider | null {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  const fromName = process.env.SMTP_FROM_NAME || 'Zitadel';
  const secure = process.env.SMTP_SECURE === 'true';
  const replyTo = process.env.SMTP_REPLY_TO;

  if (!host || !from) {
    return null;
  }

  const config: SMTPConfig = {
    host,
    port,
    secure,
    from,
    fromName,
    replyTo,
  };

  // Add auth if credentials provided
  if (user && pass) {
    config.auth = { user, pass };
  }

  return new SMTPEmailProvider(config);
}
