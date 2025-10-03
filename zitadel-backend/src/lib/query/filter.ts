/**
 * Filter builder for constructing complex query filters
 */

import {
  FilterCondition,
  FilterGroup,
  FilterOperator,
  LogicalOperator,
  FilterError,
} from './types';

/**
 * Filter builder class for fluent query construction
 */
export class FilterBuilder {
  private conditions: (FilterCondition | FilterGroup)[] = [];
  private currentOperator: LogicalOperator = LogicalOperator.AND;

  /**
   * Add an equals condition
   */
  equals(field: string, value: any): this {
    return this.addCondition(field, FilterOperator.EQUALS, value);
  }

  /**
   * Add a not equals condition
   */
  notEquals(field: string, value: any): this {
    return this.addCondition(field, FilterOperator.NOT_EQUALS, value);
  }

  /**
   * Add a greater than condition
   */
  greaterThan(field: string, value: any): this {
    return this.addCondition(field, FilterOperator.GREATER_THAN, value);
  }

  /**
   * Add a greater than or equal condition
   */
  greaterThanOrEqual(field: string, value: any): this {
    return this.addCondition(field, FilterOperator.GREATER_THAN_OR_EQUAL, value);
  }

  /**
   * Add a less than condition
   */
  lessThan(field: string, value: any): this {
    return this.addCondition(field, FilterOperator.LESS_THAN, value);
  }

  /**
   * Add a less than or equal condition
   */
  lessThanOrEqual(field: string, value: any): this {
    return this.addCondition(field, FilterOperator.LESS_THAN_OR_EQUAL, value);
  }

  /**
   * Add an IN condition
   */
  in(field: string, values: any[]): this {
    if (!Array.isArray(values)) {
      throw new FilterError('IN operator requires an array of values', field);
    }
    return this.addCondition(field, FilterOperator.IN, values);
  }

  /**
   * Add a NOT IN condition
   */
  notIn(field: string, values: any[]): this {
    if (!Array.isArray(values)) {
      throw new FilterError('NOT IN operator requires an array of values', field);
    }
    return this.addCondition(field, FilterOperator.NOT_IN, values);
  }

  /**
   * Add a LIKE condition (SQL pattern matching)
   */
  like(field: string, pattern: string): this {
    return this.addCondition(field, FilterOperator.LIKE, pattern);
  }

  /**
   * Add a NOT LIKE condition
   */
  notLike(field: string, pattern: string): this {
    return this.addCondition(field, FilterOperator.NOT_LIKE, pattern);
  }

  /**
   * Add a contains condition
   */
  contains(field: string, value: string): this {
    return this.addCondition(field, FilterOperator.CONTAINS, value);
  }

  /**
   * Add a starts with condition
   */
  startsWith(field: string, value: string): this {
    return this.addCondition(field, FilterOperator.STARTS_WITH, value);
  }

  /**
   * Add an ends with condition
   */
  endsWith(field: string, value: string): this {
    return this.addCondition(field, FilterOperator.ENDS_WITH, value);
  }

  /**
   * Add an IS NULL condition
   */
  isNull(field: string): this {
    return this.addCondition(field, FilterOperator.IS_NULL);
  }

  /**
   * Add an IS NOT NULL condition
   */
  isNotNull(field: string): this {
    return this.addCondition(field, FilterOperator.IS_NOT_NULL);
  }

  /**
   * Start an AND group
   */
  and(): this {
    this.currentOperator = LogicalOperator.AND;
    return this;
  }

  /**
   * Start an OR group
   */
  or(): this {
    this.currentOperator = LogicalOperator.OR;
    return this;
  }

  /**
   * Add a nested filter group
   */
  group(builder: (fb: FilterBuilder) => void): this {
    const nestedBuilder = new FilterBuilder();
    builder(nestedBuilder);
    const group = nestedBuilder.build();
    
    if (group) {
      this.conditions.push(group);
    }
    
    return this;
  }

  /**
   * Add a custom condition
   */
  where(field: string, operator: FilterOperator, value?: any): this {
    return this.addCondition(field, operator, value);
  }

