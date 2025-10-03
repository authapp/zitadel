import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { throwInternal } from '@/zerrors/errors';

/**
 * Password hasher configuration
 */
export interface HasherConfig {
  cost?: number; // bcrypt cost factor (4-31)
  algorithm?: 'bcrypt';
}

/**
 * Password hasher using bcrypt
 */
export class PasswordHasher {
  private readonly cost: number;

  constructor(config: HasherConfig = {}) {
    this.cost = config.cost ?? 12; // Default cost of 12

    if (this.cost < 4 || this.cost > 31) {
      throw new Error('Bcrypt cost must be between 4 and 31');
    }
  }

  /**
   * Hash a password
   */
  async hash(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.cost);
    } catch (error) {
      throwInternal('Password hashing failed', 'CRYPTO-HASH-001', {}, error as Error);
    }
  }

  /**
   * Verify a password against a hash
   */
  async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throwInternal('Password verification failed', 'CRYPTO-HASH-002', {}, error as Error);
    }
  }

  /**
   * Check if a hash needs rehashing (cost changed)
   */
  needsRehash(hash: string): boolean {
    try {
      const rounds = bcrypt.getRounds(hash);
      return rounds !== this.cost;
    } catch {
      return true; // If we can't parse the hash, it needs rehashing
    }
  }
}

/**
 * Secret hasher for API keys, client secrets, etc.
 */
export class SecretHasher {
  /**
   * Hash a secret using SHA-256
   */
  hash(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  /**
   * Verify a secret against a hash
   */
  verify(secret: string, hash: string): boolean {
    const computedHash = this.hash(secret);
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
  }
}

/**
 * Generate a secure random secret
 */
export function generateSecret(length = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generate a cryptographically secure random token
 */
export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a numeric code (for OTP, verification codes)
 */
export function generateNumericCode(length = 6): string {
  const max = Math.pow(10, length);
  const code = crypto.randomInt(0, max);
  return code.toString().padStart(length, '0');
}

/**
 * Generate an alphanumeric code
 */
export function generateAlphanumericCode(length = 8): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  const bytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    code += charset[bytes[i] % charset.length];
  }

  return code;
}

/**
 * Hash data using SHA-256
 */
export function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Hash data using SHA-512
 */
export function sha512(data: string | Buffer): string {
  return crypto.createHash('sha512').update(data).digest('hex');
}

/**
 * Create HMAC signature
 */
export function hmacSign(data: string, secret: string, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
  return crypto.createHmac(algorithm, secret).update(data).digest('hex');
}

/**
 * Verify HMAC signature
 */
export function hmacVerify(
  data: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha512' = 'sha256',
): boolean {
  const expectedSignature = hmacSign(data, secret, algorithm);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}
