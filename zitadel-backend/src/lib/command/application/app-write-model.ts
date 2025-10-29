/**
 * Application Write Model
 * 
 * Tracks application aggregate state for command execution
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';
import { 
  AppState,
  AppType,
  OIDCApplicationType as OIDCAppType,
  OIDCAuthMethodType,
  isAppActive,
  isAppStateExists as appExists,
  isAppStateInactive
} from '../../domain/project';

// Re-export for backward compatibility
export { AppState, AppType, OIDCAppType, OIDCAuthMethodType };

/**
 * Application write model
 */
export class AppWriteModel extends WriteModel {
  state: AppState = AppState.UNSPECIFIED;
  appType: AppType = AppType.UNSPECIFIED;
  name?: string;
  projectID?: string;
  
  // OIDC specific
  oidcAppType?: OIDCAppType;
  redirectURIs: string[] = [];
  responseTypes: string[] = [];
  grantTypes: string[] = [];
  applicationType?: OIDCAppType;
  authMethodType?: OIDCAuthMethodType;
  postLogoutRedirectURIs: string[] = [];
  devMode: boolean = false;
  accessTokenType?: number;
  accessTokenRoleAssertion: boolean = false;
  idTokenRoleAssertion: boolean = false;
  idTokenUserinfoAssertion: boolean = false;
  clockSkew?: number;
  additionalOrigins: string[] = [];
  
  // API specific
  apiAuthMethodType?: OIDCAuthMethodType;
  
  // SAML specific
  samlMetadata?: string;
  samlMetadataURL?: string;
  
  constructor() {
    super('application');
  }
  
  reduce(event: Event): void {
    switch (event.eventType) {
      // OIDC App events
      case 'application.oidc.added':
      case 'project.application.added':
        this.state = AppState.ACTIVE;
        this.appType = AppType.OIDC;
        this.name = event.payload?.name;
        this.projectID = event.payload?.projectID;
        this.oidcAppType = event.payload?.oidcAppType;
        this.redirectURIs = event.payload?.redirectURIs || [];
        this.responseTypes = event.payload?.responseTypes || [];
        this.grantTypes = event.payload?.grantTypes || [];
        this.authMethodType = event.payload?.authMethodType;
        this.postLogoutRedirectURIs = event.payload?.postLogoutRedirectURIs || [];
        this.devMode = event.payload?.devMode ?? false;
        this.accessTokenType = event.payload?.accessTokenType;
        this.accessTokenRoleAssertion = event.payload?.accessTokenRoleAssertion ?? false;
        this.idTokenRoleAssertion = event.payload?.idTokenRoleAssertion ?? false;
        this.idTokenUserinfoAssertion = event.payload?.idTokenUserinfoAssertion ?? false;
        this.clockSkew = event.payload?.clockSkew;
        this.additionalOrigins = event.payload?.additionalOrigins || [];
        break;
        
      case 'application.oidc.changed':
      case 'application.oidc.config.changed':
      case 'project.application.changed':
        if (event.payload?.name !== undefined) {
          this.name = event.payload.name;
        }
        if (event.payload?.redirectURIs !== undefined) {
          this.redirectURIs = event.payload.redirectURIs;
        }
        if (event.payload?.responseTypes !== undefined) {
          this.responseTypes = event.payload.responseTypes;
        }
        if (event.payload?.grantTypes !== undefined) {
          this.grantTypes = event.payload.grantTypes;
        }
        if (event.payload?.authMethodType !== undefined) {
          this.authMethodType = event.payload.authMethodType;
        }
        if (event.payload?.oidcAppType !== undefined) {
          this.oidcAppType = event.payload.oidcAppType;
        }
        if (event.payload?.postLogoutRedirectURIs !== undefined) {
          this.postLogoutRedirectURIs = event.payload.postLogoutRedirectURIs;
        }
        if (event.payload?.devMode !== undefined) {
          this.devMode = event.payload.devMode;
        }
        if (event.payload?.accessTokenType !== undefined) {
          this.accessTokenType = event.payload.accessTokenType;
        }
        if (event.payload?.accessTokenRoleAssertion !== undefined) {
          this.accessTokenRoleAssertion = event.payload.accessTokenRoleAssertion;
        }
        if (event.payload?.idTokenRoleAssertion !== undefined) {
          this.idTokenRoleAssertion = event.payload.idTokenRoleAssertion;
        }
        if (event.payload?.idTokenUserinfoAssertion !== undefined) {
          this.idTokenUserinfoAssertion = event.payload.idTokenUserinfoAssertion;
        }
        if (event.payload?.clockSkew !== undefined) {
          this.clockSkew = event.payload.clockSkew;
        }
        if (event.payload?.additionalOrigins !== undefined) {
          this.additionalOrigins = event.payload.additionalOrigins;
        }
        break;
        
      // API App events
      case 'application.api.added':
        this.state = AppState.ACTIVE;
        this.appType = AppType.API;
        this.name = event.payload?.name;
        this.projectID = event.payload?.projectID;
        this.apiAuthMethodType = event.payload?.authMethodType;
        break;
        
      case 'application.api.changed':
      case 'application.api.config.changed':
        if (event.payload?.name !== undefined) {
          this.name = event.payload.name;
        }
        if (event.payload?.authMethodType !== undefined) {
          this.apiAuthMethodType = event.payload.authMethodType;
        }
        break;
        
      // SAML App events
      case 'application.added':
        // Generic application.added event (used by SAML)
        this.state = AppState.ACTIVE;
        this.name = event.payload?.name;
        this.projectID = event.payload?.projectID;
        break;
        
      case 'application.saml.config.added':
        this.appType = AppType.SAML;
        this.samlMetadata = event.payload?.metadata;
        this.samlMetadataURL = event.payload?.metadataURL;
        break;
        
      case 'application.saml.config.changed':
        if (event.payload?.metadata !== undefined) {
          this.samlMetadata = event.payload.metadata;
        }
        if (event.payload?.metadataURL !== undefined) {
          this.samlMetadataURL = event.payload.metadataURL;
        }
        break;
        
      // Common events
      case 'application.deactivated':
      case 'project.application.deactivated':
        this.state = AppState.INACTIVE;
        break;
        
      case 'application.reactivated':
      case 'project.application.reactivated':
        this.state = AppState.ACTIVE;
        break;
        
      case 'application.secret.changed':
      case 'application.key.added':
        // These don't change the write model state
        // but we acknowledge them for completeness
        break;
    }
  }
}

/**
 * Helper functions for app state
 * These mirror Go's command helpers
 */

export function isAppStateExists(state: AppState): boolean {
  return appExists(state);
}

export { isAppActive as isAppStateActive, isAppStateInactive };