  /**
   * Build the filter group
   */
  build(): FilterGroup | null {
    if (this.conditions.length === 0) {
      return null;
    }

    if (this.conditions.length === 1 && !this.isFilterGroup(this.conditions[0])) {
      // Single condition, wrap in a group
      return {
        operator: LogicalOperator.AND,
        conditions: this.conditions,
      };
    }

    return {
      operator: this.currentOperator,
      conditions: this.conditions,
    };
  }

  /**
   * Build and return array of conditions (for simple queries)
   */
  buildArray(): FilterCondition[] {
    return this.conditions.filter(c => !this.isFilterGroup(c)) as FilterCondition[];
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.conditions = [];
    this.currentOperator = LogicalOperator.AND;
    return this;
  }

  /**
   * Add a condition to the builder
   */
  private addCondition(field: string, operator: FilterOperator, value?: any): this {
    this.conditions.push({
      field,
      operator,
      value,
    });
    return this;
  }

  /**
   * Check if a condition is a filter group
   */
  private isFilterGroup(condition: FilterCondition | FilterGroup): condition is FilterGroup {
    return 'operator' in condition && 'conditions' in condition;
  }
}

/**
 * Helper function to create a filter builder
 */
export function filter(): FilterBuilder {
  return new FilterBuilder();
}

/**
 * Convert filter to SQL WHERE clause
 */
export function filterToSQL(
  filters: FilterGroup | FilterCondition[],
  paramOffset = 1
): { sql: string; params: any[] } {
  const params: any[] = [];
  let paramIndex = paramOffset;

  function buildCondition(condition: FilterCondition): string {
    const field = condition.field;
    
    switch (condition.operator) {
      case FilterOperator.EQUALS:
        params.push(condition.value);
        return `${field} = $${paramIndex++}`;
      
      case FilterOperator.NOT_EQUALS:
        params.push(condition.value);
        return `${field} != $${paramIndex++}`;
      
      case FilterOperator.GREATER_THAN:
        params.push(condition.value);
        return `${field} > $${paramIndex++}`;
      
      case FilterOperator.GREATER_THAN_OR_EQUAL:
        params.push(condition.value);
        return `${field} >= $${paramIndex++}`;
      
      case FilterOperator.LESS_THAN:
        params.push(condition.value);
        return `${field} < $${paramIndex++}`;
      
      case FilterOperator.LESS_THAN_OR_EQUAL:
        params.push(condition.value);
        return `${field} <= $${paramIndex++}`;
      
      case FilterOperator.IN:
        params.push(condition.value);
        return `${field} = ANY($${paramIndex++})`;
      
      case FilterOperator.NOT_IN:
        params.push(condition.value);
        return `${field} != ALL($${paramIndex++})`;
      
      case FilterOperator.LIKE:
        params.push(condition.value);
        return `${field} LIKE $${paramIndex++}`;
      
      case FilterOperator.NOT_LIKE:
        params.push(condition.value);
        return `${field} NOT LIKE $${paramIndex++}`;
      
      case FilterOperator.CONTAINS:
        params.push(`%${condition.value}%`);
        return `${field} LIKE $${paramIndex++}`;
      
      case FilterOperator.STARTS_WITH:
        params.push(`${condition.value}%`);
        return `${field} LIKE $${paramIndex++}`;
      
      case FilterOperator.ENDS_WITH:
        params.push(`%${condition.value}`);
        return `${field} LIKE $${paramIndex++}`;
      
      case FilterOperator.IS_NULL:
        return `${field} IS NULL`;
      
      case FilterOperator.IS_NOT_NULL:
        return `${field} IS NOT NULL`;
      
      default:
        throw new FilterError(`Unknown operator: ${condition.operator}`);
    }
  }

  function buildGroup(group: FilterGroup): string {
    const parts = group.conditions.map(condition => {
      if ('operator' in condition && 'conditions' in condition) {
        return `(${buildGroup(condition as FilterGroup)})`;
      }
      return buildCondition(condition as FilterCondition);
    });

    const operator = group.operator === LogicalOperator.OR ? ' OR ' : ' AND ';
    return parts.join(operator);
  }

  if (Array.isArray(filters)) {
    // Simple array of conditions
    const parts = filters.map(buildCondition);
    return {
      sql: parts.length > 0 ? parts.join(' AND ') : '1=1',
      params,
    };
  }

  // Complex filter group
  return {
    sql: buildGroup(filters),
    params,
  };
}
