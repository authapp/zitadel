/**
 * TOTP (Time-based One-Time Password) Utilities
 * 
 * Based on RFC 6238 - TOTP: Time-Based One-Time Password Algorithm
 * Uses otplib for TOTP generation and validation
 */

import { authenticator } from 'otplib';
import { throwInvalidArgument, throwInternal } from '@/zerrors/errors';

/**
 * TOTP Key with secret and URI
 */
export interface TOTPKey {
  secret: string;  // Base32 encoded secret
  uri: string;     // otpauth:// URI
}

/**
 * Generate a new TOTP secret and URI
 * Based on Go: domain.NewTOTPKey
 */
export function generateTOTPKey(issuer: string, accountName: string): TOTPKey {
  try {
    // Generate a random secret (base32 encoded)
    const secret = authenticator.generateSecret();

    // Generate the otpauth:// URI
    const uri = authenticator.keyuri(accountName, issuer, secret);

    return {
      secret,
      uri,
    };
  } catch (err) {
    throwInternal(err instanceof Error ? err.message : 'Failed to generate TOTP key', 'TOTP-gen01');
  }
}

/**
 * Verify a TOTP code against a secret
 * Based on Go: domain.VerifyTOTP
 */
export function verifyTOTP(code: string, secret: string): boolean {
  try {
    // Verify the token
    const isValid = authenticator.verify({
      token: code,
      secret: secret,
    });

    return isValid;
  } catch (err) {
    return false;
  }
}

/**
 * Validate TOTP code and throw error if invalid
 */
export function validateTOTP(code: string, secret: string): void {
  const isValid = verifyTOTP(code, secret);
  if (!isValid) {
    throwInvalidArgument('Invalid TOTP code', 'TOTP-val01');
  }
}

/**
 * Generate current TOTP token (for testing)
 */
export function generateTOTPToken(secret: string): string {
  return authenticator.generate(secret);
}
