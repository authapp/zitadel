/**
 * Factory functions for creating query components
 */

import { ProjectionRegistry } from './projection/projection-registry';
import { Eventstore } from '../eventstore/types';
import { DatabasePool } from '../database/pool';

/**
 * Create a projection registry (replaces ProjectionManager)
 */
export function createProjectionRegistry(
  eventstore: Eventstore,
  database: DatabasePool
): ProjectionRegistry {
  return new ProjectionRegistry({
    eventstore,
    database,
  });
}
