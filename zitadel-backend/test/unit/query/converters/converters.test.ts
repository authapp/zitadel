/**
 * Converters Tests
 */

import { describe, it, expect } from '@jest/globals';
import {
  DateConverter,
  EnumConverter,
  StateConverter,
  State,
  JSONConverter,
} from '../../../../src/lib/query/converters';

describe('DateConverter', () => {
  describe('toDate', () => {
    it('should convert string to Date', () => {
      const date = DateConverter.toDate('2024-01-01');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2024);
    });

    it('should convert number to Date', () => {
      const timestamp = new Date('2024-01-01').getTime();
      const date = DateConverter.toDate(timestamp);
      expect(date).toBeInstanceOf(Date);
    });

    it('should return null for null', () => {
      expect(DateConverter.toDate(null)).toBeNull();
    });

    it('should return null for invalid string', () => {
      expect(DateConverter.toDate('invalid')).toBeNull();
    });

    it('should return Date unchanged', () => {
      const date = new Date();
      expect(DateConverter.toDate(date)).toBe(date);
    });
  });

  describe('fromDate', () => {
    it('should convert Date to ISO string', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const str = DateConverter.fromDate(date);
      expect(str).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('toTimestamp', () => {
    it('should convert Date to Unix timestamp', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const timestamp = DateConverter.toTimestamp(date);
      expect(timestamp).toBe(Math.floor(date.getTime() / 1000));
    });

    it('should return null for null', () => {
      expect(DateConverter.toTimestamp(null)).toBeNull();
    });
  });

  describe('fromTimestamp', () => {
    it('should convert Unix timestamp to Date', () => {
      const timestamp = 1704067200; // 2024-01-01
      const date = DateConverter.fromTimestamp(timestamp);
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2024);
    });
  });

  describe('date arithmetic', () => {
    it('addDays should add days', () => {
      const date = new Date('2024-01-01');
      const result = DateConverter.addDays(date, 5);
      expect(result.getDate()).toBe(6);
    });

    it('addHours should add hours', () => {
      const date = new Date('2024-01-01T10:00:00');
      const result = DateConverter.addHours(date, 3);
      expect(result.getHours()).toBe(13);
    });

    it('diffDays should calculate difference', () => {
      const date1 = new Date('2024-01-10');
      const date2 = new Date('2024-01-01');
      const diff = DateConverter.diffDays(date1, date2);
      expect(diff).toBe(9);
    });
  });

  describe('date checks', () => {
    it('isPast should return true for past date', () => {
      const pastDate = new Date('2020-01-01');
      expect(DateConverter.isPast(pastDate)).toBe(true);
    });

    it('isFuture should return true for future date', () => {
      const futureDate = new Date(Date.now() + 86400000);
      expect(DateConverter.isFuture(futureDate)).toBe(true);
    });

    it('isToday should return true for today', () => {
      const today = new Date();
      expect(DateConverter.isToday(today)).toBe(true);
    });
  });
});

describe('EnumConverter', () => {
  enum TestEnum {
    FIRST = 'first',
    SECOND = 'second',
    THIRD = 3,
  }

  describe('toEnum', () => {
    it('should convert string to enum value', () => {
      const result = EnumConverter.toEnum('first', TestEnum);
      expect(result).toBe(TestEnum.FIRST);
    });

    it('should convert number to enum value', () => {
      const result = EnumConverter.toEnum(3, TestEnum);
      expect(result).toBe(TestEnum.THIRD);
    });

    it('should return null for invalid value', () => {
      const result = EnumConverter.toEnum('invalid', TestEnum);
      expect(result).toBeNull();
    });

    it('should return null for null', () => {
      const result = EnumConverter.toEnum(null, TestEnum);
      expect(result).toBeNull();
    });
  });

  describe('fromEnum', () => {
    it('should convert enum to string', () => {
      const result = EnumConverter.fromEnum(TestEnum.FIRST);
      expect(result).toBe('first');
    });
  });

  describe('getValues', () => {
    it('should return all enum values', () => {
      const values = EnumConverter.getValues(TestEnum);
      expect(values).toContain('first');
      expect(values).toContain('second');
      expect(values).toContain(3);
    });
  });

  describe('isValid', () => {
    it('should return true for valid enum value', () => {
      expect(EnumConverter.isValid('first', TestEnum)).toBe(true);
    });

    it('should return false for invalid value', () => {
      expect(EnumConverter.isValid('invalid', TestEnum)).toBe(false);
    });
  });
});

