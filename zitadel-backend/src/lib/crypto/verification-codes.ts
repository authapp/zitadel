/**
 * Verification Code Generation and Encryption
 * Based on Zitadel Go: internal/crypto/code.go
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface CodeConfig {
  length: number;
  expiry: number; // seconds
  includeUpperCase?: boolean;
  includeLowerCase?: boolean;
  includeDigits?: boolean;
}

export interface CryptoValue {
  algorithm: string;
  keyID: string;
  crypted: Buffer;
}

export interface VerificationCode {
  plain: string;
  encrypted: CryptoValue;
  expiry: number;
}

/**
 * Generate verification code with encryption
 * Based on Go: crypto.NewCode
 */
export async function generateVerificationCode(
  config: CodeConfig
): Promise<VerificationCode> {
  // Generate random code
  const plain = generateRandomCode(config);

  // Encrypt code
  const encrypted = await encryptCode(plain);

  return {
    plain,
    encrypted,
    expiry: config.expiry,
  };
}

/**
 * Generate random code based on config
 */
function generateRandomCode(config: CodeConfig): string {
  let chars = '';
  
  if (config.includeDigits !== false) {
    chars += '0123456789';
  }
  if (config.includeUpperCase) {
    chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  if (config.includeLowerCase) {
    chars += 'abcdefghijklmnopqrstuvwxyz';
  }

  // Default to digits only
  if (chars === '') {
    chars = '0123456789';
  }

  let code = '';
  const bytes = randomBytes(config.length * 2); // Extra randomness
  for (let i = 0; i < config.length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Encrypt verification code using AES-256-GCM
 * Based on Go: crypto encryption
 */
export async function encryptCode(plainCode: string): Promise<CryptoValue> {
  const algorithm = 'aes-256-gcm';
  
  // Get encryption key from environment (32 bytes for AES-256)
  const keyHex = process.env.ENCRYPTION_KEY || '0'.repeat(64);
  const key = Buffer.from(keyHex, 'hex').slice(0, 32);
  
  const iv = randomBytes(12); // 12 bytes for GCM mode

  const cipher = createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(plainCode, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: [IV(12) + AuthTag(16) + Ciphertext]
  const crypted = Buffer.concat([iv, authTag, encrypted]);

  return {
    algorithm,
    keyID: 'default',
    crypted,
  };
}

/**
 * Decrypt code
 */
async function decryptCode(encrypted: CryptoValue): Promise<string> {
  const keyHex = process.env.ENCRYPTION_KEY || '0'.repeat(64);
  const key = Buffer.from(keyHex, 'hex').slice(0, 32);

  const iv = encrypted.crypted.slice(0, 12);
  const authTag = encrypted.crypted.slice(12, 28);
  const ciphertext = encrypted.crypted.slice(28);

  const decipher = createDecipheriv(encrypted.algorithm, key, iv);
  (decipher as any).setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Verify code matches encrypted value and is not expired
 * Based on Go: crypto.VerifyCode
 */
export async function verifyCode(
  encrypted: CryptoValue | undefined,
  plainCode: string,
  creationDate: Date | undefined,
  expirySeconds: number | undefined
): Promise<boolean> {
  if (!encrypted || !creationDate || !expirySeconds) {
    return false;
  }

  // Check expiry
  const now = new Date();
  const expiryDate = new Date(creationDate.getTime() + expirySeconds * 1000);
  if (now > expiryDate) {
    return false;
  }

  // Decrypt and compare
  try {
    const decrypted = await decryptCode(encrypted);
    return decrypted === plainCode;
  } catch (error) {
    return false;
  }
}

/**
 * Default code configurations
 */
export const DEFAULT_CODE_CONFIGS = {
  phoneVerification: {
    length: 6,
    expiry: 600, // 10 minutes
    includeDigits: true,
  },
  emailVerification: {
    length: 6,
    expiry: 600, // 10 minutes
    includeDigits: true,
  },
} as const;
