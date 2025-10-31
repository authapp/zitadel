/**
 * Token Store Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TokenStore, getTokenStore, resetTokenStore } from '../../../../src/api/oidc/token-store';

describe('TokenStore', () => {
  let tokenStore: TokenStore;

  beforeEach(() => {
    resetTokenStore();
    tokenStore = getTokenStore();
    tokenStore.clear();
  });

  describe('generateAuthorizationCode', () => {
    it('should generate authorization code', () => {
      const code = tokenStore.generateAuthorizationCode({
        client_id: 'test-client',
        redirect_uri: 'https://app.example.com/callback',
        scope: 'openid profile',
        user_id: 'user123',
      });

      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(10);
    });

    it('should store authorization code with metadata', () => {
      const params = {
        client_id: 'test-client',
        redirect_uri: 'https://app.example.com/callback',
        scope: 'openid profile email',
        user_id: 'user123',
        code_challenge: 'challenge123',
        code_challenge_method: 'S256',
        nonce: 'nonce123',
      };

      const code = tokenStore.generateAuthorizationCode(params);
      const authCode = tokenStore.consumeAuthorizationCode(code);

      expect(authCode).not.toBeNull();
      expect(authCode!.client_id).toBe(params.client_id);
      expect(authCode!.user_id).toBe(params.user_id);
      expect(authCode!.code_challenge).toBe(params.code_challenge);
      expect(authCode!.nonce).toBe(params.nonce);
    });
  });

  describe('consumeAuthorizationCode', () => {
    it('should consume authorization code (one-time use)', () => {
      const code = tokenStore.generateAuthorizationCode({
        client_id: 'test-client',
        redirect_uri: 'https://app.example.com/callback',
        scope: 'openid',
        user_id: 'user123',
      });

      const first = tokenStore.consumeAuthorizationCode(code);
      const second = tokenStore.consumeAuthorizationCode(code);

      expect(first).not.toBeNull();
      expect(second).toBeNull(); // Already consumed
    });

    it('should return null for non-existent code', () => {
      const authCode = tokenStore.consumeAuthorizationCode('invalid-code');
      
      expect(authCode).toBeNull();
    });

    it('should return null for expired code', () => {
      const code = tokenStore.generateAuthorizationCode({
        client_id: 'test-client',
        redirect_uri: 'https://app.example.com/callback',
        scope: 'openid',
        user_id: 'user123',
      });

      // Manually expire the code by setting old expiration
      const authCode = tokenStore['authCodes'].get(code);
      if (authCode) {
        authCode.expires_at = new Date(Date.now() - 1000); // 1 second ago
      }

      const result = tokenStore.consumeAuthorizationCode(code);
      expect(result).toBeNull();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token', () => {
      const token = tokenStore.generateRefreshToken({
        user_id: 'user123',
        client_id: 'test-client',
        scope: 'openid profile',
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);
    });

    it('should store refresh token with 30 day expiration', () => {
      const token = tokenStore.generateRefreshToken({
        user_id: 'user123',
        client_id: 'test-client',
        scope: 'openid',
      });

      const refreshToken = tokenStore.getRefreshToken(token);
      
      expect(refreshToken).not.toBeNull();
      expect(refreshToken!.user_id).toBe('user123');
      expect(refreshToken!.client_id).toBe('test-client');
      
      // Check expiration is ~30 days from now
      const expectedExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
      const actualExpiry = refreshToken!.expires_at.getTime();
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('getRefreshToken', () => {
    it('should retrieve refresh token', () => {
      const token = tokenStore.generateRefreshToken({
        user_id: 'user123',
        client_id: 'test-client',
        scope: 'openid',
      });

      const refreshToken = tokenStore.getRefreshToken(token);
      
      expect(refreshToken).not.toBeNull();
      expect(refreshToken!.token).toBe(token);
    });

    it('should return null for non-existent token', () => {
      const refreshToken = tokenStore.getRefreshToken('invalid-token');
      
      expect(refreshToken).toBeNull();
    });

    it('should return null for expired token', () => {
      const token = tokenStore.generateRefreshToken({
        user_id: 'user123',
        client_id: 'test-client',
        scope: 'openid',
      });

      // Manually expire the token
      const refreshToken = tokenStore['refreshTokens'].get(token);
      if (refreshToken) {
        refreshToken.expires_at = new Date(Date.now() - 1000);
      }

      const result = tokenStore.getRefreshToken(token);
      expect(result).toBeNull();
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke refresh token', () => {
      const token = tokenStore.generateRefreshToken({
        user_id: 'user123',
        client_id: 'test-client',
        scope: 'openid',
      });

      const revoked = tokenStore.revokeRefreshToken(token);
      const retrieved = tokenStore.getRefreshToken(token);

      expect(revoked).toBe(true);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent token', () => {
      const revoked = tokenStore.revokeRefreshToken('invalid-token');
      
      expect(revoked).toBe(false);
    });
  });

  describe('trackAccessToken', () => {
    it('should track access token by user and jti', () => {
      tokenStore.trackAccessToken('user123', 'jti-abc');
      
      // No direct way to verify tracking, but should not throw
      expect(() => {
        tokenStore.trackAccessToken('user123', 'jti-def');
      }).not.toThrow();
    });
  });

  describe('revokeAccessToken', () => {
    it('should revoke access token', () => {
      const jti = 'jti-abc';
      tokenStore.trackAccessToken('user123', jti);
      
      tokenStore.revokeAccessToken(jti);
      const isRevoked = tokenStore.isAccessTokenRevoked(jti);
      
      expect(isRevoked).toBe(true);
    });
  });

  describe('isAccessTokenRevoked', () => {
    it('should return false for non-revoked token', () => {
      const isRevoked = tokenStore.isAccessTokenRevoked('jti-abc');
      
      expect(isRevoked).toBe(false);
    });

    it('should return true for revoked token', () => {
      const jti = 'jti-abc';
      tokenStore.revokeAccessToken(jti);
      const isRevoked = tokenStore.isAccessTokenRevoked(jti);
      
      expect(isRevoked).toBe(true);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for user', () => {
      const userId = 'user123';
      
      // Create tokens
      tokenStore.trackAccessToken(userId, 'jti-1');
      tokenStore.trackAccessToken(userId, 'jti-2');
      const refreshToken = tokenStore.generateRefreshToken({
        user_id: userId,
        client_id: 'test-client',
        scope: 'openid',
      });
      
      // Revoke all
      tokenStore.revokeAllUserTokens(userId);
      
      // Verify revocation
      expect(tokenStore.isAccessTokenRevoked('jti-1')).toBe(true);
      expect(tokenStore.isAccessTokenRevoked('jti-2')).toBe(true);
      expect(tokenStore.getRefreshToken(refreshToken)).toBeNull();
    });
  });

  describe('createSession', () => {
    it('should create session with 24 hour expiration', () => {
      const session = tokenStore.createSession({
        user_id: 'user123',
        client_id: 'test-client',
      });

      expect(session.session_id).toBeDefined();
      expect(session.user_id).toBe('user123');
      expect(session.client_id).toBe('test-client');
      
      // Check expiration is ~24 hours from now
      const expectedExpiry = Date.now() + 24 * 60 * 60 * 1000;
      const actualExpiry = session.expires_at.getTime();
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000);
    });
  });

  describe('getSession', () => {
    it('should retrieve session', () => {
      const created = tokenStore.createSession({
        user_id: 'user123',
        client_id: 'test-client',
      });

      const retrieved = tokenStore.getSession(created.session_id);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.session_id).toBe(created.session_id);
      expect(retrieved!.user_id).toBe('user123');
    });

    it('should update last_used_at on retrieval', (done) => {
      const created = tokenStore.createSession({
        user_id: 'user123',
        client_id: 'test-client',
      });

      const initialLastUsed = created.last_used_at.getTime();
      
      // Wait a bit then verify
      setTimeout(() => {
        const retrieved = tokenStore.getSession(created.session_id);
        if (retrieved) {
          expect(retrieved.last_used_at.getTime()).toBeGreaterThanOrEqual(initialLastUsed);
          done();
        } else {
          done(new Error('Session not found'));
        }
      }, 10);
    });

    it('should return null for non-existent session', () => {
      const session = tokenStore.getSession('invalid-session-id');
      
      expect(session).toBeNull();
    });

    it('should return null for expired session', () => {
      const created = tokenStore.createSession({
        user_id: 'user123',
        client_id: 'test-client',
      });

      // Manually expire the session
      created.expires_at = new Date(Date.now() - 1000);

      const retrieved = tokenStore.getSession(created.session_id);
      expect(retrieved).toBeNull();
    });
  });

  describe('revokeSession', () => {
    it('should revoke session', () => {
      const session = tokenStore.createSession({
        user_id: 'user123',
        client_id: 'test-client',
      });

      const revoked = tokenStore.revokeSession(session.session_id);
      const retrieved = tokenStore.getSession(session.session_id);

      expect(revoked).toBe(true);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent session', () => {
      const revoked = tokenStore.revokeSession('invalid-session-id');
      
      expect(revoked).toBe(false);
    });
  });

  describe('getUserSessions', () => {
    it('should return all sessions for user', () => {
      const userId = 'user123';
      
      tokenStore.createSession({ user_id: userId, client_id: 'client1' });
      tokenStore.createSession({ user_id: userId, client_id: 'client2' });
      tokenStore.createSession({ user_id: 'other-user', client_id: 'client3' });
      
      const sessions = tokenStore.getUserSessions(userId);
      
      expect(sessions.length).toBe(2);
      expect(sessions.every(s => s.user_id === userId)).toBe(true);
    });

    it('should not include expired sessions', () => {
      const userId = 'user123';
      
      const session1 = tokenStore.createSession({ user_id: userId, client_id: 'client1' });
      const session2 = tokenStore.createSession({ user_id: userId, client_id: 'client2' });
      
      // Expire session1
      session1.expires_at = new Date(Date.now() - 1000);
      
      const sessions = tokenStore.getUserSessions(userId);
      
      expect(sessions.length).toBe(1);
      expect(sessions[0].session_id).toBe(session2.session_id);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      // Create entries
      const code = tokenStore.generateAuthorizationCode({
        client_id: 'test-client',
        redirect_uri: 'https://app.example.com/callback',
        scope: 'openid',
        user_id: 'user123',
      });

      const refreshToken = tokenStore.generateRefreshToken({
        user_id: 'user123',
        client_id: 'test-client',
        scope: 'openid',
      });

      const session = tokenStore.createSession({
        user_id: 'user123',
        client_id: 'test-client',
      });

      // Manually expire them
      const authCode = tokenStore['authCodes'].get(code);
      if (authCode) authCode.expires_at = new Date(Date.now() - 1000);
      
      const rt = tokenStore['refreshTokens'].get(refreshToken);
      if (rt) rt.expires_at = new Date(Date.now() - 1000);
      
      session.expires_at = new Date(Date.now() - 1000);

      // Cleanup
      tokenStore.cleanup();

      // Verify cleanup
      expect(tokenStore.consumeAuthorizationCode(code)).toBeNull();
      expect(tokenStore.getRefreshToken(refreshToken)).toBeNull();
      expect(tokenStore.getSession(session.session_id)).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      // Create data
      tokenStore.generateAuthorizationCode({
        client_id: 'test-client',
        redirect_uri: 'https://app.example.com/callback',
        scope: 'openid',
        user_id: 'user123',
      });

      tokenStore.generateRefreshToken({
        user_id: 'user123',
        client_id: 'test-client',
        scope: 'openid',
      });

      tokenStore.createSession({
        user_id: 'user123',
        client_id: 'test-client',
      });

      tokenStore.trackAccessToken('user123', 'jti-1');

      // Clear
      tokenStore.clear();

      // Verify cleared
      expect(tokenStore.getUserSessions('user123').length).toBe(0);
      expect(tokenStore.isAccessTokenRevoked('jti-1')).toBe(false);
    });
  });
});
