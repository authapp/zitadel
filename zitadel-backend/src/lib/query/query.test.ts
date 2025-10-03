import { Pool } from 'pg';
import { PostgresQuery } from './postgres/query';
import { filter, filterToSQL } from './filter';
import { FilterOperator, LogicalOperator, QueryOptions } from './types';

// Mock pg Pool
jest.mock('pg', () => {
  return {
    Pool: jest.fn(),
  };
});

describe('FilterBuilder', () => {
  describe('basic conditions', () => {
    it('should build equals condition', () => {
      const fb = filter().equals('name', 'John');
      const result = fb.build();
      
      expect(result).toEqual({
        operator: LogicalOperator.AND,
        conditions: [
          { field: 'name', operator: FilterOperator.EQUALS, value: 'John' }
        ]
      });
    });

    it('should build not equals condition', () => {
      const fb = filter().notEquals('status', 'deleted');
      const conditions = fb.buildArray();
      
      expect(conditions).toEqual([
        { field: 'status', operator: FilterOperator.NOT_EQUALS, value: 'deleted' }
      ]);
    });

    it('should build greater than condition', () => {
      const fb = filter().greaterThan('age', 18);
      const conditions = fb.buildArray();
      
      expect(conditions[0]).toEqual({
        field: 'age',
        operator: FilterOperator.GREATER_THAN,
        value: 18
      });
    });

    it('should build less than or equal condition', () => {
      const fb = filter().lessThanOrEqual('price', 100);
      const conditions = fb.buildArray();
      
      expect(conditions[0].operator).toBe(FilterOperator.LESS_THAN_OR_EQUAL);
    });
  });

  describe('string conditions', () => {
    it('should build LIKE condition', () => {
      const fb = filter().like('email', '%@example.com');
      const conditions = fb.buildArray();
      
      expect(conditions[0]).toEqual({
        field: 'email',
        operator: FilterOperator.LIKE,
        value: '%@example.com'
      });
    });

    it('should build contains condition', () => {
      const fb = filter().contains('description', 'test');
      const conditions = fb.buildArray();
      
      expect(conditions[0].operator).toBe(FilterOperator.CONTAINS);
      expect(conditions[0].value).toBe('test');
    });

    it('should build starts with condition', () => {
      const fb = filter().startsWith('username', 'admin');
      const conditions = fb.buildArray();
      
      expect(conditions[0].operator).toBe(FilterOperator.STARTS_WITH);
    });

    it('should build ends with condition', () => {
      const fb = filter().endsWith('domain', '.com');
      const conditions = fb.buildArray();
      
      expect(conditions[0].operator).toBe(FilterOperator.ENDS_WITH);
    });
  });

  describe('array conditions', () => {
    it('should build IN condition', () => {
      const fb = filter().in('status', ['active', 'pending']);
      const conditions = fb.buildArray();
      
      expect(conditions[0]).toEqual({
        field: 'status',
        operator: FilterOperator.IN,
        value: ['active', 'pending']
      });
    });

    it('should build NOT IN condition', () => {
      const fb = filter().notIn('type', ['deleted', 'archived']);
      const conditions = fb.buildArray();
      
      expect(conditions[0].operator).toBe(FilterOperator.NOT_IN);
    });

    it('should throw error for IN with non-array', () => {
      expect(() => {
        filter().in('status', 'active' as any);
      }).toThrow();
    });
  });

  describe('null conditions', () => {
    it('should build IS NULL condition', () => {
      const fb = filter().isNull('deleted_at');
      const conditions = fb.buildArray();
      
      expect(conditions[0]).toEqual({
        field: 'deleted_at',
        operator: FilterOperator.IS_NULL,
        value: undefined
      });
    });

    it('should build IS NOT NULL condition', () => {
      const fb = filter().isNotNull('email');
      const conditions = fb.buildArray();
      
      expect(conditions[0].operator).toBe(FilterOperator.IS_NOT_NULL);
    });
  });

  describe('complex filters', () => {
    it('should build AND conditions', () => {
      const fb = filter()
        .equals('status', 'active')
        .and()
        .greaterThan('age', 18);
      
      const result = fb.build();
      expect(result?.conditions).toHaveLength(2);
      expect(result?.operator).toBe(LogicalOperator.AND);
    });

    it('should build OR conditions', () => {
      const fb = filter()
        .equals('type', 'admin')
        .or()
        .equals('type', 'moderator');
      
      const result = fb.build();
      expect(result?.operator).toBe(LogicalOperator.OR);
    });

    it('should build nested groups', () => {
      const fb = filter()
        .equals('status', 'active')
        .and()
        .group(nested => {
          nested
            .equals('role', 'admin')
            .or()
            .equals('role', 'moderator');
        });
      
      const result = fb.build();
      expect(result?.conditions).toHaveLength(2);
      expect(result?.conditions[1]).toHaveProperty('operator');
    });
  });

  describe('filter to SQL conversion', () => {
    it('should convert simple equals to SQL', () => {
      const conditions = [
        { field: 'name', operator: FilterOperator.EQUALS, value: 'John' }
      ];
      
      const { sql, params } = filterToSQL(conditions);
      expect(sql).toBe('name = $1');
      expect(params).toEqual(['John']);
    });

    it('should convert multiple AND conditions', () => {
      const conditions = [
        { field: 'status', operator: FilterOperator.EQUALS, value: 'active' },
        { field: 'age', operator: FilterOperator.GREATER_THAN, value: 18 }
      ];
      
      const { sql, params } = filterToSQL(conditions);
      expect(sql).toBe('status = $1 AND age > $2');
      expect(params).toEqual(['active', 18]);
    });

    it('should convert IN to SQL', () => {
      const conditions = [
        { field: 'status', operator: FilterOperator.IN, value: ['active', 'pending'] }
      ];
      
      const { sql, params } = filterToSQL(conditions);
      expect(sql).toBe('status = ANY($1)');
      expect(params).toEqual([['active', 'pending']]);
    });

    it('should convert LIKE patterns', () => {
      const conditions = [
        { field: 'email', operator: FilterOperator.CONTAINS, value: 'test' }
      ];
      
      const { sql, params } = filterToSQL(conditions);
      expect(sql).toBe('email LIKE $1');
      expect(params).toEqual(['%test%']);
    });

    it('should convert IS NULL', () => {
      const conditions = [
        { field: 'deleted_at', operator: FilterOperator.IS_NULL }
      ];
      
      const { sql, params } = filterToSQL(conditions);
      expect(sql).toBe('deleted_at IS NULL');
      expect(params).toEqual([]);
    });

    it('should convert complex filter groups', () => {
      const group = {
        operator: LogicalOperator.OR,
        conditions: [
          { field: 'status', operator: FilterOperator.EQUALS, value: 'active' },
          { field: 'status', operator: FilterOperator.EQUALS, value: 'pending' }
        ]
      };
      
      const { sql, params } = filterToSQL(group);
      expect(sql).toBe('status = $1 OR status = $2');
      expect(params).toEqual(['active', 'pending']);
    });
  });
});

