/**
 * Validation Utilities
 * 
 * Common validation functions for command data
 */

import { throwInvalidArgument, throwPreconditionFailed } from '@/zerrors/errors';

/**
 * Validate email format
 */
export function validateEmail(email: string, fieldName: string = 'email'): void {
  if (!email || email.trim().length === 0) {
    throwInvalidArgument(`${fieldName} is required`, 'COMMAND-Email1');
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throwInvalidArgument(`${fieldName} has invalid format`, 'COMMAND-Email2');
  }
}

/**
 * Check if email is valid (boolean return)
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate username
 */
export function validateUsername(username: string, minLength: number = 3): void {
  if (!username || username.trim().length === 0) {
    throwInvalidArgument('username is required', 'COMMAND-User1');
  }
  
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
 * Validate URL format
 */
export function validateURL(url: string, fieldName: string = 'url'): void {
  if (!url || url.trim().length === 0) {
    throwInvalidArgument(`${fieldName} is required`, 'COMMAND-URL1');
  }
  
  try {
    new URL(url);
  } catch {
    throwInvalidArgument(`${fieldName} has invalid format`, 'COMMAND-URL2');
  }
}

/**
 * Validate domain format
 */
export function validateDomain(domain: string): void {
  if (!domain || domain.trim().length === 0) {
    throwInvalidArgument('domain is required', 'COMMAND-Dom1');
  }
  
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*\.[a-zA-Z]{2,}$/;
  if (!domainRegex.test(domain)) {
    throwInvalidArgument('domain has invalid format', 'COMMAND-Dom2');
  }
}

/**
 * Validate phone number (basic international format)
 */
export function validatePhone(phone: string): void {
  if (!phone || phone.trim().length === 0) {
    throwInvalidArgument('phone is required', 'COMMAND-Phone1');
  }
  
  // Basic E.164 format: +[country code][number]
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(phone)) {
    throwInvalidArgument(
      'phone must be in international format (+...)',
      'COMMAND-Phone2'
    );
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
