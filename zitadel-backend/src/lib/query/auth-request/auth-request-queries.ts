/**
 * Auth Request queries for Zitadel query layer
 * Handles authentication request lookups for OAuth/OIDC flows
 */

import { DatabasePool } from '../../database';
import {
  AuthRequest,
  AuthRequestSearchQuery,
  AuthRequestSearchResult,
  CodeChallenge,
} from './auth-request-types';

export class AuthRequestQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get auth request by ID
   * 
   * @param authRequestID - The auth request ID
   * @param instanceID - The instance ID (optional for filtering)
   * @returns The auth request or null if not found
   */
  async getAuthRequestByID(
    authRequestID: string,
    instanceID?: string
  ): Promise<AuthRequest | null> {
    const conditions = ['ar.id = $1'];
    const params: any[] = [authRequestID];

    if (instanceID) {
      conditions.push('ar.instance_id = $2');
      params.push(instanceID);
    }

    const query = `
      SELECT 
        ar.id,
        ar.creation_date,
        ar.change_date,
        ar.sequence,
        ar.resource_owner,
        ar.instance_id,
        ar.login_client,
        ar.client_id,
        ar.redirect_uri,
        ar.state,
        ar.nonce,
        ar.scope,
        ar.audience,
        ar.response_type,
        ar.response_mode,
        ar.code_challenge,
        ar.code_challenge_method,
        ar.prompt,
        ar.ui_locales,
        ar.max_age,
        ar.login_hint,
        ar.hint_user_id,
        ar.need_refresh_token,
        ar.session_id,
        ar.user_id,
        ar.auth_time,
        ar.auth_methods,
        ar.code,
        ar.issuer
      FROM projections.auth_requests ar
      WHERE ${conditions.join(' AND ')}
      LIMIT 1
    `;

    const row = await this.database.queryOne(query, params);
    if (!row) return null;

    return this.mapRowToAuthRequest(row);
  }

  /**
   * Get auth request by code
   * 
   * @param code - The authorization code
   * @param instanceID - The instance ID
   * @returns The auth request or null if not found
   */
  async getAuthRequestByCode(
    code: string,
    instanceID: string
  ): Promise<AuthRequest | null> {
    const query = `
      SELECT 
        ar.id,
        ar.creation_date,
        ar.change_date,
        ar.sequence,
        ar.resource_owner,
        ar.instance_id,
        ar.login_client,
        ar.client_id,
        ar.redirect_uri,
        ar.state,
        ar.nonce,
        ar.scope,
        ar.audience,
        ar.response_type,
        ar.response_mode,
        ar.code_challenge,
        ar.code_challenge_method,
        ar.prompt,
        ar.ui_locales,
        ar.max_age,
        ar.login_hint,
        ar.hint_user_id,
        ar.need_refresh_token,
        ar.session_id,
        ar.user_id,
        ar.auth_time,
        ar.auth_methods,
        ar.code,
        ar.issuer
      FROM projections.auth_requests ar
      WHERE ar.code = $1 AND ar.instance_id = $2
      LIMIT 1
    `;

    const row = await this.database.queryOne(query, [code, instanceID]);
    if (!row) return null;

    return this.mapRowToAuthRequest(row);
  }

  /**
   * Search auth requests with filters
   * 
   * @param searchQuery - The search criteria
   * @returns Paginated auth request results
   */
  async searchAuthRequests(
    searchQuery: AuthRequestSearchQuery
  ): Promise<AuthRequestSearchResult> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (searchQuery.instanceID) {
      conditions.push(`ar.instance_id = $${paramIndex++}`);
      params.push(searchQuery.instanceID);
    }

    if (searchQuery.clientID) {
      conditions.push(`ar.client_id = $${paramIndex++}`);
      params.push(searchQuery.clientID);
    }

    if (searchQuery.userID) {
      conditions.push(`ar.user_id = $${paramIndex++}`);
      params.push(searchQuery.userID);
    }

    if (searchQuery.sessionID) {
      conditions.push(`ar.session_id = $${paramIndex++}`);
      params.push(searchQuery.sessionID);
    }

    if (searchQuery.state) {
      conditions.push(`ar.state = $${paramIndex++}`);
      params.push(searchQuery.state);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM projections.auth_requests ar ${whereClause}`;
    const countResult = await this.database.queryOne(countQuery, params);
    const total = parseInt(countResult?.count || '0', 10);

    // Get auth requests with pagination
    const limit = searchQuery.limit || 50;
    const offset = searchQuery.offset || 0;

    const query = `
      SELECT 
        ar.id,
        ar.creation_date,
        ar.change_date,
        ar.sequence,
        ar.resource_owner,
        ar.instance_id,
        ar.login_client,
        ar.client_id,
        ar.redirect_uri,
        ar.state,
        ar.nonce,
        ar.scope,
        ar.audience,
        ar.response_type,
        ar.response_mode,
        ar.code_challenge,
        ar.code_challenge_method,
        ar.prompt,
        ar.ui_locales,
        ar.max_age,
        ar.login_hint,
        ar.hint_user_id,
        ar.need_refresh_token,
        ar.session_id,
        ar.user_id,
        ar.auth_time,
        ar.auth_methods,
        ar.code,
        ar.issuer
      FROM projections.auth_requests ar
      ${whereClause}
      ORDER BY ar.creation_date DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const rows = await this.database.query(query, params);
    const authRequests = rows.rows.map((row: any) => this.mapRowToAuthRequest(row));

    return {
      total,
      authRequests,
      limit,
      offset,
    };
  }

  /**
   * Map database row to AuthRequest
   */
  private mapRowToAuthRequest(row: any): AuthRequest {
    const codeChallenge: CodeChallenge | undefined = row.code_challenge
      ? {
          challenge: row.code_challenge,
          method: row.code_challenge_method || 'S256',
        }
      : undefined;

    return {
      id: row.id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: parseInt(row.sequence, 10),
      resourceOwner: row.resource_owner,
      instanceID: row.instance_id,
      loginClient: row.login_client,
      clientID: row.client_id,
      redirectURI: row.redirect_uri,
      state: row.state,
      nonce: row.nonce,
      scope: row.scope || [],
      audience: row.audience || [],
      responseType: row.response_type,
      responseMode: row.response_mode,
      codeChallenge,
      prompt: row.prompt || [],
      uiLocales: row.ui_locales || [],
      maxAge: row.max_age,
      loginHint: row.login_hint,
      hintUserID: row.hint_user_id,
      needRefreshToken: row.need_refresh_token || false,
      sessionID: row.session_id,
      userID: row.user_id,
      authTime: row.auth_time,
      authMethods: row.auth_methods || [],
      code: row.code,
      issuer: row.issuer,
    };
  }
}
