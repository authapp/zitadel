/**
 * Phone validation and normalization utilities
 * Matches Zitadel's phone handling logic
 */

import { parsePhoneNumber, PhoneNumber as LibPhoneNumber } from 'libphonenumber-js';

/**
 * Default region for phone parsing (matching Zitadel: "CH")
 */
export const DEFAULT_PHONE_REGION = 'CH';

/**
 * Phone validation error codes (matching Zitadel)
 */
export const PHONE_ERROR_CODES = {
  EMPTY: 'PHONE-Zt0NV',
  INVALID: 'PHONE-so0wa',
} as const;

/**
 * Validate and normalize phone number to E.164 format
 * Matches Zitadel's PhoneNumber.Normalize() function
 * 
 * @param phone - Phone number string
 * @param defaultRegion - ISO 3166-1 alpha-2 country code (default: "CH")
 * @returns Normalized phone number in E.164 format
 * @throws Error if phone is empty or invalid
 */
export function normalizePhoneNumber(
  phone: string,
  defaultRegion: string = DEFAULT_PHONE_REGION
): string {
  // Check for empty phone
  if (!phone || phone.trim().length === 0) {
    throw new Error(`${PHONE_ERROR_CODES.EMPTY}: Phone number is empty`);
  }

  try {
    // Parse phone number with default region
    const phoneNumber: LibPhoneNumber | undefined = parsePhoneNumber(phone, defaultRegion as any);

    if (!phoneNumber) {
      throw new Error(`${PHONE_ERROR_CODES.INVALID}: Invalid phone number format`);
    }

    // Validate the phone number
    if (!phoneNumber.isValid()) {
      throw new Error(`${PHONE_ERROR_CODES.INVALID}: Invalid phone number`);
    }

    // Return in E.164 format (e.g., +41446681800)
    return phoneNumber.format('E.164');
  } catch (error) {
    // Re-throw with Zitadel error code
    if (error instanceof Error && error.message.includes('PHONE-')) {
      throw error;
    }
    throw new Error(`${PHONE_ERROR_CODES.INVALID}: ${error instanceof Error ? error.message : 'Invalid phone number'}`);
  }
}

/**
 * Validate phone number format without normalization
 * 
 * @param phone - Phone number string
 * @param defaultRegion - ISO 3166-1 alpha-2 country code
 * @returns true if valid, false otherwise
 */
export function isValidPhoneNumber(
  phone: string,
  defaultRegion: string = DEFAULT_PHONE_REGION
): boolean {
  if (!phone || phone.trim().length === 0) {
    return false;
  }

  try {
    const phoneNumber = parsePhoneNumber(phone, defaultRegion as any);
    return phoneNumber ? phoneNumber.isValid() : false;
  } catch {
    return false;
  }
}

/**
 * Check if phone number is in E.164 format
 * E.164: + followed by 1-3 digit country code and 4-14 more digits
 * 
 * @param phone - Phone number string
 * @returns true if in E.164 format
 */
export function isE164Format(phone: string): boolean {
  // E.164 format: + followed by country code (1-3 digits) and subscriber number
  // Min length: 8 (e.g., +1234567), Max length: 15 (e.g., +123456789012345)
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

/**
 * Extract country code from E.164 phone number
 * 
 * @param phone - Phone number in E.164 format
 * @returns Country calling code (e.g., "41" for Switzerland)
 */
export function getCountryCallingCode(phone: string): string | null {
  try {
    const phoneNumber = parsePhoneNumber(phone);
    return phoneNumber ? phoneNumber.countryCallingCode : null;
  } catch {
    return null;
  }
}

/**
 * Get country code from phone number
 * 
 * @param phone - Phone number string
 * @returns ISO 3166-1 alpha-2 country code (e.g., "CH")
 */
export function getCountryCode(phone: string): string | null {
  try {
    const phoneNumber = parsePhoneNumber(phone);
    return phoneNumber ? phoneNumber.country || null : null;
  } catch {
    return null;
  }
}

/**
 * Format phone number for display
 * 
 * @param phone - Phone number string
 * @param format - Format type ('E.164', 'INTERNATIONAL', 'NATIONAL')
 * @returns Formatted phone number
 */
export function formatPhoneNumber(
  phone: string,
  format: 'E.164' | 'INTERNATIONAL' | 'NATIONAL' = 'INTERNATIONAL'
): string {
  try {
    const phoneNumber = parsePhoneNumber(phone);
    if (!phoneNumber) {
      return phone;
    }
    return phoneNumber.format(format);
  } catch {
    return phone;
  }
}
