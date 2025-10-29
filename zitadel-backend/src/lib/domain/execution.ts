/**
 * Execution Domain Model
 * 
 * Executions define WHEN (condition) and WHAT (targets/includes) to execute
 * Based on Zitadel Go: internal/domain/execution.go
 */

/**
 * Execution types determine the trigger context
 */
export enum ExecutionType {
  UNSPECIFIED = 0,
  REQUEST = 1,   // gRPC request interception
  RESPONSE = 2,  // gRPC response interception
  FUNCTION = 3,  // Function invocation
  EVENT = 4,     // Domain event trigger
}

/**
 * Execution state
 */
export enum ExecutionState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REMOVED = 2,
}

/**
 * Target types for execution
 */
export enum ExecutionTargetType {
  UNSPECIFIED = 0,
  TARGET = 1,   // Reference to a Target (webhook/endpoint)
  INCLUDE = 2,  // Reference to another Execution (composition)
}

/**
 * Execution target (what to call)
 */
export interface ExecutionTarget {
  type: ExecutionTargetType;
  target: string; // Target ID or Execution ID
}

/**
 * Execution condition (when to trigger)
 * Exactly one field must be set (mutually exclusive)
 */
export interface ExecutionCondition {
  // For REQUEST/RESPONSE types
  method?: string;   // gRPC method path
  service?: string;  // gRPC service path
  
  // For EVENT type
  event?: string;      // Specific event type
  eventGroup?: string; // Event group pattern
  
  // For FUNCTION type
  function?: string;  // Function name
  
  // For any type
  all?: boolean;      // Match all
}

/**
 * Execution entity
 */
export interface Execution {
  id: string;
  instanceID: string;
  resourceOwner: string;
  executionType: ExecutionType;
  targets: ExecutionTarget[];
  state: ExecutionState;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
}

/**
 * Check if execution state indicates it exists
 */
export function executionStateExists(state: ExecutionState): boolean {
  return state === ExecutionState.ACTIVE;
}

/**
 * Validate execution condition (exactly one field must be set)
 */
export function isConditionValid(condition: ExecutionCondition): boolean {
  const fields = [
    condition.method,
    condition.service,
    condition.event,
    condition.eventGroup,
    condition.function,
    condition.all,
  ];

  const setFields = fields.filter(f => f !== undefined && f !== false);

  // Exactly one field must be set
  return setFields.length === 1;
}

/**
 * Generate execution ID from condition and type
 */
export function generateExecutionID(
  type: ExecutionType,
  condition: ExecutionCondition
): string {
  const typeStr = ExecutionType[type].toLowerCase();

  if (condition.method) {
    return `${typeStr}-method-${condition.method}`;
  }
  if (condition.service) {
    return `${typeStr}-service-${condition.service}`;
  }
  if (condition.event) {
    return `${typeStr}-event-${condition.event}`;
  }
  if (condition.eventGroup) {
    const group = condition.eventGroup.endsWith('.*') 
      ? condition.eventGroup 
      : `${condition.eventGroup}.*`;
    return `${typeStr}-event-${group}`;
  }
  if (condition.function) {
    return `${typeStr}-function-${condition.function}`;
  }
  if (condition.all) {
    return `${typeStr}-all`;
  }

  throw new Error('Invalid condition: no field set');
}

/**
 * Get list of target IDs from execution targets
 */
export function getTargetIDs(targets: ExecutionTarget[]): string[] {
  return targets
    .filter(t => t.type === ExecutionTargetType.TARGET)
    .map(t => t.target);
}

/**
 * Get list of include IDs from execution targets
 */
export function getIncludeIDs(targets: ExecutionTarget[]): string[] {
  return targets
    .filter(t => t.type === ExecutionTargetType.INCLUDE)
    .map(t => t.target);
}

/**
 * Compare two target arrays for equality
 */
export function targetsEqual(
  a: ExecutionTarget[],
  b: ExecutionTarget[]
): boolean {
  if (a.length !== b.length) return false;

  // Sort and compare JSON strings for deep equality
  const sortedA = [...a].sort((x, y) => x.target.localeCompare(y.target));
  const sortedB = [...b].sort((x, y) => x.target.localeCompare(y.target));

  return JSON.stringify(sortedA) === JSON.stringify(sortedB);
}
