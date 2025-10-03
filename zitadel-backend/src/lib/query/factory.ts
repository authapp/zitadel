/**
 * Factory functions for creating query components
 */

import { Pool } from 'pg';
import { Query, ProjectionManager } from './types';
import { PostgresQuery } from './postgres/query';
import { PostgresProjectionManager } from './postgres/projection-manager';
import { Eventstore } from '../eventstore/types';

/**
 * Create a query instance
 */
export function createQuery(pool: Pool): Query {
  return new PostgresQuery(pool);
}

/**
 * Create a projection manager
 */
export function createProjectionManager(pool: Pool, eventStore: Eventstore): ProjectionManager {
  return new PostgresProjectionManager(pool, eventStore);
}

/**
 * Create query components from existing database pool
 */
export function createQueryComponents(pool: Pool, eventStore: Eventstore): {
  query: Query;
  projectionManager: ProjectionManager;
} {
  return {
    query: createQuery(pool),
    projectionManager: createProjectionManager(pool, eventStore),
  };
}
