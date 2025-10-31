/**
 * Key Manager
 * 
 * Manages cryptographic keys for JWT signing and verification
 */

import { generateKeyPair, exportJWK, SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';
import { webcrypto } from 'node:crypto';
import { JWK, JWKS } from './types';

export interface KeyPair {
  kid: string;
  publicKey: webcrypto.CryptoKey;
  privateKey: webcrypto.CryptoKey;
  algorithm: string;
  createdAt: Date;
}

export class KeyManager {
  private keyPairs: Map<string, KeyPair> = new Map();
  private currentKeyId: string | null = null;

  /**
   * Initialize key manager with a default key pair
   */
  async initialize(): Promise<void> {
    const keyPair = await this.generateKeyPair();
    this.currentKeyId = keyPair.kid;
  }

  /**
   * Generate a new RSA key pair
   */
  async generateKeyPair(algorithm: string = 'RS256'): Promise<KeyPair> {
    const kid = randomUUID();
    const { publicKey, privateKey } = await generateKeyPair('RS256', {
      modulusLength: 2048,
    });

    const keyPair: KeyPair = {
      kid,
      publicKey,
      privateKey,
      algorithm,
      createdAt: new Date(),
    };

    this.keyPairs.set(kid, keyPair);
    return keyPair;
  }

  /**
   * Get current signing key
   */
  getCurrentKey(): KeyPair | null {
    if (!this.currentKeyId) return null;
    return this.keyPairs.get(this.currentKeyId) || null;
  }

  /**
   * Get key by ID
   */
  getKey(kid: string): KeyPair | null {
    return this.keyPairs.get(kid) || null;
  }

  /**
   * Get all key pairs
   */
  getAllKeys(): KeyPair[] {
    return Array.from(this.keyPairs.values());
  }

  /**
   * Sign a JWT
   */
  async signJWT(
    payload: Record<string, any>,
    options?: {
      kid?: string;
      expiresIn?: string;
    }
  ): Promise<string> {
    const keyPair = options?.kid
      ? this.getKey(options.kid)
      : this.getCurrentKey();

    if (!keyPair) {
      throw new Error('No signing key available');
    }

    let jwt = new SignJWT(payload)
      .setProtectedHeader({ alg: keyPair.algorithm, kid: keyPair.kid, typ: 'JWT' })
      .setIssuedAt()
      .setIssuer(process.env.ISSUER_URL || 'http://localhost:3000');

    if (options?.expiresIn) {
      jwt = jwt.setExpirationTime(options.expiresIn);
    }

    return await jwt.sign(keyPair.privateKey);
  }

  /**
   * Verify a JWT
   */
  async verifyJWT(token: string): Promise<{
    payload: any;
    protectedHeader: any;
  }> {
    // Extract kid from token header
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const kid = header.kid;

    if (!kid) {
      throw new Error('Token missing kid header');
    }

    const keyPair = this.getKey(kid);
    if (!keyPair) {
      throw new Error('Unknown signing key');
    }

    const result = await jwtVerify(token, keyPair.publicKey, {
      issuer: process.env.ISSUER_URL || 'http://localhost:3000',
    });

    return {
      payload: result.payload,
      protectedHeader: result.protectedHeader,
    };
  }

  /**
   * Get JWKS (JSON Web Key Set) for public keys
   */
  async getJWKS(): Promise<JWKS> {
    const keys: JWK[] = [];

    for (const keyPair of this.keyPairs.values()) {
      const jwk = await exportJWK(keyPair.publicKey);
      keys.push({
        kty: jwk.kty!,
        use: 'sig',
        kid: keyPair.kid,
        alg: keyPair.algorithm,
        n: jwk.n,
        e: jwk.e,
      });
    }

    return { keys };
  }

  /**
   * Rotate keys (generate new key and mark old as deprecated)
   */
  async rotateKeys(): Promise<KeyPair> {
    const newKeyPair = await this.generateKeyPair();
    this.currentKeyId = newKeyPair.kid;
    return newKeyPair;
  }

  /**
   * Remove old keys (keep only recent ones)
   */
  cleanupOldKeys(maxAge: number = 30 * 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    
    for (const [kid, keyPair] of this.keyPairs.entries()) {
      // Don't remove current key
      if (kid === this.currentKeyId) continue;

      const age = now - keyPair.createdAt.getTime();
      if (age > maxAge) {
        this.keyPairs.delete(kid);
      }
    }
  }
}

// Global singleton instance
let keyManagerInstance: KeyManager | null = null;

/**
 * Get or create key manager instance
 */
export async function getKeyManager(): Promise<KeyManager> {
  if (!keyManagerInstance) {
    keyManagerInstance = new KeyManager();
    await keyManagerInstance.initialize();
  }
  return keyManagerInstance;
}

/**
 * Reset key manager (for testing)
 */
export function resetKeyManager(): void {
  keyManagerInstance = null;
}

/**
 * Set key manager instance (for testing)
 */
export function setKeyManager(manager: KeyManager): void {
  keyManagerInstance = manager;
}
