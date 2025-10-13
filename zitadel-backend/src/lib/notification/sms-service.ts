/**
 * SMS Service
 * Based on Zitadel Go: internal/notification/senders/sms.go
 */

/**
 * SMS Metadata for tracking and multi-tenancy
 * Based on Zitadel Go: internal/notification/messages/sms.go
 */
export interface SMSMetadata {
  instanceID?: string;      // Multi-tenant instance ID
  jobID?: string;           // Notification job ID
  userID?: string;          // Target user ID
  verificationID?: string;  // Twilio verification SID
}

export interface VerificationResult {
  messageId?: string;
  verificationId?: string;
  status?: string;
}

export interface SMSProvider {
  name: string;
  sendSMS(to: string, message: string, metadata?: SMSMetadata): Promise<{ messageId: string }>;
  sendVerification?(to: string, channel?: 'sms' | 'call' | 'email', metadata?: SMSMetadata): Promise<VerificationResult>;
}

/**
 * Twilio SMS Provider
 * Supports both Messages API and Verify API
 */
export class TwilioSMSProvider implements SMSProvider {
  name = 'twilio';
  private client: any;
  private verifyServiceSid?: string;

  constructor(
    private accountSid: string,
    private authToken: string,
    private fromNumber: string,
    verifyServiceSid?: string
  ) {
    this.verifyServiceSid = verifyServiceSid;
    // Lazy load Twilio SDK
    try {
      const twilio = require('twilio');
      this.client = twilio(this.accountSid, this.authToken);
    } catch (error) {
      console.warn('Twilio SDK not installed. Install with: npm install twilio');
    }
  }

  async sendSMS(to: string, message: string, metadata?: SMSMetadata): Promise<{ messageId: string }> {
    if (!this.client) {
      throw new Error('Twilio client not initialized. Install twilio package.');
    }

    // Log metadata for tracking
    if (metadata) {
      console.log('[Twilio SMS] Sending with metadata:', {
        to,
        instanceID: metadata.instanceID,
        jobID: metadata.jobID,
        userID: metadata.userID,
      });
    }

    const result = await this.client.messages.create({
      body: message,
      from: this.fromNumber,
      to,
    });

    return { messageId: result.sid };
  }

  /**
   * Send verification using Twilio Verify API
   * More reliable and cost-effective than Messages API for OTP
   * Supports SMS, Call, and Email channels
   * Based on Zitadel Go: internal/notification/channels/twilio/channel.go:30-58
   */
  async sendVerification(
    to: string,
    channel: 'sms' | 'call' | 'email' = 'sms',
    metadata?: SMSMetadata
  ): Promise<VerificationResult> {
    if (!this.client) {
      throw new Error('Twilio client not initialized. Install twilio package.');
    }

    if (!this.verifyServiceSid) {
      throw new Error('Twilio Verify Service SID not configured. Falling back to Messages API.');
    }

    // Log metadata for tracking
    if (metadata) {
      console.log('[Twilio Verify] Sending with metadata:', {
        to,
        channel,
        instanceID: metadata.instanceID,
        jobID: metadata.jobID,
        userID: metadata.userID,
      });
    }

    try {
      const verification = await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verifications.create({ to, channel });

      const result: VerificationResult = {
        verificationId: verification.sid,
        status: verification.status,
      };

      // Store verification ID in metadata if provided
      if (metadata) {
        metadata.verificationID = verification.sid;
      }

      return result;
    } catch (error: any) {
      // Handle 4xx errors as non-retryable (like Zitadel Go)
      if (error.status >= 400 && error.status < 500) {
        console.warn('[Twilio Verify] Client error:', {
          status: error.status,
          code: error.code,
          message: error.message,
          instanceID: metadata?.instanceID,
          jobID: metadata?.jobID,
          userID: metadata?.userID,
        });
        throw new Error(`Twilio Verify error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Check if Verify API is configured
   */
  hasVerifyAPI(): boolean {
    return !!this.verifyServiceSid;
  }
}

/**
 * Mock SMS Provider for testing
 */
export class MockSMSProvider implements SMSProvider {
  name = 'mock';
  public sentMessages: Array<{ 
    to: string; 
    message: string; 
    metadata?: SMSMetadata;
    timestamp: Date;
  }> = [];
  public sentVerifications: Array<{ 
    to: string; 
    channel: string; 
    metadata?: SMSMetadata;
    timestamp: Date;
  }> = [];

  async sendSMS(to: string, message: string, metadata?: SMSMetadata): Promise<{ messageId: string }> {
    const messageId = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Clone metadata to avoid reference issues
    const clonedMetadata = metadata ? { ...metadata } : undefined;
    
    this.sentMessages.push({
      to,
      message,
      metadata: clonedMetadata,
      timestamp: new Date(),
    });

    const metadataInfo = metadata 
      ? ` [Instance: ${metadata.instanceID}, Job: ${metadata.jobID}, User: ${metadata.userID}]`
      : '';
    console.log(`[MOCK SMS] To: ${to}, Message: ${message}${metadataInfo}`);
    
    return { messageId };
  }

  async sendVerification(to: string, channel: 'sms' | 'call' | 'email' = 'sms', metadata?: SMSMetadata): Promise<VerificationResult> {
    const verificationId = `mock_verify_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Update metadata with verification ID (create if doesn't exist)
    const updatedMetadata: SMSMetadata = metadata 
      ? { ...metadata, verificationID: verificationId }
      : { verificationID: verificationId };
    
    this.sentVerifications.push({
      to,
      channel,
      metadata: updatedMetadata,
      timestamp: new Date(),
    });

    const metadataInfo = metadata
      ? ` [Instance: ${metadata.instanceID}, Job: ${metadata.jobID}, User: ${metadata.userID}]`
      : '';
    console.log(`[MOCK SMS VERIFY] To: ${to}, Channel: ${channel}${metadataInfo}`);
    
    return {
      verificationId,
      status: 'pending',
    };
  }

  getLastMessage() {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  getLastVerification() {
    return this.sentVerifications[this.sentVerifications.length - 1];
  }

  clearMessages() {
    this.sentMessages = [];
    this.sentVerifications = [];
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
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    if (accountSid && authToken && fromNumber) {
      return new TwilioSMSProvider(accountSid, authToken, fromNumber, verifyServiceSid);
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
