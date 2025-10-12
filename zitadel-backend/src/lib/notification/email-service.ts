/**
 * Email Service
 * Based on Zitadel Go: internal/notification/channels/email.go
 */

export interface EmailProvider {
  name: string;
  sendEmail(to: string, subject: string, body: string, html?: string): Promise<{ messageId: string }>;
}

/**
 * Mock Email Provider for testing
 */
export class MockEmailProvider implements EmailProvider {
  name = 'mock';
  public sentEmails: Array<{
    to: string;
    subject: string;
    body: string;
    html?: string;
    timestamp: Date;
  }> = [];

  async sendEmail(
    to: string,
    subject: string,
    body: string,
    html?: string
  ): Promise<{ messageId: string }> {
    const messageId = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    this.sentEmails.push({
      to,
      subject,
      body,
      html,
      timestamp: new Date(),
    });

    console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}`);

    return { messageId };
  }

  getLastEmail() {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  clearEmails() {
    this.sentEmails = [];
  }
}

/**
 * Email Service (abstraction over providers)
 */
export class EmailService {
  private provider: EmailProvider;

  constructor(provider?: EmailProvider) {
    if (provider) {
      this.provider = provider;
    } else {
      this.provider = this.createDefaultProvider();
    }
  }

  private createDefaultProvider(): EmailProvider {
    // For now, use mock (can be extended with SendGrid, AWS SES, etc.)
    console.log('[EMAIL] Using mock provider');
    return new MockEmailProvider();
  }

  async sendVerificationCode(
    email: string,
    code: string,
    urlTemplate?: string
  ): Promise<void> {
    const subject = 'Verify your email address';
    const body = `Your verification code is: ${code}\n\nThis code will expire in 10 minutes.`;
    
    let html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Verify your email address</h2>
        <p>Your verification code is:</p>
        <h1 style="color: #4CAF50; letter-spacing: 5px;">${code}</h1>
        <p>This code will expire in 10 minutes.</p>
      </div>
    `;

    if (urlTemplate) {
      const verifyUrl = urlTemplate.replace('{{.Code}}', code);
      html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Verify your email address</h2>
          <p>Click the link below to verify your email:</p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
          <p>Or use this code: <strong>${code}</strong></p>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `;
    }

    await this.provider.sendEmail(email, subject, body, html);
  }

  getProvider(): EmailProvider {
    return this.provider;
  }
}

// Singleton instance
let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

export function setEmailService(service: EmailService): void {
  emailServiceInstance = service;
}
