import {
  InMemorySessionManager,
  createInMemorySessionManager,
} from './session-manager';
import {
  InMemoryTokenService,
  createInMemoryTokenService,
} from './token-service';
import {
  InMemoryAuthProvider,
  createInMemoryAuthProvider,
} from './auth-provider';
import {
  SessionExpiredError,
  TokenExpiredError,
  AuthRequest,
  TokenPayload,
} from './types';

describe('InMemorySessionManager', () => {
  let sessionManager: InMemorySessionManager;

  beforeEach(() => {
    sessionManager = createInMemorySessionManager(60000); // 1 minute TTL
  });

  describe('create', () => {
    it('should create new session', async () => {
      const session = await sessionManager.create('user123', 'instance1');
      
      expect(session.id).toBeDefined();
      expect(session.userId).toBe('user123');
      expect(session.instanceId).toBe('instance1');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.lastActivityAt).toBeInstanceOf(Date);
    });

    it('should create session with metadata', async () => {
      const metadata = { ip: '127.0.0.1', device: 'mobile' };
      const session = await sessionManager.create('user123', 'instance1', metadata);
      
      expect(session.metadata).toEqual(metadata);
    });

    it('should set expiration time correctly', async () => {
      const session = await sessionManager.create('user123', 'instance1');
      
      const expectedExpiration = new Date(session.createdAt.getTime() + 60000);
      expect(session.expiresAt.getTime()).toBeCloseTo(expectedExpiration.getTime(), -3);
    });
  });

  describe('get', () => {
    it('should get existing session', async () => {
      const created = await sessionManager.create('user123', 'instance1');
      const retrieved = await sessionManager.get(created.id);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.userId).toBe('user123');
    });

    it('should return null for non-existent session', async () => {
      const session = await sessionManager.get('non-existent');
      expect(session).toBeNull();
    });
  });

  describe('updateActivity', () => {
    it('should update last activity time', async () => {
      const session = await sessionManager.create('user123', 'instance1');
      const originalActivity = session.lastActivityAt;
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await sessionManager.updateActivity(session.id);
      const updated = await sessionManager.get(session.id);
      
      expect(updated!.lastActivityAt.getTime()).toBeGreaterThan(originalActivity.getTime());
    });

    it('should throw error for non-existent session', async () => {
      await expect(sessionManager.updateActivity('non-existent'))
        .rejects.toThrow(SessionExpiredError);
    });
  });

  describe('delete', () => {
    it('should delete session', async () => {
      const session = await sessionManager.create('user123', 'instance1');
      await sessionManager.delete(session.id);
      
      const retrieved = await sessionManager.get(session.id);
      expect(retrieved).toBeNull();
    });

    it('should not throw error when deleting non-existent session', async () => {
      await expect(sessionManager.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('deleteAllForUser', () => {
    it('should delete all user sessions', async () => {
      const session1 = await sessionManager.create('user123', 'instance1');
      const session2 = await sessionManager.create('user123', 'instance1');
      const session3 = await sessionManager.create('user456', 'instance1');
      
      await sessionManager.deleteAllForUser('user123');
      
      expect(await sessionManager.get(session1.id)).toBeNull();
      expect(await sessionManager.get(session2.id)).toBeNull();
      expect(await sessionManager.get(session3.id)).not.toBeNull();
    });
  });

  describe('isValid', () => {
    it('should return true for valid session', async () => {
      const session = await sessionManager.create('user123', 'instance1');
      const valid = await sessionManager.isValid(session.id);
      
      expect(valid).toBe(true);
    });

    it('should return false for non-existent session', async () => {
      const valid = await sessionManager.isValid('non-existent');
      expect(valid).toBe(false);
    });

    it('should return false for expired session', async () => {
      const shortLivedManager = createInMemorySessionManager(1); // 1ms TTL
      const session = await shortLivedManager.create('user123', 'instance1');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const valid = await shortLivedManager.isValid(session.id);
      expect(valid).toBe(false);
    });
  });

  describe('cleanupExpired', () => {
    it('should remove expired sessions', async () => {
      const shortLivedManager = createInMemorySessionManager(1);
      const session1 = await shortLivedManager.create('user123', 'instance1');
      const session2 = await shortLivedManager.create('user456', 'instance1');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const count = await shortLivedManager.cleanupExpired();
      
      expect(count).toBe(2);
      expect(await shortLivedManager.get(session1.id)).toBeNull();
      expect(await shortLivedManager.get(session2.id)).toBeNull();
    });
  });
});

describe('InMemoryTokenService', () => {
  let tokenService: InMemoryTokenService;

  beforeEach(() => {
    tokenService = createInMemoryTokenService();
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh tokens', async () => {
      const payload: TokenPayload = {
        sub: 'user123',
        iss: 'zitadel',
        aud: 'zitadel-api',
        exp: 0,
        iat: 0,
      };
      
      const tokenPair = await tokenService.generateTokenPair(payload);
      
      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.expiresIn).toBeGreaterThan(0);
      expect(tokenPair.tokenType).toBe('Bearer');
    });

    it('should generate different tokens each time', async () => {
      const payload: TokenPayload = {
        sub: 'user123',
        iss: 'zitadel',
        aud: 'zitadel-api',
        exp: 0,
        iat: 0,
      };
      
      const pair1 = await tokenService.generateTokenPair(payload);
      const pair2 = await tokenService.generateTokenPair(payload);
      
      expect(pair1.accessToken).not.toBe(pair2.accessToken);
      expect(pair1.refreshToken).not.toBe(pair2.refreshToken);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const payload: TokenPayload = {
        sub: 'user123',
        iss: 'zitadel',
        aud: 'zitadel-api',
        exp: 0,
        iat: 0,
        email: 'user@example.com',
      };
      
      const tokenPair = await tokenService.generateTokenPair(payload);
      const verified = await tokenService.verifyToken(tokenPair.accessToken);
      
      expect(verified.sub).toBe('user123');
      expect(verified.jti).toBeDefined();
    });

    it('should throw error for invalid token', async () => {
      await expect(tokenService.verifyToken('invalid-token'))
        .rejects.toThrow(TokenExpiredError);
    });
  });

  describe('refreshToken', () => {
    it('should generate new token pair from refresh token', async () => {
      const payload: TokenPayload = {
        sub: 'user123',
        iss: 'zitadel',
        aud: 'zitadel-api',
        exp: 0,
        iat: 0,
      };
      
      const original = await tokenService.generateTokenPair(payload);
      const refreshed = await tokenService.refreshToken(original.refreshToken);
      
      expect(refreshed.accessToken).toBeDefined();
      expect(refreshed.refreshToken).toBeDefined();
      expect(refreshed.accessToken).not.toBe(original.accessToken);
    });

    it('should revoke old refresh token', async () => {
      const payload: TokenPayload = {
        sub: 'user123',
        iss: 'zitadel',
        aud: 'zitadel-api',
        exp: 0,
        iat: 0,
      };
      
      const original = await tokenService.generateTokenPair(payload);
      await tokenService.refreshToken(original.refreshToken);
      
      // Original refresh token should no longer work
      await expect(tokenService.refreshToken(original.refreshToken))
        .rejects.toThrow();
    });

    it('should throw error for access token', async () => {
      const payload: TokenPayload = {
        sub: 'user123',
        iss: 'zitadel',
        aud: 'zitadel-api',
        exp: 0,
        iat: 0,
      };
      
      const tokenPair = await tokenService.generateTokenPair(payload);
      
      await expect(tokenService.refreshToken(tokenPair.accessToken))
        .rejects.toThrow('Invalid refresh token');
    });
  });

  describe('revokeToken', () => {
    it('should revoke token', async () => {
      const payload: TokenPayload = {
        sub: 'user123',
        iss: 'zitadel',
        aud: 'zitadel-api',
        exp: 0,
        iat: 0,
      };
      
      const tokenPair = await tokenService.generateTokenPair(payload);
      await tokenService.revokeToken(tokenPair.accessToken);
      
      await expect(tokenService.verifyToken(tokenPair.accessToken))
        .rejects.toThrow(TokenExpiredError);
    });
  });
});

