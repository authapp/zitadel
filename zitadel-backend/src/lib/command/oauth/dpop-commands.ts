/**
 * DPoP (Demonstrating Proof-of-Possession) Commands (RFC 9449)
 * 
 * Implements OAuth 2.0 Demonstrating Proof-of-Possession at the Application Layer
 * https://datatracker.ietf.org/doc/html/rfc9449
 */

import { createHash } from 'crypto';
import { importJWK, jwtVerify, type JWK } from 'jose';
import { throwInvalidArgument } from '@/zerrors/errors';

/**
 * DPoP Proof JWT payload
 */
export interface DPoPProof {
  // JWT header (typ: dpop+jwt, alg, jwk)
  header: {
    typ: string;
    alg: string;
    jwk: JWK;
  };
  
  // JWT payload
  payload: {
    jti: string;           // Unique identifier for this proof
    htm: string;           // HTTP method (GET, POST, etc.)
    htu: string;           // HTTP URI (without query and fragment)
    iat: number;           // Issued at timestamp
    ath?: string;          // Access token hash (for token requests)
    nonce?: string;        // Server-provided nonce
  };
}

/**
 * DPoP validation options
 */
export interface DPoPValidationOptions {
  expectedMethod: string;
  expectedUrl: string;
  accessToken?: string;
  nonce?: string;
  maxAge?: number;        // Maximum age in seconds (default: 60)
}

/**
 * Calculate JWK thumbprint (RFC 7638)
 * Used to bind tokens to specific public keys
 */
export function calculateJWKThumbprint(jwk: JWK): string {
  // RFC 7638: Canonical JSON representation
  const canonicalJwk: Record<string, any> = {};
  
  // Required members for each key type
  if (jwk.kty === 'RSA') {
    canonicalJwk.e = jwk.e;
    canonicalJwk.kty = jwk.kty;
    canonicalJwk.n = jwk.n;
  } else if (jwk.kty === 'EC') {
    canonicalJwk.crv = jwk.crv;
    canonicalJwk.kty = jwk.kty;
    canonicalJwk.x = jwk.x;
    canonicalJwk.y = jwk.y;
  } else if (jwk.kty === 'OKP') {
    canonicalJwk.crv = jwk.crv;
    canonicalJwk.kty = jwk.kty;
    canonicalJwk.x = jwk.x;
  } else {
    throwInvalidArgument('Unsupported JWK key type', 'DPOP-001');
  }

  // Canonical JSON with sorted keys
  const canonical = JSON.stringify(canonicalJwk, Object.keys(canonicalJwk).sort());
  
  // SHA-256 hash, base64url encoded
  return createHash('sha256').update(canonical).digest('base64url');
}

/**
 * Calculate access token hash for DPoP proof (ath claim)
 * RFC 9449 Section 4.3
 */
export function calculateAccessTokenHash(accessToken: string): string {
  return createHash('sha256').update(accessToken).digest('base64url');
}

/**
 * Validate DPoP proof JWT
 * RFC 9449 Section 4.3
 */
