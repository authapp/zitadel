/**
 * Column Tests
 */

import { describe, it, expect } from '@jest/globals';
import { Column, col } from '../../../../src/lib/query/search/column';

describe('Column', () => {
  describe('constructor', () => {
    it('should create column with name only', () => {
      const column = new Column('username');
      expect(column.name).toBe('username');
      expect(column.table).toBeUndefined();
      expect(column.alias).toBeUndefined();
    });

    it('should create column with table', () => {
      const column = new Column('username', 'users');
      expect(column.name).toBe('username');
      expect(column.table).toBe('users');
      expect(column.alias).toBeUndefined();
    });

    it('should create column with table and alias', () => {
      const column = new Column('username', 'users', 'user_name');
      expect(column.name).toBe('username');
      expect(column.table).toBe('users');
      expect(column.alias).toBe('user_name');
    });
  });

  describe('identifier', () => {
    it('should return column name without table', () => {
      const column = new Column('username');
      expect(column.identifier()).toBe('username');
    });

    it('should return table.column with table', () => {
      const column = new Column('username', 'users');
      expect(column.identifier()).toBe('users.username');
    });

    it('should return table.column even with alias', () => {
      const column = new Column('username', 'users', 'user_name');
      expect(column.identifier()).toBe('users.username');
    });
  });

  describe('orderBy', () => {
    it('should return identifier without alias', () => {
      const column = new Column('username', 'users');
      expect(column.orderBy()).toBe('users.username');
    });

    it('should return alias when present', () => {
      const column = new Column('username', 'users', 'user_name');
      expect(column.orderBy()).toBe('user_name');
    });

    it('should return column name when no table or alias', () => {
      const column = new Column('username');
      expect(column.orderBy()).toBe('username');
    });
  });

  describe('isZero', () => {
    it('should return true for empty name', () => {
      const column = new Column('');
      expect(column.isZero()).toBe(true);
    });

    it('should return false for non-empty name', () => {
      const column = new Column('username');
      expect(column.isZero()).toBe(false);
    });
  });

  describe('select', () => {
    it('should return column identifier without alias', () => {
      const column = new Column('username');
      expect(column.select()).toBe('username');
    });

    it('should return column with AS alias', () => {
      const column = new Column('username', 'users', 'user_name');
      expect(column.select()).toBe('users.username AS "user_name"');
    });

    it('should not add AS if alias equals name', () => {
      const column = new Column('username', 'users', 'username');
      expect(column.select()).toBe('users.username');
    });
  });

  describe('static methods', () => {
    it('fromName should create simple column', () => {
      const column = Column.fromName('username');
      expect(column.name).toBe('username');
      expect(column.table).toBeUndefined();
    });

    it('fromTable should create column with table', () => {
      const column = Column.fromTable('users', 'username', 'user_name');
      expect(column.name).toBe('username');
      expect(column.table).toBe('users');
      expect(column.alias).toBe('user_name');
    });
  });

  describe('withAlias', () => {
    it('should clone column with new alias', () => {
      const column = new Column('username', 'users');
      const aliased = column.withAlias('user_name');
      expect(aliased.name).toBe('username');
      expect(aliased.table).toBe('users');
      expect(aliased.alias).toBe('user_name');
      expect(column.alias).toBeUndefined(); // Original unchanged
    });
  });

  describe('withTable', () => {
    it('should clone column with new table', () => {
      const column = new Column('username');
      const withTable = column.withTable('users');
      expect(withTable.name).toBe('username');
      expect(withTable.table).toBe('users');
      expect(column.table).toBeUndefined(); // Original unchanged
    });
  });

  describe('toString', () => {
    it('should return identifier', () => {
      const column = new Column('username', 'users');
      expect(column.toString()).toBe('users.username');
    });
  });

  describe('col helper', () => {
    it('should create column', () => {
      const column = col('username', 'users', 'user_name');
      expect(column).toBeInstanceOf(Column);
      expect(column.name).toBe('username');
      expect(column.table).toBe('users');
      expect(column.alias).toBe('user_name');
    });
  });
});
