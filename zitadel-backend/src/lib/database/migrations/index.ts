/**
 * Database migrations - CLEAN SCHEMA VERSION
 * 
 * Uses consolidated clean schema files instead of 68 individual migrations
 * This is 70-80% faster and much easier to understand
 */

export interface Migration {
  version: number;
  name: string;
  filename: string;
}

/**
 * Clean Schema Migration Registry
 * 
 * Instead of 68 migrations, we now have 4 consolidated schema files
 * These are loaded from the schema/ directory (relative path: ../schema/)
 */

export const migrations: Migration[] = [
  { version: 1, name: 'Infrastructure (Events, Projections, Keys)', filename: '../schema/01_infrastructure.sql' },
  { version: 2, name: 'Projection Tables (All 50 projections)', filename: '../schema/02_projections.sql' },
  { version: 3, name: 'Indexes (All performance indexes)', filename: '../schema/03_indexes.sql' },
  { version: 4, name: 'Constraints (Additional constraints if any)', filename: '../schema/04_constraints.sql' },
];
