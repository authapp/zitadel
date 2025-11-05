/**
 * Date utility functions
 */
import { format, formatDistance, formatRelative, parseISO, isValid } from 'date-fns';

/**
 * Format date to standard format
 */
export function formatDate(date: string | Date, formatStr = 'MMM dd, yyyy'): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';
    return format(dateObj, formatStr);
  } catch {
    return '';
  }
}

/**
 * Format date and time
 */
export function formatDateTime(date: string | Date, formatStr = 'MMM dd, yyyy HH:mm'): string {
  return formatDate(date, formatStr);
}

/**
 * Format date relative to now (e.g., "2 hours ago")
 */
export function formatRelativeDate(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';
    return formatDistance(dateObj, new Date(), { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Format date relative with context (e.g., "yesterday at 3:15 PM")
 */
export function formatRelativeWithContext(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';
    return formatRelative(dateObj, new Date());
  } catch {
    return '';
  }
}

/**
 * Check if date is today
 */
export function isToday(date: string | Date): boolean {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return false;
    const today = new Date();
    return (
      dateObj.getDate() === today.getDate() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getFullYear() === today.getFullYear()
    );
  } catch {
    return false;
  }
}

/**
 * Check if date is in the past
 */
export function isPast(date: string | Date): boolean {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return false;
    return dateObj < new Date();
  } catch {
    return false;
  }
}

/**
 * Check if date is in the future
 */
export function isFuture(date: string | Date): boolean {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return false;
    return dateObj > new Date();
  } catch {
    return false;
  }
}

/**
 * Get date range label
 */
export function getDateRangeLabel(startDate: string | Date, endDate: string | Date): string {
  try {
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
    
    if (!isValid(start) || !isValid(end)) return '';
    
    const startStr = format(start, 'MMM dd, yyyy');
    const endStr = format(end, 'MMM dd, yyyy');
    
    return `${startStr} - ${endStr}`;
  } catch {
    return '';
  }
}
