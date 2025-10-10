/**
 * Session Domain Entity
 * 
 * User authentication session
 */

import { ObjectRoot, Stateful, AuthMethodType, MFALevel } from '../types';
import { throwInvalidArgument } from '@/zerrors/errors';

/**
 * Session state
 */
export enum SessionState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  TERMINATED = 2,
}

/**
 * Session entity
 */
export class Session implements ObjectRoot, Stateful<SessionState> {
  public factors: SessionFactor[] = [];
  public metadata: Map<string, Buffer> = new Map();

  constructor(
    public aggregateID: string,
    public resourceOwner: string,
    public userID: string,
    public state: SessionState,
    public userAgent?: string,
    public ipAddress?: string,
    public expirationDate?: Date,
    public creationDate?: Date,
    public changeDate?: Date,
    public sequence?: bigint
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.userID) {
      throwInvalidArgument('User ID is required', 'SESSION-001');
    }
  }

  isValid(): boolean {
    return !!this.userID;
  }

  exists(): boolean {
    return this.state !== SessionState.UNSPECIFIED && this.state !== SessionState.TERMINATED;
  }

  /**
   * Check if session is expired
   */
  isExpired(): boolean {
    if (!this.expirationDate) {
      return false;
    }
    return new Date() > this.expirationDate;
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.state === SessionState.ACTIVE && !this.isExpired();
  }

  /**
   * Add authentication factor
   */
  addFactor(factor: SessionFactor): void {
    // Remove existing factor of same type
    this.factors = this.factors.filter(f => f.type !== factor.type);
    this.factors.push(factor);
  }

  /**
   * Check if session has factor
   */
  hasFactor(type: AuthMethodType): boolean {
    return this.factors.some(f => f.type === type && f.verified);
  }

  /**
   * Get MFA level
   */
  getMFALevel(): MFALevel {
    const verifiedFactors = this.factors.filter(f => f.verified);
    
    if (verifiedFactors.length === 0) {
      return MFALevel.NONE;
    }
    
    // Check for hardware factors
    if (verifiedFactors.some(f => f.type === AuthMethodType.U2F)) {
      return MFALevel.HARDWARE;
    }
    
    // Check for software factors
    if (verifiedFactors.some(f => 
      f.type === AuthMethodType.TOTP || 
      f.type === AuthMethodType.OTP_SMS ||
      f.type === AuthMethodType.OTP_EMAIL
    )) {
      return MFALevel.SOFTWARE;
    }
    
    return MFALevel.NONE;
  }

  /**
   * Set session metadata
   */
  setMetadata(key: string, value: Buffer): void {
    this.metadata.set(key, value);
  }

  /**
   * Get session metadata
   */
  getMetadata(key: string): Buffer | undefined {
    return this.metadata.get(key);
  }

  /**
   * Delete session metadata
   */
  deleteMetadata(key: string): void {
    this.metadata.delete(key);
  }
}

/**
 * Session factor (authentication method used in session)
 */
export class SessionFactor {
  constructor(
    public type: AuthMethodType,
    public verified: boolean = false,
    public verificationTime?: Date
  ) {}
}

/**
 * Session token
 */
export class SessionToken {
  constructor(
    public sessionID: string,
    public tokenID: string,
    public token: string,
    public expirationDate: Date,
    public creationDate?: Date
  ) {}

  /**
   * Check if token is expired
   */
  isExpired(): boolean {
    return new Date() > this.expirationDate;
  }

  /**
   * Check if token is valid
   */
  isValid(): boolean {
    return !this.isExpired();
  }
}

/**
 * Helper functions
 */
export function isSessionStateValid(state: SessionState): boolean {
  return state >= SessionState.UNSPECIFIED && state <= SessionState.TERMINATED;
}

export function isSessionStateActive(state: SessionState): boolean {
  return state === SessionState.ACTIVE;
}
