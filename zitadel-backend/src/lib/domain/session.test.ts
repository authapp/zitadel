import {
  SessionState,
  TokenType,
  Session,
  Token,
  RefreshToken,
  isSessionActive,
  isTokenExpired,
  isRefreshTokenIdleExpired,
} from './session';

describe('SessionState enum', () => {
  it('should have correct values', () => {
    expect(SessionState.UNSPECIFIED).toBe(0);
    expect(SessionState.ACTIVE).toBe(1);
    expect(SessionState.TERMINATED).toBe(2);
  });
});

describe('TokenType enum', () => {
  it('should have correct values', () => {
    expect(TokenType.ACCESS_TOKEN).toBe('access_token');
    expect(TokenType.REFRESH_TOKEN).toBe('refresh_token');
    expect(TokenType.ID_TOKEN).toBe('id_token');
  });
});

describe('isSessionActive', () => {
  it('should return true for active session without expiry', () => {
    const session: Session = {
      id: 'session-123',
      userId: 'user-123',
      state: SessionState.ACTIVE,
      createdAt: new Date(),
      changedAt: new Date(),
      sequence: 1,
    };

    expect(isSessionActive(session)).toBe(true);
  });

  it('should return true for active session with future expiry', () => {
    const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
    const session: Session = {
      id: 'session-123',
      userId: 'user-123',
      state: SessionState.ACTIVE,
      createdAt: new Date(),
      changedAt: new Date(),
      expiresAt: futureDate,
      sequence: 1,
    };

    expect(isSessionActive(session)).toBe(true);
  });

  it('should return false for active session with past expiry', () => {
    const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
    const session: Session = {
      id: 'session-123',
      userId: 'user-123',
      state: SessionState.ACTIVE,
      createdAt: new Date(),
      changedAt: new Date(),
      expiresAt: pastDate,
      sequence: 1,
    };

    expect(isSessionActive(session)).toBe(false);
  });

  it('should return false for terminated session', () => {
    const session: Session = {
      id: 'session-123',
      userId: 'user-123',
      state: SessionState.TERMINATED,
      createdAt: new Date(),
      changedAt: new Date(),
      sequence: 1,
    };

    expect(isSessionActive(session)).toBe(false);
  });
});

describe('isTokenExpired', () => {
  it('should return false for token with future expiry', () => {
    const futureDate = new Date(Date.now() + 3600000);
    const token: Token = {
      id: 'token-123',
      userId: 'user-123',
      applicationId: 'app-123',
      type: TokenType.ACCESS_TOKEN,
      expiresAt: futureDate,
      scopes: ['openid', 'profile'],
      audience: ['app-123'],
      createdAt: new Date(),
    };

    expect(isTokenExpired(token)).toBe(false);
  });

  it('should return true for token with past expiry', () => {
    const pastDate = new Date(Date.now() - 3600000);
    const token: Token = {
      id: 'token-123',
      userId: 'user-123',
      applicationId: 'app-123',
      type: TokenType.ACCESS_TOKEN,
      expiresAt: pastDate,
      scopes: ['openid', 'profile'],
      audience: ['app-123'],
      createdAt: new Date(),
    };

    expect(isTokenExpired(token)).toBe(true);
  });
});

describe('isRefreshTokenIdleExpired', () => {
  it('should return false for refresh token with future idle expiry', () => {
    const futureDate = new Date(Date.now() + 3600000);
    const token: RefreshToken = {
      id: 'token-123',
      userId: 'user-123',
      applicationId: 'app-123',
      type: TokenType.REFRESH_TOKEN,
      expiresAt: futureDate,
      idleExpiresAt: futureDate,
      scopes: ['openid', 'offline_access'],
      audience: ['app-123'],
      amr: ['pwd'],
      createdAt: new Date(),
    };

    expect(isRefreshTokenIdleExpired(token)).toBe(false);
  });

  it('should return true for refresh token with past idle expiry', () => {
    const futureDate = new Date(Date.now() + 3600000);
    const pastDate = new Date(Date.now() - 3600000);
    const token: RefreshToken = {
      id: 'token-123',
      userId: 'user-123',
      applicationId: 'app-123',
      type: TokenType.REFRESH_TOKEN,
      expiresAt: futureDate,
      idleExpiresAt: pastDate,
      scopes: ['openid', 'offline_access'],
      audience: ['app-123'],
      amr: ['pwd'],
      createdAt: new Date(),
    };

    expect(isRefreshTokenIdleExpired(token)).toBe(true);
  });
});
