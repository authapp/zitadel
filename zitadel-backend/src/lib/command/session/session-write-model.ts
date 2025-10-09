/**
 * Session Write Model (Phase 3)
 * 
 * Manages session state and event reduction
 */

import { WriteModel } from '../write-model';
import { Event } from '../../eventstore/types';

export enum SessionState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  TERMINATED = 2,
}

export interface SessionToken {
  tokenID: string;
  token: string;
  expiry: Date;
}

export interface AuthFactor {
  type: 'password' | 'otp' | 'webauthn' | 'idp';
  verified: boolean;
  verifiedAt?: Date;
  metadata: Record<string, any>;
}

export class SessionWriteModel extends WriteModel {
  state: SessionState = SessionState.UNSPECIFIED;
  userID?: string;
  userAgent?: string;
  clientIP?: string;
  metadata: Map<string, string> = new Map();
  tokens: Map<string, SessionToken> = new Map();
  factors: Map<string, AuthFactor> = new Map();
  createdAt?: Date;
  updatedAt?: Date;
  terminatedAt?: Date;

  constructor() {
    super('session');
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'session.created':
        this.state = SessionState.ACTIVE;
        this.userID = event.payload?.userID;
        this.userAgent = event.payload?.userAgent;
        this.clientIP = event.payload?.clientIP;
        this.createdAt = event.createdAt;
        this.updatedAt = event.createdAt;
        
        // Set metadata
        if (event.payload?.metadata) {
          for (const [key, value] of Object.entries(event.payload.metadata)) {
            this.metadata.set(key, value as string);
          }
        }
        break;

      case 'session.updated':
        this.updatedAt = event.createdAt;
        
        if (event.payload?.userAgent !== undefined) {
          this.userAgent = event.payload.userAgent;
        }
        if (event.payload?.clientIP !== undefined) {
          this.clientIP = event.payload.clientIP;
        }
        if (event.payload?.metadata) {
          for (const [key, value] of Object.entries(event.payload.metadata)) {
            this.metadata.set(key, value as string);
          }
        }
        break;

      case 'session.terminated':
        this.state = SessionState.TERMINATED;
        this.terminatedAt = event.createdAt;
        this.updatedAt = event.createdAt;
        break;

      case 'session.token.set':
        if (event.payload?.tokenID && event.payload?.token && event.payload?.expiry) {
          this.tokens.set(event.payload.tokenID, {
            tokenID: event.payload.tokenID,
            token: event.payload.token,
            expiry: new Date(event.payload.expiry),
          });
        }
        this.updatedAt = event.createdAt;
        break;

      case 'session.factor.set':
        if (event.payload?.type) {
          this.factors.set(event.payload.type, {
            type: event.payload.type,
            verified: event.payload.verified || false,
            verifiedAt: event.payload.verifiedAt ? new Date(event.payload.verifiedAt) : undefined,
            metadata: event.payload.metadata || {},
          });
        }
        this.updatedAt = event.createdAt;
        break;

      case 'session.metadata.set':
        if (event.payload?.key !== undefined) {
          this.metadata.set(event.payload.key, event.payload.value || '');
        }
        this.updatedAt = event.createdAt;
        break;

      case 'session.metadata.deleted':
        if (event.payload?.key) {
          this.metadata.delete(event.payload.key);
        }
        this.updatedAt = event.createdAt;
        break;
    }
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.state === SessionState.ACTIVE;
  }

  /**
   * Check if session is terminated
   */
  isTerminated(): boolean {
    return this.state === SessionState.TERMINATED;
  }

  /**
   * Get all verified factors
   */
  getVerifiedFactors(): AuthFactor[] {
    return Array.from(this.factors.values()).filter(factor => factor.verified);
  }

  /**
   * Check if specific factor is verified
   */
  isFactorVerified(type: string): boolean {
    const factor = this.factors.get(type);
    return factor ? factor.verified : false;
  }

  /**
   * Get valid tokens (not expired)
   */
  getValidTokens(): SessionToken[] {
    const now = new Date();
    return Array.from(this.tokens.values()).filter(token => token.expiry > now);
  }

  /**
   * Check if token is valid
   */
  isTokenValid(tokenID: string): boolean {
    const token = this.tokens.get(tokenID);
    if (!token) return false;
    return token.expiry > new Date();
  }

  /**
   * Get session metadata as object
   */
  getMetadataObject(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of this.metadata) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Get session summary for API responses
   */
  toSummary(): {
    sessionID: string;
    state: SessionState;
    userID?: string;
    userAgent?: string;
    clientIP?: string;
    createdAt?: Date;
    updatedAt?: Date;
    terminatedAt?: Date;
    verifiedFactors: string[];
    validTokenCount: number;
  } {
    return {
      sessionID: this.aggregateID,
      state: this.state,
      userID: this.userID,
      userAgent: this.userAgent,
      clientIP: this.clientIP,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      terminatedAt: this.terminatedAt,
      verifiedFactors: this.getVerifiedFactors().map(f => f.type),
      validTokenCount: this.getValidTokens().length,
    };
  }
}
