/**
 * Auth Request Write Model (Phase 3)
 * 
 * Manages authentication request state
 */

import { WriteModel } from '../write-model';
import { Event } from '../../eventstore/types';

export enum AuthRequestState {
  UNSPECIFIED = 0,
  ADDED = 1,
  USER_SELECTED = 2,
  AUTHENTICATED = 3,
  SUCCEEDED = 4,
  FAILED = 5,
}

export class AuthRequestWriteModel extends WriteModel {
  state: AuthRequestState = AuthRequestState.UNSPECIFIED;
  clientID?: string;
  redirectURI?: string;
  responseType?: string;
  scope: string[] = [];
  state_param?: string; // OAuth state parameter
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  userID?: string;
  orgID?: string;
  authCode?: string;
  failureReason?: string;
  
  // Authentication factors
  passwordChecked: boolean = false;
  totpChecked: boolean = false;
  webauthnChecked: boolean = false;
  
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;

  constructor() {
    super('auth_request');
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'auth.request.added':
        this.state = AuthRequestState.ADDED;
        this.clientID = event.payload?.clientID;
        this.redirectURI = event.payload?.redirectURI;
        this.responseType = event.payload?.responseType;
        this.scope = event.payload?.scope || [];
        this.state_param = event.payload?.state;
        this.nonce = event.payload?.nonce;
        this.codeChallenge = event.payload?.codeChallenge;
        this.codeChallengeMethod = event.payload?.codeChallengeMethod;
        this.userID = event.payload?.userID;
        this.orgID = event.payload?.orgID;
        this.createdAt = event.createdAt;
        this.updatedAt = event.createdAt;
        break;

      case 'auth.request.user.selected':
        this.state = AuthRequestState.USER_SELECTED;
        this.userID = event.payload?.userID;
        this.orgID = event.payload?.orgID;
        this.updatedAt = event.createdAt;
        break;

      case 'auth.request.password.checked':
        this.passwordChecked = true;
        this.updateAuthenticationState();
        this.updatedAt = event.createdAt;
        break;

      case 'auth.request.password.failed':
        this.state = AuthRequestState.FAILED;
        this.failureReason = 'invalid_password';
        this.completedAt = event.createdAt;
        this.updatedAt = event.createdAt;
        break;

      case 'auth.request.totp.checked':
        this.totpChecked = true;
        this.updateAuthenticationState();
        this.updatedAt = event.createdAt;
        break;

      case 'auth.request.totp.failed':
        this.state = AuthRequestState.FAILED;
        this.failureReason = 'invalid_totp';
        this.completedAt = event.createdAt;
        this.updatedAt = event.createdAt;
        break;

      case 'auth.request.webauthn.checked':
        this.webauthnChecked = true;
        this.updateAuthenticationState();
        this.updatedAt = event.createdAt;
        break;

      case 'auth.request.webauthn.failed':
        this.state = AuthRequestState.FAILED;
        this.failureReason = 'invalid_webauthn';
        this.completedAt = event.createdAt;
        this.updatedAt = event.createdAt;
        break;

      case 'auth.request.succeeded':
        this.state = AuthRequestState.SUCCEEDED;
        this.authCode = event.payload?.authCode;
        this.completedAt = event.createdAt;
        this.updatedAt = event.createdAt;
        break;

      case 'auth.request.failed':
        this.state = AuthRequestState.FAILED;
        this.failureReason = event.payload?.reason || 'unknown';
        this.completedAt = event.createdAt;
        this.updatedAt = event.createdAt;
        break;
    }
  }

  /**
   * Update authentication state based on completed factors
   */
  private updateAuthenticationState(): void {
    // Simple logic: if password is checked, consider authenticated
    // In real implementation, would check required factors based on policy
    if (this.passwordChecked) {
      this.state = AuthRequestState.AUTHENTICATED;
    }
  }

  /**
   * Check if authentication request is completed
   */
  isCompleted(): boolean {
    return this.state === AuthRequestState.SUCCEEDED || this.state === AuthRequestState.FAILED;
  }

  /**
   * Check if authentication request succeeded
   */
  isSucceeded(): boolean {
    return this.state === AuthRequestState.SUCCEEDED;
  }

  /**
   * Check if authentication request failed
   */
  isFailed(): boolean {
    return this.state === AuthRequestState.FAILED;
  }

  /**
   * Check if user is selected
   */
  hasUserSelected(): boolean {
    return this.userID !== undefined && this.orgID !== undefined;
  }

  /**
   * Check if authentication is complete
   */
  isAuthenticated(): boolean {
    return this.state === AuthRequestState.AUTHENTICATED || this.state === AuthRequestState.SUCCEEDED;
  }

  /**
   * Get required scopes as array
   */
  getScopes(): string[] {
    return [...this.scope];
  }

  /**
   * Check if specific scope is requested
   */
  hasScope(scope: string): boolean {
    return this.scope.includes(scope);
  }

  /**
   * Get authentication factors status
   */
  getFactorsStatus(): {
    password: boolean;
    totp: boolean;
    webauthn: boolean;
  } {
    return {
      password: this.passwordChecked,
      totp: this.totpChecked,
      webauthn: this.webauthnChecked,
    };
  }

  /**
   * Get auth request summary
   */
  toSummary(): {
    authRequestID: string;
    state: AuthRequestState;
    clientID?: string;
    userID?: string;
    orgID?: string;
    responseType?: string;
    scope: string[];
    authCode?: string;
    failureReason?: string;
    createdAt?: Date;
    completedAt?: Date;
  } {
    return {
      authRequestID: this.aggregateID,
      state: this.state,
      clientID: this.clientID,
      userID: this.userID,
      orgID: this.orgID,
      responseType: this.responseType,
      scope: this.getScopes(),
      authCode: this.authCode,
      failureReason: this.failureReason,
      createdAt: this.createdAt,
      completedAt: this.completedAt,
    };
  }
}
