/**
 * Organization Aggregate Helpers
 * 
 * Matches Go's internal/repository/org/aggregate.go
 */

import { ORG_AGGREGATE_TYPE } from './events';

/**
 * Aggregate helper interface
 */
export interface OrgAggregate {
  id: string;
  type: string;
  owner: string;
  instanceID: string;
}

/**
 * Create org aggregate descriptor
 */
export function newOrgAggregate(
  id: string,
  owner: string,
  instanceID: string = 'default'
): OrgAggregate {
  return {
    id,
    type: ORG_AGGREGATE_TYPE,
    owner,
    instanceID,
  };
}
