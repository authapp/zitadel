/**
 * IDP Intent Projection
 * 
 * Handles events related to external Identity Provider (IDP) intents.
 * Stores temporary state during OAuth/OIDC/SAML flows for CSRF protection
 * and callback validation.
 * 
 * Events handled:
 * - idp.intent.started - New intent created
 * - idp.intent.succeeded - Intent successfully completed
 * - idp.intent.failed - Intent failed
 * 
 * Table: projections.idp_intents
 */

import { Projection } from '../projection/projection';
import { Event } from '../../eventstore/types';

export class IDPIntentProjection extends Projection {
  readonly name = 'idp_intent_projection';
  readonly tables = ['idp_intents'];

  async init(): Promise<void> {
    // Create table if not exists (for integration tests)
    await this.query(
      `CREATE TABLE IF NOT EXISTS projections.idp_intents (
        id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        idp_id TEXT NOT NULL,
        idp_type TEXT NOT NULL,
        state TEXT NOT NULL,
        code_verifier TEXT,
        nonce TEXT,
        redirect_uri TEXT NOT NULL,
        auth_request_id TEXT,
        user_id TEXT,
        resource_owner TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        succeeded BOOLEAN DEFAULT false,
        succeeded_at TIMESTAMPTZ,
        succeeded_user_id TEXT,
        PRIMARY KEY (instance_id, id)
      )`,
      []
    );

    // Create indexes
    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_idp_intents_state 
       ON projections.idp_intents(instance_id, state) 
       WHERE succeeded = false`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_idp_intents_expires_at 
       ON projections.idp_intents(expires_at) 
       WHERE succeeded = false`,
      []
    );
  }
  
  /**
   * Get event types handled by this projection
   * Required for real-time event subscription
   */
  getEventTypes(): string[] {
    return [
      'idp.intent.failed',
      'idp.intent.started',
      'idp.intent.succeeded',
    ];
  }


  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'idp.intent.started':
        await this.handleIntentStarted(event);
        break;
      case 'idp.intent.succeeded':
        await this.handleIntentSucceeded(event);
        break;
      case 'idp.intent.failed':
        await this.handleIntentFailed(event);
        break;
    }
  }

  /**
   * Handle idp.intent.started event
   * Creates a new intent record for OAuth/OIDC/SAML flow
   */
  private async handleIntentStarted(event: Event): Promise<void> {
    const payload = event.payload || {};
    const {
      intentID,
      idpID,
      idpType,
      state,
      codeVerifier,
      nonce,
      redirectURI,
      authRequestID,
      userID,
      expiresAt,
    } = payload;

    await this.query(
      `INSERT INTO projections.idp_intents (
        id,
        instance_id,
        idp_id,
        idp_type,
        state,
        code_verifier,
        nonce,
        redirect_uri,
        auth_request_id,
        user_id,
        resource_owner,
        created_at,
        expires_at,
        succeeded
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (instance_id, id) DO NOTHING`,
      [
        intentID || event.aggregateID,
        event.instanceID,
        idpID,
        idpType,
        state,
        codeVerifier || null,
        nonce || null,
        redirectURI,
        authRequestID || null,
        userID || null,
        event.owner,
        event.createdAt,
        new Date(expiresAt),
        false,
      ]
    );
  }

  /**
   * Handle idp.intent.succeeded event
   * Marks intent as successfully completed
   */
  private async handleIntentSucceeded(event: Event): Promise<void> {
    const payload = event.payload || {};
    const { userID } = payload;

    await this.query(
      `UPDATE projections.idp_intents
       SET succeeded = true,
           succeeded_at = $1,
           succeeded_user_id = $2
       WHERE instance_id = $3
         AND id = $4`,
      [
        event.createdAt,
        userID,
        event.instanceID,
        event.aggregateID,
      ]
    );
  }

  /**
   * Handle idp.intent.failed event
   * Currently just marks completion (could add failure tracking)
   */
  private async handleIntentFailed(event: Event): Promise<void> {
    // For now, we just let the intent expire naturally
    // Could add a failed flag if needed for analytics
    
    // Optional: Mark as failed explicitly
    await this.query(
      `UPDATE projections.idp_intents
       SET succeeded = false
       WHERE instance_id = $1
         AND id = $2`,
      [
        event.instanceID,
        event.aggregateID,
      ]
    );
  }

  /**
   * Cleanup expired intents (periodic maintenance)
   * Should be called by a background job
   */
  async cleanupExpiredIntents(): Promise<number> {
    const result = await this.query(
      `DELETE FROM projections.idp_intents
       WHERE expires_at < NOW()
         AND succeeded = false
       RETURNING id`
    );

    return result.rowCount || 0;
  }
}
