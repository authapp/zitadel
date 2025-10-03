import crypto from 'crypto';
import { throwInternal, throwInvalidArgument } from '@/zerrors/errors';

/**
 * Encryption algorithm type
 */
export enum CryptoType {
  ENCRYPTION = 'encryption',
  HASH = 'hash',
}

/**
 * Encrypted value structure stored in database
 */
export interface CryptoValue {
  cryptoType: CryptoType;
  algorithm: string;
  keyId: string;
  crypted: Buffer;
}

/**
 * Encryption algorithm interface
 */
export interface EncryptionAlgorithm {
  algorithm(): string;
  encryptionKeyId(): string;
  decryptionKeyIds(): string[];
  encrypt(value: Buffer): Promise<Buffer>;
  decrypt(hashed: Buffer, keyId: string): Promise<Buffer>;
  decryptString(hashed: Buffer, keyId: string): Promise<string>;
}

/**
 * AES encryption algorithm configuration
 */
export interface AESConfig {
  key: string; // Base64 encoded key
  keyId: string;
  algorithm?: 'aes-256-gcm' | 'aes-128-gcm';
}

/**
 * AES-GCM encryption implementation
 */
export class AESEncryption implements EncryptionAlgorithm {
  private readonly key: Buffer;
  private readonly keyId: string;
  private readonly algorithmName: string;
  private readonly ivLength: number;
  private readonly authTagLength: number;

  constructor(config: AESConfig) {
    this.algorithmName = config.algorithm ?? 'aes-256-gcm';
    this.keyId = config.keyId;
    this.ivLength = 12; // 96 bits recommended for GCM
    this.authTagLength = 16; // 128 bits

    try {
      this.key = Buffer.from(config.key, 'base64');
    } catch (error) {
      throwInternal('Failed to decode encryption key', 'CRYPTO-001', {}, error as Error);
    }

    // Validate key length based on algorithm
    const expectedKeyLength = this.algorithmName === 'aes-256-gcm' ? 32 : 16;
    if (this.key.length !== expectedKeyLength) {
      throwInvalidArgument(
        `Key length must be ${expectedKeyLength} bytes for ${this.algorithmName}`,
        'CRYPTO-002',
        { actual: this.key.length, expected: expectedKeyLength },
      );
    }
  }

  algorithm(): string {
    return this.algorithmName;
  }

  encryptionKeyId(): string {
    return this.keyId;
  }

  decryptionKeyIds(): string[] {
    return [this.keyId];
  }

  /**
   * Encrypt data using AES-GCM
   * Format: IV (12 bytes) + Encrypted Data + Auth Tag (16 bytes)
   */
  async encrypt(value: Buffer): Promise<Buffer> {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher (cast to CipherGCM for GCM-specific methods)
      const cipher = crypto.createCipheriv(this.algorithmName, this.key, iv) as crypto.CipherGCM;

      // Encrypt
      const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);

      // Get auth tag
      const authTag = cipher.getAuthTag();

      // Combine: IV + encrypted + authTag
      return Buffer.concat([iv, encrypted, authTag]);
    } catch (error) {
      throwInternal('Encryption failed', 'CRYPTO-003', {}, error as Error);
    }
  }

  /**
   * Decrypt data using AES-GCM
   */
  async decrypt(hashed: Buffer, keyId: string): Promise<Buffer> {
    if (keyId !== this.keyId) {
      throwInvalidArgument(`Unknown key ID: ${keyId}`, 'CRYPTO-004', { keyId });
    }

    try {
      // Extract components
      const iv = hashed.subarray(0, this.ivLength);
      const authTag = hashed.subarray(hashed.length - this.authTagLength);
      const encrypted = hashed.subarray(this.ivLength, hashed.length - this.authTagLength);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithmName, this.key, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      // Decrypt
      return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch (error) {
      throwInternal('Decryption failed', 'CRYPTO-005', {}, error as Error);
    }
  }

  /**
   * Decrypt and return as UTF-8 string
   */
  async decryptString(hashed: Buffer, keyId: string): Promise<string> {
    const decrypted = await this.decrypt(hashed, keyId);
    try {
      return decrypted.toString('utf8');
    } catch (error) {
      throwInternal('Decrypted value contains non-UTF8 characters', 'CRYPTO-006', {}, error as Error);
    }
  }
}

/**
 * Create a CryptoValue from plaintext
 */
export async function encryptValue(
  algorithm: EncryptionAlgorithm,
  plaintext: string | Buffer,
): Promise<CryptoValue> {
  const buffer = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  const encrypted = await algorithm.encrypt(buffer);

  return {
    cryptoType: CryptoType.ENCRYPTION,
    algorithm: algorithm.algorithm(),
    keyId: algorithm.encryptionKeyId(),
    crypted: encrypted,
  };
}

/**
 * Decrypt a CryptoValue
 */
export async function decryptValue(
  algorithm: EncryptionAlgorithm,
  value: CryptoValue,
): Promise<Buffer> {
  return algorithm.decrypt(value.crypted, value.keyId);
}

/**
 * Decrypt a CryptoValue to string
 */
export async function decryptValueString(
  algorithm: EncryptionAlgorithm,
  value: CryptoValue,
): Promise<string> {
  return algorithm.decryptString(value.crypted, value.keyId);
}

/**
 * Serialize CryptoValue to JSON for database storage
 */
export function serializeCryptoValue(value: CryptoValue): string {
  return JSON.stringify({
    cryptoType: value.cryptoType,
    algorithm: value.algorithm,
    keyId: value.keyId,
    crypted: value.crypted.toString('base64'),
  });
}

/**
 * Deserialize CryptoValue from JSON
 */
export function deserializeCryptoValue(json: string): CryptoValue {
  const parsed = JSON.parse(json);
  return {
    cryptoType: parsed.cryptoType,
    algorithm: parsed.algorithm,
    keyId: parsed.keyId,
    crypted: Buffer.from(parsed.crypted, 'base64'),
  };
}
