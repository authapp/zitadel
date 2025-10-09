/**
 * User Aggregate Helpers
 * 
 * Matches Go's internal/repository/user/aggregate.go
 */

import { USER_AGGREGATE_TYPE } from './events';

/**
 * Aggregate helper interface
 */
export interface UserAggregate {
  id: string;
  type: string;
  owner: string;
  instanceID: string;
}

/**
 * Create user aggregate descriptor
 */
export function newUserAggregate(
  id: string,
  owner: string,
  instanceID: string = 'default'
): UserAggregate {
  return {
    id,
    type: USER_AGGREGATE_TYPE,
    owner,
    instanceID,
  };
}