export async function validateDPoPProof(
  dpopProof: string,
  options: DPoPValidationOptions
): Promise<DPoPProof> {
  try {
    // 1. Parse and verify JWT structure  
    // Decode header manually since decodeProtectedHeader may not be available
    const parts = dpopProof.split('.');
    if (parts.length !== 3) {
      throwInvalidArgument('Invalid DPoP proof: invalid JWT structure', 'DPOP-002');
    }
    
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    
    if (!header) {
      throwInvalidArgument('Invalid DPoP proof: missing header', 'DPOP-002a');
    }

    // 2. Validate JWT header
    // RFC 9449: typ MUST be "dpop+jwt"
    if (header.typ !== 'dpop+jwt') {
      throwInvalidArgument(
        'Invalid DPoP proof: typ must be dpop+jwt',
        'DPOP-003'
      );
    }

    // RFC 9449: alg MUST NOT be "none"
    if (header.alg === 'none') {
      throwInvalidArgument(
        'Invalid DPoP proof: alg cannot be none',
        'DPOP-004'
      );
    }

    // RFC 9449: jwk MUST be present
    if (!header.jwk) {
      throwInvalidArgument(
        'Invalid DPoP proof: jwk is required in header',
        'DPOP-005'
      );
    }

    // 3. Verify JWT signature using the jwk from header
    const publicKey = await importJWK(header.jwk, header.alg);
    const { payload: verifiedPayload } = await jwtVerify(dpopProof, publicKey, {
      typ: 'dpop+jwt',
    });

    // 4. Validate payload claims
    // jti (unique identifier)
    if (!verifiedPayload.jti || typeof verifiedPayload.jti !== 'string') {
      throwInvalidArgument(
        'Invalid DPoP proof: jti is required',
        'DPOP-006'
      );
    }

    // htm (HTTP method)
    if (verifiedPayload.htm !== options.expectedMethod) {
      throwInvalidArgument(
        `Invalid DPoP proof: htm mismatch (expected ${options.expectedMethod}, got ${verifiedPayload.htm})`,
        'DPOP-007'
      );
    }

    // htu (HTTP URI) - must match without query/fragment
    const expectedHtu = options.expectedUrl.split('?')[0].split('#')[0];
    if (verifiedPayload.htu !== expectedHtu) {
      throwInvalidArgument(
        `Invalid DPoP proof: htu mismatch`,
        'DPOP-008'
      );
    }

    // iat (issued at) - check for freshness
    const maxAge = options.maxAge || 60; // Default 60 seconds
    const now = Math.floor(Date.now() / 1000);
    const age = now - (verifiedPayload.iat as number);
    
    if (age < 0) {
      throwInvalidArgument(
        'Invalid DPoP proof: iat is in the future',
        'DPOP-009'
      );
    }
    
    if (age > maxAge) {
      throwInvalidArgument(
        `Invalid DPoP proof: proof is too old (${age}s > ${maxAge}s)`,
        'DPOP-010'
      );
    }

    // ath (access token hash) - required when using DPoP-bound access token
    if (options.accessToken) {
      const expectedAth = calculateAccessTokenHash(options.accessToken);
      if (verifiedPayload.ath !== expectedAth) {
        throwInvalidArgument(
          'Invalid DPoP proof: ath mismatch',
          'DPOP-011'
        );
      }
    }

    // nonce (server-provided nonce) - if server requires it
    if (options.nonce && verifiedPayload.nonce !== options.nonce) {
      throwInvalidArgument(
        'Invalid DPoP proof: nonce mismatch',
        'DPOP-012'
      );
    }

    return {
      header: {
        typ: header.typ!,
        alg: header.alg!,
        jwk: header.jwk!,
      },
      payload: {
        jti: verifiedPayload.jti as string,
        htm: verifiedPayload.htm as string,
        htu: verifiedPayload.htu as string,
        iat: verifiedPayload.iat as number,
        ath: verifiedPayload.ath as string | undefined,
        nonce: verifiedPayload.nonce as string | undefined,
      },
    };
  } catch (error: any) {
    if (error.code?.startsWith('DPOP-')) {
      throw error;
    }
    throwInvalidArgument(
      `DPoP proof validation failed: ${error.message}`,
      'DPOP-013'
    );
  }
}

/**
 * Generate DPoP nonce
 * RFC 9449 Section 8
 */
export function generateDPoPNonce(): string {
  return createHash('sha256')
    .update(Date.now().toString())
    .update(Math.random().toString())
    .digest('base64url')
    .substring(0, 32);
}

/**
 * Extract DPoP proof from HTTP headers
 * RFC 9449 Section 4.3
 */
export function extractDPoPProof(headers: Record<string, string | string[] | undefined>): string | null {
  const dpopHeader = headers['dpop'] || headers['DPoP'];
  
  if (!dpopHeader) {
    return null;
  }

  if (Array.isArray(dpopHeader)) {
    // Multiple DPoP headers not allowed
    throwInvalidArgument(
      'Multiple DPoP headers not allowed',
      'DPOP-014'
    );
  }

  return dpopHeader;
}

/**
 * Check if a request includes DPoP proof
 */
export function hasDPoPProof(headers: Record<string, string | string[] | undefined>): boolean {
  return !!(headers['dpop'] || headers['DPoP']);
}
