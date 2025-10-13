/**
 * Filter Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Column } from '../../../../src/lib/query/search/column';
import {
  TextFilter,
  NumberFilter,
  BooleanFilter,
  DateFilter,
  DateRangeFilter,
  ListFilter,
  NotListFilter,
  IsNullFilter,
  IsNotNullFilter,
  AndFilter,
  OrFilter,
  NotFilter,
  filter,
} from '../../../../src/lib/query/search/filters';
import { Comparison } from '../../../../src/lib/query/search/search-query';

describe('Filters', () => {
  const col = new Column('username', 'users');
  const params: any[] = [];

  beforeEach(() => {
    params.length = 0; // Clear params
  });

  describe('TextFilter', () => {
    it('should generate EQUALS filter', () => {
      const f = new TextFilter(col, 'john', Comparison.EQUALS);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.username = $1');
      expect(params).toEqual(['john']);
    });

    it('should generate NOT_EQUALS filter', () => {
      const f = new TextFilter(col, 'john', Comparison.NOT_EQUALS);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.username != $1');
      expect(params).toEqual(['john']);
    });

    it('should generate LIKE filter', () => {
      const f = new TextFilter(col, '%john%', Comparison.LIKE);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.username LIKE $1');
      expect(params).toEqual(['%john%']);
    });

    it('should generate ILIKE filter', () => {
      const f = new TextFilter(col, '%john%', Comparison.ILIKE);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.username ILIKE $1');
      expect(params).toEqual(['%john%']);
    });

    it('should generate STARTS_WITH filter', () => {
      const f = new TextFilter(col, 'john', Comparison.STARTS_WITH);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.username LIKE $1');
      expect(params).toEqual(['john%']);
    });

    it('should generate ENDS_WITH filter', () => {
      const f = new TextFilter(col, 'john', Comparison.ENDS_WITH);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.username LIKE $1');
      expect(params).toEqual(['%john']);
    });

    it('should generate CONTAINS filter', () => {
      const f = new TextFilter(col, 'john', Comparison.CONTAINS);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.username LIKE $1');
      expect(params).toEqual(['%john%']);
    });

    it('should return correct comparison', () => {
      const f = new TextFilter(col, 'john', Comparison.EQUALS);
      expect(f.toComparison()).toBe(Comparison.EQUALS);
    });

    it('should return correct column', () => {
      const f = new TextFilter(col, 'john', Comparison.EQUALS);
      expect(f.getColumn()).toBe(col);
    });
  });

  describe('NumberFilter', () => {
    const numCol = new Column('age', 'users');

    it('should generate EQUALS filter', () => {
      const f = new NumberFilter(numCol, 25, Comparison.EQUALS);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.age = $1');
      expect(params).toEqual([25]);
    });

    it('should generate NOT_EQUALS filter', () => {
      const f = new NumberFilter(numCol, 25, Comparison.NOT_EQUALS);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.age != $1');
      expect(params).toEqual([25]);
    });

    it('should generate GREATER filter', () => {
      const f = new NumberFilter(numCol, 25, Comparison.GREATER);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.age > $1');
      expect(params).toEqual([25]);
    });

    it('should generate GREATER_OR_EQUAL filter', () => {
      const f = new NumberFilter(numCol, 25, Comparison.GREATER_OR_EQUAL);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.age >= $1');
      expect(params).toEqual([25]);
    });

    it('should generate LESS filter', () => {
      const f = new NumberFilter(numCol, 25, Comparison.LESS);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.age < $1');
      expect(params).toEqual([25]);
    });

    it('should generate LESS_OR_EQUAL filter', () => {
      const f = new NumberFilter(numCol, 25, Comparison.LESS_OR_EQUAL);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.age <= $1');
      expect(params).toEqual([25]);
    });
  });

  describe('BooleanFilter', () => {
    const boolCol = new Column('active', 'users');

    it('should generate filter for true', () => {
      const f = new BooleanFilter(boolCol, true);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.active = $1');
      expect(params).toEqual([true]);
    });

    it('should generate filter for false', () => {
      const f = new BooleanFilter(boolCol, false);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.active = $1');
      expect(params).toEqual([false]);
    });
  });

  describe('DateFilter', () => {
    const dateCol = new Column('created_at', 'users');
    const date = new Date('2024-01-01');

    it('should generate EQUALS filter', () => {
      const f = new DateFilter(dateCol, date, Comparison.EQUALS);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.created_at = $1');
      expect(params).toEqual([date]);
    });

    it('should generate GREATER filter', () => {
      const f = new DateFilter(dateCol, date, Comparison.GREATER);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.created_at > $1');
      expect(params).toEqual([date]);
    });

    it('should generate LESS filter', () => {
      const f = new DateFilter(dateCol, date, Comparison.LESS);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.created_at < $1');
      expect(params).toEqual([date]);
    });
  });

  describe('DateRangeFilter', () => {
    const dateCol = new Column('created_at', 'users');
    const start = new Date('2024-01-01');
    const end = new Date('2024-12-31');

    it('should generate BETWEEN filter', () => {
      const f = new DateRangeFilter(dateCol, start, end);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.created_at BETWEEN $1 AND $2');
      expect(params).toEqual([start, end]);
    });
  });

  describe('ListFilter', () => {
    it('should generate IN filter', () => {
      const f = new ListFilter(col, ['john', 'jane', 'bob']);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.username IN ($1, $2, $3)');
      expect(params).toEqual(['john', 'jane', 'bob']);
    });

    it('should return FALSE for empty array', () => {
      const f = new ListFilter(col, []);
      const sql = f.toQuery(params);
      expect(sql).toBe('FALSE');
      expect(params).toEqual([]);
    });
  });

  describe('NotListFilter', () => {
    it('should generate NOT IN filter', () => {
      const f = new NotListFilter(col, ['john', 'jane']);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.username NOT IN ($1, $2)');
      expect(params).toEqual(['john', 'jane']);
    });

    it('should return TRUE for empty array', () => {
      const f = new NotListFilter(col, []);
      const sql = f.toQuery(params);
      expect(sql).toBe('TRUE');
      expect(params).toEqual([]);
    });
  });

  describe('IsNullFilter', () => {
    it('should generate IS NULL filter', () => {
      const f = new IsNullFilter(col);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.username IS NULL');
      expect(params).toEqual([]);
    });
  });

  describe('IsNotNullFilter', () => {
    it('should generate IS NOT NULL filter', () => {
      const f = new IsNotNullFilter(col);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.username IS NOT NULL');
      expect(params).toEqual([]);
    });
  });

  describe('AndFilter', () => {
    it('should combine filters with AND', () => {
      const f1 = new TextFilter(col, 'john', Comparison.EQUALS);
      const f2 = new NumberFilter(new Column('age'), 25, Comparison.GREATER);
      const andFilter = new AndFilter([f1, f2]);
      const sql = andFilter.toQuery(params);
      expect(sql).toBe('(users.username = $1) AND (age > $2)');
      expect(params).toEqual(['john', 25]);
    });

    it('should return TRUE for empty filters', () => {
      const andFilter = new AndFilter([]);
      const sql = andFilter.toQuery(params);
      expect(sql).toBe('TRUE');
    });

    it('should return single filter for one filter', () => {
      const f1 = new TextFilter(col, 'john', Comparison.EQUALS);
      const andFilter = new AndFilter([f1]);
      const sql = andFilter.toQuery(params);
      expect(sql).toBe('users.username = $1');
      expect(params).toEqual(['john']);
    });
  });

  describe('OrFilter', () => {
    it('should combine filters with OR', () => {
      const f1 = new TextFilter(col, 'john', Comparison.EQUALS);
      const f2 = new TextFilter(col, 'jane', Comparison.EQUALS);
      const orFilter = new OrFilter([f1, f2]);
      const sql = orFilter.toQuery(params);
      expect(sql).toBe('(users.username = $1) OR (users.username = $2)');
      expect(params).toEqual(['john', 'jane']);
    });

    it('should return FALSE for empty filters', () => {
      const orFilter = new OrFilter([]);
      const sql = orFilter.toQuery(params);
      expect(sql).toBe('FALSE');
    });

    it('should return single filter for one filter', () => {
      const f1 = new TextFilter(col, 'john', Comparison.EQUALS);
      const orFilter = new OrFilter([f1]);
      const sql = orFilter.toQuery(params);
      expect(sql).toBe('users.username = $1');
      expect(params).toEqual(['john']);
    });
  });

  describe('NotFilter', () => {
    it('should negate filter', () => {
      const f1 = new TextFilter(col, 'john', Comparison.EQUALS);
      const notFilter = new NotFilter(f1);
      const sql = notFilter.toQuery(params);
      expect(sql).toBe('NOT (users.username = $1)');
      expect(params).toEqual(['john']);
    });
  });

  describe('filter helper API', () => {
    it('textEquals should create TextFilter', () => {
      const f = filter.textEquals(col, 'john');
      expect(f).toBeInstanceOf(TextFilter);
      const sql = f.toQuery(params);
      expect(sql).toBe('users.username = $1');
    });

    it('textContains should create TextFilter with CONTAINS', () => {
      const f = filter.textContains(col, 'john');
      const sql = f.toQuery(params);
      expect(sql).toBe('users.username LIKE $1');
      expect(params).toEqual(['%john%']);
    });

    it('numberGreater should create NumberFilter', () => {
      const numCol = new Column('age');
      const f = filter.numberGreater(numCol, 25);
      expect(f).toBeInstanceOf(NumberFilter);
    });

    it('dateBetween should create DateRangeFilter', () => {
      const dateCol = new Column('created_at');
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      const f = filter.dateBetween(dateCol, start, end);
      expect(f).toBeInstanceOf(DateRangeFilter);
    });

    it('isNull should create IsNullFilter', () => {
      const f = filter.isNull(col);
      expect(f).toBeInstanceOf(IsNullFilter);
    });

    it('and should create AndFilter', () => {
      const f1 = filter.textEquals(col, 'john');
      const f2 = filter.isNotNull(col);
      const andF = filter.and(f1, f2);
      expect(andF).toBeInstanceOf(AndFilter);
    });
  });
});
