/**
 * Text Queries
 * Handles custom text and message text queries
 * Based on Zitadel Go internal/query/custom_text.go and message_text.go
 */

import { DatabasePool } from '../../database';
import { CustomText, MessageText, MessageTextType } from './text-types';

export class TextQueries {
  constructor(private readonly database: DatabasePool) {}

  // ===== Custom Text Methods =====

  /**
   * Get custom texts by template
   * Returns all custom texts for a specific template (e.g., "Login")
   * 
   * @param instanceID - Instance ID
   * @param language - Language code (e.g., "en", "de")
   * @param template - Template name
   * @returns Array of custom texts
   */
  async getCustomTextsByTemplate(
    instanceID: string,
    language: string,
    template: string
  ): Promise<CustomText[]> {
    const query = `
      SELECT 
        aggregate_id,
        instance_id,
        creation_date,
        change_date,
        sequence,
        language,
        template,
        key,
        text,
        is_default
      FROM projections.custom_texts
      WHERE instance_id = $1 AND language = $2 AND template = $3
      ORDER BY key
    `;

    const result = await this.database.query(query, [instanceID, language, template]);
    return result.rows.map(row => this.mapToCustomText(row));
  }

  /**
   * Get default login texts
   * Returns built-in default texts for login template
   * 
   * @param language - Language code
   * @returns Array of default login texts
   */
  getDefaultLoginTexts(language: string = 'en'): CustomText[] {
    const defaults = [
      { key: 'title', text: 'Login' },
      { key: 'description', text: 'Enter your credentials to sign in' },
      { key: 'usernameLabel', text: 'Username or Email' },
      { key: 'passwordLabel', text: 'Password' },
      { key: 'loginButton', text: 'Sign In' },
      { key: 'registerLink', text: 'Create account' },
      { key: 'forgotPasswordLink', text: 'Forgot password?' },
    ];

    return defaults.map(({ key, text }) => ({
      aggregateID: 'default',
      instanceID: 'default',
      creationDate: new Date(),
      changeDate: new Date(),
      sequence: 0,
      language,
      template: 'Login',
      key,
      text,
      isDefault: true,
    }));
  }

  // ===== Message Text Methods =====

  /**
   * Get custom message text
   * Returns custom message text for a specific message type
   * 
   * @param instanceID - Instance ID
   * @param messageType - Message type (e.g., "InitCode", "PasswordReset")
   * @param language - Language code
   * @returns Message text or null
   */
  async getCustomMessageText(
    instanceID: string,
    messageType: MessageTextType,
    language: string
  ): Promise<MessageText | null> {
    const query = `
      SELECT 
        aggregate_id,
        instance_id,
        creation_date,
        change_date,
        sequence,
        message_type,
        language,
        title,
        pre_header,
        subject,
        greeting,
        text,
        button_text,
        footer_text,
        is_default
      FROM projections.message_texts
      WHERE instance_id = $1 AND message_type = $2 AND language = $3
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, messageType, language]);

    if (!result) {
      // Return default message text
      return this.getDefaultMessageText(messageType, language);
    }

    return this.mapToMessageText(result);
  }

  /**
   * Get default message text
   * Returns built-in default message text
   * 
   * @param messageType - Message type
   * @param language - Language code
   * @returns Default message text
   */
  getDefaultMessageText(
    messageType: MessageTextType,
    language: string = 'en'
  ): MessageText {
    const defaults: Record<MessageTextType, Partial<MessageText>> = {
      InitCode: {
        title: 'Initialize Your Account',
        subject: 'Initialize Account',
        greeting: 'Hello',
        text: 'Use this code to initialize your account: {{.Code}}',
        buttonText: 'Initialize Account',
      },
      PasswordReset: {
        title: 'Reset Your Password',
        subject: 'Password Reset',
        greeting: 'Hello',
        text: 'Click the button below to reset your password',
        buttonText: 'Reset Password',
      },
      VerifyEmail: {
        title: 'Verify Your Email',
        subject: 'Email Verification',
        greeting: 'Hello',
        text: 'Please verify your email address by clicking the button below',
        buttonText: 'Verify Email',
      },
      VerifyPhone: {
        title: 'Verify Your Phone',
        subject: 'Phone Verification',
        greeting: 'Hello',
        text: 'Use this code to verify your phone: {{.Code}}',
        buttonText: 'Verify Phone',
      },
      DomainClaimed: {
        title: 'Domain Claimed',
        subject: 'Domain Claimed',
        greeting: 'Hello',
        text: 'Your domain has been claimed and is ready to use',
        buttonText: 'Go to Dashboard',
      },
      PasswordChange: {
        title: 'Password Changed',
        subject: 'Password Change Notification',
        greeting: 'Hello',
        text: 'Your password has been successfully changed',
        buttonText: 'Go to Dashboard',
      },
    };

    const defaultData = defaults[messageType] || defaults.InitCode;

    return {
      aggregateID: 'default',
      instanceID: 'default',
      creationDate: new Date(),
      changeDate: new Date(),
      sequence: 0,
      messageType,
      language,
      title: defaultData.title || '',
      preHeader: '',
      subject: defaultData.subject || '',
      greeting: defaultData.greeting || 'Hello',
      text: defaultData.text || '',
      buttonText: defaultData.buttonText || '',
      footerText: 'Powered by Zitadel',
      isDefault: true,
    };
  }

  /**
   * List all message text types
   * Returns available message types
   * 
   * @returns Array of message types
   */
  listMessageTextTypes(): MessageTextType[] {
    return ['InitCode', 'PasswordReset', 'VerifyEmail', 'VerifyPhone', 'DomainClaimed', 'PasswordChange'];
  }

  /**
   * Get all message texts for an instance
   * Returns all configured message texts
   * 
   * @param instanceID - Instance ID
   * @param language - Language code
   * @returns Array of message texts
   */
  async getAllMessageTexts(
    instanceID: string,
    language: string
  ): Promise<MessageText[]> {
    const query = `
      SELECT 
        aggregate_id,
        instance_id,
        creation_date,
        change_date,
        sequence,
        message_type,
        language,
        title,
        pre_header,
        subject,
        greeting,
        text,
        button_text,
        footer_text,
        is_default
      FROM projections.message_texts
      WHERE instance_id = $1 AND language = $2
      ORDER BY message_type
    `;

    const result = await this.database.query(query, [instanceID, language]);
    return result.rows.map(row => this.mapToMessageText(row));
  }

  // ===== Private Helper Methods =====

  private mapToCustomText(row: any): CustomText {
    return {
      aggregateID: row.aggregate_id,
      instanceID: row.instance_id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
      language: row.language,
      template: row.template,
      key: row.key,
      text: row.text || '',
      isDefault: row.is_default || false,
    };
  }

  private mapToMessageText(row: any): MessageText {
    return {
      aggregateID: row.aggregate_id,
      instanceID: row.instance_id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
      messageType: row.message_type,
      language: row.language,
      title: row.title || '',
      preHeader: row.pre_header || '',
      subject: row.subject || '',
      greeting: row.greeting || 'Hello',
      text: row.text || '',
      buttonText: row.button_text || '',
      footerText: row.footer_text || '',
      isDefault: row.is_default || false,
    };
  }
}
