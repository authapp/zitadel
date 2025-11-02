/**
 * SCIM Filter Parser
 * RFC 7644 Section 3.4.2.2 - Filtering
 * 
 * Parses SCIM filter expressions and converts to database queries
 */

import { SCIMFilterExpression, SCIMFilterOperator } from '../types';

/**
 * Parse SCIM filter expression
 * Example: userName eq "john@example.com"
 */
export function parseSCIMFilter(filter: string): SCIMFilterExpression | null {
  if (!filter || filter.trim() === '') {
    return null;
  }

  // Simple regex-based parser for basic filters
  // Format: <attribute> <operator> <value>
  const filterRegex = /^(\w+(?:\.\w+)?)\s+(eq|ne|co|sw|ew|gt|ge|lt|le|pr)\s*(?:"([^"]+)"|(\S+))?$/i;
  const match = filter.match(filterRegex);

  if (!match) {
    // Try to handle "pr" (present) operator without value
    const prRegex = /^(\w+(?:\.\w+)?)\s+(pr)$/i;
    const prMatch = filter.match(prRegex);
    
    if (prMatch) {
      return {
        attributePath: prMatch[1].toLowerCase(),
        operator: 'pr' as SCIMFilterOperator,
      };
    }
    
    return null;
  }

  const [, attributePath, operator, quotedValue, unquotedValue] = match;
  const value = quotedValue || unquotedValue;

  return {
    attributePath: attributePath.toLowerCase(),
    operator: operator.toLowerCase() as SCIMFilterOperator,
    compareValue: value,
  };
}

/**
 * Convert SCIM filter to SQL WHERE clause
 */
export function scimFilterToSQL(filter: SCIMFilterExpression, tableAlias: string = 'u'): string {
  const column = mapSCIMAttributeToColumn(filter.attributePath, tableAlias);
  const value = filter.compareValue;

  switch (filter.operator) {
    case 'eq':
      return `${column} = '${escapeSQLString(value)}'`;
    
    case 'ne':
      return `${column} != '${escapeSQLString(value)}'`;
    
    case 'co':
      return `${column} LIKE '%${escapeSQLString(value)}%'`;
    
    case 'sw':
      return `${column} LIKE '${escapeSQLString(value)}%'`;
    
    case 'ew':
      return `${column} LIKE '%${escapeSQLString(value)}'`;
    
    case 'gt':
      return `${column} > '${escapeSQLString(value)}'`;
    
    case 'ge':
      return `${column} >= '${escapeSQLString(value)}'`;
    
    case 'lt':
      return `${column} < '${escapeSQLString(value)}'`;
    
    case 'le':
      return `${column} <= '${escapeSQLString(value)}'`;
    
    case 'pr':
      return `${column} IS NOT NULL AND ${column} != ''`;
    
    default:
      return '1=1'; // Always true for unknown operators
  }
}

/**
 * Map SCIM attribute path to database column
 */
function mapSCIMAttributeToColumn(attributePath: string, tableAlias: string): string {
  const lowerPath = attributePath.toLowerCase();

  // Map SCIM attributes to Zitadel database columns
  const mapping: Record<string, string> = {
    'username': `${tableAlias}.username`,
    'displayname': `${tableAlias}.display_name`,
    'name.givenname': `${tableAlias}.first_name`,
    'name.familyname': `${tableAlias}.last_name`,
    'emails.value': `${tableAlias}.email`,
    'emails': `${tableAlias}.email`,
    'phonenumbers.value': `${tableAlias}.phone`,
    'phonenumbers': `${tableAlias}.phone`,
    'active': `${tableAlias}.state`,
    'externalid': `${tableAlias}.external_id`,
    'id': `${tableAlias}.id`,
  };

  return mapping[lowerPath] || `${tableAlias}.${lowerPath}`;
}

/**
 * Escape SQL string to prevent injection
 */
function escapeSQLString(value: string): string {
  if (!value) return '';
  return value.replace(/'/g, "''");
}

/**
 * Parse SCIM sortBy parameter
 */
export function parseSCIMSort(sortBy?: string, sortOrder?: string): { column: string; order: 'ASC' | 'DESC' } | null {
  if (!sortBy) {
    return null;
  }

  const column = mapSCIMAttributeToColumn(sortBy.toLowerCase(), 'u');
  const order = sortOrder?.toLowerCase() === 'descending' ? 'DESC' : 'ASC';

  return { column, order };
}

/**
 * Validate SCIM filter expression
 */
export function validateSCIMFilter(filter: string): { valid: boolean; error?: string } {
  if (!filter || filter.trim() === '') {
    return { valid: true };
  }

  const parsed = parseSCIMFilter(filter);
  
  if (!parsed) {
    return {
      valid: false,
      error: 'Invalid filter syntax. Expected format: <attribute> <operator> <value>',
    };
  }

  // Validate operator
  const validOperators = ['eq', 'ne', 'co', 'sw', 'ew', 'gt', 'ge', 'lt', 'le', 'pr'];
  if (!validOperators.includes(parsed.operator)) {
    return {
      valid: false,
      error: `Invalid operator: ${parsed.operator}. Supported: ${validOperators.join(', ')}`,
    };
  }

  // Check if value is required for operator
  if (parsed.operator !== 'pr' && !parsed.compareValue) {
    return {
      valid: false,
      error: `Operator ${parsed.operator} requires a value`,
    };
  }

  return { valid: true };
}
