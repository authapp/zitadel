/**
 * Sorting Helper
 * 
 * Utilities for sorting operations.
 */

import { Column } from '../search/column';

/**
 * Sort direction
 */
export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

/**
 * Sort options
 */
export interface SortOptions {
  column: Column;
  direction: SortDirection;
}

/**
 * Sorting helper utilities
 */
export class SortingHelper {
  /**
   * Parse sort string (e.g., "name:asc", "-created_at")
   */
  static parseSortString(sort: string): SortOptions {
    // Handle "-" prefix for descending
    if (sort.startsWith('-')) {
      return {
        column: new Column(sort.substring(1)),
        direction: SortDirection.DESC,
      };
    }

    // Handle ":" separator
    if (sort.includes(':')) {
      const [column, dir] = sort.split(':');
      const direction = dir.toLowerCase() === 'desc' 
        ? SortDirection.DESC 
        : SortDirection.ASC;
      return {
        column: new Column(column),
        direction,
      };
    }

    // Default to ascending
    return {
      column: new Column(sort),
      direction: SortDirection.ASC,
    };
  }

  /**
   * Create ORDER BY clause
   */
  static createOrderByClause(
    column: Column,
    direction: SortDirection = SortDirection.ASC
  ): string {
    return `${column.orderBy()} ${direction}`;
  }

  /**
   * Create ORDER BY clause for multiple columns
   */
  static createMultipleOrderByClause(sorts: SortOptions[]): string {
    if (sorts.length === 0) {
      return '';
    }

    const clauses = sorts.map(sort => 
      this.createOrderByClause(sort.column, sort.direction)
    );

    return `ORDER BY ${clauses.join(', ')}`;
  }

  /**
   * Validate sort direction
   */
  static validateDirection(direction: string): SortDirection {
    const upper = direction.toUpperCase();
    if (upper === 'DESC' || upper === 'DESCENDING') {
      return SortDirection.DESC;
    }
    return SortDirection.ASC;
  }

  /**
   * Toggle sort direction
   */
  static toggleDirection(current: SortDirection): SortDirection {
    return current === SortDirection.ASC ? SortDirection.DESC : SortDirection.ASC;
  }

  /**
   * Convert boolean to sort direction
   */
  static fromBoolean(asc: boolean): SortDirection {
    return asc ? SortDirection.ASC : SortDirection.DESC;
  }

  /**
   * Convert sort direction to boolean
   */
  static toBoolean(direction: SortDirection): boolean {
    return direction === SortDirection.ASC;
  }
}
