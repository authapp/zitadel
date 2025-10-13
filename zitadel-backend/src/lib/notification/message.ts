/**
 * Notification Message Interface
 * Based on Zitadel Go: internal/notification/messages/message.go
 */

/**
 * Base Message interface
 * Defines the contract for all notification messages
 */
export interface Message {
  /**
   * Get the content of the message
   * Returns the formatted message content ready for sending
   */
  getContent(): string;

  /**
   * Get the subject of the message (for emails)
   */
  getSubject?(): string;

  /**
   * Get the recipient of the message
   */
  getRecipient(): string;

  /**
   * Get message metadata
   */
  getMetadata?(): MessageMetadata | undefined;
}

/**
 * Message metadata for tracking and multi-tenancy
 */
export interface MessageMetadata {
  instanceID?: string;
  jobID?: string;
  userID?: string;
  messageID?: string;
  eventID?: string;
  aggregateID?: string;
}

/**
 * Email Message implementation
 */
export class EmailMessage implements Message {
  constructor(
    private recipient: string,
    private subject: string,
    private content: string,
    private htmlContent?: string,
    private metadata?: MessageMetadata,
    private cc?: string[],
    private bcc?: string[]
  ) {}

  getContent(): string {
    return this.content;
  }

  getSubject(): string {
    return this.subject;
  }

  getRecipient(): string {
    return this.recipient;
  }

  getMetadata(): MessageMetadata | undefined {
    return this.metadata;
  }

  getHtmlContent(): string | undefined {
    return this.htmlContent;
  }

  getCc(): string[] | undefined {
    return this.cc;
  }

  getBcc(): string[] | undefined {
    return this.bcc;
  }

  /**
   * Get all recipients (to + cc + bcc)
   */
  getAllRecipients(): string[] {
    return [
      this.recipient,
      ...(this.cc || []),
      ...(this.bcc || []),
    ];
  }
}

/**
 * SMS Message implementation
 */
export class SMSMessage implements Message {
  constructor(
    private recipient: string,
    private content: string,
    private metadata?: MessageMetadata
  ) {}

  getContent(): string {
    return this.content;
  }

  getRecipient(): string {
    return this.recipient;
  }

  getMetadata(): MessageMetadata | undefined {
    return this.metadata;
  }
}

/**
 * Verification Message implementation
 * For OTP and verification codes
 */
export class VerificationMessage implements Message {
  constructor(
    private recipient: string,
    private channel: 'sms' | 'call' | 'email',
    private metadata?: MessageMetadata
  ) {}

  getContent(): string {
    // For verification, Twilio generates the code
    return `Verification request for ${this.recipient} via ${this.channel}`;
  }

  getRecipient(): string {
    return this.recipient;
  }

  getChannel(): 'sms' | 'call' | 'email' {
    return this.channel;
  }

  getMetadata(): MessageMetadata | undefined {
    return this.metadata;
  }
}

/**
 * Message builder for creating structured messages
 */
export class MessageBuilder {
  /**
   * Create an email message
   */
  static createEmail(
    to: string,
    subject: string,
    content: string,
    options?: {
      html?: string;
      cc?: string[];
      bcc?: string[];
      metadata?: MessageMetadata;
    }
  ): EmailMessage {
    return new EmailMessage(
      to,
      subject,
      content,
      options?.html,
      options?.metadata,
      options?.cc,
      options?.bcc
    );
  }

  /**
   * Create an SMS message
   */
  static createSMS(
    to: string,
    content: string,
    metadata?: MessageMetadata
  ): SMSMessage {
    return new SMSMessage(to, content, metadata);
  }

  /**
   * Create a verification message
   */
  static createVerification(
    to: string,
    channel: 'sms' | 'call' | 'email',
    metadata?: MessageMetadata
  ): VerificationMessage {
    return new VerificationMessage(to, channel, metadata);
  }
}
