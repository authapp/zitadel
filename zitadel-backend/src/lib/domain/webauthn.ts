/**
 * WebAuthn Domain Types
 * 
 * WebAuthn/FIDO2 authentication support for U2F and Passwordless
 * Based on Go: internal/domain/human_web_auth_n.go
 * 
 * NOTE: Full WebAuthn implementation requires:
 * - @simplewebauthn/server for RP (Relying Party) logic
 * - Challenge generation and verification
 * - Public key cryptography
 * - Browser WebAuthn API integration
 */

import { MFAState } from './mfa';

/**
 * User Verification Requirement (WebAuthn spec)
 */
export enum UserVerificationRequirement {
  UNSPECIFIED = 0,
  REQUIRED = 1,     // Must verify user (PIN/biometric required)
  PREFERRED = 2,    // Prefer verification if available
  DISCOURAGED = 3,  // Don't verify (for U2F security keys)
}

/**
 * Authenticator Attachment (WebAuthn spec)
 */
export enum AuthenticatorAttachment {
  UNSPECIFIED = 0,
  PLATFORM = 1,          // Built-in (Touch ID, Face ID, Windows Hello)
  CROSS_PLATFORM = 2,    // External (USB security key, NFC, Bluetooth)
}

/**
 * WebAuthN Token (registered credential)
 */
export interface WebAuthNToken {
  webAuthNTokenID: string;
  credentialCreationData?: Uint8Array;  // PublicKeyCredential from browser
  state: MFAState;
  challenge?: string;
  allowedCredentialIDs?: Uint8Array[];
  userVerification?: UserVerificationRequirement;
  keyID?: Uint8Array;           // Credential ID
  publicKey?: Uint8Array;       // Public key
  attestationType?: string;
  aaguid?: Uint8Array;          // Authenticator GUID
  signCount?: number;           // Signature counter
  webAuthNTokenName?: string;   // User-friendly name
  rpID?: string;                // Relying Party ID (domain)
}

/**
 * WebAuthN Login (authentication challenge)
 */
export interface WebAuthNLogin {
  credentialAssertionData?: Uint8Array;
  challenge: string;
  allowedCredentialIDs: Uint8Array[];
  userVerification: UserVerificationRequirement;
  rpID: string;
}

/**
 * Passwordless Init Code State
 */
export enum PasswordlessInitCodeState {
  UNSPECIFIED = 0,
  REQUESTED = 1,
  ACTIVE = 2,
  REMOVED = 3,
}

/**
 * Passwordless Init Code (for email verification flow)
 */
export interface PasswordlessInitCode {
  codeID: string;
  code: string;
  expiration: number;  // Duration in milliseconds
  state: PasswordlessInitCodeState;
}

/**
 * Get token that needs verification (NOT_READY state)
 */
export function getTokenToVerify(tokens: WebAuthNToken[]): WebAuthNToken | null {
  return tokens.find(t => t.state === MFAState.NOT_READY) || null;
}

/**
 * Get token by credential ID (key ID)
 */
export function getTokenByKeyID(tokens: WebAuthNToken[], keyID: Uint8Array): WebAuthNToken | null {
  return tokens.find(t => {
    if (!t.keyID) return false;
    if (t.keyID.length !== keyID.length) return false;
    return t.keyID.every((byte, i) => byte === keyID[i]);
  }) || null;
}

/**
 * Generate passwordless init code link
 */
export function generatePasswordlessInitCodeLink(
  baseURL: string,
  userID: string,
  orgID: string,
  codeID: string,
  code: string
): string {
  return `${baseURL}?userID=${userID}&orgID=${orgID}&codeID=${codeID}&code=${code}`;
}
