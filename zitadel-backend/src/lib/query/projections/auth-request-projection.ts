/**
 * Auth Request projection for Zitadel query layer
 * Projects auth request events into the auth_requests table for OAuth/OIDC flows
 */

import { Projection } from '../projection/projection';
import { Event } from '../../eventstore/types';

export class AuthRequestProjection extends Projection {
  readonly name = 'auth_request_projection';
  readonly tables = ['auth_requests'];

  async init(): Promise<void> {
    // Create auth_requests table if it doesn't exist
    await this.query(
      `CREATE TABLE IF NOT EXISTS projections.auth_requests (
        id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        login_client TEXT NOT NULL,
        client_id TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        state TEXT,
        nonce TEXT,
        scope TEXT[] NOT NULL DEFAULT '{}',
        audience TEXT[],
        response_type TEXT,
        response_mode TEXT,
        code_challenge TEXT,
        code_challenge_method TEXT,
        prompt TEXT[] DEFAULT '{}',
        ui_locales TEXT[],
        max_age INTEGER,
        login_hint TEXT,
        hint_user_id TEXT,
        need_refresh_token BOOLEAN DEFAULT false,
        session_id TEXT,
        user_id TEXT,
        auth_time TIMESTAMPTZ,
        auth_methods TEXT[],
        code TEXT,
        issuer TEXT,
        PRIMARY KEY (instance_id, id)
      )`,
      []
    );

    // Create indexes for common queries
    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_auth_requests_code 
       ON projections.auth_requests(code, instance_id) 
       WHERE code IS NOT NULL`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_auth_requests_client_id 
       ON projections.auth_requests(client_id, instance_id)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_auth_requests_session_id 
       ON projections.auth_requests(session_id, instance_id) 
       WHERE session_id IS NOT NULL`,
      []
    );
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'auth_request.added':
        await this.handleAuthRequestAdded(event);
        break;

      case 'auth_request.code.added':
        await this.handleCodeAdded(event);
        break;

      case 'auth_request.session.linked':
        await this.handleSessionLinked(event);
        break;

      case 'auth_request.succeeded':
        await this.handleAuthRequestSucceeded(event);
        break;

      case 'auth_request.failed':
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
        Math.floor(event.position.position),
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
        Math.floor(event.position.position),
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
        Math.floor(event.position.position),
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
