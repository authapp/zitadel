/**
 * Advanced Query Builder for Event Filtering
 * Based on Go implementation: internal/eventstore/search_query.go
 * 
 * Provides a fluent interface for building complex event queries with:
 * - OR logic support
 * - Exclusion filters
 * - Method chaining
 * - Type-safe query construction
 */

import { EventFilter, SearchQuery } from './types';

/**
 * Builder for constructing event queries with advanced filtering
 * 
 * Supports both AND and OR logic, exclusions, and method chaining for
 * building complex queries in a readable way.
 * 
 * @example
 * const query = new QueryBuilder()
 *   .aggregateTypes('user', 'org')
 *   .or()
 *   .aggregateTypes('project')
 *   .excludeEventTypes('*.deleted')
 *   .limit(100)
 *   .build();
 */
export class QueryBuilder {
  private queries: EventFilter[] = [];
  private currentQuery: EventFilter = {};
  private excludeFilter: EventFilter = {};
  private limitValue?: number;
  private descending: boolean = false;

  /**
   * Filter by aggregate types
   * Multiple calls to this method within the same query segment are combined with AND logic
   */
  aggregateTypes(...types: string[]): this {
    if (!this.currentQuery.aggregateTypes) {
      this.currentQuery.aggregateTypes = [];
    }
    this.currentQuery.aggregateTypes.push(...types);
    return this;
  }

  /**
   * Filter by aggregate IDs
   */
  aggregateIDs(...ids: string[]): this {
    if (!this.currentQuery.aggregateIDs) {
      this.currentQuery.aggregateIDs = [];
    }
    this.currentQuery.aggregateIDs.push(...ids);
    return this;
  }

  /**
   * Filter by event types
   */
  eventTypes(...types: string[]): this {
    if (!this.currentQuery.eventTypes) {
      this.currentQuery.eventTypes = [];
    }
    this.currentQuery.eventTypes.push(...types);
    return this;
  }

  /**
   * Start a new OR query segment
   * All filters added after calling or() are combined with OR logic
   * 
   * @example
   * builder
   *   .aggregateTypes('user')  // First segment
   *   .or()
   *   .aggregateTypes('org')   // OR second segment
   */
  or(): this {
    // Save current query if it has any filters
    if (this.hasFilters(this.currentQuery)) {
      this.queries.push(this.currentQuery);
      this.currentQuery = {};
    }
    return this;
  }

  /**
   * Exclude specific aggregate types from results
   */
  excludeAggregateTypes(...types: string[]): this {
    if (!this.excludeFilter.aggregateTypes) {
      this.excludeFilter.aggregateTypes = [];
    }
    this.excludeFilter.aggregateTypes.push(...types);
    return this;
  }

  /**
   * Exclude specific aggregate IDs from results
   */
  excludeAggregateIDs(...ids: string[]): this {
    if (!this.excludeFilter.aggregateIDs) {
      this.excludeFilter.aggregateIDs = [];
    }
    this.excludeFilter.aggregateIDs.push(...ids);
    return this;
  }

  /**
   * Exclude specific event types from results
   */
  excludeEventTypes(...types: string[]): this {
    if (!this.excludeFilter.eventTypes) {
      this.excludeFilter.eventTypes = [];
    }
    this.excludeFilter.eventTypes.push(...types);
    return this;
  }

  /**
   * Set maximum number of events to return
   */
  limit(value: number): this {
    this.limitValue = value;
    return this;
  }

  /**
   * Order results descending (newest first)
   * Default is ascending (oldest first)
   */
  orderDescending(): this {
    this.descending = true;
    return this;
  }

  /**
   * Order results ascending (oldest first)
   * This is the default ordering
   */
  orderAscending(): this {
    this.descending = false;
    return this;
  }

  /**
   * Build the final search query
   * Combines all OR segments and exclusion filters
   */
  build(): SearchQuery {
    // Add current query if it has filters
    if (this.hasFilters(this.currentQuery)) {
      this.queries.push(this.currentQuery);
    }

    const searchQuery: SearchQuery = {
      queries: this.queries.length > 0 ? this.queries : [{}],
      limit: this.limitValue,
      desc: this.descending,
    };

    // Add exclusion filter if any exclusions are defined
    if (this.hasFilters(this.excludeFilter)) {
      searchQuery.excludeFilter = this.excludeFilter;
    }

    return searchQuery;
  }

  /**
   * Reset the builder to start a new query
   */
  reset(): this {
    this.queries = [];
    this.currentQuery = {};
    this.excludeFilter = {};
    this.limitValue = undefined;
    this.descending = false;
    return this;
  }

  /**
   * Check if a filter has any actual filters defined
   */
  private hasFilters(filter: EventFilter): boolean {
    return !!(
      filter.aggregateTypes?.length ||
      filter.aggregateIDs?.length ||
      filter.eventTypes?.length
    );
  }
}

/**
 * Helper function to create a new query builder
 * Convenience function for more fluent API usage
 * 
 * @example
 * const query = query()
 *   .aggregateTypes('user')
 *   .eventTypes('user.added')
 *   .build();
 */
export function query(): QueryBuilder {
  return new QueryBuilder();
}

/**
 * Helper function to create a simple query with just aggregate types
 * 
 * @example
 * const filter = queryByAggregateTypes('user', 'org');
 */
export function queryByAggregateTypes(...types: string[]): EventFilter {
  return { aggregateTypes: types };
}

/**
 * Helper function to create a simple query with just aggregate IDs
 * 
 * @example
 * const filter = queryByAggregateIDs('user-1', 'user-2');
 */
export function queryByAggregateIDs(...ids: string[]): EventFilter {
  return { aggregateIDs: ids };
}

/**
 * Helper function to create a simple query with just event types
 * 
 * @example
 * const filter = queryByEventTypes('user.added', 'user.updated');
 */
export function queryByEventTypes(...types: string[]): EventFilter {
  return { eventTypes: types };
}
