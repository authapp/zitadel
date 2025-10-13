/**
 * SearchQuery Tests
 */

import { describe, it, expect } from '@jest/globals';
import {
  SearchRequestBuilder,
  SearchQueryBuilder,
  newSearchRequest,
  applyDefaultLimit,
  applyMaxLimit,
} from '../../../../src/lib/query/search/search-query';
import { Column } from '../../../../src/lib/query/search/column';
import { filter } from '../../../../src/lib/query/search/filters';

describe('SearchQuery', () => {
  describe('SearchRequestBuilder', () => {
    it('should build empty request', () => {
      const builder = new SearchRequestBuilder();
      const request = builder.build();
      expect(request).toEqual({});
    });

    it('should set offset', () => {
      const request = new SearchRequestBuilder().withOffset(10).build();
      expect(request.offset).toBe(10);
    });

    it('should set limit', () => {
      const request = new SearchRequestBuilder().withLimit(50).build();
      expect(request.limit).toBe(50);
    });

    it('should set sorting', () => {
      const col = new Column('username');
      const request = new SearchRequestBuilder()
        .withSorting(col, true)
        .build();
      expect(request.sortingColumn).toBe(col);
      expect(request.asc).toBe(true);
    });

    it('should add filters', () => {
      const col = new Column('username');
      const f1 = filter.textEquals(col, 'john');
      const f2 = filter.isNotNull(col);
      const request = new SearchRequestBuilder()
        .withFilters(f1, f2)
        .build();
      expect(request.queries).toHaveLength(2);
    });

    it('should chain multiple operations', () => {
      const col = new Column('username');
      const request = new SearchRequestBuilder()
        .withOffset(10)
        .withLimit(20)
        .withSorting(col, false)
        .withFilters(filter.textContains(col, 'test'))
        .build();
      expect(request.offset).toBe(10);
      expect(request.limit).toBe(20);
      expect(request.sortingColumn).toBe(col);
      expect(request.asc).toBe(false);
      expect(request.queries).toHaveLength(1);
    });
  });

  describe('SearchQueryBuilder', () => {
    it('should build WHERE clause from filters', () => {
      const col = new Column('username');
      const request = newSearchRequest()
        .withFilters(filter.textEquals(col, 'john'))
        .build();
      const builder = new SearchQueryBuilder(request);
      const { where, params } = builder.build();
      expect(where).toBe('WHERE username = $1');
      expect(params).toEqual(['john']);
    });

    it('should build empty WHERE for no filters', () => {
      const request = newSearchRequest().build();
      const builder = new SearchQueryBuilder(request);
      const { where } = builder.build();
      expect(where).toBe('');
    });

    it('should build ORDER BY clause', () => {
      const col = new Column('username');
      const request = newSearchRequest()
        .withSorting(col, true)
        .build();
      const builder = new SearchQueryBuilder(request);
      const { orderBy } = builder.build();
      expect(orderBy).toBe('ORDER BY username ASC');
    });

    it('should build ORDER BY DESC', () => {
      const col = new Column('created_at');
      const request = newSearchRequest()
        .withSorting(col, false)
        .build();
      const builder = new SearchQueryBuilder(request);
      const { orderBy } = builder.build();
      expect(orderBy).toBe('ORDER BY created_at DESC');
    });

    it('should build LIMIT clause', () => {
      const request = newSearchRequest().withLimit(10).build();
      const builder = new SearchQueryBuilder(request);
      const { limit } = builder.build();
      expect(limit).toBe('LIMIT 10');
    });

    it('should build OFFSET clause', () => {
      const request = newSearchRequest().withOffset(20).build();
      const builder = new SearchQueryBuilder(request);
      const { offset } = builder.build();
      expect(offset).toBe('OFFSET 20');
    });

    it('should build complete query', () => {
      const col = new Column('username');
      const request = newSearchRequest()
        .withFilters(
          filter.textContains(col, 'test'),
          filter.isNotNull(col)
        )
        .withSorting(col, true)
        .withLimit(10)
        .withOffset(20)
        .build();
      const builder = new SearchQueryBuilder(request);
      const result = builder.build();
      expect(result.where).toContain('WHERE');
      expect(result.orderBy).toBe('ORDER BY username ASC');
      expect(result.limit).toBe('LIMIT 10');
      expect(result.offset).toBe('OFFSET 20');
      expect(result.params.length).toBeGreaterThan(0);
    });
  });

  describe('helper functions', () => {
    it('newSearchRequest should return builder', () => {
      const builder = newSearchRequest();
      expect(builder).toBeInstanceOf(SearchRequestBuilder);
    });

    it('applyDefaultLimit should add default limit', () => {
      const request = {};
      const result = applyDefaultLimit(request, 50);
      expect(result.limit).toBe(50);
    });

    it('applyDefaultLimit should not override existing limit', () => {
      const request = { limit: 10 };
      const result = applyDefaultLimit(request, 50);
      expect(result.limit).toBe(10);
    });

    it('applyMaxLimit should cap limit', () => {
      const request = { limit: 2000 };
      const result = applyMaxLimit(request, 1000);
      expect(result.limit).toBe(1000);
    });

    it('applyMaxLimit should not modify smaller limits', () => {
      const request = { limit: 50 };
      const result = applyMaxLimit(request, 1000);
      expect(result.limit).toBe(50);
    });
  });
});
