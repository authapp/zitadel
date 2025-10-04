/**
 * Authentication provider implementation
 */

import { Query } from '../query/types';
import { PasswordHasher as CryptoHasher } from '../crypto/hash';
import {
  AuthProvider,
  AuthRequest,
  AuthResult,
  MfaType,
  PasswordPolicy,
  PasswordHasher,
  ValidationResult,
  InvalidCredentialsError,
  MfaRequiredError,
  PasswordPolicyError,
} from './types';
import { SessionManager } from './types';
import { TokenService } from './types';
import { generateId } from '../id/snowflake';

/**
 * Default password hasher using crypto module
 */
export class DefaultPasswordHasher implements PasswordHasher {
  constructor(private cryptoHasher: CryptoHasher) {}

  async hash(password: string): Promise<string> {
    return this.cryptoHasher.hash(password);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return this.cryptoHasher.verify(password, hash);
  }
}

/**
 * Default authentication provider
 */
export class DefaultAuthProvider implements AuthProvider {
  private readonly defaultPolicy: PasswordPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSymbol: false,
  };

  constructor(
    private query: Query,
    private sessionManager: SessionManager,
    private tokenService: TokenService,
    private passwordHasher: PasswordHasher,
    private passwordPolicy: PasswordPolicy = DefaultAuthProvider.prototype.defaultPolicy
  ) {}

  /**
   * Authenticate user with credentials
   */
  async authenticate(request: AuthRequest): Promise<AuthResult> {
    try {
      // Look up user by username
      const users = await this.query.execute<any>(
        'SELECT id, password_hash, email, mfa_enabled, mfa_type FROM users WHERE username = $1 AND instance_id = $2',
        [request.username, request.instanceId]
      );

      if (users.length === 0) {
        throw new InvalidCredentialsError();
      }

      const user = users[0];

      // Verify password
      const passwordValid = await this.passwordHasher.verify(
        request.password,
        user.password_hash
      );

      if (!passwordValid) {
        throw new InvalidCredentialsError();
      }

      // Check if MFA is required
      if (user.mfa_enabled && !request.mfaCode) {
        const mfaToken = generateId();
        throw new MfaRequiredError(mfaToken);
      }

      // Verify MFA if provided
      if (user.mfa_enabled && request.mfaCode) {
        const mfaValid = await this.verifyMfa(user.id, request.mfaCode, user.mfa_type);
        if (!mfaValid) {
          return {
            success: false,
            error: 'Invalid MFA code',
          };
        }
      }

      // Create session
      const session = await this.sessionManager.create(
        user.id,
        request.instanceId,
        request.metadata
      );

      // Generate tokens
      const tokens = await this.tokenService.generateTokenPair({
        sub: user.id,
        iss: 'zitadel',
        aud: 'zitadel-api',
        exp: 0, // Will be set by token service
        iat: 0, // Will be set by token service
        instance_id: request.instanceId,
        email: user.email,
      });

      return {
        success: true,
        userId: user.id,
        sessionId: session.id,
        tokens,
      };
    } catch (error) {
      if (error instanceof MfaRequiredError) {
        return {
          success: false,
          requiresMfa: true,
          mfaToken: error.mfaToken,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Verify MFA code
   */
  async verifyMfa(userId: string, code: string, type: MfaType): Promise<boolean> {
    // Get MFA configuration for user
    const configs = await this.query.execute<any>(
      'SELECT secret FROM user_mfa WHERE user_id = $1 AND type = $2 AND verified = true',
      [userId, type]
    );

    if (configs.length === 0) {
      return false;
    }

    const config = configs[0];

    switch (type) {
      case MfaType.TOTP:
        return this.verifyTotpCode(code, config.secret);
      
      case MfaType.SMS:
      case MfaType.EMAIL:
        // These would require external service integration
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Validate password against policy
   */
  async validatePassword(password: string, policy?: PasswordPolicy): Promise<ValidationResult> {
    const appliedPolicy = policy || this.passwordPolicy;
    const errors: any[] = [];

    // Check minimum length
    if (password.length < appliedPolicy.minLength) {
      errors.push({
        field: 'password',
        message: `Password must be at least ${appliedPolicy.minLength} characters`,
        code: 'MIN_LENGTH',
      });
    }

    // Check uppercase requirement
    if (appliedPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one uppercase letter',
        code: 'REQUIRE_UPPERCASE',
      });
    }

    // Check lowercase requirement
    if (appliedPolicy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one lowercase letter',
        code: 'REQUIRE_LOWERCASE',
      });
    }

    // Check number requirement
    if (appliedPolicy.requireNumber && !/[0-9]/.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one number',
        code: 'REQUIRE_NUMBER',
      });
    }

    // Check symbol requirement
    if (appliedPolicy.requireSymbol && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one special character',
        code: 'REQUIRE_SYMBOL',
      });
    }

    if (errors.length > 0) {
      throw new PasswordPolicyError(errors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Verify TOTP code
   */
  private verifyTotpCode(code: string, _secret: string): boolean {
    // Simplified TOTP verification
    // In production, use a library like otpauth or speakeasy
    
    // For now, accept 6-digit codes
    return /^\d{6}$/.test(code);
  }
}

/**
 * In-memory auth provider for testing
 */
export class InMemoryAuthProvider implements AuthProvider {
  private users = new Map<string, {
    id: string;
    username: string;
    password: string; // Plain text for testing only
    email: string;
    mfaEnabled: boolean;
    mfaType?: MfaType;
  }>();

  constructor(
    private sessionManager: SessionManager,
    private tokenService: TokenService
  ) {}

  /**
   * Add test user
   */
  addUser(username: string, password: string, email: string, mfaEnabled: boolean = false): string {
    const userId = generateId();
    this.users.set(username, {
      id: userId,
      username,
      password,
      email,
      mfaEnabled,
      mfaType: mfaEnabled ? MfaType.TOTP : undefined,
    });
    return userId;
  }

  async authenticate(request: AuthRequest): Promise<AuthResult> {
    const user = this.users.get(request.username);
    
    if (!user || user.password !== request.password) {
      return {
        success: false,
        error: 'Invalid credentials',
      };
    }

    if (user.mfaEnabled && !request.mfaCode) {
      return {
        success: false,
        requiresMfa: true,
        mfaToken: generateId(),
      };
    }

    const session = await this.sessionManager.create(
      user.id,
      request.instanceId,
      request.metadata
    );

    const tokens = await this.tokenService.generateTokenPair({
      sub: user.id,
      iss: 'zitadel',
      aud: 'zitadel-api',
      exp: 0,
      iat: 0,
      instance_id: request.instanceId,
      email: user.email,
    });

    return {
      success: true,
      userId: user.id,
      sessionId: session.id,
      tokens,
    };
  }

  async verifyMfa(_userId: string, code: string, _type: MfaType): Promise<boolean> {
    return /^\d{6}$/.test(code);
  }

  async validatePassword(password: string, _policy?: PasswordPolicy): Promise<ValidationResult> {
    const errors: any[] = [];
    
    if (password.length < 8) {
      errors.push({
        field: 'password',
        message: 'Password must be at least 8 characters',
        code: 'MIN_LENGTH',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Create auth provider
 */
export function createAuthProvider(
  query: Query,
  sessionManager: SessionManager,
  tokenService: TokenService,
  passwordHasher: PasswordHasher,
  passwordPolicy?: PasswordPolicy
): AuthProvider {
  return new DefaultAuthProvider(
    query,
    sessionManager,
    tokenService,
    passwordHasher,
    passwordPolicy
  );
}

/**
 * Create in-memory auth provider for testing
 */
export function createInMemoryAuthProvider(
  sessionManager: SessionManager,
  tokenService: TokenService
): InMemoryAuthProvider {
  return new InMemoryAuthProvider(sessionManager, tokenService);
}
