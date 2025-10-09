/**
 * Login Policy Write Model (Phase 3)
 * 
 * Manages login policy state
 * Based on: internal/command/instance_policy_login_model.go
 */

import { WriteModel } from '../write-model';
import { Event } from '../../eventstore/types';
import { SecondFactorType, MultiFactorType } from './login-policy-commands';

export enum LoginPolicyState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REMOVED = 2,
}

export class LoginPolicyWriteModel extends WriteModel {
  state: LoginPolicyState = LoginPolicyState.UNSPECIFIED;
  allowUsernamePassword: boolean = true;
  allowRegister: boolean = true;
  allowExternalIDP: boolean = false;
  forceMFA: boolean = false;
  forceMFALocalOnly: boolean = false;
  hidePasswordReset: boolean = false;
  ignoreUnknownUsernames: boolean = false;
  allowDomainDiscovery: boolean = true;
  disableLoginWithEmail: boolean = false;
  disableLoginWithPhone: boolean = true;
  defaultRedirectURI: string = '';
  passwordCheckLifetime: number = 864000; // 10 days in seconds
  externalLoginCheckLifetime: number = 864000; // 10 days in seconds
  mfaInitSkipLifetime: number = 2592000; // 30 days in seconds
  secondFactorCheckLifetime: number = 64800; // 18 hours in seconds
  multiFactorCheckLifetime: number = 43200; // 12 hours in seconds
  
  secondFactors: SecondFactorType[] = [];
  multiFactors: MultiFactorType[] = [];
  idps: string[] = []; // IDP IDs
  
  isDefault: boolean = false;
  createdAt?: Date;
  updatedAt?: Date;
  removedAt?: Date;