describe('InMemoryAuthProvider', () => {
  let authProvider: InMemoryAuthProvider;
  let sessionManager: InMemorySessionManager;
  let tokenService: InMemoryTokenService;

  beforeEach(() => {
    sessionManager = createInMemorySessionManager();
    tokenService = createInMemoryTokenService();
    authProvider = createInMemoryAuthProvider(sessionManager, tokenService);
  });

  describe('authenticate', () => {
    it('should authenticate valid credentials', async () => {
      authProvider.addUser('testuser', 'password123', 'test@example.com');
      
      const request: AuthRequest = {
        username: 'testuser',
        password: 'password123',
        instanceId: 'instance1',
      };
      
      const result = await authProvider.authenticate(request);
      
      expect(result.success).toBe(true);
      expect(result.userId).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.tokens!.accessToken).toBeDefined();
      expect(result.tokens!.refreshToken).toBeDefined();
    });

    it('should reject invalid username', async () => {
      const request: AuthRequest = {
        username: 'nonexistent',
        password: 'password123',
        instanceId: 'instance1',
      };
      
      const result = await authProvider.authenticate(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid password', async () => {
      authProvider.addUser('testuser', 'password123', 'test@example.com');
      
      const request: AuthRequest = {
        username: 'testuser',
        password: 'wrongpassword',
        instanceId: 'instance1',
      };
      
      const result = await authProvider.authenticate(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should require MFA when enabled', async () => {
      authProvider.addUser('testuser', 'password123', 'test@example.com', true);
      
      const request: AuthRequest = {
        username: 'testuser',
        password: 'password123',
        instanceId: 'instance1',
      };
      
      const result = await authProvider.authenticate(request);
      
      expect(result.success).toBe(false);
      expect(result.requiresMfa).toBe(true);
      expect(result.mfaToken).toBeDefined();
    });

    it('should authenticate with valid MFA code', async () => {
      authProvider.addUser('testuser', 'password123', 'test@example.com', true);
      
      const request: AuthRequest = {
        username: 'testuser',
        password: 'password123',
        instanceId: 'instance1',
        mfaCode: '123456',
      };
      
      const result = await authProvider.authenticate(request);
      
      expect(result.success).toBe(true);
      expect(result.tokens).toBeDefined();
    });
  });

  describe('verifyMfa', () => {
    it('should verify valid 6-digit code', async () => {
      const valid = await authProvider.verifyMfa('user123', '123456', 'totp' as any);
      expect(valid).toBe(true);
    });

    it('should reject invalid code format', async () => {
      const valid = await authProvider.verifyMfa('user123', 'abc123', 'totp' as any);
      expect(valid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should accept valid password', async () => {
      const result = await authProvider.validatePassword('ValidPass123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short password', async () => {
      const result = await authProvider.validatePassword('short');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe('MIN_LENGTH');
    });
  });
});
