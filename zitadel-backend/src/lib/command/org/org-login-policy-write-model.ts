/**
 * Organization Login Policy Write Model
 * 
 * Tracks login policy state for an organization
 * Based on Go: internal/command/org_policy_login_model.go
 */

import { WriteModel } from '../write-model';
import { Event } from '../../eventstore/types';

export enum LoginPolicyState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REMOVED = 2,
}

export class OrgLoginPolicyWriteModel extends WriteModel {
  state: LoginPolicyState = LoginPolicyState.UNSPECIFIED;
  
  // Login policy fields
  allowUsernamePassword: boolean = true;
  allowRegister: boolean = true;
  allowExternalIDP: boolean = true;
  forceMFA: boolean = false;
  forceMFALocalOnly: boolean = false;
  hidePasswordReset: boolean = false;
  ignoreUnknownUsernames: boolean = false;
  allowDomainDiscovery: boolean = true;
  disableLoginWithEmail: boolean = false;
  disableLoginWithPhone: boolean = false;
  defaultRedirectURI: string = '';
  passwordCheckLifetime: number = 0; // in seconds
  externalLoginCheckLifetime: number = 0; // in seconds
  mfaInitSkipLifetime: number = 0; // in seconds
  secondFactorCheckLifetime: number = 0; // in seconds
  multiFactorCheckLifetime: number = 0; // in seconds
  
  // Factors
  secondFactors: Set<number> = new Set();
  multiFactors: Set<number> = new Set();

