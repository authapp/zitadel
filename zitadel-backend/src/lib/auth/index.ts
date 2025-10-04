/**
 * Authentication module for Zitadel
 * 
 * Provides:
 * - User authentication (password, OAuth, MFA)
 * - Session management
 * - JWT token generation and verification
 * - Password policies
 */

export * from './types';
export * from './session-manager';
export * from './token-service';
export * from './auth-provider';

// Re-export commonly used types
export type {
  Session,
  TokenPayload,
  TokenPair,
  AuthRequest,
  AuthResult,
  MfaConfig,
  PasswordPolicy,
  AuthProvider,
  SessionManager,
  TokenService,
  PasswordHasher,
  ValidationResult,
  ValidationError,
} from './types';

export {
  MfaType,
  AuthenticationError,
  InvalidCredentialsError,
  MfaRequiredError,
  SessionExpiredError,
  TokenExpiredError,
  PasswordPolicyError,
} from './types';

export {
  CacheSessionManager,
  InMemorySessionManager,
  createSessionManager,
  createInMemorySessionManager,
} from './session-manager';

export {
  JwtTokenService,
  InMemoryTokenService,
  createTokenService,
  createInMemoryTokenService,
} from './token-service';

export {
  DefaultPasswordHasher,
  DefaultAuthProvider,
  InMemoryAuthProvider,
  createAuthProvider,
  createInMemoryAuthProvider,
} from './auth-provider';
