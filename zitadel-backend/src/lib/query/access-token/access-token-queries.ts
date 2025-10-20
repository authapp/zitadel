/**
 * Access Token queries for Zitadel query layer
 * Handles OAuth/OIDC access token validation and retrieval
 * 
 * Note: Access tokens are typically stored in eventstore or session storage,
 * not projected. These queries read from events or session data.
 */

import { DatabasePool } from '../../database';
import { Eventstore } from '../../eventstore';
import { AccessToken, ActiveAccessToken } from './access-token-types';

export class AccessTokenQueries {
  constructor(
    private readonly database: DatabasePool,
    private readonly eventstore?: Eventstore
  ) {}

  /**
   * Get active access token by ID
   * Returns token only if it's not expired and not revoked
   * 
   * @param tokenID - Token ID
   * @param instanceID - Instance ID
   * @returns Active access token or null
   */
  async getActiveAccessTokenByID(
    tokenID: string,
    instanceID: string
  ): Promise<ActiveAccessToken | null> {
    const token = await this.getAccessTokenByID(tokenID, instanceID);
    
    if (!token) {
      return null;
    }

    // Check if token is expired
    if (token.expiration < new Date()) {
      return null;
    }

    // Check if token is revoked
    if (token.reason !== undefined) {
      return null;
    }

    return {
      ...token,
      isActive: true,
    };
  }

  /**
   * Get access token by ID
   * Returns token even if expired or revoked
   * 
   * @param tokenID - Token ID
   * @param instanceID - Instance ID
   * @returns Access token or null
   */
  async getAccessTokenByID(
    tokenID: string,
    instanceID: string
  ): Promise<AccessToken | null> {
    // First try to get from session tokens (if using session-based storage)
    const sessionToken = await this.getTokenFromSessions(tokenID, instanceID);
    if (sessionToken) {
      return sessionToken;
    }

    // Fallback to event-based lookup
    if (this.eventstore) {
      return await this.getTokenFromEvents(tokenID, instanceID);
    }

    return null;
  }

  /**
   * Get access token by token string
   * Used for token validation during API requests
   * 
   * @param token - Token string
   * @param instanceID - Instance ID
   * @returns Active access token or null
   */
  async getAccessTokenByToken(
    token: string,
    instanceID: string
  ): Promise<ActiveAccessToken | null> {
    // Try to get from session tokens
    const sessionToken = await this.getTokenByTokenString(token, instanceID);
    if (!sessionToken) {
      return null;
    }

    // Check if token is active
    if (sessionToken.expiration < new Date()) {
      return null;
    }

    if (sessionToken.reason !== undefined) {
      return null;
    }

    return {
      ...sessionToken,
      isActive: true,
    };
  }

  /**
   * Get token from sessions table
   * Assumes tokens are stored in session_tokens table
   */
  private async getTokenFromSessions(
    tokenID: string,
    instanceID: string
  ): Promise<AccessToken | null> {
    try {
      const result = await this.database.queryOne(
        `SELECT 
          id, creation_date, change_date, sequence, resource_owner, instance_id,
          user_id, application_id, token, scopes, audience, expiration,
          refresh_token_id, actor_user_id, actor_issuer, reason
         FROM projections.session_tokens
         WHERE id = $1 AND instance_id = $2`,
        [tokenID, instanceID]
      );

      if (!result) {
        return null;
      }

      return this.mapRowToAccessToken(result);
    } catch (error) {
      // Table might not exist, return null
      return null;
    }
  }

  /**
   * Get token by token string from sessions table
   */
  private async getTokenByTokenString(
    token: string,
    instanceID: string
  ): Promise<AccessToken | null> {
    try {
      const result = await this.database.queryOne(
        `SELECT 
          id, creation_date, change_date, sequence, resource_owner, instance_id,
          user_id, application_id, token, scopes, audience, expiration,
          refresh_token_id, actor_user_id, actor_issuer, reason
         FROM projections.session_tokens
         WHERE token = $1 AND instance_id = $2`,
        [token, instanceID]
      );

      if (!result) {
        return null;
      }

      return this.mapRowToAccessToken(result);
    } catch (error) {
      // Table might not exist, return null
      return null;
    }
  }

  /**
   * Get token from events
   * Fallback method that reconstructs token from eventstore
   */
  private async getTokenFromEvents(
    tokenID: string,
    instanceID: string
  ): Promise<AccessToken | null> {
    if (!this.eventstore) {
      return null;
    }

    try {
      // Query events for this token
      const events = await this.eventstore.query({
        instanceID,
        aggregateTypes: ['user_session', 'oidc_session'],
        eventTypes: [
          'user.token.added',
          'user.token.v2.added',
          'oidc.access_token.added',
          'session.token.set',
        ],
      });

      // Find the token creation event
      for (const event of events) {
        const payload = event.payload || {};
        if (payload.tokenID === tokenID || event.aggregateID === tokenID) {
          return {
            id: tokenID,
            creationDate: event.createdAt,
            changeDate: event.createdAt,
            sequence: BigInt(event.position?.position || 0),
            resourceOwner: event.owner,
            instanceID: event.instanceID,
            userID: payload.userID || event.aggregateID,
            applicationID: payload.applicationID || payload.clientID || '',
            token: payload.token || '',
            scopes: payload.scopes || [],
            audience: payload.audience || [],
            expiration: payload.expiration ? new Date(payload.expiration) : new Date(Date.now() + 3600000),
            refreshTokenID: payload.refreshTokenID,
            actorUserID: payload.actorUserID,
            actorIssuer: payload.actorIssuer,
            reason: payload.reason,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error querying token from events:', error);
      return null;
    }
  }

  /**
   * Map database row to AccessToken
   */
  private mapRowToAccessToken(row: any): AccessToken {
    return {
      id: row.id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      resourceOwner: row.resource_owner,
      instanceID: row.instance_id,
      userID: row.user_id,
      applicationID: row.application_id,
      token: row.token,
      scopes: Array.isArray(row.scopes) ? row.scopes : JSON.parse(row.scopes || '[]'),
      audience: Array.isArray(row.audience) ? row.audience : JSON.parse(row.audience || '[]'),
      expiration: row.expiration,
      refreshTokenID: row.refresh_token_id,
      actorUserID: row.actor_user_id,
      actorIssuer: row.actor_issuer,
      reason: row.reason,
    };
  }
}
