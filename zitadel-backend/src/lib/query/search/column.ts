/**
 * Column Mapping
 * 
 * Represents a database column for queries and sorting.
 * Based on Zitadel Go internal/query/search_query.go (Column struct)
 */

/**
 * Column represents a database column with optional table and alias
 */
export class Column {
  constructor(
    public readonly name: string,
    public readonly table?: string,
    public readonly alias?: string
  ) {}

  /**
   * Get the full column identifier (table.column or column)
   */
  identifier(): string {
    if (this.table) {
      return `${this.table}.${this.name}`;
    }
    return this.name;
  }

  /**
   * Get the column identifier for ORDER BY clause
   */
  orderBy(): string {
    if (this.alias) {
      return this.alias;
    }
    return this.identifier();
  }

  /**
   * Check if column is empty/zero value
   */
  isZero(): boolean {
    return !this.name || this.name.length === 0;
  }

  /**
   * Get column for SELECT clause with optional alias
   */
  select(): string {
    const id = this.identifier();
    if (this.alias && this.alias !== this.name) {
      return `${id} AS "${this.alias}"`;
    }
    return id;
  }

  /**
   * Create a column from a simple string name
   */
  static fromName(name: string): Column {
    return new Column(name);
  }

  /**
   * Create a column with table qualifier
   */
  static fromTable(table: string, name: string, alias?: string): Column {
    return new Column(name, table, alias);
  }

  /**
   * Clone the column with a new alias
   */
  withAlias(alias: string): Column {
    return new Column(this.name, this.table, alias);
  }

  /**
   * Clone the column with a new table
   */
  withTable(table: string): Column {
    return new Column(this.name, table, this.alias);
  }

  /**
   * Convert to string (for debugging)
   */
  toString(): string {
    return this.identifier();
  }
}

/**
 * Helper function to create a column
 */
export function col(name: string, table?: string, alias?: string): Column {
  return new Column(name, table, alias);
}
