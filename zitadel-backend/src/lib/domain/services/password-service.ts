/**
 * Password Domain Service
 * 
 * Business logic for password validation and management
 */

import { PasswordComplexityPolicy, PasswordAgePolicy, PasswordLockoutPolicy } from '../policies';
import { throwInvalidArgument } from '@/zerrors/errors';
import * as bcrypt from 'bcrypt';

/**
 * Password service for validation and hashing
 */
export class PasswordService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly MIN_PASSWORD_LENGTH = 1;
  private static readonly MAX_PASSWORD_LENGTH = 72; // bcrypt limit

  /**
   * Validate password against policy
   */
  static validatePassword(
    password: string,
    policy: PasswordComplexityPolicy
  ): void {
    if (!password || password.length === 0) {
      throwInvalidArgument('Password cannot be empty', 'PASSWORD-001');
    }

    if (password.length < this.MIN_PASSWORD_LENGTH) {
      throwInvalidArgument(
        `Password must be at least ${this.MIN_PASSWORD_LENGTH} character`,
        'PASSWORD-002'
      );
    }

    if (password.length > this.MAX_PASSWORD_LENGTH) {
      throwInvalidArgument(
        `Password cannot exceed ${this.MAX_PASSWORD_LENGTH} characters`,
        'PASSWORD-003'
      );
    }

    const error = policy.getValidationError(password);
    if (error) {
      throwInvalidArgument(error, 'PASSWORD-004');
    }
  }

  /**
   * Hash password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    if (password.length > this.MAX_PASSWORD_LENGTH) {
      throwInvalidArgument(
        `Password cannot exceed ${this.MAX_PASSWORD_LENGTH} characters`,
        'PASSWORD-005'
      );
    }

    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate random password
   */
  static generateRandomPassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';
    
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill the rest
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  /**
   * Check if password is expired
   */
  static isPasswordExpired(
    passwordChangeDate: Date,
    policy: PasswordAgePolicy
  ): boolean {
    return policy.isExpired(passwordChangeDate);
  }

  /**
   * Check if password expiration warning should be shown
   */
  static shouldWarnPasswordExpiration(
    passwordChangeDate: Date,
    policy: PasswordAgePolicy
  ): boolean {
    return policy.shouldWarn(passwordChangeDate);
  }

  /**
   * Check if account should be locked due to failed attempts
   */
  static shouldLockAccount(
    failedAttempts: number,
    policy: PasswordLockoutPolicy
  ): boolean {
    return policy.shouldLock(failedAttempts);
  }

  /**
   * Get remaining password attempts
   */
  static getRemainingAttempts(
    failedAttempts: number,
    policy: PasswordLockoutPolicy
  ): number {
    return policy.getRemainingAttempts(failedAttempts);
  }
}

/**
 * Password verification result
 */
export interface PasswordVerificationResult {
  valid: boolean;
  expired: boolean;
  shouldWarn: boolean;
  shouldLock: boolean;
  remainingAttempts: number;
}

/**
 * Password verification with policies
 */
export class PasswordVerifier {
  constructor(
    private agePolicy: PasswordAgePolicy,
    private lockoutPolicy: PasswordLockoutPolicy
  ) {}

  /**
   * Verify password with all policies
   */
  async verify(
    password: string,
    hashedPassword: string,
    passwordChangeDate: Date,
    failedAttempts: number
  ): Promise<PasswordVerificationResult> {
    const valid = await PasswordService.verifyPassword(password, hashedPassword);
    
    return {
      valid,
      expired: PasswordService.isPasswordExpired(passwordChangeDate, this.agePolicy),
      shouldWarn: PasswordService.shouldWarnPasswordExpiration(
        passwordChangeDate,
        this.agePolicy
      ),
      shouldLock: PasswordService.shouldLockAccount(
        valid ? 0 : failedAttempts + 1,
        this.lockoutPolicy
      ),
      remainingAttempts: PasswordService.getRemainingAttempts(
        valid ? 0 : failedAttempts + 1,
        this.lockoutPolicy
      ),
    };
  }
}
