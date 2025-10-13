/**
 * Filter Implementations
 * 
 * Concrete filter implementations for various data types.
 * Based on Zitadel Go internal/query/search_query.go
 */

import { Column } from './column';
import { SearchQuery, Comparison } from './search-query';

/**
 * Base filter class
 */
abstract class BaseFilter implements SearchQuery {
  constructor(
    protected readonly column: Column,
    protected readonly comparison: Comparison
  ) {}

  abstract toQuery(params: any[]): string;

  toComparison(): Comparison {
    return this.comparison;
  }

  getColumn(): Column {
    return this.column;
  }

  protected paramPlaceholder(params: any[]): string {
    return `$${params.length}`;
  }
}

/**
 * Text filter for string comparisons
 */
export class TextFilter extends BaseFilter {
  constructor(
    column: Column,
    private readonly value: string,
    comparison: Comparison
  ) {
    super(column, comparison);
  }

  toQuery(params: any[]): string {
    const col = this.column.identifier();

    switch (this.comparison) {
      case Comparison.EQUALS:
        params.push(this.value);
        return `${col} = ${this.paramPlaceholder(params)}`;

      case Comparison.NOT_EQUALS:
        params.push(this.value);
        return `${col} != ${this.paramPlaceholder(params)}`;

      case Comparison.LIKE:
        params.push(this.value);
        return `${col} LIKE ${this.paramPlaceholder(params)}`;

      case Comparison.ILIKE:
        params.push(this.value);
        return `${col} ILIKE ${this.paramPlaceholder(params)}`;

      case Comparison.NOT_LIKE:
        params.push(this.value);
        return `${col} NOT LIKE ${this.paramPlaceholder(params)}`;

      case Comparison.STARTS_WITH:
        params.push(`${this.value}%`);
        return `${col} LIKE ${this.paramPlaceholder(params)}`;

      case Comparison.ENDS_WITH:
        params.push(`%${this.value}`);
        return `${col} LIKE ${this.paramPlaceholder(params)}`;

      case Comparison.CONTAINS:
        params.push(`%${this.value}%`);
        return `${col} LIKE ${this.paramPlaceholder(params)}`;

      default:
        throw new Error(`Unsupported text comparison: ${this.comparison}`);
    }
  }
}

/**
 * Number filter for numeric comparisons
 */
export class NumberFilter extends BaseFilter {
  constructor(
    column: Column,
    private readonly value: number,
    comparison: Comparison
  ) {
    super(column, comparison);
  }

  toQuery(params: any[]): string {
    const col = this.column.identifier();
    params.push(this.value);
    const placeholder = this.paramPlaceholder(params);

    switch (this.comparison) {
      case Comparison.EQUALS:
        return `${col} = ${placeholder}`;
      case Comparison.NOT_EQUALS:
        return `${col} != ${placeholder}`;
      case Comparison.GREATER:
        return `${col} > ${placeholder}`;
      case Comparison.GREATER_OR_EQUAL:
        return `${col} >= ${placeholder}`;
      case Comparison.LESS:
        return `${col} < ${placeholder}`;
      case Comparison.LESS_OR_EQUAL:
        return `${col} <= ${placeholder}`;
      default:
        throw new Error(`Unsupported number comparison: ${this.comparison}`);
    }
  }
}

/**
 * Boolean filter
 */
export class BooleanFilter extends BaseFilter {
  constructor(
    column: Column,
    private readonly value: boolean
  ) {
    super(column, Comparison.EQUALS);
  }

  toQuery(params: any[]): string {
    const col = this.column.identifier();
    params.push(this.value);
    return `${col} = ${this.paramPlaceholder(params)}`;
  }
}

/**
 * Date filter for date/timestamp comparisons
 */
export class DateFilter extends BaseFilter {
  constructor(
    column: Column,
    private readonly value: Date,
    comparison: Comparison
  ) {
    super(column, comparison);
  }

  toQuery(params: any[]): string {
    const col = this.column.identifier();
    params.push(this.value);
    const placeholder = this.paramPlaceholder(params);

    switch (this.comparison) {
      case Comparison.EQUALS:
        return `${col} = ${placeholder}`;
      case Comparison.NOT_EQUALS:
        return `${col} != ${placeholder}`;
      case Comparison.GREATER:
        return `${col} > ${placeholder}`;
      case Comparison.GREATER_OR_EQUAL:
        return `${col} >= ${placeholder}`;
      case Comparison.LESS:
        return `${col} < ${placeholder}`;
      case Comparison.LESS_OR_EQUAL:
        return `${col} <= ${placeholder}`;
      default:
        throw new Error(`Unsupported date comparison: ${this.comparison}`);
    }
  }
}

/**
 * Date range filter (BETWEEN)
 */
export class DateRangeFilter extends BaseFilter {
  constructor(
    column: Column,
    private readonly start: Date,
    private readonly end: Date
  ) {
    super(column, Comparison.BETWEEN);
  }

  toQuery(params: any[]): string {
    const col = this.column.identifier();
    params.push(this.start, this.end);
    return `${col} BETWEEN $${params.length - 1} AND $${params.length}`;
  }
}

/**
 * List filter (IN clause)
 */
export class ListFilter extends BaseFilter {
  constructor(
    column: Column,
    private readonly values: any[]
  ) {
    super(column, Comparison.IN);
  }

  toQuery(params: any[]): string {
    if (this.values.length === 0) {
      return 'FALSE'; // No values means no match
    }

    const col = this.column.identifier();
    const placeholders: string[] = [];
    
    for (const value of this.values) {
      params.push(value);
      placeholders.push(this.paramPlaceholder(params));
    }

    return `${col} IN (${placeholders.join(', ')})`;
  }
}

