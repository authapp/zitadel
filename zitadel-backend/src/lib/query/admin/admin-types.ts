/**
 * Admin & Debug Types
 * Administrative and debugging functionality
 * Based on Zitadel Go internal/query (various admin modules)
 */

/**
 * Personal Access Token
 */
export interface PersonalAccessToken {
  id: string;
  userID: string;
  instanceID: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  scopes: string[];
  expirationDate: Date;
}

/**
 * Quota
 */
export interface Quota {
  instanceID: string;
  unit: string; // e.g., "requests", "actions.all.runs"
  from: Date;
  interval: number; // duration in seconds
  limit: boolean;
  amount: number;
  usage: number;
  notifications: QuotaNotification[];
}

/**
 * Quota Notification
 */
export interface QuotaNotification {
  percent: number;
  repeat: boolean;
  callURL: string;
  nextDueTime: Date | null;
}

/**
 * Quota Period
 */
export interface QuotaPeriod {
  unit: string;
  periodStart: Date;
  usage: number;
}

/**
 * Restrictions
 */
export interface Restrictions {
  disallowPublicOrgRegistration: boolean;
  allowedLanguages: string[];
}

/**
 * Milestone
 */
export interface Milestone {
  type: MilestoneType;
  instanceID: string;
  reached: boolean;
  pushedDate: Date | null;
  reachedDate: Date | null;
}

/**
 * Milestone Type
 */
export enum MilestoneType {
  INSTANCE_CREATED = 'InstanceCreated',
  AUTHENTICATION_SUCCEEDED_ON_INSTANCE = 'AuthenticationSucceededOnInstance',
  PROJECT_CREATED = 'ProjectCreated',
  APPLICATION_CREATED = 'ApplicationCreated',
  AUTHENTICATION_SUCCEEDED_ON_APPLICATION = 'AuthenticationSucceededOnApplication',
  INSTANCE_DELETED = 'InstanceDeleted',
}

/**
 * Web Key
 */
export interface WebKey {
  id: string;
  instanceID: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  state: WebKeyState;
  config: WebKeyConfig;
}

/**
 * Web Key State
 */
export enum WebKeyState {
  UNSPECIFIED = 0,
  INITIAL = 1,
  ACTIVE = 2,
  INACTIVE = 3,
  REMOVED = 4,
}

/**
 * Web Key Config
 */
export interface WebKeyConfig {
  use: string; // 'sig' or 'enc'
  algorithm: string;
  publicKey: string;
}

/**
 * Failed Event
 */
export interface FailedEvent {
  projectID: string;
  eventType: string;
  aggregateType: string;
  aggregateID: string;
  failureCount: number;
  error: string;
  lastFailed: Date;
}
