/**
 * Multi-Factor Authentication (MFA) Domain Types
 * 
 * State management and configuration for MFA factors
 * Based on Go: internal/domain/mfa.go, human_otp.go
 */

/**
 * MFA State enumeration
 */
export enum MFAState {
  UNSPECIFIED = 0,
  NOT_READY = 1,    // MFA added but not yet verified/setup
  READY = 2,        // MFA active and ready to use
  REMOVED = 3,      // MFA removed
}

/**
 * Check if MFA state exists (not unspecified or removed)
 */
export function mfaStateExists(state: MFAState): boolean {
  return state !== MFAState.UNSPECIFIED && state !== MFAState.REMOVED;
}

/**
 * TOTP response with secret and URI
 */
export interface TOTP {
  secret: string;  // Base32 encoded secret
  uri: string;     // otpauth:// URI for QR codes
}

/**
 * OTP Configuration
 */
export interface OTPConfig {
  issuer: string;              // Issuer name for TOTP (e.g., "MyApp")
  cryptoAlgorithm?: string;    // Encryption algorithm (for secret storage)
}

/**
 * Multifactor configs
 */
export interface MultifactorConfigs {
  otp: OTPConfig;
}
