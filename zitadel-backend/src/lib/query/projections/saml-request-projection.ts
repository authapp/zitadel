/**
 * SAML Request Projection
 * 
 * Projects SAML request events into read model
 * Based on Go: internal/query/projection/saml_request.go
 */

import { Event } from '../../eventstore/types';
import { Projection } from '../projection/projection';

/**
 * SAML Request Projection
 * 
 * Handles events:
 * - saml.request.added
 * - saml.request.session.linked
 * - saml.request.succeeded
 * - saml.request.failed
 */
export class SAMLRequestProjection extends Projection {
  readonly name = 'saml_requests_projection';
  readonly tables = ['projections.saml_requests'];

  /**
   * Initialize projection table
   */
  async init(): Promise<void> {
    // Table is created via migration 03_saml.sql
  }

  /**
   * Get event types handled by this projection
   */
  getEventTypes(): string[] {
    return [
      'saml.request.added',
      'saml.request.session.linked',
      'saml.request.succeeded',
      'saml.request.failed',
    ];
  }

  /**
   * Process SAML request events
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'saml.request.added':
        await this.handleRequestAdded(event);
        break;
      
      case 'saml.request.session.linked':
        await this.handleSessionLinked(event);
        break;
      
      case 'saml.request.succeeded':
        await this.handleRequestSucceeded(event);
        break;
      
      case 'saml.request.failed':
        await this.handleRequestFailed(event);
        break;
      
      default:
        // Ignore other events
        break;
    }
  }

  /**
   * Handle saml.request.added event
   */
  private async handleRequestAdded(event: Event): Promise<void> {
    const params = [
      event.instanceID,
      event.aggregateID,
      event.payload?.loginClient || null,
      event.payload?.applicationID,
      event.payload?.acsURL,
      event.payload?.relayState || '',
      event.payload?.requestID,
      event.payload?.binding,
      event.payload?.issuer,
      event.payload?.destination,
      event.payload?.responseIssuer || '',
      event.payload?.userID || null,  // Add user_id
      'added',
      event.createdAt,
      event.createdAt,
    ];
    
    const query = `
      INSERT INTO projections.saml_requests (
        instance_id,
        id,
        login_client,
        application_id,
        acs_url,
        relay_state,
        request_id,
        binding,
        issuer,
        destination,
        response_issuer,
        user_id,
        state,
        creation_date,
        change_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        login_client = EXCLUDED.login_client,
        application_id = EXCLUDED.application_id,
        acs_url = EXCLUDED.acs_url,
        relay_state = EXCLUDED.relay_state,
        request_id = EXCLUDED.request_id,
        binding = EXCLUDED.binding,
        issuer = EXCLUDED.issuer,
        destination = EXCLUDED.destination,
        response_issuer = EXCLUDED.response_issuer,
        user_id = EXCLUDED.user_id,
        state = EXCLUDED.state,
        change_date = EXCLUDED.change_date
    `;

    await this.database.query(query, params);
  }

  /**
   * Handle saml.request.session.linked event
   */
  private async handleSessionLinked(event: Event): Promise<void> {
    const query = `
      UPDATE projections.saml_requests
      SET
        session_id = $1,
        user_id = $2,
        auth_methods = $3,
        auth_time = $4,
        change_date = $5
      WHERE instance_id = $6
        AND id = $7
    `;

    const authMethods = event.payload?.authMethods || [];

    await this.database.query(query, [
      event.payload?.sessionID,
      event.payload?.userID,
      authMethods,
      event.payload?.authTime ? new Date(event.payload.authTime) : null,
      event.createdAt,
      event.instanceID,
      event.aggregateID,
    ]);
  }

  /**
   * Handle saml.request.succeeded event
   */
  private async handleRequestSucceeded(event: Event): Promise<void> {
    const query = `
      UPDATE projections.saml_requests
      SET
        state = $1,
        change_date = $2
      WHERE instance_id = $3
        AND id = $4
    `;

    await this.database.query(query, [
      'succeeded',
      event.createdAt,
      event.instanceID,
      event.aggregateID,
    ]);
  }

  /**
   * Handle saml.request.failed event
   */
  private async handleRequestFailed(event: Event): Promise<void> {
    const query = `
      UPDATE projections.saml_requests
      SET
        state = $1,
        error_reason = $2,
        error_description = $3,
        change_date = $4
      WHERE instance_id = $5
        AND id = $6
    `;

    await this.database.query(query, [
      'failed',
      event.payload?.errorReason || null,
      event.payload?.errorDescription || null,
      event.createdAt,
      event.instanceID,
      event.aggregateID,
    ]);
  }
}