describe('StateConverter', () => {
  describe('toState', () => {
    it('should convert number to State', () => {
      expect(StateConverter.toState(1)).toBe(State.ACTIVE);
      expect(StateConverter.toState(2)).toBe(State.INACTIVE);
    });

    it('should convert string to State', () => {
      expect(StateConverter.toState('ACTIVE')).toBe(State.ACTIVE);
      expect(StateConverter.toState('active')).toBe(State.ACTIVE);
    });

    it('should return UNSPECIFIED for null', () => {
      expect(StateConverter.toState(null)).toBe(State.UNSPECIFIED);
    });

    it('should return UNSPECIFIED for invalid value', () => {
      expect(StateConverter.toState('invalid')).toBe(State.UNSPECIFIED);
    });
  });

  describe('fromState', () => {
    it('should convert State to string', () => {
      expect(StateConverter.fromState(State.ACTIVE)).toBe('ACTIVE');
      expect(StateConverter.fromState(State.DELETED)).toBe('DELETED');
    });
  });

  describe('state checks', () => {
    it('isActive should work', () => {
      expect(StateConverter.isActive(State.ACTIVE)).toBe(true);
      expect(StateConverter.isActive(State.INACTIVE)).toBe(false);
    });

    it('isInactive should work', () => {
      expect(StateConverter.isInactive(State.INACTIVE)).toBe(true);
      expect(StateConverter.isInactive(State.ACTIVE)).toBe(false);
    });

    it('isDeleted should work', () => {
      expect(StateConverter.isDeleted(State.DELETED)).toBe(true);
      expect(StateConverter.isDeleted(State.REMOVED)).toBe(true);
      expect(StateConverter.isDeleted(State.ACTIVE)).toBe(false);
    });
  });

  describe('canTransition', () => {
    it('should allow valid transitions', () => {
      expect(StateConverter.canTransition(State.ACTIVE, State.INACTIVE)).toBe(true);
      expect(StateConverter.canTransition(State.INACTIVE, State.ACTIVE)).toBe(true);
      expect(StateConverter.canTransition(State.ACTIVE, State.DELETED)).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(StateConverter.canTransition(State.DELETED, State.ACTIVE)).toBe(false);
      expect(StateConverter.canTransition(State.REMOVED, State.INACTIVE)).toBe(false);
    });

    it('should allow any transition from UNSPECIFIED', () => {
      expect(StateConverter.canTransition(State.UNSPECIFIED, State.ACTIVE)).toBe(true);
      expect(StateConverter.canTransition(State.UNSPECIFIED, State.DELETED)).toBe(true);
    });
  });

  describe('state filtering helpers', () => {
    it('getActiveStates should return active states', () => {
      const states = StateConverter.getActiveStates();
      expect(states).toContain(State.ACTIVE);
      expect(states).toHaveLength(1);
    });

    it('getNonDeletedStates should exclude deleted', () => {
      const states = StateConverter.getNonDeletedStates();
      expect(states).not.toContain(State.DELETED);
      expect(states).not.toContain(State.REMOVED);
    });
  });
});

describe('JSONConverter', () => {
  describe('parse', () => {
    it('should parse valid JSON', () => {
      const result = JSONConverter.parse<{ name: string }>('{"name":"test"}');
      expect(result).toEqual({ name: 'test' });
    });

    it('should return null for null', () => {
      expect(JSONConverter.parse(null)).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      expect(JSONConverter.parse('invalid')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(JSONConverter.parse('')).toBeNull();
    });

    it('should return object if already object', () => {
      const obj = { name: 'test' };
      expect(JSONConverter.parse(obj as any)).toBe(obj);
    });
  });

  describe('stringify', () => {
    it('should stringify object', () => {
      const result = JSONConverter.stringify({ name: 'test' });
      expect(result).toBe('{"name":"test"}');
    });

    it('should return empty string for null', () => {
      expect(JSONConverter.stringify(null)).toBe('');
    });
  });

  describe('parseOrDefault', () => {
    it('should parse with default', () => {
      const result = JSONConverter.parseOrDefault('{"name":"test"}', { name: 'default' });
      expect(result).toEqual({ name: 'test' });
    });

    it('should return default for invalid JSON', () => {
      const result = JSONConverter.parseOrDefault('invalid', { name: 'default' });
      expect(result).toEqual({ name: 'default' });
    });
  });

  describe('isValid', () => {
    it('should return true for valid JSON', () => {
      expect(JSONConverter.isValid('{"name":"test"}')).toBe(true);
    });

    it('should return false for invalid JSON', () => {
      expect(JSONConverter.isValid('invalid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(JSONConverter.isValid('')).toBe(false);
    });
  });

  describe('safeParse', () => {
    it('should return success for valid JSON', () => {
      const result = JSONConverter.safeParse<{ name: string }>('{"name":"test"}');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test' });
    });

    it('should return error for invalid JSON', () => {
      const result = JSONConverter.safeParse('invalid');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('deepClone', () => {
    it('should deep clone object', () => {
      const obj = { name: 'test', nested: { value: 123 } };
      const cloned = JSONConverter.deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.nested).not.toBe(obj.nested);
    });
  });
});