  constructor() {
    super('login_policy');
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'instance.policy.login.added':
        this.state = LoginPolicyState.ACTIVE;
        this.isDefault = true;
        this.updateFromPayload(event.payload);
        this.createdAt = event.createdAt;
        this.updatedAt = event.createdAt;
        break;

      case 'org.policy.login.added':
        this.state = LoginPolicyState.ACTIVE;
        this.isDefault = false;
        this.updateFromPayload(event.payload);
        this.createdAt = event.createdAt;
        this.updatedAt = event.createdAt;
        break;

      case 'instance.policy.login.changed':
      case 'org.policy.login.changed':
        this.updateFromPayload(event.payload);
        this.updatedAt = event.createdAt;
        break;

      case 'instance.policy.login.second_factor.added':
      case 'org.policy.login.second_factor.added':
        if (event.payload?.factorType && !this.secondFactors.includes(event.payload.factorType)) {
          this.secondFactors.push(event.payload.factorType);
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.policy.login.second_factor.removed':
      case 'org.policy.login.second_factor.removed':
        if (event.payload?.factorType) {
          this.secondFactors = this.secondFactors.filter(f => f !== event.payload?.factorType);
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.policy.login.multi_factor.added':
      case 'org.policy.login.multi_factor.added':
        if (event.payload?.factorType && !this.multiFactors.includes(event.payload.factorType)) {
          this.multiFactors.push(event.payload.factorType);
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.policy.login.multi_factor.removed':
      case 'org.policy.login.multi_factor.removed':
        if (event.payload?.factorType) {
          this.multiFactors = this.multiFactors.filter(f => f !== event.payload?.factorType);
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.policy.login.idp.added':
      case 'org.policy.login.idp.added':
        if (event.payload?.idpID && !this.idps.includes(event.payload.idpID)) {
          this.idps.push(event.payload.idpID);
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.policy.login.idp.removed':
      case 'org.policy.login.idp.removed':
        if (event.payload?.idpID) {
          this.idps = this.idps.filter(id => id !== event.payload?.idpID);
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.policy.login.removed':
      case 'org.policy.login.removed':
        this.state = LoginPolicyState.REMOVED;
        this.removedAt = event.createdAt;
        this.updatedAt = event.createdAt;
        break;
    }
  }

  /**
   * Update policy from event payload
   */
  private updateFromPayload(payload: any): void {
    if (payload?.allowUsernamePassword !== undefined) {
      this.allowUsernamePassword = payload.allowUsernamePassword;
    }
    if (payload?.allowRegister !== undefined) {
      this.allowRegister = payload.allowRegister;
    }
    if (payload?.allowExternalIDP !== undefined) {
      this.allowExternalIDP = payload.allowExternalIDP;
    }
    if (payload?.forceMFA !== undefined) {
      this.forceMFA = payload.forceMFA;
    }
    if (payload?.forceMFALocalOnly !== undefined) {
      this.forceMFALocalOnly = payload.forceMFALocalOnly;
    }
    if (payload?.hidePasswordReset !== undefined) {
      this.hidePasswordReset = payload.hidePasswordReset;
    }
    if (payload?.ignoreUnknownUsernames !== undefined) {
      this.ignoreUnknownUsernames = payload.ignoreUnknownUsernames;
    }
    if (payload?.allowDomainDiscovery !== undefined) {
      this.allowDomainDiscovery = payload.allowDomainDiscovery;
    }
    if (payload?.disableLoginWithEmail !== undefined) {
      this.disableLoginWithEmail = payload.disableLoginWithEmail;
    }
    if (payload?.disableLoginWithPhone !== undefined) {
      this.disableLoginWithPhone = payload.disableLoginWithPhone;
    }
    if (payload?.defaultRedirectURI !== undefined) {
      this.defaultRedirectURI = payload.defaultRedirectURI;
    }
    if (payload?.passwordCheckLifetime !== undefined) {
      this.passwordCheckLifetime = payload.passwordCheckLifetime;
    }
    if (payload?.externalLoginCheckLifetime !== undefined) {
      this.externalLoginCheckLifetime = payload.externalLoginCheckLifetime;
    }
    if (payload?.mfaInitSkipLifetime !== undefined) {
      this.mfaInitSkipLifetime = payload.mfaInitSkipLifetime;
    }
    if (payload?.secondFactorCheckLifetime !== undefined) {
      this.secondFactorCheckLifetime = payload.secondFactorCheckLifetime;
    }
    if (payload?.multiFactorCheckLifetime !== undefined) {
      this.multiFactorCheckLifetime = payload.multiFactorCheckLifetime;
    }
  }

  /**
   * Check if policy is active
   */
  isActive(): boolean {
    return this.state === LoginPolicyState.ACTIVE;
  }

  /**
   * Check if policy is removed
   */
  isRemoved(): boolean {
    return this.state === LoginPolicyState.REMOVED;
  }

  /**
   * Check if username/password login is allowed
   */
  isUsernamePasswordAllowed(): boolean {
    return this.allowUsernamePassword;
  }

  /**
   * Check if registration is allowed
   */
  isRegistrationAllowed(): boolean {
    return this.allowRegister;
  }

  /**
   * Check if external IDP login is allowed
   */
  isExternalIDPAllowed(): boolean {
    return this.allowExternalIDP;
  }

  /**
   * Check if MFA is forced
   */
  isMFAForced(): boolean {
    return this.forceMFA;
  }

  /**
   * Check if MFA is forced for local users only
   */
  isMFAForcedLocalOnly(): boolean {
    return this.forceMFALocalOnly;
  }

  /**
   * Check if password reset is hidden
   */
  isPasswordResetHidden(): boolean {
    return this.hidePasswordReset;
  }

  /**
   * Check if unknown usernames should be ignored
   */
  shouldIgnoreUnknownUsernames(): boolean {
    return this.ignoreUnknownUsernames;
  }

  /**
   * Check if domain discovery is allowed
   */
  isDomainDiscoveryAllowed(): boolean {
    return this.allowDomainDiscovery;
  }

  /**
   * Check if login with email is disabled
   */
  isLoginWithEmailDisabled(): boolean {
    return this.disableLoginWithEmail;
  }

  /**
   * Check if login with phone is disabled
   */
  isLoginWithPhoneDisabled(): boolean {
    return this.disableLoginWithPhone;
  }

  /**
   * Check if second factor is enabled
   */
  hasSecondFactor(factorType: SecondFactorType): boolean {
    return this.secondFactors.includes(factorType);
  }

  /**
   * Check if multi factor is enabled
   */
  hasMultiFactor(factorType: MultiFactorType): boolean {
    return this.multiFactors.includes(factorType);
  }

  /**
   * Check if IDP is enabled
   */
  hasIDP(idpID: string): boolean {
    return this.idps.includes(idpID);
  }

  /**
   * Get all enabled second factors
   */
  getSecondFactors(): SecondFactorType[] {
    return [...this.secondFactors];
  }

  /**
   * Get all enabled multi factors
   */
  getMultiFactors(): MultiFactorType[] {
    return [...this.multiFactors];
  }

  /**
   * Get all enabled IDPs
   */
  getIDPs(): string[] {
    return [...this.idps];
  }

  /**
   * Get policy summary
   */
  toSummary(): {
    policyID: string;
    state: LoginPolicyState;
    allowUsernamePassword: boolean;
    allowRegister: boolean;
    allowExternalIDP: boolean;
    forceMFA: boolean;
    secondFactorCount: number;
    multiFactorCount: number;
    idpCount: number;
    isDefault: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  } {
    return {
      policyID: this.aggregateID,
      state: this.state,
      allowUsernamePassword: this.allowUsernamePassword,
      allowRegister: this.allowRegister,
      allowExternalIDP: this.allowExternalIDP,
      forceMFA: this.forceMFA,
      secondFactorCount: this.secondFactors.length,
      multiFactorCount: this.multiFactors.length,
      idpCount: this.idps.length,
      isDefault: this.isDefault,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
