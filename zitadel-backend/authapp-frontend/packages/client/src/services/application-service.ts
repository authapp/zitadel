import { HttpClient } from '../lib/http-client';
import {
  AddOIDCAppRequest,
  AddOIDCAppResponse,
  AddAPIAppRequest,
  AddAPIAppResponse,
  GetAppByIdResponse,
  ListAppsResponse,
} from '../types/application';
import { ObjectDetails } from '../types/common';

export class ApplicationService {
  constructor(private client: HttpClient) {}

  /**
   * Get application by ID
   */
  async getAppById(projectId: string, appId: string): Promise<GetAppByIdResponse> {
    return this.client.post('/zitadel.app.v2.AppService/GetAppByID', {
      projectId,
      appId,
    });
  }

  /**
   * List applications
   */
  async listApps(
    projectId: string,
    query?: { offset?: number; limit?: number; asc?: boolean }
  ): Promise<ListAppsResponse> {
    return this.client.post('/zitadel.app.v2.AppService/ListApps', {
      projectId,
      query,
    });
  }

  /**
   * Add OIDC application
   */
  async addOIDCApp(request: AddOIDCAppRequest): Promise<AddOIDCAppResponse> {
    return this.client.post('/zitadel.app.v2.AppService/AddOIDCApp', request);
  }

  /**
   * Add API application
   */
  async addAPIApp(request: AddAPIAppRequest): Promise<AddAPIAppResponse> {
    return this.client.post('/zitadel.app.v2.AppService/AddAPIApp', request);
  }

  /**
   * Update OIDC app config
   */
  async updateOIDCAppConfig(
    projectId: string,
    appId: string,
    config: Partial<AddOIDCAppRequest>
  ): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.app.v2.AppService/UpdateOIDCAppConfig', {
      projectId,
      appId,
      ...config,
    });
  }

  /**
   * Update API app config
   */
  async updateAPIAppConfig(
    projectId: string,
    appId: string,
    authMethodType: number
  ): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.app.v2.AppService/UpdateAPIAppConfig', {
      projectId,
      appId,
      authMethodType,
    });
  }

  /**
   * Deactivate application
   */
  async deactivateApp(projectId: string, appId: string): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.app.v2.AppService/DeactivateApp', {
      projectId,
      appId,
    });
  }

  /**
   * Reactivate application
   */
  async reactivateApp(projectId: string, appId: string): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.app.v2.AppService/ReactivateApp', {
      projectId,
      appId,
    });
  }

  /**
   * Remove application
   */
  async removeApp(projectId: string, appId: string): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.app.v2.AppService/RemoveApp', {
      projectId,
      appId,
    });
  }

  /**
   * Regenerate OIDC client secret
   */
  async regenerateOIDCClientSecret(
    projectId: string,
    appId: string
  ): Promise<{ details: ObjectDetails; clientSecret: string }> {
    return this.client.post('/zitadel.app.v2.AppService/RegenerateOIDCClientSecret', {
      projectId,
      appId,
    });
  }

  /**
   * Regenerate API client secret
   */
  async regenerateAPIClientSecret(
    projectId: string,
    appId: string
  ): Promise<{ details: ObjectDetails; clientSecret: string }> {
    return this.client.post('/zitadel.app.v2.AppService/RegenerateAPIClientSecret', {
      projectId,
      appId,
    });
  }
}
