/**
 * Phone validation and normalization tests
 * Matching Zitadel's phone handling behavior
 */

import {
  normalizePhoneNumber,
  isValidPhoneNumber,
  isE164Format,
  getCountryCallingCode,
  getCountryCode,
  formatPhoneNumber,
  DEFAULT_PHONE_REGION,
  PHONE_ERROR_CODES,
} from './phone';

describe('Phone Validation', () => {
  describe('normalizePhoneNumber', () => {
    it('should normalize Swiss phone number to E.164', () => {
      const result = normalizePhoneNumber('044 668 18 00');
      expect(result).toBe('+41446681800');
    });

    it('should normalize phone with country code', () => {
      const result = normalizePhoneNumber('+41 44 668 18 00');
      expect(result).toBe('+41446681800');
    });

    it('should normalize US phone number', () => {
      const result = normalizePhoneNumber('+1 (415) 555-0132');
      expect(result).toBe('+14155550132');
    });

    it('should normalize German phone number', () => {
      const result = normalizePhoneNumber('+49 30 12345678');
      expect(result).toBe('+493012345678');
    });

    it('should use default region (CH) when no country code provided', () => {
      const result = normalizePhoneNumber('044 668 18 00');
      expect(result).toMatch(/^\+41/); // Should start with Swiss code
    });

    it('should handle phone with spaces and dashes', () => {
      const result = normalizePhoneNumber('+1-415-555-0132');
      expect(result).toBe('+14155550132');
    });

    it('should throw error for empty phone', () => {
      expect(() => normalizePhoneNumber('')).toThrow(PHONE_ERROR_CODES.EMPTY);
    });

    it('should throw error for invalid phone', () => {
      expect(() => normalizePhoneNumber('invalid')).toThrow(PHONE_ERROR_CODES.INVALID);
    });

    it('should throw error for too short number', () => {
      expect(() => normalizePhoneNumber('123')).toThrow(PHONE_ERROR_CODES.INVALID);
    });

    it('should support custom default region', () => {
      // German local number
      const result = normalizePhoneNumber('030 12345678', 'DE');
      expect(result).toBe('+493012345678');
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should validate Swiss phone number', () => {
      expect(isValidPhoneNumber('044 668 18 00')).toBe(true);
    });

    it('should validate phone with country code', () => {
      expect(isValidPhoneNumber('+41 44 668 18 00')).toBe(true);
    });

    it('should validate US phone number', () => {
      expect(isValidPhoneNumber('+1 (415) 555-0132')).toBe(true);
    });

    it('should reject empty phone', () => {
      expect(isValidPhoneNumber('')).toBe(false);
    });

    it('should reject invalid phone', () => {
      expect(isValidPhoneNumber('invalid')).toBe(false);
    });

    it('should reject too short number', () => {
      expect(isValidPhoneNumber('123')).toBe(false);
    });

    it('should validate with custom region', () => {
      expect(isValidPhoneNumber('030 12345678', 'DE')).toBe(true);
    });
  });

  describe('isE164Format', () => {
    it('should recognize E.164 format', () => {
      expect(isE164Format('+41446681800')).toBe(true);
      expect(isE164Format('+14155550132')).toBe(true);
      expect(isE164Format('+493012345678')).toBe(true);
    });

    it('should reject non-E.164 format', () => {
      expect(isE164Format('044 668 18 00')).toBe(false);
      expect(isE164Format('41446681800')).toBe(false);
      expect(isE164Format('+41 44 668 18 00')).toBe(false);
    });

    it('should reject invalid formats', () => {
      expect(isE164Format('invalid')).toBe(false);
      expect(isE164Format('+123')).toBe(false);
      expect(isE164Format('')).toBe(false);
    });
  });

  describe('getCountryCallingCode', () => {
    it('should extract Swiss country code', () => {
      expect(getCountryCallingCode('+41446681800')).toBe('41');
    });

    it('should extract US country code', () => {
      expect(getCountryCallingCode('+14155550132')).toBe('1');
    });

    it('should extract German country code', () => {
      expect(getCountryCallingCode('+493012345678')).toBe('49');
    });

    it('should return null for invalid phone', () => {
      expect(getCountryCallingCode('invalid')).toBeNull();
    });
  });

  describe('getCountryCode', () => {
    it('should extract country code from Swiss number', () => {
      expect(getCountryCode('+41446681800')).toBe('CH');
    });

    it('should extract country code from US number', () => {
      expect(getCountryCode('+14155550132')).toBe('US');
    });

    it('should extract country code from German number', () => {
      expect(getCountryCode('+493012345678')).toBe('DE');
    });

    it('should return null for invalid phone', () => {
      expect(getCountryCode('invalid')).toBeNull();
    });
  });

  describe('formatPhoneNumber', () => {
    const swissPhone = '+41446681800';

    it('should format as E.164', () => {
      expect(formatPhoneNumber(swissPhone, 'E.164')).toBe('+41446681800');
    });

    it('should format as INTERNATIONAL', () => {
      const result = formatPhoneNumber(swissPhone, 'INTERNATIONAL');
      expect(result).toContain('+41');
      expect(result).toContain('44');
    });

    it('should format as NATIONAL', () => {
      const result = formatPhoneNumber(swissPhone, 'NATIONAL');
      expect(result).not.toContain('+41');
      expect(result).toContain('044');
    });

    it('should return original for invalid phone', () => {
      expect(formatPhoneNumber('invalid')).toBe('invalid');
    });

    it('should default to INTERNATIONAL format', () => {
      const result = formatPhoneNumber(swissPhone);
      expect(result).toContain('+41');
    });
  });

  describe('DEFAULT_PHONE_REGION', () => {
    it('should be Switzerland (CH)', () => {
      expect(DEFAULT_PHONE_REGION).toBe('CH');
    });
  });

  describe('PHONE_ERROR_CODES', () => {
    it('should match Zitadel error codes', () => {
      expect(PHONE_ERROR_CODES.EMPTY).toBe('PHONE-Zt0NV');
      expect(PHONE_ERROR_CODES.INVALID).toBe('PHONE-so0wa');
    });
  });

  describe('Real-world phone numbers', () => {
    const testCases = [
      { input: '+41 44 668 18 00', expected: '+41446681800', country: 'CH' },
      { input: '+1 415 555 0132', expected: '+14155550132', country: 'US' },
      { input: '+49 30 12345678', expected: '+493012345678', country: 'DE' },
      { input: '+33 1 42 86 82 00', expected: '+33142868200', country: 'FR' },
      { input: '+44 20 7946 0958', expected: '+442079460958', country: 'GB' },
      { input: '+81 3-1234-5678', expected: '+81312345678', country: 'JP' },
      { input: '+61 2 1234 5678', expected: '+61212345678', country: 'AU' },
    ];

    testCases.forEach(({ input, expected, country }) => {
      it(`should normalize ${country} phone: ${input}`, () => {
        const result = normalizePhoneNumber(input);
        expect(result).toBe(expected);
        expect(isE164Format(result)).toBe(true);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle whitespace-only input', () => {
      expect(() => normalizePhoneNumber('   ')).toThrow(PHONE_ERROR_CODES.EMPTY);
    });

    it('should handle phone with multiple spaces', () => {
      const result = normalizePhoneNumber('+41  44  668  18  00');
      expect(result).toBe('+41446681800');
    });

    it('should handle phone with parentheses', () => {
      const result = normalizePhoneNumber('+1 (415) 555-0132');
      expect(result).toBe('+14155550132');
    });

    it('should handle very long invalid number', () => {
      expect(() => normalizePhoneNumber('12345678901234567890')).toThrow();
    });
  });
});
