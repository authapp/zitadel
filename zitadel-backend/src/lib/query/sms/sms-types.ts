/**
 * SMS Configuration Types
 * SMS delivery configuration
 * Based on Zitadel Go internal/query/sms.go (simplified)
 */

/**
 * SMS Config State
 */
export enum SMSConfigState {
  UNSPECIFIED = 0,
  INACTIVE = 1,
  ACTIVE = 2,
}

/**
 * SMS Provider Type
 */
export enum SMSProviderType {
  TWILIO = 'twilio',
  HTTP = 'http',
}

/**
 * SMS Configuration
 * Core SMS delivery settings
 */
export interface SMSConfig {
  id: string;
  instanceID: string;
  resourceOwner: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  
  // Config details
  description: string;
  state: SMSConfigState;
  
  // Provider info
  providerType: SMSProviderType;
  
  // Twilio settings (if providerType === TWILIO)
  twilioSID?: string;
  twilioSenderNumber?: string;
  twilioVerifyServiceSID?: string;
  
  // HTTP settings (if providerType === HTTP)
  httpEndpoint?: string;
  // Note: tokens/keys are encrypted and not exposed in queries
}
