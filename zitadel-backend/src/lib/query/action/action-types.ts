/**
 * Action & Flow Types
 * Extensibility system for Zitadel - custom actions, flows, and executions
 * Based on Zitadel Go internal/query/action.go, flow.go, execution.go
 */

/**
 * Action State
 */
export enum ActionState {
  UNSPECIFIED = 0,
  INACTIVE = 1,
  ACTIVE = 2,
}

/**
 * Action
 * Custom code/webhook that can be triggered in flows
 */
export interface Action {
  id: string;
  instanceID: string;
  resourceOwner: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  name: string;
  script: string; // JavaScript code or webhook URL
  timeout: number; // milliseconds
  allowedToFail: boolean;
  state: ActionState;
}

/**
 * Flow Type
 */
export enum FlowType {
  EXTERNAL_AUTHENTICATION = 'EXTERNAL_AUTHENTICATION',
  CUSTOMISE_TOKEN = 'CUSTOMISE_TOKEN',
  INTERNAL_AUTHENTICATION = 'INTERNAL_AUTHENTICATION',
  COMPLEMENT_TOKEN = 'COMPLEMENT_TOKEN',
}

/**
 * Trigger Type
 */
export enum TriggerType {
  POST_AUTHENTICATION = 'POST_AUTHENTICATION',
  PRE_CREATION = 'PRE_CREATION',
  POST_CREATION = 'POST_CREATION',
  PRE_USERINFO_CREATION = 'PRE_USERINFO_CREATION',
  PRE_ACCESS_TOKEN_CREATION = 'PRE_ACCESS_TOKEN_CREATION',
}

/**
 * Flow
 * Sequence of actions triggered at specific points
 */
export interface Flow {
  flowType: FlowType;
  triggerType: TriggerType;
  actionIDs: string[];
}

/**
 * Execution
 * Association between targets and conditions for action execution
 */
export interface Execution {
  id: string;
  instanceID: string;
  resourceOwner: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  executionType: number;
  targets: any[]; // ExecutionTarget[]
  state: number;
}

/**
 * Target
 * Endpoint or configuration for action execution
 */
export interface Target {
  id: string;
  instanceID: string;
  resourceOwner: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  name: string;
  targetType: number;
  endpoint: string;
  timeout: number;
  interruptOnError: boolean;
  state: number;
}

/**
 * User Metadata
 */
export interface UserMetadata {
  userID: string;
  key: string;
  value: any; // JSON value
  creationDate: Date;
  changeDate: Date;
}

/**
 * User Schema
 */
export interface UserSchema {
  id: string;
  instanceID: string;
  creationDate: Date;
  changeDate: Date;
  type: string;
  schema: any; // JSON schema
  possibleAuthenticators: string[];
}
