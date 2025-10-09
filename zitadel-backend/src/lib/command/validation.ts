/**
 * Validation Utilities
 * 
 * Common validation functions for command data
 * Uses domain validators for core business logic
 */

import { throwInvalidArgument, throwPreconditionFailed } from '@/zerrors/errors';
import {
  validateEmailAddress,
  validatePhoneNumber as domainValidatePhone,
  validateUsername as domainValidateUsername,
  validateDomainName,
  validateURL as domainValidateURL,
} from '../domain/validators';

/**
 * Validate email format (uses domain validator)
 */
export function validateEmail(email: string, fieldName: string = 'email'): void {
  try {
    validateEmailAddress(email);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throwInvalidArgument(`${fieldName} has invalid format`, 'COMMAND-Email2');
  }
}

/**
 * Check if email is valid (boolean return)
 */
export function isValidEmail(email: string): boolean {
  try {
    validateEmailAddress(email);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate username (uses domain validator + additional length check)
 */
export function validateUsername(username: string, minLength: number = 3): void {
  domainValidateUsername(username);
  
  if (username.length < minLength) {
    throwInvalidArgument(
      `username must be at least ${minLength} characters`,
      'COMMAND-User2'
    );
  }
  
  // Allow alphanumeric, dots, underscores, @ (for email-style), and hyphens
  const usernameRegex = /^[a-zA-Z0-9._@-]+$/;
  if (!usernameRegex.test(username)) {
    throwInvalidArgument(
      'username contains invalid characters',
      'COMMAND-User3'
    );
  }
}

/**
 * Validate password against policy
 */
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
}

export function validatePassword(password: string, policy: PasswordPolicy): void {
  if (!password) {
    throwInvalidArgument('password is required', 'COMMAND-Pass1');
  }
  
  if (password.length < policy.minLength) {
    throwInvalidArgument(
      `password must be at least ${policy.minLength} characters`,
      'COMMAND-Pass2'
    );
  }
  
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    throwInvalidArgument(
      'password must contain at least one uppercase letter',
      'COMMAND-Pass3'
    );
  }
  
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    throwInvalidArgument(
      'password must contain at least one lowercase letter',
      'COMMAND-Pass4'
    );
  }
  
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    throwInvalidArgument(
      'password must contain at least one number',
      'COMMAND-Pass5'
    );
  }
  
  if (policy.requireSymbol && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    throwInvalidArgument(
      'password must contain at least one symbol',
      'COMMAND-Pass6'
    );
  }
}

/**
 * Default password policy
 */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: false,
};

/**
 * Validate required field
 */
export function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throwInvalidArgument(`${fieldName} is required`, 'COMMAND-Req1');
  }
}

/**
 * Validate string length
 */
export function validateLength(
  value: string,
  fieldName: string,
  min?: number,
  max?: number
): void {
  if (min !== undefined && value.length < min) {
    throwInvalidArgument(
      `${fieldName} must be at least ${min} characters`,
      'COMMAND-Len1'
    );
  }
  
  if (max !== undefined && value.length > max) {
    throwInvalidArgument(
      `${fieldName} must be at most ${max} characters`,
      'COMMAND-Len2'
    );
  }
}

/**
 * Validate ID format (basic check)
 */
export function validateID(id: string, fieldName: string = 'id'): void {
  if (!id || id.trim().length === 0) {
    throwInvalidArgument(`${fieldName} is required`, 'COMMAND-ID1');
  }
  
  // IDs should be alphanumeric with hyphens/underscores
  const idRegex = /^[a-zA-Z0-9_-]+$/;
  if (!idRegex.test(id)) {
    throwInvalidArgument(`${fieldName} has invalid format`, 'COMMAND-ID2');
  }
}

/**
 * Validate URL format (uses domain validator)
 */
export function validateURL(url: string, fieldName: string = 'url'): void {
  try {
    domainValidateURL(url, fieldName);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throwInvalidArgument(`${fieldName} has invalid format`, 'COMMAND-URL2');
  }
}

/**
 * Validate domain format (uses domain validator)
 */
export function validateDomain(domain: string): void {
  try {
    validateDomainName(domain);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throwInvalidArgument('domain has invalid format', 'COMMAND-Dom2');
  }
}

/**
 * Validate phone number (uses domain phone validator)
 */
export function validatePhone(phone: string, defaultRegion?: string): string {
  try {
    return domainValidatePhone(phone, defaultRegion);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throwInvalidArgument(
      'phone must be in international format (+...)',
      'COMMAND-Phone2'
    );
    throw error; // unreachable but TS needs it
  }
}

/**
 * Validate state transition
 */
export function validateStateTransition(
  currentState: string,
  newState: string,
  allowedTransitions: Record<string, string[]>
): void {
  const allowed = allowedTransitions[currentState] || [];
  
  if (!allowed.includes(newState)) {
    throwPreconditionFailed(
      `Cannot transition from ${currentState} to ${newState}`,
      'COMMAND-State1'
    );
  }
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: T,
  allowedValues: readonly T[],
  fieldName: string
): void {
  if (!allowedValues.includes(value)) {
    throwInvalidArgument(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      'COMMAND-Enum1'
    );
  }
}
