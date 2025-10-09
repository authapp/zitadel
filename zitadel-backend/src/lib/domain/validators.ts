/**
 * Domain Validators
 * 
 * Validation functions for domain entities matching Zitadel Go implementation
 * These are domain-level validators that enforce business rules
 */

import { throwInvalidArgument } from '../zerrors/errors';
import { normalizePhoneNumber } from './phone';

/**
 * Email validation regex (matches Go: internal/domain/human_email.go)
 * ^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Validate email address (matches Go: EmailAddress.Validate())
 * @throws Error with Zitadel error code if validation fails
 */
export function validateEmailAddress(email: string): void {
  if (!email || email.trim().length === 0) {
    throwInvalidArgument('email is empty', 'EMAIL-spblu');
  }
  
  if (!EMAIL_REGEX.test(email)) {
    throwInvalidArgument('email has invalid format', 'EMAIL-599BI');
  }
}

/**
 * Normalize email address (matches Go: EmailAddress.Normalize())
 */
export function normalizeEmail(email: string): string {
  return email.trim();
}

/**
 * Check if email is valid (boolean return)
 */
export function isValidEmailAddress(email: string): boolean {
  if (!email) return false;
  return EMAIL_REGEX.test(email);
}

/**
 * Validate human profile (matches Go: Profile.Validate())
 * @throws Error with Zitadel error code if validation fails
 */
export function validateProfile(profile: {
  firstName?: string;
  lastName?: string;
}): void {
  if (!profile) {
    throwInvalidArgument('profile is empty', 'PROFILE-GPY3p');
  }
  
  if (!profile.firstName || profile.firstName.trim().length === 0) {
    throwInvalidArgument('first name is empty', 'PROFILE-RF5z2');
  }
  
  if (!profile.lastName || profile.lastName.trim().length === 0) {
    throwInvalidArgument('last name is empty', 'PROFILE-DSUkN');
  }
}

/**
 * Validate username (basic validation)
 * @throws Error with Zitadel error code if validation fails
 */
export function validateUsername(username: string): void {
  if (!username || username.trim().length === 0) {
    throwInvalidArgument('username is empty', 'COMMAND-00p2b');
  }
}

/**
 * Validate phone number using domain phone validator
 * @throws Error with Zitadel error code if validation fails
 */
export function validatePhoneNumber(phone: string, defaultRegion?: string): string {
  return normalizePhoneNumber(phone, defaultRegion);
}

/**
 * Validate organization name
 * @throws Error with Zitadel error code if validation fails
 */
export function validateOrgName(name: string): void {
  if (!name || name.trim().length === 0) {
    throwInvalidArgument('organization name is empty', 'ORG-mru74');
  }
}

/**
 * Validate project name
 * @throws Error with Zitadel error code if validation fails
 */
export function validateProjectName(name: string): void {
  if (!name || name.trim().length === 0) {
    throwInvalidArgument('project name is empty', 'PROJECT-mci74');
  }
}

/**
 * Validate application name
 * @throws Error with Zitadel error code if validation fails
 */
export function validateAppName(name: string): void {
  if (!name || name.trim().length === 0) {
    throwInvalidArgument('application name is empty', 'APP-3m9fs');
  }
}

/**
 * Validate domain name format
 * @throws Error with Zitadel error code if validation fails
 */
export function validateDomainName(domain: string): void {
  if (!domain || domain.trim().length === 0) {
    throwInvalidArgument('domain is empty', 'DOMAIN-mci74');
  }
  
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*\.[a-zA-Z]{2,}$/;
  if (!domainRegex.test(domain)) {
    throwInvalidArgument('domain has invalid format', 'DOMAIN-Mf9sd');
  }
}

/**
 * Validate redirect URI (matches Go: ValidateDefaultRedirectURI)
 */
export function validateRedirectURI(uri: string): boolean {
  if (uri === '') {
    return true;
  }
  
  try {
    new URL(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate URL format
 * @throws Error with Zitadel error code if validation fails
 */
export function validateURL(url: string, fieldName: string = 'url'): void {
  if (!url || url.trim().length === 0) {
    throwInvalidArgument(`${fieldName} is empty`, 'URL-3m9fs');
  }
  
  try {
    new URL(url);
  } catch {
    throwInvalidArgument(`${fieldName} has invalid format`, 'URL-mci74');
  }
}

/**
 * Validate required field
 * @throws Error with Zitadel error code if validation fails
 */
export function validateRequired(value: any, fieldName: string, errorCode: string = 'REQUIRED-1'): void {
  if (value === undefined || value === null || value === '') {
    throwInvalidArgument(`${fieldName} is required`, errorCode);
  }
}

/**
 * Validate string length
 * @throws Error with Zitadel error code if validation fails
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
      'LENGTH-1'
    );
  }
  
  if (max !== undefined && value.length > max) {
    throwInvalidArgument(
      `${fieldName} must be at most ${max} characters`,
      'LENGTH-2'
    );
  }
}