/**
 * Not in list filter (NOT IN clause)
 */
export class NotListFilter extends BaseFilter {
  constructor(
    column: Column,
    private readonly values: any[]
  ) {
    super(column, Comparison.NOT_IN);
  }

  toQuery(params: any[]): string {
    if (this.values.length === 0) {
      return 'TRUE'; // No values means match all
    }

    const col = this.column.identifier();
    const placeholders: string[] = [];
    
    for (const value of this.values) {
      params.push(value);
      placeholders.push(this.paramPlaceholder(params));
    }

    return `${col} NOT IN (${placeholders.join(', ')})`;
  }
}

/**
 * IS NULL filter
 */
export class IsNullFilter extends BaseFilter {
  constructor(column: Column) {
    super(column, Comparison.IS_NULL);
  }

  toQuery(_params: any[]): string {
    return `${this.column.identifier()} IS NULL`;
  }
}

/**
 * IS NOT NULL filter
 */
export class IsNotNullFilter extends BaseFilter {
  constructor(column: Column) {
    super(column, Comparison.IS_NOT_NULL);
  }

  toQuery(_params: any[]): string {
    return `${this.column.identifier()} IS NOT NULL`;
  }
}

/**
 * AND filter - combines multiple filters with AND
 */
export class AndFilter implements SearchQuery {
  constructor(private readonly filters: SearchQuery[]) {}

  toQuery(params: any[]): string {
    if (this.filters.length === 0) {
      return 'TRUE';
    }

    if (this.filters.length === 1) {
      return this.filters[0].toQuery(params);
    }

    const clauses = this.filters.map(f => `(${f.toQuery(params)})`);
    return clauses.join(' AND ');
  }

  toComparison(): Comparison {
    // AND doesn't have a single comparison
    return Comparison.EQUALS;
  }

  getColumn(): Column {
    // AND doesn't have a single column
    return new Column('');
  }
}

/**
 * OR filter - combines multiple filters with OR
 */
export class OrFilter implements SearchQuery {
  constructor(private readonly filters: SearchQuery[]) {}

  toQuery(params: any[]): string {
    if (this.filters.length === 0) {
      return 'FALSE';
    }

    if (this.filters.length === 1) {
      return this.filters[0].toQuery(params);
    }

    const clauses = this.filters.map(f => `(${f.toQuery(params)})`);
    return clauses.join(' OR ');
  }

  toComparison(): Comparison {
    return Comparison.EQUALS;
  }

  getColumn(): Column {
    return new Column('');
  }
}

/**
 * NOT filter - negates a filter
 */
export class NotFilter implements SearchQuery {
  constructor(private readonly filter: SearchQuery) {}

  toQuery(params: any[]): string {
    return `NOT (${this.filter.toQuery(params)})`;
  }

  toComparison(): Comparison {
    return Comparison.NOT_EQUALS;
  }

  getColumn(): Column {
    return this.filter.getColumn();
  }
}

/**
 * Helper functions to create filters
 */
export const filter = {
  text: (column: Column, value: string, comparison: Comparison = Comparison.EQUALS) =>
    new TextFilter(column, value, comparison),
  
  textEquals: (column: Column, value: string) =>
    new TextFilter(column, value, Comparison.EQUALS),
  
  textStartsWith: (column: Column, value: string) =>
    new TextFilter(column, value, Comparison.STARTS_WITH),
  
  textEndsWith: (column: Column, value: string) =>
    new TextFilter(column, value, Comparison.ENDS_WITH),
  
  textContains: (column: Column, value: string) =>
    new TextFilter(column, value, Comparison.CONTAINS),
  
  textLike: (column: Column, value: string) =>
    new TextFilter(column, value, Comparison.LIKE),
  
  textILike: (column: Column, value: string) =>
    new TextFilter(column, value, Comparison.ILIKE),
  
  number: (column: Column, value: number, comparison: Comparison = Comparison.EQUALS) =>
    new NumberFilter(column, value, comparison),
  
  numberEquals: (column: Column, value: number) =>
    new NumberFilter(column, value, Comparison.EQUALS),
  
  numberGreater: (column: Column, value: number) =>
    new NumberFilter(column, value, Comparison.GREATER),
  
  numberGreaterOrEqual: (column: Column, value: number) =>
    new NumberFilter(column, value, Comparison.GREATER_OR_EQUAL),
  
  numberLess: (column: Column, value: number) =>
    new NumberFilter(column, value, Comparison.LESS),
  
  numberLessOrEqual: (column: Column, value: number) =>
    new NumberFilter(column, value, Comparison.LESS_OR_EQUAL),
  
  boolean: (column: Column, value: boolean) =>
    new BooleanFilter(column, value),
  
  date: (column: Column, value: Date, comparison: Comparison = Comparison.EQUALS) =>
    new DateFilter(column, value, comparison),
  
  dateBefore: (column: Column, value: Date) =>
    new DateFilter(column, value, Comparison.LESS),
  
  dateAfter: (column: Column, value: Date) =>
    new DateFilter(column, value, Comparison.GREATER),
  
  dateBetween: (column: Column, start: Date, end: Date) =>
    new DateRangeFilter(column, start, end),
  
  in: (column: Column, values: any[]) =>
    new ListFilter(column, values),
  
  notIn: (column: Column, values: any[]) =>
    new NotListFilter(column, values),
  
  isNull: (column: Column) =>
    new IsNullFilter(column),
  
  isNotNull: (column: Column) =>
    new IsNotNullFilter(column),
  
  and: (...filters: SearchQuery[]) =>
    new AndFilter(filters),
  
  or: (...filters: SearchQuery[]) =>
    new OrFilter(filters),
  
  not: (filter: SearchQuery) =>
    new NotFilter(filter),
};
