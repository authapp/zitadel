/**
 * Target Domain Model
 * 
 * Targets represent external endpoints (webhooks, functions, services)
 * that can be invoked by executions when certain conditions are met.
 * 
 * Based on Zitadel Go: internal/domain/target.go
 */

/**
 * Target types for different invocation patterns
 */
export enum TargetType {
  UNSPECIFIED = 0,
  WEBHOOK = 1,          // HTTP webhook
  REQUEST_RESPONSE = 2, // Synchronous request/response
  ASYNC = 3,            // Asynchronous invocation
}

/**
 * Target state
 */
export enum TargetState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  REMOVED = 3,
}

/**
 * Target entity
 */
export interface Target {
  id: string;
  instanceID: string;
  resourceOwner: string;
  name: string;
  targetType: TargetType;
  endpoint: string;
  timeout: number; // milliseconds
  interruptOnError: boolean;
  state: TargetState;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
}

/**
 * Check if target state indicates it exists
 */
export function targetStateExists(state: TargetState): boolean {
  return state !== TargetState.UNSPECIFIED && 
         state !== TargetState.REMOVED;
}

/**
 * Validate target configuration
 */
export function isTargetValid(target: {
  name: string;
  endpoint: string;
  timeout: number;
}): boolean {
  // Name must not be empty
  if (!target.name || target.name.trim() === '') {
    return false;
  }

  // Timeout must be positive
  if (target.timeout <= 0) {
    return false;
  }

  // Endpoint must be a valid URL
  if (!target.endpoint || target.endpoint.trim() === '') {
    return false;
  }

  try {
    new URL(target.endpoint);
  } catch {
    return false;
  }

  return true;
}

/**
 * Validate timeout value
 */
export function isTimeoutValid(timeout: number): boolean {
  return timeout > 0 && timeout <= 300000; // Max 5 minutes
}
