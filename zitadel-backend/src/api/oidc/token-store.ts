/**
 * Token Store
 * 
 * In-memory store for authorization codes, tokens, and sessions
 * TODO: Replace with database-backed store for production
 */

import { randomBytes } from 'crypto';
import { AuthorizationCode, RefreshToken, OIDCSession } from './types';

export class TokenStore {
  private authCodes: Map<string, AuthorizationCode> = new Map();
  private refreshTokens: Map<string, RefreshToken> = new Map();
  private accessTokens: Map<string, Set<string>> = new Map(); // user_id -> Set<jti>
  private sessions: Map<string, OIDCSession> = new Map();
  private revokedTokens: Set<string> = new Set(); // jti of revoked tokens

  /**
   * Generate authorization code
   */
  generateAuthorizationCode(params: {
    client_id: string;
    redirect_uri: string;
    scope: string;
    user_id: string;
    code_challenge?: string;
    code_challenge_method?: string;
    nonce?: string;
  }): string {
    const code = this.generateRandomToken(32);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    this.authCodes.set(code, {
      code,
      client_id: params.client_id,
      redirect_uri: params.redirect_uri,
      scope: params.scope,
      user_id: params.user_id,
      expires_at: expiresAt,
      code_challenge: params.code_challenge,
      code_challenge_method: params.code_challenge_method,
      nonce: params.nonce,
    });

    return code;
  }

  /**
   * Get and consume authorization code
   */
  consumeAuthorizationCode(code: string): AuthorizationCode | null {
    const authCode = this.authCodes.get(code);
    if (!authCode) return null;

    // Check expiration
    if (authCode.expires_at < new Date()) {
      this.authCodes.delete(code);
      return null;
    }

    // Delete after use (one-time use)
    this.authCodes.delete(code);
    return authCode;
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(params: {
    user_id: string;
    client_id: string;
    scope: string;
  }): string {
    const token = this.generateRandomToken(64);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    this.refreshTokens.set(token, {
      token,
      user_id: params.user_id,
      client_id: params.client_id,
      scope: params.scope,
      expires_at: expiresAt,
      created_at: new Date(),
    });

    return token;
  }

  /**
   * Get refresh token
   */
  getRefreshToken(token: string): RefreshToken | null {
    const refreshToken = this.refreshTokens.get(token);
    if (!refreshToken) return null;

    // Check expiration
    if (refreshToken.expires_at < new Date()) {
      this.refreshTokens.delete(token);
      return null;
    }

    return refreshToken;
  }

  /**
   * Revoke refresh token
   */
  revokeRefreshToken(token: string): boolean {
    return this.refreshTokens.delete(token);
  }

  /**
   * Track access token (by jti)
   */
  trackAccessToken(userId: string, jti: string): void {
    if (!this.accessTokens.has(userId)) {
      this.accessTokens.set(userId, new Set());
    }
    this.accessTokens.get(userId)!.add(jti);
  }

  /**
   * Revoke access token (by jti)
   */
  revokeAccessToken(jti: string): void {
    this.revokedTokens.add(jti);
  }

  /**
   * Check if access token is revoked
   */
  isAccessTokenRevoked(jti: string): boolean {
    return this.revokedTokens.has(jti);
  }

  /**
   * Revoke all tokens for user
   */
  revokeAllUserTokens(userId: string): void {
    // Revoke all access tokens
    const userTokens = this.accessTokens.get(userId);
    if (userTokens) {
      userTokens.forEach((jti) => this.revokedTokens.add(jti));
      this.accessTokens.delete(userId);
    }

    // Revoke all refresh tokens
    for (const [token, refreshToken] of this.refreshTokens.entries()) {
      if (refreshToken.user_id === userId) {
        this.refreshTokens.delete(token);
      }
    }

    // Revoke all sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.user_id === userId) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Create session
   */
  createSession(params: {
    user_id: string;
    client_id: string;
  }): OIDCSession {
    const sessionId = this.generateRandomToken(32);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const session: OIDCSession = {
      session_id: sessionId,
      user_id: params.user_id,
      client_id: params.client_id,
      created_at: now,
      last_used_at: now,
      expires_at: expiresAt,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get session
   */
  getSession(sessionId: string): OIDCSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check expiration
    if (session.expires_at < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }

    // Update last used
    session.last_used_at = new Date();
    return session;
  }

  /**
   * Revoke session
   */
  revokeSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get all sessions for user
   */
  getUserSessions(userId: string): OIDCSession[] {
    const sessions: OIDCSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.user_id === userId && session.expires_at > new Date()) {
        sessions.push(session);
      }
    }
    return sessions;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = new Date();

    // Cleanup expired auth codes
    for (const [code, authCode] of this.authCodes.entries()) {
      if (authCode.expires_at < now) {
        this.authCodes.delete(code);
      }
    }

    // Cleanup expired refresh tokens
    for (const [token, refreshToken] of this.refreshTokens.entries()) {
      if (refreshToken.expires_at < now) {
        this.refreshTokens.delete(token);
      }
    }

    // Cleanup expired sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expires_at < now) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Generate random token
   */
  private generateRandomToken(bytes: number = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.authCodes.clear();
    this.refreshTokens.clear();
    this.accessTokens.clear();
    this.sessions.clear();
    this.revokedTokens.clear();
  }
}

// Global singleton instance
let tokenStoreInstance: TokenStore | null = null;

/**
 * Get or create token store instance
 */
export function getTokenStore(): TokenStore {
  if (!tokenStoreInstance) {
    tokenStoreInstance = new TokenStore();
    
    // Cleanup every hour
    setInterval(() => {
      tokenStoreInstance?.cleanup();
    }, 60 * 60 * 1000);
  }
  return tokenStoreInstance;
}

/**
 * Reset token store (for testing)
 */
export function resetTokenStore(): void {
  if (tokenStoreInstance) {
    tokenStoreInstance.clear();
  }
  tokenStoreInstance = null;
}
