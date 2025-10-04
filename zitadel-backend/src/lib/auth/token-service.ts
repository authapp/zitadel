/**
 * Token service implementation for JWT tokens
 */

import { TokenService, TokenPayload, TokenPair, TokenExpiredError } from './types';
import { generateId } from '../id/snowflake';

/**
 * JWT Token service
 * Note: This is a simplified implementation. In production, use a proper JWT library
 * like jsonwebtoken or jose
 */
export class JwtTokenService implements TokenService {
  private readonly ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes
  private readonly REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days
  private revokedTokens = new Set<string>();

  constructor(
    private secret: string,
    private issuer: string,
    private audience: string,
    private accessTokenTtl: number = JwtTokenService.prototype.ACCESS_TOKEN_TTL,
    private refreshTokenTtl: number = JwtTokenService.prototype.REFRESH_TOKEN_TTL
  ) {}

  /**
   * Generate token pair
   */
  async generateTokenPair(payload: TokenPayload): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);

    // Generate access token
    const accessPayload: TokenPayload = {
      ...payload,
      iss: this.issuer,
      aud: this.audience,
      iat: now,
      exp: now + this.accessTokenTtl,
      jti: generateId(),
    };

    // Generate refresh token
    const refreshPayload: TokenPayload = {
      sub: payload.sub,
      iss: this.issuer,
      aud: this.audience,
      iat: now,
      exp: now + this.refreshTokenTtl,
      jti: generateId(),
      token_type: 'refresh',
    };

    const accessToken = await this.encodeToken(accessPayload);
    const refreshToken = await this.encodeToken(refreshPayload);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenTtl,
      tokenType: 'Bearer',
    };
  }

  /**
   * Verify and decode token
   */
  async verifyToken(token: string): Promise<TokenPayload> {
    const payload = await this.decodeToken(token);

    // Check if token is revoked
    if (payload.jti && this.revokedTokens.has(payload.jti)) {
      throw new TokenExpiredError();
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new TokenExpiredError();
    }

    // Check not before
    if (payload.nbf && payload.nbf > now) {
      throw new TokenExpiredError();
    }

    // Verify issuer and audience
    if (payload.iss !== this.issuer || payload.aud !== this.audience) {
      throw new Error('Invalid token issuer or audience');
    }

    return payload;
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyToken(refreshToken);

    // Verify it's a refresh token
    if (payload.token_type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    // Revoke old refresh token
    if (payload.jti) {
      this.revokedTokens.add(payload.jti);
    }

    // Generate new token pair
    const newPayload: TokenPayload = {
      sub: payload.sub,
      iss: this.issuer,
      aud: this.audience,
      exp: 0, // Will be set by generateTokenPair
      iat: 0, // Will be set by generateTokenPair
      instance_id: payload.instance_id,
      org_id: payload.org_id,
      project_id: payload.project_id,
      roles: payload.roles,
      email: payload.email,
      email_verified: payload.email_verified,
    };

    return this.generateTokenPair(newPayload);
  }

  /**
   * Revoke token
   */
  async revokeToken(token: string): Promise<void> {
    const payload = await this.decodeToken(token);
    if (payload.jti) {
      this.revokedTokens.add(payload.jti);
    }
  }

  /**
   * Encode token (simplified - use proper JWT library in production)
   */
  private async encodeToken(payload: TokenPayload): Promise<string> {
    // This is a simplified implementation
    // In production, use a library like jsonwebtoken or jose
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = await this.sign(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Decode token (simplified - use proper JWT library in production)
   */
  private async decodeToken(token: string): Promise<TokenPayload> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Verify signature
    const expectedSignature = await this.sign(`${encodedHeader}.${encodedPayload}`);
    if (signature !== expectedSignature) {
      throw new Error('Invalid token signature');
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
    return payload;
  }

  /**
   * Sign data with secret (simplified HMAC)
   */
  private async sign(data: string): Promise<string> {
    // This is a simplified implementation
    // In production, use proper HMAC with crypto module
    const crypto = await import('crypto');
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(data);
    return hmac.digest('base64url');
  }
}

/**
 * In-memory token service for testing
 */
export class InMemoryTokenService implements TokenService {
  private tokens = new Map<string, TokenPayload>();
  private refreshTokens = new Map<string, TokenPayload>();
  private readonly accessTokenTtl = 15 * 60; // 15 minutes in seconds
  private readonly refreshTokenTtl = 7 * 24 * 60 * 60; // 7 days in seconds

  async generateTokenPair(payload: TokenPayload): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);

    // Generate token IDs
    const accessTokenId = generateId();
    const refreshTokenId = generateId();

    // Store access token
    const accessPayload: TokenPayload = {
      ...payload,
      jti: accessTokenId,
      iat: now,
      exp: now + this.accessTokenTtl,
    };
    this.tokens.set(accessTokenId, accessPayload);

    // Store refresh token
    const refreshPayload: TokenPayload = {
      sub: payload.sub,
      iss: payload.iss || 'zitadel',
      aud: payload.aud || 'zitadel-api',
      jti: refreshTokenId,
      iat: now,
      exp: now + this.refreshTokenTtl,
      token_type: 'refresh',
    };
    this.refreshTokens.set(refreshTokenId, refreshPayload);

    return {
      accessToken: accessTokenId,
      refreshToken: refreshTokenId,
      expiresIn: this.accessTokenTtl,
      tokenType: 'Bearer',
    };
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    const payload = this.tokens.get(token) || this.refreshTokens.get(token);
    if (!payload) {
      throw new TokenExpiredError();
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new TokenExpiredError();
    }

    return payload;
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyToken(refreshToken);

    if (payload.token_type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    // Revoke old refresh token
    this.refreshTokens.delete(refreshToken);

    // Generate new token pair
    return this.generateTokenPair({
      sub: payload.sub,
      iss: payload.iss || '',
      aud: payload.aud || '',
      exp: 0, // Will be set by generateTokenPair
      iat: 0, // Will be set by generateTokenPair
    });
  }

  async revokeToken(token: string): Promise<void> {
    this.tokens.delete(token);
    this.refreshTokens.delete(token);
  }
}

/**
 * Create token service
 */
export function createTokenService(
  secret: string,
  issuer: string,
  audience: string,
  accessTokenTtl?: number,
  refreshTokenTtl?: number
): TokenService {
  return new JwtTokenService(secret, issuer, audience, accessTokenTtl, refreshTokenTtl);
}

/**
 * Create in-memory token service for testing
 */
export function createInMemoryTokenService(): InMemoryTokenService {
  return new InMemoryTokenService();
}
