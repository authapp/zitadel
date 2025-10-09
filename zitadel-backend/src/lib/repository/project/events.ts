/**
 * Project Event Definitions
 * 
 * Matches Go's internal/repository/project/
 */

import { Command } from '../../eventstore/types';

/**
 * Aggregate type constant
 */
export const PROJECT_AGGREGATE_TYPE = 'project';

/**
 * Event type constants (matches Go)
 */
export const ProjectEventTypes = {
  // Project lifecycle
  ADDED: 'project.added',
  CHANGED: 'project.changed',
  DEACTIVATED: 'project.deactivated',
  REACTIVATED: 'project.reactivated',
  REMOVED: 'project.removed',
  
  // Role events
  ROLE_ADDED: 'project.role.added',
  ROLE_CHANGED: 'project.role.changed',
  ROLE_REMOVED: 'project.role.removed',
  
  // Application events
  APPLICATION_ADDED: 'project.application.added',
  APPLICATION_CHANGED: 'project.application.changed',
  APPLICATION_DEACTIVATED: 'project.application.deactivated',
  APPLICATION_REACTIVATED: 'project.application.reactivated',
  APPLICATION_REMOVED: 'project.application.removed',
  
  // OIDC Application
  OIDC_APPLICATION_ADDED: 'application.oidc.added',
  OIDC_APPLICATION_CHANGED: 'application.oidc.changed',
  
  // API Application
  API_APPLICATION_ADDED: 'application.api.added',
  API_APPLICATION_CHANGED: 'application.api.changed',
} as const;

export type ProjectEventType = typeof ProjectEventTypes[keyof typeof ProjectEventTypes];

/**
 * Event Payload Interfaces
 */

export interface ProjectAddedPayload {
  name: string;
  projectRoleAssertion?: boolean;
  projectRoleCheck?: boolean;
  hasProjectCheck?: boolean;
  privateLabelingSetting?: number;
}

export interface ProjectChangedPayload {
  name?: string;
  projectRoleAssertion?: boolean;
  projectRoleCheck?: boolean;
  hasProjectCheck?: boolean;
  privateLabelingSetting?: number;
}

export interface ProjectRoleAddedPayload {
  key: string;
  displayName: string;
  group?: string;
}

export interface ProjectRoleChangedPayload {
  key: string;
  displayName?: string;
  group?: string;
}

export interface OIDCApplicationAddedPayload {
  name: string;
  redirectURIs: string[];
  responseTypes: string[];
  grantTypes: string[];
  oidcAppType: number;
  authMethodType: number;
  postLogoutRedirectURIs?: string[];
  devMode?: boolean;
  accessTokenType?: number;
  accessTokenRoleAssertion?: boolean;
  idTokenRoleAssertion?: boolean;
  idTokenUserinfoAssertion?: boolean;
  clockSkew?: number;
  additionalOrigins?: string[];
}

export interface OIDCApplicationChangedPayload {
  appID: string;
  name?: string;
  redirectURIs?: string[];
  responseTypes?: string[];
  grantTypes?: string[];
  authMethodType?: number;
  postLogoutRedirectURIs?: string[];
  devMode?: boolean;
  accessTokenType?: number;
  accessTokenRoleAssertion?: boolean;
  idTokenRoleAssertion?: boolean;
  idTokenUserinfoAssertion?: boolean;
  clockSkew?: number;
  additionalOrigins?: string[];
}

export interface APIApplicationAddedPayload {
  name: string;
  authMethodType: number;
}

/**
 * Event Factory Functions
 */

export function newProjectAddedEvent(
  aggregateID: string,
  owner: string,
  payload: ProjectAddedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: ProjectEventTypes.ADDED,
    aggregateType: PROJECT_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newProjectChangedEvent(
  aggregateID: string,
  owner: string,
  payload: ProjectChangedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: ProjectEventTypes.CHANGED,
    aggregateType: PROJECT_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newProjectDeactivatedEvent(
  aggregateID: string,
  owner: string,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: ProjectEventTypes.DEACTIVATED,
    aggregateType: PROJECT_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload: {},
  };
}

export function newProjectReactivatedEvent(
  aggregateID: string,
  owner: string,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: ProjectEventTypes.REACTIVATED,
    aggregateType: PROJECT_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload: {},
  };
}

export function newProjectRoleAddedEvent(
  aggregateID: string,
  owner: string,
  payload: ProjectRoleAddedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: ProjectEventTypes.ROLE_ADDED,
    aggregateType: PROJECT_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newOIDCApplicationAddedEvent(
  aggregateID: string,
  owner: string,
  payload: OIDCApplicationAddedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: ProjectEventTypes.OIDC_APPLICATION_ADDED,
    aggregateType: PROJECT_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newOIDCApplicationChangedEvent(
  aggregateID: string,
  owner: string,
  payload: OIDCApplicationChangedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: ProjectEventTypes.OIDC_APPLICATION_CHANGED,
    aggregateType: PROJECT_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newAPIApplicationAddedEvent(
  aggregateID: string,
  owner: string,
  payload: APIApplicationAddedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: ProjectEventTypes.API_APPLICATION_ADDED,
    aggregateType: PROJECT_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}
