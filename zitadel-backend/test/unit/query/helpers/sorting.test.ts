/**
 * Sorting Helper Tests
 */

import { describe, it, expect } from '@jest/globals';
import { SortingHelper, SortDirection } from '../../../../src/lib/query/helpers/sorting';
import { Column } from '../../../../src/lib/query/search/column';

describe('SortingHelper', () => {
  describe('parseSortString', () => {
    it('should parse ascending sort', () => {
      const result = SortingHelper.parseSortString('name');
      expect(result.column.name).toBe('name');
      expect(result.direction).toBe(SortDirection.ASC);
    });

    it('should parse descending with minus', () => {
      const result = SortingHelper.parseSortString('-created_at');
      expect(result.column.name).toBe('created_at');
      expect(result.direction).toBe(SortDirection.DESC);
    });

    it('should parse with colon separator asc', () => {
      const result = SortingHelper.parseSortString('name:asc');
      expect(result.column.name).toBe('name');
      expect(result.direction).toBe(SortDirection.ASC);
    });

    it('should parse with colon separator desc', () => {
      const result = SortingHelper.parseSortString('name:desc');
      expect(result.column.name).toBe('name');
      expect(result.direction).toBe(SortDirection.DESC);
    });
  });

  describe('createOrderByClause', () => {
    it('should create ORDER BY ASC', () => {
      const col = new Column('username');
      const clause = SortingHelper.createOrderByClause(col, SortDirection.ASC);
      expect(clause).toBe('username ASC');
    });

    it('should create ORDER BY DESC', () => {
      const col = new Column('created_at');
      const clause = SortingHelper.createOrderByClause(col, SortDirection.DESC);
      expect(clause).toBe('created_at DESC');
    });

    it('should use table.column format', () => {
      const col = new Column('username', 'users');
      const clause = SortingHelper.createOrderByClause(col);
      expect(clause).toBe('users.username ASC');
    });
  });

  describe('createMultipleOrderByClause', () => {
    it('should create multiple ORDER BY', () => {
      const col1 = new Column('username');
      const col2 = new Column('created_at');
      const clause = SortingHelper.createMultipleOrderByClause([
        { column: col1, direction: SortDirection.ASC },
        { column: col2, direction: SortDirection.DESC },
      ]);
      expect(clause).toBe('ORDER BY username ASC, created_at DESC');
    });

    it('should return empty for no sorts', () => {
      const clause = SortingHelper.createMultipleOrderByClause([]);
      expect(clause).toBe('');
    });
  });

  describe('validateDirection', () => {
    it('should validate desc variations', () => {
      expect(SortingHelper.validateDirection('desc')).toBe(SortDirection.DESC);
      expect(SortingHelper.validateDirection('DESC')).toBe(SortDirection.DESC);
      expect(SortingHelper.validateDirection('descending')).toBe(SortDirection.DESC);
    });

    it('should default to ASC', () => {
      expect(SortingHelper.validateDirection('asc')).toBe(SortDirection.ASC);
      expect(SortingHelper.validateDirection('invalid')).toBe(SortDirection.ASC);
    });
  });

  describe('toggleDirection', () => {
    it('should toggle ASC to DESC', () => {
      expect(SortingHelper.toggleDirection(SortDirection.ASC)).toBe(SortDirection.DESC);
    });

    it('should toggle DESC to ASC', () => {
      expect(SortingHelper.toggleDirection(SortDirection.DESC)).toBe(SortDirection.ASC);
    });
  });

  describe('fromBoolean', () => {
    it('should convert true to ASC', () => {
      expect(SortingHelper.fromBoolean(true)).toBe(SortDirection.ASC);
    });

    it('should convert false to DESC', () => {
      expect(SortingHelper.fromBoolean(false)).toBe(SortDirection.DESC);
    });
  });

  describe('toBoolean', () => {
    it('should convert ASC to true', () => {
      expect(SortingHelper.toBoolean(SortDirection.ASC)).toBe(true);
    });

    it('should convert DESC to false', () => {
      expect(SortingHelper.toBoolean(SortDirection.DESC)).toBe(false);
    });
  });
});
