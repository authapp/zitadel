/**
 * Organization Event Definitions
 * 
 * Matches Go's internal/repository/org/
 */

import { Command } from '../../eventstore/types';

/**
 * Aggregate type constant
 */
export const ORG_AGGREGATE_TYPE = 'org';

/**
 * Event type constants (matches Go)
 */
export const OrgEventTypes = {
  // Org lifecycle
  ADDED: 'org.added',
  CHANGED: 'org.changed',
  DEACTIVATED: 'org.deactivated',
  REACTIVATED: 'org.reactivated',
  REMOVED: 'org.removed',
  
  // Domain events
  DOMAIN_ADDED: 'org.domain.added',
  DOMAIN_VERIFIED: 'org.domain.verified',
  DOMAIN_PRIMARY_SET: 'org.domain.primary.set',
  DOMAIN_REMOVED: 'org.domain.removed',
  
  // Member events
  MEMBER_ADDED: 'org.member.added',
  MEMBER_CHANGED: 'org.member.changed',
  MEMBER_REMOVED: 'org.member.removed',
} as const;

export type OrgEventType = typeof OrgEventTypes[keyof typeof OrgEventTypes];

/**
 * Event Payload Interfaces
 */

export interface OrgAddedPayload {
  name: string;
}

export interface OrgChangedPayload {
  name?: string;
}

export interface DomainAddedPayload {
  domain: string;
}

export interface DomainVerifiedPayload {
  domain: string;
}

export interface DomainPrimarySetPayload {
  domain: string;
}

export interface DomainRemovedPayload {
  domain: string;
}

export interface MemberAddedPayload {
  userID: string;
  roles: string[];
}

export interface MemberChangedPayload {
  userID: string;
  roles: string[];
}

export interface MemberRemovedPayload {
  userID: string;
}

/**
 * Event Factory Functions
 */

export function newOrgAddedEvent(
  aggregateID: string,
  owner: string,
  payload: OrgAddedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: OrgEventTypes.ADDED,
    aggregateType: ORG_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newOrgChangedEvent(
  aggregateID: string,
  owner: string,
  payload: OrgChangedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: OrgEventTypes.CHANGED,
    aggregateType: ORG_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newOrgDeactivatedEvent(
  aggregateID: string,
  owner: string,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: OrgEventTypes.DEACTIVATED,
    aggregateType: ORG_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload: {},
  };
}

export function newOrgReactivatedEvent(
  aggregateID: string,
  owner: string,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: OrgEventTypes.REACTIVATED,
    aggregateType: ORG_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload: {},
  };
}

export function newDomainAddedEvent(
  aggregateID: string,
  owner: string,
  payload: DomainAddedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: OrgEventTypes.DOMAIN_ADDED,
    aggregateType: ORG_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newDomainVerifiedEvent(
  aggregateID: string,
  owner: string,
  payload: DomainVerifiedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: OrgEventTypes.DOMAIN_VERIFIED,
    aggregateType: ORG_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newDomainPrimarySetEvent(
  aggregateID: string,
  owner: string,
  payload: DomainPrimarySetPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: OrgEventTypes.DOMAIN_PRIMARY_SET,
    aggregateType: ORG_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newMemberAddedEvent(
  aggregateID: string,
  owner: string,
  payload: MemberAddedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: OrgEventTypes.MEMBER_ADDED,
    aggregateType: ORG_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}
