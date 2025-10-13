/**
 * Search Query Framework
 * 
 * Generic search and filtering framework for query operations.
 * Based on Zitadel Go internal/query/search_query.go
 */

import { Column } from './column';

/**
 * Comparison operators for filters
 */
export enum Comparison {
  EQUALS = 'eq',
  NOT_EQUALS = 'ne',
  GREATER = 'gt',
  GREATER_OR_EQUAL = 'gte',
  LESS = 'lt',
  LESS_OR_EQUAL = 'lte',
  IN = 'in',
  NOT_IN = 'nin',
  LIKE = 'like',
  ILIKE = 'ilike',
  NOT_LIKE = 'nlike',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  CONTAINS = 'contains',
  BETWEEN = 'between',
}

/**
 * SearchQuery interface - all filters must implement this
 */
export interface SearchQuery {
  /**
   * Convert to SQL WHERE clause
   */
  toQuery(params: any[]): string;

  /**
   * Get the comparison operator
   */
  toComparison(): Comparison;

  /**
   * Get the column being queried
   */
  getColumn(): Column;
}

/**
 * SearchRequest represents a complete search request with filters, sorting, and pagination
 */
export interface SearchRequest {
  /**
   * Offset for pagination
   */
  offset?: number;

  /**
   * Limit for pagination
   */
  limit?: number;

  /**
   * Column to sort by
   */
  sortingColumn?: Column;

  /**
   * Sort direction (true = ascending, false = descending)
   */
  asc?: boolean;

  /**
   * Search query filters
   */
  queries?: SearchQuery[];
}

/**
 * SearchResponse wraps query results with pagination info
 */
export interface SearchResponse<T> {
  /**
   * Result items
   */
  items: T[];

  /**
   * Total count (if requested)
   */
  count: number;

  /**
   * Offset used
   */
  offset: number;

  /**
   * Limit used
   */
  limit: number;

  /**
   * Query timestamp
   */
  timestamp?: Date;
}

/**
 * Builder for SearchRequest
 */
export class SearchRequestBuilder {
  private request: SearchRequest = {};

  /**
   * Set offset
   */
  withOffset(offset: number): this {
    this.request.offset = offset;
    return this;
  }

  /**
   * Set limit
   */
  withLimit(limit: number): this {
    this.request.limit = limit;
    return this;
  }

  /**
   * Set sorting
   */
  withSorting(column: Column, asc: boolean = true): this {
    this.request.sortingColumn = column;
    this.request.asc = asc;
    return this;
  }

  /**
   * Add filters
   */
  withFilters(...queries: SearchQuery[]): this {
    if (!this.request.queries) {
      this.request.queries = [];
    }
    this.request.queries.push(...queries);
    return this;
  }

  /**
   * Build the search request
   */
  build(): SearchRequest {
    return this.request;
  }
}

/**
 * Convert SearchRequest to SQL clauses
 */
export class SearchQueryBuilder {
  private params: any[] = [];
  private whereClauses: string[] = [];

  constructor(private request: SearchRequest) {}

  /**
   * Build WHERE clause from filters
   */
  buildWhere(): { sql: string; params: any[] } {
    if (!this.request.queries || this.request.queries.length === 0) {
      return { sql: '', params: [] };
    }

    this.whereClauses = this.request.queries.map(query => {
      return query.toQuery(this.params);
    });

    const whereSQL = this.whereClauses.length > 0
      ? `WHERE ${this.whereClauses.join(' AND ')}`
      : '';

    return { sql: whereSQL, params: this.params };
  }

  /**
   * Build ORDER BY clause
   */
  buildOrderBy(): string {
    if (!this.request.sortingColumn) {
      return '';
    }

    const direction = this.request.asc !== false ? 'ASC' : 'DESC';
    return `ORDER BY ${this.request.sortingColumn.orderBy()} ${direction}`;
  }

  /**
   * Build LIMIT clause
   */
  buildLimit(): string {
    if (this.request.limit === undefined) {
      return '';
    }

    return `LIMIT ${this.request.limit}`;
  }

  /**
   * Build OFFSET clause
   */
  buildOffset(): string {
    if (this.request.offset === undefined || this.request.offset === 0) {
      return '';
    }

    return `OFFSET ${this.request.offset}`;
  }

  /**
   * Build complete query
   */
  build(): { where: string; orderBy: string; limit: string; offset: string; params: any[] } {
    const whereResult = this.buildWhere();
    
    return {
      where: whereResult.sql,
      orderBy: this.buildOrderBy(),
      limit: this.buildLimit(),
      offset: this.buildOffset(),
      params: whereResult.params,
    };
  }
}

/**
 * Helper to create a SearchRequest
 */
export function newSearchRequest(): SearchRequestBuilder {
  return new SearchRequestBuilder();
}

/**
 * Helper to apply default limit if not set
 */
export function applyDefaultLimit(request: SearchRequest, defaultLimit: number = 100): SearchRequest {
  if (request.limit === undefined) {
    request.limit = defaultLimit;
  }
  return request;
}

/**
 * Helper to apply maximum limit
 */
export function applyMaxLimit(request: SearchRequest, maxLimit: number = 1000): SearchRequest {
  if (request.limit && request.limit > maxLimit) {
    request.limit = maxLimit;
  }
  return request;
}
