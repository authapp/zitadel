/**
 * Pagination Helper Tests
 */

import { describe, it, expect } from '@jest/globals';
import { PaginationHelper } from '../../../../src/lib/query/helpers/pagination';

describe('PaginationHelper', () => {
  describe('calculateOffset', () => {
    it('should calculate offset from page', () => {
      expect(PaginationHelper.calculateOffset(1, 10)).toBe(0);
      expect(PaginationHelper.calculateOffset(2, 10)).toBe(10);
      expect(PaginationHelper.calculateOffset(3, 20)).toBe(40);
    });

    it('should handle page < 1', () => {
      expect(PaginationHelper.calculateOffset(0, 10)).toBe(0);
      expect(PaginationHelper.calculateOffset(-1, 10)).toBe(0);
    });
  });

  describe('calculatePage', () => {
    it('should calculate page from offset', () => {
      expect(PaginationHelper.calculatePage(0, 10)).toBe(1);
      expect(PaginationHelper.calculatePage(10, 10)).toBe(2);
      expect(PaginationHelper.calculatePage(25, 10)).toBe(3);
    });

    it('should handle negative offset', () => {
      expect(PaginationHelper.calculatePage(-10, 10)).toBe(1);
    });
  });

  describe('createPaginationInfo', () => {
    it('should create complete pagination info', () => {
      const info = PaginationHelper.createPaginationInfo(100, 20, 10);
      expect(info.totalItems).toBe(100);
      expect(info.totalPages).toBe(10);
      expect(info.currentPage).toBe(3);
      expect(info.itemsPerPage).toBe(10);
      expect(info.hasNextPage).toBe(true);
      expect(info.hasPreviousPage).toBe(true);
      expect(info.startIndex).toBe(20);
      expect(info.endIndex).toBe(30);
    });

    it('should handle first page', () => {
      const info = PaginationHelper.createPaginationInfo(100, 0, 10);
      expect(info.currentPage).toBe(1);
      expect(info.hasPreviousPage).toBe(false);
      expect(info.hasNextPage).toBe(true);
    });

    it('should handle last page', () => {
      const info = PaginationHelper.createPaginationInfo(100, 90, 10);
      expect(info.currentPage).toBe(10);
      expect(info.hasNextPage).toBe(false);
      expect(info.hasPreviousPage).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate and apply defaults', () => {
      const result = PaginationHelper.validate(10, 50);
      expect(result.offset).toBe(10);
      expect(result.limit).toBe(50);
    });

    it('should fix negative offset', () => {
      const result = PaginationHelper.validate(-10, 50);
      expect(result.offset).toBe(0);
    });

    it('should apply default limit for invalid limit', () => {
      const result = PaginationHelper.validate(0, -5);
      expect(result.limit).toBe(100);
    });

    it('should cap limit at maximum', () => {
      const result = PaginationHelper.validate(0, 2000);
      expect(result.limit).toBe(1000);
    });
  });

  describe('nextOffset', () => {
    it('should return next offset', () => {
      expect(PaginationHelper.nextOffset(0, 10, 100)).toBe(10);
      expect(PaginationHelper.nextOffset(10, 10, 100)).toBe(20);
    });

    it('should return null if no next page', () => {
      expect(PaginationHelper.nextOffset(90, 10, 100)).toBeNull();
    });
  });

  describe('previousOffset', () => {
    it('should return previous offset', () => {
      expect(PaginationHelper.previousOffset(20, 10)).toBe(10);
      expect(PaginationHelper.previousOffset(10, 10)).toBe(0);
    });

    it('should return null if on first page', () => {
      expect(PaginationHelper.previousOffset(0, 10)).toBeNull();
    });
  });

  describe('hasNextPage', () => {
    it('should return true if has next page', () => {
      expect(PaginationHelper.hasNextPage(0, 10, 100)).toBe(true);
    });

    it('should return false if no next page', () => {
      expect(PaginationHelper.hasNextPage(90, 10, 100)).toBe(false);
    });
  });

  describe('getPageRange', () => {
    it('should return page range for pagination UI', () => {
      const range = PaginationHelper.getPageRange(5, 10, 5);
      expect(range).toEqual([3, 4, 5, 6, 7]);
    });

    it('should handle first pages', () => {
      const range = PaginationHelper.getPageRange(2, 10, 5);
      expect(range).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle last pages', () => {
      const range = PaginationHelper.getPageRange(9, 10, 5);
      expect(range).toEqual([6, 7, 8, 9, 10]);
    });

    it('should return all pages if total <= max', () => {
      const range = PaginationHelper.getPageRange(2, 3, 5);
      expect(range).toEqual([1, 2, 3]);
    });
  });
});
