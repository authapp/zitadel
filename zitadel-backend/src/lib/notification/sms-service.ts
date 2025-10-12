/**
 * SMS Service
 * Based on Zitadel Go: internal/notification/senders/sms.go
 */

export interface SMSProvider {
  name: string;
  sendSMS(to: string, message: string): Promise<{ messageId: string }>;
}

/**
 * Twilio SMS Provider
 */
export class TwilioSMSProvider implements SMSProvider {
  name = 'twilio';
  private client: any;

  constructor(
    private accountSid: string,
    private authToken: string,
    private fromNumber: string
  ) {
    // Lazy load Twilio SDK
    try {
      const twilio = require('twilio');
      this.client = twilio(this.accountSid, this.authToken);
    } catch (error) {
      console.warn('Twilio SDK not installed. Install with: npm install twilio');
    }
  }

  async sendSMS(to: string, message: string): Promise<{ messageId: string }> {
    if (!this.client) {
      throw new Error('Twilio client not initialized. Install twilio package.');
    }

    const result = await this.client.messages.create({
      body: message,
      from: this.fromNumber,
      to,
    });

    return { messageId: result.sid };
  }
}

/**
 * Mock SMS Provider for testing
 */
export class MockSMSProvider implements SMSProvider {
  name = 'mock';
  public sentMessages: Array<{ to: string; message: string; timestamp: Date }> = [];

  async sendSMS(to: string, message: string): Promise<{ messageId: string }> {
    const messageId = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    this.sentMessages.push({
      to,
      message,
      timestamp: new Date(),
    });

    console.log(`[MOCK SMS] To: ${to}, Message: ${message}`);
    
    return { messageId };
  }

  getLastMessage() {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  clearMessages() {
    this.sentMessages = [];
  }
}

/**
 * SMS Service (abstraction over providers)
 */
export class SMSService {
  private provider: SMSProvider;

  constructor(provider?: SMSProvider) {
    if (provider) {
      this.provider = provider;
    } else {
      // Auto-configure based on environment
      this.provider = this.createDefaultProvider();
    }
  }

  private createDefaultProvider(): SMSProvider {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && fromNumber) {
      return new TwilioSMSProvider(accountSid, authToken, fromNumber);
    }

    // Default to mock in development
    console.log('[SMS] Using mock provider (set TWILIO_* env vars for real SMS)');
    return new MockSMSProvider();
  }

  async sendVerificationCode(phone: string, code: string): Promise<void> {
    const message = `Your verification code is: ${code}. Valid for 10 minutes.`;
    await this.provider.sendSMS(phone, message);
  }

  getProvider(): SMSProvider {
    return this.provider;
  }
}

// Singleton instance
let smsServiceInstance: SMSService | null = null;

export function getSMSService(): SMSService {
  if (!smsServiceInstance) {
    smsServiceInstance = new SMSService();
  }
  return smsServiceInstance;
}

export function setSMSService(service: SMSService): void {
  smsServiceInstance = service;
}
