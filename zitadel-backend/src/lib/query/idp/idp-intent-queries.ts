/**
 * IDP Intent Queries
 * 
 * Query layer for IDP intents (OAuth/OIDC/SAML callback state)
 * Used for validating callback state parameters and retrieving intent data
 */

import { DatabasePool } from '@/lib/database';

export interface IDPIntent {
  id: string;
  instanceID: string;
  idpID: string;
  idpType: 'oauth' | 'oidc' | 'saml';
  state: string;
  codeVerifier?: string;
  nonce?: string;
  redirectURI: string;
  authRequestID?: string;
  userID?: string;
  resourceOwner: string;
  createdAt: Date;
  expiresAt: Date;
  succeeded: boolean;
  succeededAt?: Date;
  succeededUserID?: string;
}

export class IDPIntentQueries {
  constructor(private readonly pool: DatabasePool) {}

  /**
   * Get IDP intent by state parameter
   * Used during callback validation
   */
  async getByState(
    state: string,
    instanceID: string
  ): Promise<IDPIntent | null> {
    const result = await this.pool.queryOne<{
      id: string;
      instance_id: string;
      idp_id: string;
      idp_type: string;
      state: string;
      code_verifier: string | null;
      nonce: string | null;
      redirect_uri: string;
      auth_request_id: string | null;
      user_id: string | null;
      resource_owner: string;
      created_at: Date;
      expires_at: Date;
      succeeded: boolean;
      succeeded_at: Date | null;
      succeeded_user_id: string | null;
    }>(
      `SELECT 
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
        succeeded,
        succeeded_at,
        succeeded_user_id
      FROM projections.idp_intents
      WHERE instance_id = $1
        AND state = $2
        AND succeeded = false
        AND expires_at > NOW()
      LIMIT 1`,
      [instanceID, state]
    );

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      instanceID: result.instance_id,
      idpID: result.idp_id,
      idpType: result.idp_type as 'oauth' | 'oidc' | 'saml',
      state: result.state,
      codeVerifier: result.code_verifier || undefined,
      nonce: result.nonce || undefined,
      redirectURI: result.redirect_uri,
      authRequestID: result.auth_request_id || undefined,
      userID: result.user_id || undefined,
      resourceOwner: result.resource_owner,
      createdAt: result.created_at,
      expiresAt: result.expires_at,
      succeeded: result.succeeded,
      succeededAt: result.succeeded_at || undefined,
      succeededUserID: result.succeeded_user_id || undefined,
    };
  }

  /**
   * Get IDP intent by ID
   */
  async getByID(
    id: string,
    instanceID: string
  ): Promise<IDPIntent | null> {
    const result = await this.pool.queryOne<{
      id: string;
      instance_id: string;
      idp_id: string;
      idp_type: string;
      state: string;
      code_verifier: string | null;
      nonce: string | null;
      redirect_uri: string;
      auth_request_id: string | null;
      user_id: string | null;
      resource_owner: string;
      created_at: Date;
      expires_at: Date;
      succeeded: boolean;
      succeeded_at: Date | null;
      succeeded_user_id: string | null;
    }>(
      `SELECT 
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
        succeeded,
        succeeded_at,
        succeeded_user_id
      FROM projections.idp_intents
      WHERE instance_id = $1
        AND id = $2
      LIMIT 1`,
      [instanceID, id]
    );

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      instanceID: result.instance_id,
      idpID: result.idp_id,
      idpType: result.idp_type as 'oauth' | 'oidc' | 'saml',
      state: result.state,
      codeVerifier: result.code_verifier || undefined,
      nonce: result.nonce || undefined,
      redirectURI: result.redirect_uri,
      authRequestID: result.auth_request_id || undefined,
      userID: result.user_id || undefined,
      resourceOwner: result.resource_owner,
      createdAt: result.created_at,
      expiresAt: result.expires_at,
      succeeded: result.succeeded,
      succeededAt: result.succeeded_at || undefined,
      succeededUserID: result.succeeded_user_id || undefined,
    };
  }

  /**
   * List active (non-expired, non-succeeded) intents for a user
   */
  async listActiveByUser(
    userID: string,
    instanceID: string
  ): Promise<IDPIntent[]> {
    const results = await this.pool.queryMany<{
      id: string;
      instance_id: string;
      idp_id: string;
      idp_type: string;
      state: string;
      code_verifier: string | null;
      nonce: string | null;
      redirect_uri: string;
      auth_request_id: string | null;
      user_id: string | null;
      resource_owner: string;
      created_at: Date;
      expires_at: Date;
      succeeded: boolean;
      succeeded_at: Date | null;
      succeeded_user_id: string | null;
    }>(
      `SELECT 
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
        succeeded,
        succeeded_at,
        succeeded_user_id
      FROM projections.idp_intents
      WHERE instance_id = $1
        AND user_id = $2
        AND succeeded = false
        AND expires_at > NOW()
      ORDER BY created_at DESC`,
      [instanceID, userID]
    );

    return results.map((result) => ({
      id: result.id,
      instanceID: result.instance_id,
      idpID: result.idp_id,
      idpType: result.idp_type as 'oauth' | 'oidc' | 'saml',
      state: result.state,
      codeVerifier: result.code_verifier || undefined,
      nonce: result.nonce || undefined,
      redirectURI: result.redirect_uri,
      authRequestID: result.auth_request_id || undefined,
      userID: result.user_id || undefined,
      resourceOwner: result.resource_owner,
      createdAt: result.created_at,
      expiresAt: result.expires_at,
      succeeded: result.succeeded,
      succeededAt: result.succeeded_at || undefined,
      succeededUserID: result.succeeded_user_id || undefined,
    }));
  }

  /**
   * Count expired intents (for cleanup monitoring)
   */
  async countExpired(instanceID: string): Promise<number> {
    const result = await this.pool.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM projections.idp_intents
       WHERE instance_id = $1
         AND expires_at < NOW()
         AND succeeded = false`,
      [instanceID]
    );

    return parseInt(result?.count || '0', 10);
  }
}