describe('PostgresQuery', () => {
  let query: PostgresQuery;
  let mockPool: any;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
      end: jest.fn(),
    };
    query = new PostgresQuery(mockPool as Pool);
  });

  describe('findById', () => {
    it('should find entity by ID', async () => {
      const mockUser = { id: '123', name: 'John', deleted_at: null };
      mockPool.query.mockResolvedValue({ rows: [mockUser], command: '', oid: 0, fields: [], rowCount: 1 });

      const result = await query.findById('users', '123');
      
      expect(result).toEqual(mockUser);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users'),
        ['123']
      );
    });

    it('should return null for non-existent entity', async () => {
      mockPool.query.mockResolvedValue({ rows: [], command: '', oid: 0, fields: [], rowCount: 0 });

      const result = await query.findById('users', '999');
      
      expect(result).toBeNull();
    });
  });

  describe('find', () => {
    it('should find entities with filters', async () => {
      const mockUsers = [
        { id: '1', name: 'John', deleted_at: null },
        { id: '2', name: 'Jane', deleted_at: null }
      ];
      mockPool.query.mockResolvedValue({ rows: mockUsers, command: '', oid: 0, fields: [], rowCount: 2 });

      const options: QueryOptions = {
        filters: [
          { field: 'status', operator: FilterOperator.EQUALS, value: 'active' }
        ]
      };

      const result = await query.find('users', options);
      
      expect(result.data).toEqual(mockUsers);
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should handle pagination', async () => {
      const mockUsers = [{ id: '1', name: 'John', deleted_at: null }];
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }], command: '', oid: 0, fields: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: mockUsers, command: '', oid: 0, fields: [], rowCount: 1 });

      const options: QueryOptions = {
        pagination: { offset: 0, limit: 5 }
      };

      const result = await query.find('users', options);
      
      expect(result.pagination).toEqual({
        offset: 0,
        limit: 5,
        total: 10,
        hasMore: true
      });
    });

    it('should handle sorting', async () => {
      const mockUsers = [{ id: '1', name: 'Alice', deleted_at: null }];
      mockPool.query.mockResolvedValue({ rows: mockUsers, command: '', oid: 0, fields: [], rowCount: 1 });

      const options: QueryOptions = {
        sorting: [
          { field: 'name', direction: 'asc' },
          { field: 'created_at', direction: 'desc' }
        ]
      };

      const result = await query.find('users', options);
      
      expect(result.data).toEqual(mockUsers);
      const call = mockPool.query.mock.calls[0];
      expect(call[0]).toContain('ORDER BY');
    });
  });

  describe('count', () => {
    it('should count entities', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '42' }], command: '', oid: 0, fields: [], rowCount: 1 });

      const count = await query.count('users');
      
      expect(count).toBe(42);
    });

    it('should count with filters', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '10' }], command: '', oid: 0, fields: [], rowCount: 1 });

      const filters = [
        { field: 'status', operator: FilterOperator.EQUALS, value: 'active' }
      ];

      const count = await query.count('users', filters);
      
      expect(count).toBe(10);
    });
  });

  describe('exists', () => {
    it('should return true if entity exists', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: '123' }], command: '', oid: 0, fields: [], rowCount: 1 });

      const exists = await query.exists('users', '123');
      
      expect(exists).toBe(true);
    });

    it('should return false if entity does not exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [], command: '', oid: 0, fields: [], rowCount: 0 });

      const exists = await query.exists('users', '999');
      
      expect(exists).toBe(false);
    });
  });

  describe('health', () => {
    it('should return true for healthy connection', async () => {
      mockPool.query.mockResolvedValue({ rows: [], command: '', oid: 0, fields: [], rowCount: 0 });

      const healthy = await query.health();
      
      expect(healthy).toBe(true);
    });

    it('should return false for unhealthy connection', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection failed'));

      const healthy = await query.health();
      
      expect(healthy).toBe(false);
    });
  });
});
