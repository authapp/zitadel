/**
 * Auth Request projection for Zitadel query layer
 * Projects auth request events into the auth_requests table for OAuth/OIDC flows
 */

import { Projection } from '../projection/projection';
import { Event } from '../../eventstore/types';

export class AuthRequestProjection extends Projection {
  readonly name = 'auth_request_projection';
  readonly tables = ['projections.auth_requests'];

  /**
   * Initialize projection - table created by migration 002_56
   */
  async init(): Promise<void> {
    // Table created by migration, no initialization needed
  }
  
  /**
   * Get event types handled by this projection
   * Required for real-time event subscription
   */
  getEventTypes(): string[] {
    return [
      'auth.request.added',
      'auth.request.code.added',
      'auth.request.failed',
      'auth.request.session.linked',
      'auth.request.succeeded',
      'instance.removed',
    ];
  }


  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'auth.request.added':
        await this.handleAuthRequestAdded(event);
        break;

      case 'auth.request.code.added':
        await this.handleCodeAdded(event);
        break;

      case 'auth.request.session.linked':
        await this.handleSessionLinked(event);
        break;

      case 'auth.request.succeeded':
        await this.handleAuthRequestSucceeded(event);
        break;

      case 'auth.request.failed':
        await this.handleAuthRequestFailed(event);
        break;

      case 'instance.removed':
        await this.handleInstanceRemoved(event);
        break;
    }
  }

  /**
   * Handle auth_request.added event
   */
  private async handleAuthRequestAdded(event: Event): Promise<void> {
    const payload = event.payload || {};

    // Parse code challenge if present
    const codeChallengeMethod = payload.codeChallenge?.method || null;
    const codeChallenge = payload.codeChallenge?.challenge || null;

    await this.query(
      `INSERT INTO projections.auth_requests (
        id, instance_id, creation_date, change_date, sequence, resource_owner,
        login_client, client_id, redirect_uri, state, nonce, scope, audience,
        response_type, response_mode, code_challenge, code_challenge_method,
        prompt, ui_locales, max_age, login_hint, hint_user_id, need_refresh_token, issuer
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence`,
      [
        event.aggregateID,
        event.instanceID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.owner,
        payload.loginClient || '',
        payload.clientID || '',
        payload.redirectURI || '',
        payload.state || null,
        payload.nonce || null,
        payload.scope || [],
        payload.audience || [],
        payload.responseType || null,
        payload.responseMode || null,
        codeChallenge,
        codeChallengeMethod,
        payload.prompt || [],
        payload.uiLocales || [],
        payload.maxAge || null,
        payload.loginHint || null,
        payload.hintUserID || null,
        payload.needRefreshToken || false,
        payload.issuer || null,
      ]
    );
  }

  /**
   * Handle auth_request.code.added event
   */
  private async handleCodeAdded(event: Event): Promise<void> {
    const payload = event.payload || {};

    await this.query(
      `UPDATE projections.auth_requests
       SET code = $1,
           change_date = $2,
           sequence = $3
       WHERE id = $4 AND instance_id = $5`,
      [
        payload.code || null,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.aggregateID,
        event.instanceID,
      ]
    );
  }

  /**
   * Handle auth_request.session.linked event
   */
  private async handleSessionLinked(event: Event): Promise<void> {
    const payload = event.payload || {};

    await this.query(
      `UPDATE projections.auth_requests
       SET session_id = $1,
           user_id = $2,
           auth_time = $3,
           auth_methods = $4,
           change_date = $5,
           sequence = $6
       WHERE id = $7 AND instance_id = $8`,
      [
        payload.sessionID || null,
        payload.userID || null,
        payload.authTime || null,
        payload.authMethods || [],
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.aggregateID,
        event.instanceID,
      ]
    );
  }

  /**
   * Handle auth_request.succeeded event
   * Delete the auth request as it's no longer needed
   */
  private async handleAuthRequestSucceeded(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.auth_requests
       WHERE id = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );
  }

  /**
   * Handle auth_request.failed event
   * Delete the auth request as it's no longer needed
   */
  private async handleAuthRequestFailed(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.auth_requests
       WHERE id = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );
  }

  /**
   * Handle instance.removed event
   * Delete all auth requests for the removed instance
   */
  private async handleInstanceRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.auth_requests
       WHERE instance_id = $1`,
      [event.instanceID]
    );
  }
}
