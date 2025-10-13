/**
 * Pagination Helper
 * 
 * Utilities for pagination calculations and info.
 */

/**
 * Pagination information
 */
export interface PaginationInfo {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startIndex: number;
  endIndex: number;
}

/**
 * Pagination helper utilities
 */
export class PaginationHelper {
  /**
   * Calculate offset from page number and limit
   */
  static calculateOffset(page: number, limit: number): number {
    if (page < 1) {
      page = 1;
    }
    return (page - 1) * limit;
  }

  /**
   * Calculate page number from offset and limit
   */
  static calculatePage(offset: number, limit: number): number {
    if (offset < 0) {
      offset = 0;
    }
    if (limit <= 0) {
      return 1;
    }
    return Math.floor(offset / limit) + 1;
  }

  /**
   * Create pagination information
   */
  static createPaginationInfo(
    count: number,
    offset: number,
    limit: number
  ): PaginationInfo {
    const totalItems = count;
    const currentPage = this.calculatePage(offset, limit);
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = offset;
    const endIndex = Math.min(offset + limit, totalItems);

    return {
      totalItems,
      totalPages,
      currentPage,
      itemsPerPage: limit,
      hasNextPage: endIndex < totalItems,
      hasPreviousPage: offset > 0,
      startIndex,
      endIndex,
    };
  }

  /**
   * Validate pagination parameters
   */
  static validate(offset: number, limit: number): { offset: number; limit: number } {
    // Ensure offset is non-negative
    if (offset < 0) {
      offset = 0;
    }

    // Ensure limit is positive and within bounds
    if (limit <= 0) {
      limit = 100; // default
    }

    // Apply maximum limit
    const maxLimit = 1000;
    if (limit > maxLimit) {
      limit = maxLimit;
    }

    return { offset, limit };
  }

  /**
   * Get next page offset
   */
  static nextOffset(currentOffset: number, limit: number, totalCount: number): number | null {
    const nextOffset = currentOffset + limit;
    if (nextOffset >= totalCount) {
      return null;
    }
    return nextOffset;
  }

  /**
   * Get previous page offset
   */
  static previousOffset(currentOffset: number, limit: number): number | null {
    if (currentOffset === 0) {
      return null;
    }
    const prevOffset = currentOffset - limit;
    return Math.max(0, prevOffset);
  }

  /**
   * Calculate total pages
   */
  static totalPages(totalCount: number, limit: number): number {
    if (limit <= 0) {
      return 0;
    }
    return Math.ceil(totalCount / limit);
  }

  /**
   * Check if has next page
   */
  static hasNextPage(offset: number, limit: number, totalCount: number): boolean {
    return offset + limit < totalCount;
  }

  /**
   * Check if has previous page
   */
  static hasPreviousPage(offset: number): boolean {
    return offset > 0;
  }

  /**
   * Get page range (for pagination UI)
   */
  static getPageRange(
    currentPage: number,
    totalPages: number,
    maxVisible: number = 5
  ): number[] {
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisible - 1);

    // Adjust start if we're near the end
    if (end === totalPages) {
      start = Math.max(1, end - maxVisible + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
}
