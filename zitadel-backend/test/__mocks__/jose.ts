/**
 * Mock implementation of jose library for Jest tests
 * This avoids ESM compatibility issues with ts-jest
 */

import { webcrypto } from 'node:crypto';

export async function generateKeyPair(alg: string) {
  const keyPair = await webcrypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
  };
}

export async function exportJWK(key: any) {
  const jwk = await webcrypto.subtle.exportKey('jwk', key);
  return jwk;
}

export class SignJWT {
  private payload: any;
  private protectedHeader: any;

  constructor(payload: any) {
    this.payload = payload;
  }

  setProtectedHeader(header: any) {
    this.protectedHeader = header;
    return this;
  }

  setIssuedAt() {
    this.payload.iat = Math.floor(Date.now() / 1000);
    return this;
  }

  setExpirationTime(exp: string | number) {
    if (typeof exp === 'string') {
      // Parse simple time strings like '1h', '15m'
      const match = exp.match(/^(\d+)([smhd])$/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
        this.payload.exp = Math.floor(Date.now() / 1000) + value * multipliers[unit];
      }
    } else {
      this.payload.exp = exp;
    }
    return this;
  }

  setIssuer(iss: string) {
    this.payload.iss = iss;
    return this;
  }

  setSubject(sub: string) {
    this.payload.sub = sub;
    return this;
  }

  setAudience(aud: string | string[]) {
    this.payload.aud = aud;
    return this;
  }

  setJti(jti: string) {
    this.payload.jti = jti;
    return this;
  }

  async sign(privateKey: any) {
    // Create a simple JWT structure for testing
    const header = Buffer.from(JSON.stringify(this.protectedHeader)).toString('base64url');
    const payload = Buffer.from(JSON.stringify(this.payload)).toString('base64url');
    const signature = Buffer.from('mock-signature').toString('base64url');
    return `${header}.${payload}.${signature}`;
  }
}

export async function jwtVerify(jwt: string, publicKey: any, options?: any) {
  // Simple mock verification for tests
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  const protectedHeader = JSON.parse(Buffer.from(parts[0], 'base64url').toString());

  // Check expiration
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('JWT expired');
  }

  return {
    payload,
    protectedHeader,
  };
}

export const errors = {
  JWTExpired: class JWTExpired extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'JWTExpired';
    }
  },
  JWTInvalid: class JWTInvalid extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'JWTInvalid';
    }
  },
};
