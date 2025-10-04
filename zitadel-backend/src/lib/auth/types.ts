/**
 * Authentication types and interfaces for Zitadel
 */

/**
 * Session represents an authenticated user session
 */
export interface Session {
  id: string;
  userId: string;
  instanceId: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Token payload for JWT tokens
 */
export interface TokenPayload {
  sub: string; // Subject (user ID)
  iss: string; // Issuer
  aud: string; // Audience
  exp: number; // Expiration time
  iat: number; // Issued at
  nbf?: number; // Not before
  jti?: string; // JWT ID
  
  // Zitadel-specific claims
  instance_id?: string;
  org_id?: string;
  project_id?: string;
  roles?: string[];
  email?: string;
  email_verified?: boolean;
  
  // Custom claims
  [key: string]: any;
}

/**
 * Token pair (access + refresh)
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Authentication request
 */
export interface AuthRequest {
  username: string;
  password: string;
  instanceId: string;
  mfaCode?: string;
  rememberMe?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  userId?: string;
  sessionId?: string;
  tokens?: TokenPair;
  requiresMfa?: boolean;
  mfaToken?: string;
  error?: string;
}

/**
 * MFA (Multi-Factor Authentication) types
 */
export enum MfaType {
  TOTP = 'totp',
  SMS = 'sms',
  EMAIL = 'email',
  U2F = 'u2f',
  WEBAUTHN = 'webauthn',
}

/**
 * MFA configuration
 */
export interface MfaConfig {
  type: MfaType;
  enabled: boolean;
  verified: boolean;
  secret?: string;
  backupCodes?: string[];
  createdAt: Date;
  lastUsedAt?: Date;
}

/**
 * Password policy
 */
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  maxAge?: number; // Days
  preventReuse?: number; // Number of previous passwords
}

/**
 * Authentication provider interface
 */
export interface AuthProvider {
  /**
   * Authenticate user with credentials
   */
  authenticate(request: AuthRequest): Promise<AuthResult>;

  /**
   * Verify MFA code
   */
  verifyMfa(userId: string, code: string, type: MfaType): Promise<boolean>;

  /**
   * Validate password against policy
   */
  validatePassword(password: string, policy?: PasswordPolicy): Promise<ValidationResult>;
}

/**
 * Session manager interface
 */
export interface SessionManager {
  /**
   * Create new session
   */
  create(userId: string, instanceId: string, metadata?: Record<string, any>): Promise<Session>;

  /**
   * Get session by ID
   */
  get(sessionId: string): Promise<Session | null>;

  /**
   * Update session activity
   */
  updateActivity(sessionId: string): Promise<void>;

  /**
   * Delete session
   */
  delete(sessionId: string): Promise<void>;

  /**
   * Delete all sessions for user
   */
  deleteAllForUser(userId: string): Promise<void>;

  /**
   * Check if session is valid
   */
  isValid(sessionId: string): Promise<boolean>;

  /**
   * Cleanup expired sessions
   */
  cleanupExpired(): Promise<number>;
}

/**
 * Token service interface
 */
export interface TokenService {
  /**
   * Generate token pair
   */
  generateTokenPair(payload: TokenPayload): Promise<TokenPair>;

  /**
   * Verify and decode token
   */
  verifyToken(token: string): Promise<TokenPayload>;

  /**
   * Refresh access token
   */
  refreshToken(refreshToken: string): Promise<TokenPair>;

  /**
   * Revoke token
   */
  revokeToken(token: string): Promise<void>;
}

/**
 * Password hasher interface
 */
export interface PasswordHasher {
  /**
   * Hash password
   */
  hash(password: string): Promise<string>;

  /**
   * Verify password against hash
   */
  verify(password: string, hash: string): Promise<boolean>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Authentication errors
 */
export class AuthenticationError extends Error {
  constructor(message: string, public code: string = 'AUTHENTICATION_ERROR') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class InvalidCredentialsError extends AuthenticationError {
  constructor() {
    super('Invalid username or password', 'INVALID_CREDENTIALS');
    this.name = 'InvalidCredentialsError';
  }
}

export class MfaRequiredError extends AuthenticationError {
  constructor(public mfaToken: string) {
    super('MFA verification required', 'MFA_REQUIRED');
    this.name = 'MfaRequiredError';
  }
}

export class SessionExpiredError extends AuthenticationError {
  constructor() {
    super('Session has expired', 'SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor() {
    super('Token has expired', 'TOKEN_EXPIRED');
    this.name = 'TokenExpiredError';
  }
}

export class PasswordPolicyError extends AuthenticationError {
  constructor(public violations: ValidationError[]) {
    super('Password does not meet policy requirements', 'PASSWORD_POLICY_VIOLATION');
    this.name = 'PasswordPolicyError';
  }
}