  constructor(public readonly orgID: string) {
    super('org');
    this.aggregateID = orgID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'org.login.policy.added':
        this.reduceAdded(event);
        break;
      case 'org.login.policy.changed':
        this.reduceChanged(event);
        break;
      case 'org.login.policy.removed':
        this.reduceRemoved(event);
        break;
      case 'org.login.policy.second.factor.added':
        this.reduceSecondFactorAdded(event);
        break;
      case 'org.login.policy.second.factor.removed':
        this.reduceSecondFactorRemoved(event);
        break;
      case 'org.login.policy.multi.factor.added':
        this.reduceMultiFactorAdded(event);
        break;
      case 'org.login.policy.multi.factor.removed':
        this.reduceMultiFactorRemoved(event);
        break;
    }
  }

  private reduceAdded(event: Event): void {
    const payload = event.payload || {};
    this.state = LoginPolicyState.ACTIVE;
    this.allowUsernamePassword = payload.allowUsernamePassword ?? true;
    this.allowRegister = payload.allowRegister ?? true;
    this.allowExternalIDP = payload.allowExternalIDP ?? true;
    this.forceMFA = payload.forceMFA ?? false;
    this.forceMFALocalOnly = payload.forceMFALocalOnly ?? false;
    this.hidePasswordReset = payload.hidePasswordReset ?? false;
    this.ignoreUnknownUsernames = payload.ignoreUnknownUsernames ?? false;
    this.allowDomainDiscovery = payload.allowDomainDiscovery ?? true;
    this.disableLoginWithEmail = payload.disableLoginWithEmail ?? false;
    this.disableLoginWithPhone = payload.disableLoginWithPhone ?? false;
    this.defaultRedirectURI = payload.defaultRedirectURI || '';
    this.passwordCheckLifetime = payload.passwordCheckLifetime || 0;
    this.externalLoginCheckLifetime = payload.externalLoginCheckLifetime || 0;
    this.mfaInitSkipLifetime = payload.mfaInitSkipLifetime || 0;
    this.secondFactorCheckLifetime = payload.secondFactorCheckLifetime || 0;
    this.multiFactorCheckLifetime = payload.multiFactorCheckLifetime || 0;
  }

  private reduceChanged(event: Event): void {
    const payload = event.payload || {};
    if (payload.allowUsernamePassword !== undefined) {
      this.allowUsernamePassword = payload.allowUsernamePassword;
    }
    if (payload.allowRegister !== undefined) {
      this.allowRegister = payload.allowRegister;
    }
    if (payload.allowExternalIDP !== undefined) {
      this.allowExternalIDP = payload.allowExternalIDP;
    }
    if (payload.forceMFA !== undefined) {
      this.forceMFA = payload.forceMFA;
    }
    if (payload.forceMFALocalOnly !== undefined) {
      this.forceMFALocalOnly = payload.forceMFALocalOnly;
    }
    if (payload.hidePasswordReset !== undefined) {
      this.hidePasswordReset = payload.hidePasswordReset;
    }
    if (payload.ignoreUnknownUsernames !== undefined) {
      this.ignoreUnknownUsernames = payload.ignoreUnknownUsernames;
    }
    if (payload.allowDomainDiscovery !== undefined) {
      this.allowDomainDiscovery = payload.allowDomainDiscovery;
    }
    if (payload.disableLoginWithEmail !== undefined) {
      this.disableLoginWithEmail = payload.disableLoginWithEmail;
    }
    if (payload.disableLoginWithPhone !== undefined) {
      this.disableLoginWithPhone = payload.disableLoginWithPhone;
    }
    if (payload.defaultRedirectURI !== undefined) {
      this.defaultRedirectURI = payload.defaultRedirectURI;
    }
    if (payload.passwordCheckLifetime !== undefined) {
      this.passwordCheckLifetime = payload.passwordCheckLifetime;
    }
    if (payload.externalLoginCheckLifetime !== undefined) {
      this.externalLoginCheckLifetime = payload.externalLoginCheckLifetime;
    }
    if (payload.mfaInitSkipLifetime !== undefined) {
      this.mfaInitSkipLifetime = payload.mfaInitSkipLifetime;
    }
    if (payload.secondFactorCheckLifetime !== undefined) {
      this.secondFactorCheckLifetime = payload.secondFactorCheckLifetime;
    }
    if (payload.multiFactorCheckLifetime !== undefined) {
      this.multiFactorCheckLifetime = payload.multiFactorCheckLifetime;
    }
  }

  private reduceRemoved(_event: Event): void {
    this.state = LoginPolicyState.REMOVED;
  }

  private reduceSecondFactorAdded(event: Event): void {
    const payload = event.payload || {};
    if (payload.factorType !== undefined) {
      this.secondFactors.add(payload.factorType);
    }
  }

  private reduceSecondFactorRemoved(event: Event): void {
    const payload = event.payload || {};
    if (payload.factorType !== undefined) {
      this.secondFactors.delete(payload.factorType);
    }
  }

  private reduceMultiFactorAdded(event: Event): void {
    const payload = event.payload || {};
    if (payload.factorType !== undefined) {
      this.multiFactors.add(payload.factorType);
    }
  }

  private reduceMultiFactorRemoved(event: Event): void {
    const payload = event.payload || {};
    if (payload.factorType !== undefined) {
      this.multiFactors.delete(payload.factorType);
    }
  }

  exists(): boolean {
    return this.state === LoginPolicyState.ACTIVE;
  }

  /**
   * Check if policy configuration has changed
   */
  hasChanged(policy: Partial<{
    allowUsernamePassword?: boolean;
    allowRegister?: boolean;
    allowExternalIDP?: boolean;
    forceMFA?: boolean;
    forceMFALocalOnly?: boolean;
    hidePasswordReset?: boolean;
    ignoreUnknownUsernames?: boolean;
    allowDomainDiscovery?: boolean;
    disableLoginWithEmail?: boolean;
    disableLoginWithPhone?: boolean;
    defaultRedirectURI?: string;
    passwordCheckLifetime?: number;
    externalLoginCheckLifetime?: number;
    mfaInitSkipLifetime?: number;
    secondFactorCheckLifetime?: number;
    multiFactorCheckLifetime?: number;
  }>): boolean {
    return (
      (policy.allowUsernamePassword !== undefined && policy.allowUsernamePassword !== this.allowUsernamePassword) ||
      (policy.allowRegister !== undefined && policy.allowRegister !== this.allowRegister) ||
      (policy.allowExternalIDP !== undefined && policy.allowExternalIDP !== this.allowExternalIDP) ||
      (policy.forceMFA !== undefined && policy.forceMFA !== this.forceMFA) ||
      (policy.forceMFALocalOnly !== undefined && policy.forceMFALocalOnly !== this.forceMFALocalOnly) ||
      (policy.hidePasswordReset !== undefined && policy.hidePasswordReset !== this.hidePasswordReset) ||
      (policy.ignoreUnknownUsernames !== undefined && policy.ignoreUnknownUsernames !== this.ignoreUnknownUsernames) ||
      (policy.allowDomainDiscovery !== undefined && policy.allowDomainDiscovery !== this.allowDomainDiscovery) ||
      (policy.disableLoginWithEmail !== undefined && policy.disableLoginWithEmail !== this.disableLoginWithEmail) ||
      (policy.disableLoginWithPhone !== undefined && policy.disableLoginWithPhone !== this.disableLoginWithPhone) ||
      (policy.defaultRedirectURI !== undefined && policy.defaultRedirectURI !== this.defaultRedirectURI) ||
      (policy.passwordCheckLifetime !== undefined && policy.passwordCheckLifetime !== this.passwordCheckLifetime) ||
      (policy.externalLoginCheckLifetime !== undefined && policy.externalLoginCheckLifetime !== this.externalLoginCheckLifetime) ||
      (policy.mfaInitSkipLifetime !== undefined && policy.mfaInitSkipLifetime !== this.mfaInitSkipLifetime) ||
      (policy.secondFactorCheckLifetime !== undefined && policy.secondFactorCheckLifetime !== this.secondFactorCheckLifetime) ||
      (policy.multiFactorCheckLifetime !== undefined && policy.multiFactorCheckLifetime !== this.multiFactorCheckLifetime)
    );
  }
}
