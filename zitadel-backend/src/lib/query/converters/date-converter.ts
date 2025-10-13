/**
 * Date Converter
 * 
 * Utilities for converting between dates and various formats.
 * Based on Zitadel Go internal/query/converter.go
 */

/**
 * Date converter utilities
 */
export class DateConverter {
  /**
   * Convert value to Date or null
   */
  static toDate(value: any): Date | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    }

    return null;
  }

  /**
   * Convert Date to ISO string
   */
  static fromDate(date: Date): string {
    return date.toISOString();
  }

  /**
   * Convert value to Unix timestamp or null
   */
  static toTimestamp(value: any): number | null {
    const date = this.toDate(value);
    if (!date) {
      return null;
    }
    return Math.floor(date.getTime() / 1000);
  }

  /**
   * Convert Unix timestamp to Date
   */
  static fromTimestamp(timestamp: number): Date {
    return new Date(timestamp * 1000);
  }

  /**
   * Convert value to milliseconds timestamp or null
   */
  static toMilliseconds(value: any): number | null {
    const date = this.toDate(value);
    if (!date) {
      return null;
    }
    return date.getTime();
  }

  /**
   * Convert milliseconds timestamp to Date
   */
  static fromMilliseconds(ms: number): Date {
    return new Date(ms);
  }

  /**
   * Format date to YYYY-MM-DD
   */
  static toDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format date to HH:MM:SS
   */
  static toTimeString(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Format date to YYYY-MM-DD HH:MM:SS
   */
  static toDateTimeString(date: Date): string {
    return `${this.toDateString(date)} ${this.toTimeString(date)}`;
  }

  /**
   * Check if date is valid
   */
  static isValid(date: any): boolean {
    const d = this.toDate(date);
    return d !== null;
  }

  /**
   * Get start of day
   */
  static startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get end of day
   */
  static endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Add days to date
   */
  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Add hours to date
   */
  static addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  /**
   * Add minutes to date
   */
  static addMinutes(date: Date, minutes: number): Date {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  /**
   * Calculate difference in days
   */
  static diffDays(date1: Date, date2: Date): number {
    const diff = date1.getTime() - date2.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate difference in hours
   */
  static diffHours(date1: Date, date2: Date): number {
    const diff = date1.getTime() - date2.getTime();
    return Math.floor(diff / (1000 * 60 * 60));
  }

  /**
   * Calculate difference in minutes
   */
  static diffMinutes(date1: Date, date2: Date): number {
    const diff = date1.getTime() - date2.getTime();
    return Math.floor(diff / (1000 * 60));
  }

  /**
   * Check if date is in the past
   */
  static isPast(date: Date): boolean {
    return date.getTime() < Date.now();
  }

  /**
   * Check if date is in the future
   */
  static isFuture(date: Date): boolean {
    return date.getTime() > Date.now();
  }

  /**
   * Check if date is today
   */
  static isToday(date: Date): boolean {
    const today = new Date();
    return this.toDateString(date) === this.toDateString(today);
  }
}
