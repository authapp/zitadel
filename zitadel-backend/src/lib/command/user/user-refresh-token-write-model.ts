/**
 * Human Refresh Token Write Model
 * 
 * Matches Go's command/user_human_refresh_token_model.go
 * Tracks refresh token state and lifecycle
 */

import { WriteModel } from '../write-model';
import { Event } from '../../eventstore/types';
import { USER_AGGREGATE_TYPE, UserEventTypes } from '../../repository/user/events';
import { UserState } from './user-write-model';

export interface TokenActor {
  actorID: string;
  actorType: string;
}

/**
 * Human Refresh Token Write Model
 */
export class HumanRefreshTokenWriteModel extends WriteModel {
  tokenID: string;
  refreshToken: string = '';
  userState: UserState = UserState.UNSPECIFIED;
  authTime: Date | null = null;
  idleExpiration: Date | null = null;
  expiration: Date | null = null;
  userAgentID: string = '';
  authMethodsReferences: string[] = [];
  actor: TokenActor | null = null;

  constructor(tokenID: string) {
    super(USER_AGGREGATE_TYPE);
    this.tokenID = tokenID;
  }

  reduce(event: Event): void {
    // Only process events for this specific token or general user events
    if (
      event.eventType === UserEventTypes.REFRESH_TOKEN_ADDED ||
      event.eventType === UserEventTypes.REFRESH_TOKEN_RENEWED ||
      event.eventType === UserEventTypes.REFRESH_TOKEN_REMOVED
    ) {
      const payload = event.payload as any;
      if (payload.tokenId && payload.tokenId !== this.tokenID) {
        return;
      }
    }

    switch (event.eventType) {
      case UserEventTypes.REFRESH_TOKEN_ADDED: {
        const payload = event.payload as any;
        this.tokenID = payload.tokenId;
        this.refreshToken = payload.tokenId;
        this.userState = UserState.ACTIVE;
        this.authTime = payload.authTime ? new Date(payload.authTime) : null;
        this.userAgentID = payload.userAgentId || '';
        this.authMethodsReferences = payload.authMethodsReferences || [];
        this.actor = payload.actor || null;

        // Calculate expirations
        if (payload.idleExpiration && event.createdAt) {
          this.idleExpiration = new Date(
            event.createdAt.getTime() + payload.idleExpiration * 1000
          );
        }
        if (payload.expiration && event.createdAt) {
          this.expiration = new Date(
            event.createdAt.getTime() + payload.expiration * 1000
          );
        }
        break;
      }

      case UserEventTypes.REFRESH_TOKEN_RENEWED: {
        const payload = event.payload as any;
        if (this.userState === UserState.ACTIVE) {
          this.refreshToken = payload.refreshToken;
        }
        // Update idle expiration
        if (payload.idleExpiration && event.createdAt) {
          this.idleExpiration = new Date(
            event.createdAt.getTime() + payload.idleExpiration * 1000
          );
        }
        break;
      }

      case UserEventTypes.SIGNED_OUT: {
        const payload = event.payload as any;
        if (this.userAgentID === payload.userAgentId) {
          this.userState = UserState.DELETED;
        }
        break;
      }

      case UserEventTypes.REFRESH_TOKEN_REMOVED:
      case UserEventTypes.LOCKED:
      case UserEventTypes.DEACTIVATED:
      case UserEventTypes.REMOVED:
        this.userState = UserState.DELETED;
        break;
    }
  }
}

/**
 * Check if token exists and user is active
 */
export function isRefreshTokenActive(wm: HumanRefreshTokenWriteModel): boolean {
  return wm.userState === UserState.ACTIVE && wm.tokenID !== '';
}
