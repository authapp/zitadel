/**
 * Organization Domain Policy Write Model
 * 
 * Tracks domain policy state for username requirements
 * Based on Go: internal/command/org_policy_domain_model.go
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';

/**
 * Policy State enumeration
 */
export enum PolicyState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REMOVED = 2,
}

/**
 * Organization Domain Policy Write Model
 */
export class OrgDomainPolicyWriteModel extends WriteModel {
  userLoginMustBeDomain: boolean = false;
  validateOrgDomains: boolean = false;
  smtpSenderAddressMatchesInstanceDomain: boolean = false;
  state: PolicyState = PolicyState.UNSPECIFIED;

  constructor(orgID: string) {
    super('org');
    this.aggregateID = orgID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'org.domain.policy.added':
        this.userLoginMustBeDomain = event.payload?.userLoginMustBeDomain ?? false;
        this.validateOrgDomains = event.payload?.validateOrgDomains ?? false;
        this.smtpSenderAddressMatchesInstanceDomain = event.payload?.smtpSenderAddressMatchesInstanceDomain ?? false;
        this.state = PolicyState.ACTIVE;
        break;

      case 'org.domain.policy.changed':
        if (event.payload?.userLoginMustBeDomain !== undefined) {
          this.userLoginMustBeDomain = event.payload.userLoginMustBeDomain;
        }
        if (event.payload?.validateOrgDomains !== undefined) {
          this.validateOrgDomains = event.payload.validateOrgDomains;
        }
        if (event.payload?.smtpSenderAddressMatchesInstanceDomain !== undefined) {
          this.smtpSenderAddressMatchesInstanceDomain = event.payload.smtpSenderAddressMatchesInstanceDomain;
        }
        break;

      case 'org.domain.policy.removed':
        this.state = PolicyState.REMOVED;
        break;

      case 'org.removed':
        this.state = PolicyState.REMOVED;
        break;
    }
  }

  /**
   * Check if state exists (active)
   */
  exists(): boolean {
    return this.state === PolicyState.ACTIVE;
  }

  /**
   * Check if any values changed
   */
  hasChanged(
    userLoginMustBeDomain: boolean,
    validateOrgDomains: boolean,
    smtpSenderAddressMatchesInstanceDomain: boolean
  ): boolean {
    return (
      this.userLoginMustBeDomain !== userLoginMustBeDomain ||
      this.validateOrgDomains !== validateOrgDomains ||
      this.smtpSenderAddressMatchesInstanceDomain !== smtpSenderAddressMatchesInstanceDomain
    );
  }
}
