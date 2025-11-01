/**
 * Password Age Policy Write Model (Phase 3)
 * 
 * Manages password age policy state
 * Based on: internal/command/instance_policy_password_age_model.go
 */

import { WriteModel } from '../write-model';
import { Event } from '../../eventstore/types';

export enum PasswordAgePolicyState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REMOVED = 2,
}

export class PasswordAgePolicyWriteModel extends WriteModel {
  state: PasswordAgePolicyState = PasswordAgePolicyState.UNSPECIFIED;
  expireWarnDays: number = 0;
  maxAgeDays: number = 0;
  isDefault: boolean = false;
  
  createdAt?: Date;
  updatedAt?: Date;
  removedAt?: Date;

  constructor() {
    super('instance');  // Policy events are attached to instance aggregate
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'instance.policy.password_age.added':
        this.state = PasswordAgePolicyState.ACTIVE;
        this.expireWarnDays = event.payload?.expireWarnDays || 0;
        this.maxAgeDays = event.payload?.maxAgeDays || 0;
        this.isDefault = true;
        this.createdAt = event.createdAt;
        this.updatedAt = event.createdAt;
        break;

      case 'org.policy.password_age.added':
        this.state = PasswordAgePolicyState.ACTIVE;
        this.expireWarnDays = event.payload?.expireWarnDays || 0;
        this.maxAgeDays = event.payload?.maxAgeDays || 0;
        this.isDefault = false;
        this.createdAt = event.createdAt;
        this.updatedAt = event.createdAt;
        break;

      case 'instance.policy.password_age.changed':
      case 'org.policy.password_age.changed':
        if (event.payload?.expireWarnDays !== undefined) {
          this.expireWarnDays = event.payload.expireWarnDays;
        }
        if (event.payload?.maxAgeDays !== undefined) {
          this.maxAgeDays = event.payload.maxAgeDays;
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.policy.password_age.removed':
      case 'org.policy.password_age.removed':
        this.state = PasswordAgePolicyState.REMOVED;
        this.removedAt = event.createdAt;
        this.updatedAt = event.createdAt;
        break;
    }
  }

  /**
   * Check if policy is active
   */
  isActive(): boolean {
    return this.state === PasswordAgePolicyState.ACTIVE;
  }

  /**
   * Check if policy is removed
   */
  isRemoved(): boolean {
    return this.state === PasswordAgePolicyState.REMOVED;
  }

  /**
   * Check if password age limit is enabled
   */
  hasMaxAge(): boolean {
    return this.maxAgeDays > 0;
  }

  /**
   * Check if warning is enabled
   */
  hasExpireWarning(): boolean {
    return this.expireWarnDays > 0;
  }

  /**
   * Get warning threshold in milliseconds
   */
  getExpireWarningMs(): number {
    return this.expireWarnDays * 24 * 60 * 60 * 1000;
  }

  /**
   * Get max age in milliseconds
   */
  getMaxAgeMs(): number {
    return this.maxAgeDays * 24 * 60 * 60 * 1000;
  }

  /**
   * Check if password should show warning
   */
  shouldWarnExpiry(passwordAge: number): boolean {
    if (!this.hasMaxAge() || !this.hasExpireWarning()) {
      return false;
    }
    
    const maxAgeMs = this.getMaxAgeMs();
    const warningThresholdMs = this.getExpireWarningMs();
    
    return passwordAge >= (maxAgeMs - warningThresholdMs);
  }

  /**
   * Check if password is expired
   */
  isPasswordExpired(passwordAge: number): boolean {
    if (!this.hasMaxAge()) {
      return false;
    }
    
    return passwordAge >= this.getMaxAgeMs();
  }

  /**
   * Get policy summary
   */
  toSummary(): {
    policyID: string;
    state: PasswordAgePolicyState;
    expireWarnDays: number;
    maxAgeDays: number;
    isDefault: boolean;
    hasMaxAge: boolean;
    hasExpireWarning: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  } {
    return {
      policyID: this.aggregateID,
      state: this.state,
      expireWarnDays: this.expireWarnDays,
      maxAgeDays: this.maxAgeDays,
      isDefault: this.isDefault,
      hasMaxAge: this.hasMaxAge(),
      hasExpireWarning: this.hasExpireWarning(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
