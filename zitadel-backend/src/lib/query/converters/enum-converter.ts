/**
 * Enum Converter
 * 
 * Utilities for converting between enums and various formats.
 */

/**
 * Enum converter utilities
 */
export class EnumConverter {
  /**
   * Convert value to enum or null
   */
  static toEnum<T extends Record<string, string | number>>(
    value: any,
    enumType: T
  ): T[keyof T] | null {
    if (value === null || value === undefined) {
      return null;
    }

    // Check if value is already a valid enum value
    const enumValues = Object.values(enumType);
    if (enumValues.includes(value)) {
      return value as T[keyof T];
    }

    // Try to find by key
    const enumKeys = Object.keys(enumType) as Array<keyof T>;
    for (const key of enumKeys) {
      if (key === value || enumType[key] === value) {
        return enumType[key];
      }
    }

    return null;
  }

  /**
   * Convert enum to string
   */
  static fromEnum<T extends Record<string, string | number>>(
    enumValue: T[keyof T]
  ): string {
    return String(enumValue);
  }

  /**
   * Get all enum values
   */
  static getValues<T extends Record<string, string | number>>(
    enumType: T
  ): Array<T[keyof T]> {
    return Object.values(enumType) as Array<T[keyof T]>;
  }

  /**
   * Get all enum keys
   */
  static getKeys<T extends Record<string, string | number>>(
    enumType: T
  ): Array<keyof T> {
    return Object.keys(enumType) as Array<keyof T>;
  }

  /**
   * Check if value is valid enum value
   */
  static isValid<T extends Record<string, string | number>>(
    value: any,
    enumType: T
  ): boolean {
    return this.toEnum(value, enumType) !== null;
  }

  /**
   * Get enum key from value
   */
  static getKey<T extends Record<string, string | number>>(
    value: T[keyof T],
    enumType: T
  ): keyof T | null {
    const entries = Object.entries(enumType) as Array<[keyof T, T[keyof T]]>;
    for (const [key, val] of entries) {
      if (val === value) {
        return key;
      }
    }
    return null;
  }

  /**
   * Convert enum to number
   */
  static toNumber<T extends Record<string, string | number>>(
    enumValue: T[keyof T]
  ): number | null {
    if (typeof enumValue === 'number') {
      return enumValue;
    }

    const num = Number(enumValue);
    if (isNaN(num)) {
      return null;
    }

    return num;
  }
}
