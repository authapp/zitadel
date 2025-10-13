/**
 * JSON Converter
 * 
 * Utilities for JSON parsing and stringification with type safety.
 */

/**
 * JSON converter utilities
 */
export class JSONConverter {
  /**
   * Parse JSON string to typed object or null
   */
  static parse<T>(value: string | null): T | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'string') {
      // Already an object, return as-is
      return value as T;
    }

    if (value.trim() === '') {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('JSON parse error:', error);
      return null;
    }
  }

  /**
   * Stringify value to JSON
   */
  static stringify(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      console.error('JSON stringify error:', error);
      return '';
    }
  }

  /**
   * Parse with default value
   */
  static parseOrDefault<T>(value: string | null, defaultValue: T): T {
    const result = this.parse<T>(value);
    return result !== null ? result : defaultValue;
  }

  /**
   * Pretty print JSON
   */
  static prettyPrint(value: any, indent: number = 2): string {
    if (value === null || value === undefined) {
      return '';
    }

    try {
      return JSON.stringify(value, null, indent);
    } catch (error) {
      console.error('JSON stringify error:', error);
      return '';
    }
  }

  /**
   * Check if string is valid JSON
   */
  static isValid(value: string): boolean {
    if (typeof value !== 'string' || value.trim() === '') {
      return false;
    }

    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse JSON safely with error handling
   */
  static safeParse<T>(value: string): { success: boolean; data?: T; error?: Error } {
    if (typeof value !== 'string' || value.trim() === '') {
      return { success: false, error: new Error('Invalid input: not a string or empty') };
    }

    try {
      const data = JSON.parse(value) as T;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * Deep clone object via JSON
   */
  static deepClone<T>(value: T): T {
    try {
      return JSON.parse(JSON.stringify(value)) as T;
    } catch (error) {
      console.error('Deep clone error:', error);
      return value;
    }
  }
}
