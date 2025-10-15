/**
 * Application Queries
 * 
 * Query methods for applications (OIDC, SAML, API)
 * Based on Zitadel Go internal/query/app.go
 */

import { DatabasePool } from '../../database/pool';
import {
  App,
  AnyApp,
  OIDCApp,
  SAMLApp,
  APIApp,
  AppState,
  AppType,
  AppSearchFilters,
  AppSearchResult,
  ClientIDSearchResult,
  AppRow,
  OIDCAppRow,
  SAMLAppRow,
  APIAppRow,
  OIDCAppType,
  OIDCAuthMethodType,
} from './app-types';

export class AppQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get application by ID
   */
  async getAppByID(appId: string): Promise<AnyApp | null> {
    const result = await this.database.query<AppRow>(
      'SELECT * FROM applications_projection WHERE id = $1',
      [appId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToApp(result.rows[0]);
  }

  /**
   * Search applications with filters
   */
  async searchApps(filters: AppSearchFilters): Promise<AppSearchResult> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.projectId) {
      conditions.push(`project_id = $${paramIndex++}`);
      params.push(filters.projectId);
    }

    if (filters.name) {
      conditions.push(`name ILIKE $${paramIndex++}`);
      params.push(`%${filters.name}%`);
    }

    if (filters.state) {
      conditions.push(`state = $${paramIndex++}`);
      params.push(filters.state);
    }

    if (filters.type) {
      conditions.push(`app_type = $${paramIndex++}`);
      params.push(filters.type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.database.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM applications_projection ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count || '0');

    // Get paginated results
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    params.push(limit, offset);

    const result = await this.database.query<AppRow>(
      `SELECT * FROM applications_projection ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    const apps = result.rows.map(row => this.mapRowToApp(row));

    return {
      apps,
      total,
    };
  }

  /**
   * Search client IDs (for quick lookup)
   */
  async searchClientIDs(clientId: string): Promise<ClientIDSearchResult[]> {
    const result = await this.database.query<{
      client_id: string;
      project_id: string;
      id: string;
      app_type: string;
    }>(
      `SELECT client_id, project_id, id, app_type 
       FROM applications_projection 
       WHERE client_id ILIKE $1 
       AND app_type IN ('oidc', 'api')
       LIMIT 10`,
      [`%${clientId}%`]
    );

    return result.rows.map(row => ({
      clientId: row.client_id,
      projectId: row.project_id,
      appId: row.id,
      appType: row.app_type as AppType,
    }));
  }

  /**
   * Get OIDC app configuration
   */
  async getOIDCAppConfig(appId: string): Promise<OIDCApp | null> {
    const app = await this.getAppByID(appId);
    
    if (!app || app.type !== AppType.OIDC) {
      return null;
    }

    return app as OIDCApp;
  }

  /**
   * Get SAML app configuration
   */
  async getSAMLAppConfig(appId: string): Promise<SAMLApp | null> {
    const app = await this.getAppByID(appId);
    
    if (!app || app.type !== AppType.SAML) {
      return null;
    }

    return app as SAMLApp;
  }

  /**
   * Get API app configuration
   */
  async getAPIAppConfig(appId: string): Promise<APIApp | null> {
    const app = await this.getAppByID(appId);
    
    if (!app || app.type !== AppType.API) {
      return null;
    }

    return app as APIApp;
  }

  /**
   * Get application by client ID (OIDC/API apps)
   */
  async getAppByClientID(clientId: string): Promise<OIDCApp | APIApp | null> {
    const result = await this.database.query<AppRow>(
      `SELECT * FROM applications_projection 
       WHERE client_id = $1 
       AND app_type IN ('oidc', 'api')`,
      [clientId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToApp(result.rows[0]) as OIDCApp | APIApp;
  }

  /**
   * Search project IDs by client ID
   */
  async searchProjectIDsByClientID(clientId: string): Promise<string[]> {
    const result = await this.database.query<{ project_id: string }>(
      `SELECT DISTINCT project_id 
       FROM applications_projection 
       WHERE client_id = $1`,
      [clientId]
    );

    return result.rows.map(row => row.project_id);
  }

  /**
   * Check if application exists
   */
  async existsApp(appId: string): Promise<boolean> {
    const result = await this.database.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM applications_projection WHERE id = $1) as exists',
      [appId]
    );

    return result.rows[0]?.exists || false;
  }

  /**
   * Get project by OIDC client ID
   */
  async getProjectByOIDCClientID(clientId: string): Promise<string | null> {
    const result = await this.database.query<{ project_id: string }>(
      `SELECT project_id FROM applications_projection 
       WHERE client_id = $1 
       AND app_type = 'oidc'
       LIMIT 1`,
      [clientId]
    );

    return result.rows[0]?.project_id || null;
  }

  /**
   * Get project by any client ID (OIDC or API)
   */
  async getProjectByClientID(clientId: string): Promise<string | null> {
    const result = await this.database.query<{ project_id: string }>(
      `SELECT project_id FROM applications_projection 
       WHERE client_id = $1 
       AND app_type IN ('oidc', 'api')
       LIMIT 1`,
      [clientId]
    );

    return result.rows[0]?.project_id || null;
  }

  /**
   * Get API app by client ID
   */
  async getAPIAppByClientID(clientId: string): Promise<APIApp | null> {
    const result = await this.database.query<AppRow>(
      `SELECT * FROM applications_projection 
       WHERE client_id = $1 
       AND app_type = 'api'`,
      [clientId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToApp(result.rows[0]) as APIApp;
  }

  /**
   * Get OIDC app by client ID
   */
  async getOIDCAppByClientID(clientId: string): Promise<OIDCApp | null> {
    const result = await this.database.query<AppRow>(
      `SELECT * FROM applications_projection 
       WHERE client_id = $1 
       AND app_type = 'oidc'`,
      [clientId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToApp(result.rows[0]) as OIDCApp;
  }

  /**
   * Get SAML app by entity ID
   */
  async getSAMLAppByEntityID(entityId: string): Promise<SAMLApp | null> {
    const result = await this.database.query<AppRow>(
      `SELECT * FROM applications_projection 
       WHERE entity_id = $1 
       AND app_type = 'saml'`,
      [entityId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToApp(result.rows[0]) as SAMLApp;
  }

  /**
   * Map database row to appropriate App type
   */
  private mapRowToApp(row: AppRow): AnyApp {
    const baseApp: App = {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      state: row.state as AppState,
      type: row.app_type as AppType,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      sequence: BigInt(row.sequence),
    };

    switch (row.app_type) {
      case 'oidc':
        return this.mapToOIDCApp(baseApp, row as any as OIDCAppRow);
      case 'saml':
        return this.mapToSAMLApp(baseApp, row as any as SAMLAppRow);
      case 'api':
        return this.mapToAPIApp(baseApp, row as any as APIAppRow);
      default:
        throw new Error(`Unknown app type: ${row.app_type}`);
    }
  }

  private mapToOIDCApp(base: App, row: OIDCAppRow): OIDCApp {
    return {
      ...base,
      type: AppType.OIDC,
      config: {
        clientId: row.client_id,
        clientSecret: row.client_secret || undefined,
        redirectUris: this.parseJSON(row.redirect_uris),
        responseTypes: this.parseJSON(row.response_types),
        grantTypes: this.parseJSON(row.grant_types),
        appType: row.oidc_app_type as OIDCAppType,
        authMethodType: row.auth_method_type as OIDCAuthMethodType,
        postLogoutRedirectUris: this.parseJSON(row.post_logout_redirect_uris),
        version: row.version,
        devMode: row.dev_mode,
        accessTokenType: row.access_token_type as 'bearer' | 'jwt',
        accessTokenRoleAssertion: row.access_token_role_assertion,
        idTokenRoleAssertion: row.id_token_role_assertion,
        idTokenUserinfoAssertion: row.id_token_userinfo_assertion,
        clockSkew: row.clock_skew,
        additionalOrigins: this.parseJSON(row.additional_origins),
        skipNativeAppSuccessPage: row.skip_native_app_success_page,
      },
    };
  }

  private mapToSAMLApp(base: App, row: SAMLAppRow): SAMLApp {
    return {
      ...base,
      type: AppType.SAML,
      config: {
        entityId: row.entity_id,
        metadataUrl: row.metadata_url || undefined,
        metadata: row.metadata || undefined,
        acsUrls: this.parseJSON(row.acs_urls),
        singleLogoutUrl: row.single_logout_url || undefined,
        nameIdFormat: row.name_id_format || undefined,
        attributeStatements: row.attribute_statements ? this.parseJSON(row.attribute_statements) : undefined,
      },
    };
  }

  private mapToAPIApp(base: App, row: APIAppRow): APIApp {
    return {
      ...base,
      type: AppType.API,
      config: {
        clientId: row.client_id,
        clientSecret: row.client_secret || undefined,
        authMethodType: row.auth_method_type as OIDCAuthMethodType,
      },
    };
  }

  private parseJSON(value: string | null | undefined): any {
    if (!value) return [];
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return value;
  }
}
