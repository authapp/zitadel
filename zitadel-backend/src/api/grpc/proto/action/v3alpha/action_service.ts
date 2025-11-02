/**
 * Action Service Proto Definitions
 * Zitadel v3alpha Action API
 */

// ============================================================================
// Request/Response Types
// ============================================================================

export interface ListActionsRequest {
  query?: ActionQuery;
  sortingColumn?: ActionFieldName;
  queries?: ActionQuery[];
}

export interface ActionQuery {
  nameQuery?: string;
  stateQuery?: ActionStateQuery;
}

export interface ActionStateQuery {
  state: ActionState;
}

export enum ActionState {
  ACTION_STATE_UNSPECIFIED = 0,
  ACTION_STATE_INACTIVE = 1,
  ACTION_STATE_ACTIVE = 2,
}

export enum ActionFieldName {
  ACTION_FIELD_NAME_UNSPECIFIED = 0,
  ACTION_FIELD_NAME_NAME = 1,
  ACTION_FIELD_NAME_ID = 2,
  ACTION_FIELD_NAME_STATE = 3,
}

export interface ListActionsResponse {
  details?: ListDetails;
  sortingColumn?: ActionFieldName;
  result: Action[];
}

export interface ListDetails {
  totalResult: number;
  processedSequence: number;
  viewTimestamp: string;
}

export interface Action {
  id: string;
  details?: ObjectDetails;
  state: ActionState;
  name: string;
  script: string;
  timeout: string; // Duration as string (e.g., "10s")
  allowedToFail: boolean;
}

export interface ObjectDetails {
  sequence: number;
  creationDate: string;
  changeDate: string;
  resourceOwner: string;
}

export interface GetActionRequest {
  id: string;
}

export interface GetActionResponse {
  action?: Action;
}

export interface CreateActionRequest {
  name: string;
  script: string;
  timeout?: string;
  allowedToFail?: boolean;
}

export interface CreateActionResponse {
  id: string;
  details?: ObjectDetails;
}

export interface UpdateActionRequest {
  id: string;
  name?: string;
  script?: string;
  timeout?: string;
  allowedToFail?: boolean;
}

export interface UpdateActionResponse {
  details?: ObjectDetails;
}

export interface DeactivateActionRequest {
  id: string;
}

export interface DeactivateActionResponse {
  details?: ObjectDetails;
}

export interface ReactivateActionRequest {
  id: string;
}

export interface ReactivateActionResponse {
  details?: ObjectDetails;
}

export interface DeleteActionRequest {
  id: string;
}

export interface DeleteActionResponse {
  details?: ObjectDetails;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface ListExecutionsRequest {
  query?: ExecutionQuery;
}

export interface ExecutionQuery {
  targetQuery?: ExecutionTargetQuery;
}

export interface ExecutionTargetQuery {
  target: string;
}

export interface ListExecutionsResponse {
  details?: ListDetails;
  result: Execution[];
}

export interface Execution {
  id: string;
  details?: ObjectDetails;
  targets: ExecutionTarget[];
  includes: ExecutionInclude[];
}

export interface ExecutionTarget {
  target: string;
  targetType: ExecutionTargetType;
}

export enum ExecutionTargetType {
  EXECUTION_TARGET_TYPE_UNSPECIFIED = 0,
  EXECUTION_TARGET_TYPE_TARGET = 1,
  EXECUTION_TARGET_TYPE_INCLUDE = 2,
}

export interface ExecutionInclude {
  include: string;
  includeType: ExecutionIncludeType;
}

export enum ExecutionIncludeType {
  EXECUTION_INCLUDE_TYPE_UNSPECIFIED = 0,
  EXECUTION_INCLUDE_TYPE_INCLUDE = 1,
}

export interface GetExecutionRequest {
  id: string;
}

export interface GetExecutionResponse {
  execution?: Execution;
}
