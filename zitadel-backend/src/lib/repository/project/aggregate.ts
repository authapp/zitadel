/**
 * Project Aggregate Helpers
 * 
 * Matches Go's internal/repository/project/aggregate.go
 */

import { PROJECT_AGGREGATE_TYPE } from './events';

/**
 * Aggregate helper interface
 */
export interface ProjectAggregate {
  id: string;
  type: string;
  owner: string;
  instanceID: string;
}

/**
 * Create project aggregate descriptor
 */
export function newProjectAggregate(
  id: string,
  owner: string,
  instanceID: string = 'default'
): ProjectAggregate {
  return {
    id,
    type: PROJECT_AGGREGATE_TYPE,
    owner,
    instanceID,
  };
}
