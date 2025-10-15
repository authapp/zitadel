/**
 * Application Projection
 * 
 * Materializes application events (OIDC, SAML, API) into read models
 * Based on Zitadel Go internal/query/projection/app.go
 */

import { Event } from '../../eventstore/types';
import { Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database/pool';
import { Projection } from '../projection/projection';
import { ProjectionConfig } from '../projection/projection-config';

/**
 * Application Projection - materializes app events into read model
 */
export class AppProjection extends Projection {
  readonly name = 'app_projection';
  readonly tables = ['applications_projection'];

  /**
   * Initialize the projection
   */
  async init(): Promise<void> {
    // Table already exists from migrations
  }

  /**
   * Reduce a single event into the projection
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      // OIDC Application Events
      case 'project.application.oidc.added':
        await this.handleOIDCAppAdded(event);
        break;
      
      case 'project.application.oidc.changed':
        await this.handleOIDCAppChanged(event);
        break;
      
      case 'project.application.oidc.secret.changed':
        await this.handleOIDCSecretChanged(event);
        break;
      
      // SAML Application Events
      case 'project.application.saml.added':
        await this.handleSAMLAppAdded(event);
        break;
      
      case 'project.application.saml.changed':
        await this.handleSAMLAppChanged(event);
        break;
      
      // API Application Events
      case 'project.application.api.added':
        await this.handleAPIAppAdded(event);
        break;
      
      case 'project.application.api.changed':
        await this.handleAPIAppChanged(event);
        break;
      
      case 'project.application.api.secret.changed':
        await this.handleAPISecretChanged(event);
        break;
      
      // Generic Application Events
      case 'project.application.changed':
        await this.handleAppChanged(event);
        break;
      
      case 'project.application.deactivated':
        await this.handleAppDeactivated(event);
        break;
      
      case 'project.application.reactivated':
        await this.handleAppReactivated(event);
        break;
      
      case 'project.application.removed':
        await this.handleAppRemoved(event);
        break;
    }
  }

  private async handleOIDCAppAdded(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `INSERT INTO applications_projection (
        id, project_id, name, state, app_type,
        client_id, client_secret, redirect_uris, response_types, grant_types,
        oidc_app_type, auth_method_type, post_logout_redirect_uris,
        version, dev_mode, access_token_type,
        access_token_role_assertion, id_token_role_assertion, id_token_userinfo_assertion,
        clock_skew, additional_origins, skip_native_app_success_page,
        created_at, updated_at, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        client_id = EXCLUDED.client_id,
        client_secret = EXCLUDED.client_secret,
        redirect_uris = EXCLUDED.redirect_uris,
        response_types = EXCLUDED.response_types,
        grant_types = EXCLUDED.grant_types,
        oidc_app_type = EXCLUDED.oidc_app_type,
        auth_method_type = EXCLUDED.auth_method_type,
        post_logout_redirect_uris = EXCLUDED.post_logout_redirect_uris,
        version = EXCLUDED.version,
        dev_mode = EXCLUDED.dev_mode,
        access_token_type = EXCLUDED.access_token_type,
        access_token_role_assertion = EXCLUDED.access_token_role_assertion,
        id_token_role_assertion = EXCLUDED.id_token_role_assertion,
        id_token_userinfo_assertion = EXCLUDED.id_token_userinfo_assertion,
        clock_skew = EXCLUDED.clock_skew,
        additional_origins = EXCLUDED.additional_origins,
        skip_native_app_success_page = EXCLUDED.skip_native_app_success_page,
        updated_at = EXCLUDED.updated_at,
        sequence = EXCLUDED.sequence`,
      [
        payload.appId || event.aggregateID,
        payload.projectId || event.aggregateID,
        payload.name,
        'active',
        'oidc',
        payload.clientId,
        payload.clientSecret || null,
        JSON.stringify(payload.redirectUris || []),
        JSON.stringify(payload.responseTypes || ['code']),
        JSON.stringify(payload.grantTypes || ['authorization_code']),
        payload.appType || 'web',
        payload.authMethodType || 'basic',
        JSON.stringify(payload.postLogoutRedirectUris || []),
        payload.version || 1,
        payload.devMode || false,
        payload.accessTokenType || 'bearer',
        payload.accessTokenRoleAssertion || false,
        payload.idTokenRoleAssertion || false,
        payload.idTokenUserinfoAssertion || false,
        payload.clockSkew || 0,
        JSON.stringify(payload.additionalOrigins || []),
        payload.skipNativeAppSuccessPage || false,
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleOIDCAppChanged(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `UPDATE applications_projection SET
        name = COALESCE($2, name),
        redirect_uris = COALESCE($3, redirect_uris),
        response_types = COALESCE($4, response_types),
        grant_types = COALESCE($5, grant_types),
        oidc_app_type = COALESCE($6, oidc_app_type),
        auth_method_type = COALESCE($7, auth_method_type),
        post_logout_redirect_uris = COALESCE($8, post_logout_redirect_uris),
        dev_mode = COALESCE($9, dev_mode),
        access_token_type = COALESCE($10, access_token_type),
        access_token_role_assertion = COALESCE($11, access_token_role_assertion),
        id_token_role_assertion = COALESCE($12, id_token_role_assertion),
        id_token_userinfo_assertion = COALESCE($13, id_token_userinfo_assertion),
        clock_skew = COALESCE($14, clock_skew),
        additional_origins = COALESCE($15, additional_origins),
        skip_native_app_success_page = COALESCE($16, skip_native_app_success_page),
        updated_at = $17,
        sequence = $18
      WHERE id = $1 AND app_type = 'oidc'`,
      [
        payload.appId || event.aggregateID,
        payload.name,
        payload.redirectUris ? JSON.stringify(payload.redirectUris) : null,
        payload.responseTypes ? JSON.stringify(payload.responseTypes) : null,
        payload.grantTypes ? JSON.stringify(payload.grantTypes) : null,
        payload.appType,
        payload.authMethodType,
        payload.postLogoutRedirectUris ? JSON.stringify(payload.postLogoutRedirectUris) : null,
        payload.devMode,
        payload.accessTokenType,
        payload.accessTokenRoleAssertion,
        payload.idTokenRoleAssertion,
        payload.idTokenUserinfoAssertion,
        payload.clockSkew,
        payload.additionalOrigins ? JSON.stringify(payload.additionalOrigins) : null,
        payload.skipNativeAppSuccessPage,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleOIDCSecretChanged(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `UPDATE applications_projection SET
        client_secret = $2,
        updated_at = $3,
        sequence = $4
      WHERE id = $1 AND app_type = 'oidc'`,
      [
        payload.appId || event.aggregateID,
        payload.clientSecret,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleSAMLAppAdded(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `INSERT INTO applications_projection (
        id, project_id, name, state, app_type,
        entity_id, metadata_url, metadata, acs_urls,
        single_logout_url, name_id_format, attribute_statements,
        created_at, updated_at, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        entity_id = EXCLUDED.entity_id,
        metadata_url = EXCLUDED.metadata_url,
        metadata = EXCLUDED.metadata,
        acs_urls = EXCLUDED.acs_urls,
        single_logout_url = EXCLUDED.single_logout_url,
        name_id_format = EXCLUDED.name_id_format,
        attribute_statements = EXCLUDED.attribute_statements,
        updated_at = EXCLUDED.updated_at,
        sequence = EXCLUDED.sequence`,
      [
        payload.appId || event.aggregateID,
        payload.projectId || event.aggregateID,
        payload.name,
        'active',
        'saml',
        payload.entityId,
        payload.metadataUrl || null,
        payload.metadata || null,
        JSON.stringify(payload.acsUrls || []),
        payload.singleLogoutUrl || null,
        payload.nameIdFormat || null,
        payload.attributeStatements ? JSON.stringify(payload.attributeStatements) : null,
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleSAMLAppChanged(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `UPDATE applications_projection SET
        name = COALESCE($2, name),
        entity_id = COALESCE($3, entity_id),
        metadata_url = COALESCE($4, metadata_url),
        metadata = COALESCE($5, metadata),
        acs_urls = COALESCE($6, acs_urls),
        single_logout_url = COALESCE($7, single_logout_url),
        name_id_format = COALESCE($8, name_id_format),
        attribute_statements = COALESCE($9, attribute_statements),
        updated_at = $10,
        sequence = $11
      WHERE id = $1 AND app_type = 'saml'`,
      [
        payload.appId || event.aggregateID,
        payload.name,
        payload.entityId,
        payload.metadataUrl,
        payload.metadata,
        payload.acsUrls ? JSON.stringify(payload.acsUrls) : null,
        payload.singleLogoutUrl,
        payload.nameIdFormat,
        payload.attributeStatements ? JSON.stringify(payload.attributeStatements) : null,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleAPIAppAdded(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `INSERT INTO applications_projection (
        id, project_id, name, state, app_type,
        client_id, client_secret, auth_method_type,
        created_at, updated_at, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        client_id = EXCLUDED.client_id,
        client_secret = EXCLUDED.client_secret,
        auth_method_type = EXCLUDED.auth_method_type,
        updated_at = EXCLUDED.updated_at,
        sequence = EXCLUDED.sequence`,
      [
        payload.appId || event.aggregateID,
        payload.projectId || event.aggregateID,
        payload.name,
        'active',
        'api',
        payload.clientId,
        payload.clientSecret || null,
        payload.authMethodType || 'basic',
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleAPIAppChanged(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `UPDATE applications_projection SET
        name = COALESCE($2, name),
        auth_method_type = COALESCE($3, auth_method_type),
        updated_at = $4,
        sequence = $5
      WHERE id = $1 AND app_type = 'api'`,
      [
        payload.appId || event.aggregateID,
        payload.name,
        payload.authMethodType,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleAPISecretChanged(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `UPDATE applications_projection SET
        client_secret = $2,
        updated_at = $3,
        sequence = $4
      WHERE id = $1 AND app_type = 'api'`,
      [
        payload.appId || event.aggregateID,
        payload.clientSecret,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleAppChanged(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `UPDATE applications_projection SET
        name = COALESCE($2, name),
        updated_at = $3,
        sequence = $4
      WHERE id = $1`,
      [
        payload.appId || event.aggregateID,
        payload.name,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleAppDeactivated(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `UPDATE applications_projection SET
        state = 'inactive',
        updated_at = $2,
        sequence = $3
      WHERE id = $1`,
      [
        payload.appId || event.aggregateID,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleAppReactivated(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `UPDATE applications_projection SET
        state = 'active',
        updated_at = $2,
        sequence = $3
      WHERE id = $1`,
      [
        payload.appId || event.aggregateID,
        event.createdAt,
        Math.floor(event.position.position),
      ]
    );
  }

  private async handleAppRemoved(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    await this.database.query(
      `DELETE FROM applications_projection WHERE id = $1`,
      [payload.appId || event.aggregateID]
    );
  }
}

/**
 * Create app projection instance
 */
export function createAppProjection(
  eventstore: Eventstore,
  database: DatabasePool
): AppProjection {
  return new AppProjection(eventstore, database);
}

/**
 * Create app projection configuration
 */
export function createAppProjectionConfig(): ProjectionConfig {
  return {
    name: 'app_projection',
    tables: ['applications_projection'],
    eventTypes: [
      'project.application.oidc.added',
      'project.application.oidc.changed',
      'project.application.oidc.secret.changed',
      'project.application.saml.added',
      'project.application.saml.changed',
      'project.application.api.added',
      'project.application.api.changed',
      'project.application.api.secret.changed',
      'project.application.changed',
      'project.application.deactivated',
      'project.application.reactivated',
      'project.application.removed',
    ],
    aggregateTypes: ['project'],
    batchSize: 100,
    interval: 1000,
    enableLocking: false,
  };
}
