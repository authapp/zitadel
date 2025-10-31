/**
 * Application Service Implementation (v2)
 * 
 * gRPC service handlers for application management
 * Based on: internal/api/grpc/app/v2/app.go
 */

import { Commands } from '@/lib/command/commands';
import { Context } from '@/lib/command/context';
import { 
  AddOIDCAppRequest,
  AddOIDCAppResponse,
  AddAPIAppRequest,
  AddAPIAppResponse,
  AddSAMLAppRequest,
  AddSAMLAppResponse,
  UpdateOIDCAppRequest,
  UpdateOIDCAppResponse,
  UpdateAPIAppRequest,
  UpdateAPIAppResponse,
  DeactivateAppRequest,
  DeactivateAppResponse,
  ReactivateAppRequest,
  ReactivateAppResponse,
  RemoveAppRequest,
  RemoveAppResponse,
  RegenerateAppSecretRequest,
  RegenerateAppSecretResponse,
} from '../../proto/app/v2/app_service';
import { throwInvalidArgument } from '@/zerrors/errors';

/**
 * Convert object details to proto Details
 */
function objectDetailsToDetailsProto(details: any): any {
  return {
    sequence: details.sequence,
    changeDate: details.eventDate,
    resourceOwner: details.resourceOwner,
  };
}

/**
 * Application Service
 */
export class ApplicationService {
  constructor(
    private readonly commands: Commands
  ) {}

  // ====================================================================
  // OIDC APPLICATIONS
  // ====================================================================

  /**
   * AddOIDCApp - Create OIDC application
   */
  async addOIDCApp(
    ctx: Context,
    request: AddOIDCAppRequest
  ): Promise<AddOIDCAppResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'APPv2-001');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'APPv2-002');
    }
    if (!request.name || request.name.trim().length === 0) {
      throwInvalidArgument('name is required', 'APPv2-003');
    }
    if (!request.redirectUris || request.redirectUris.length === 0) {
      throwInvalidArgument('at least one redirectUri is required', 'APPv2-004');
    }

    const result = await this.commands.addOIDCApp(ctx, {
      projectID: request.projectId,
      orgID: request.organizationId,
      name: request.name,
      oidcAppType: request.oidcAppType as any,
      redirectURIs: request.redirectUris,
      responseTypes: request.responseTypes,
      grantTypes: request.grantTypes,
      authMethodType: request.authMethodType as any,
      postLogoutRedirectURIs: request.postLogoutRedirectUris,
      devMode: request.devMode,
      accessTokenType: request.accessTokenType,
      accessTokenRoleAssertion: request.accessTokenRoleAssertion,
      idTokenRoleAssertion: request.idTokenRoleAssertion,
      idTokenUserinfoAssertion: request.idTokenUserinfoAssertion,
      clockSkew: request.clockSkew,
      additionalOrigins: request.additionalOrigins,
    });

    return {
      details: objectDetailsToDetailsProto(result),
      appId: result.appID,
      clientId: result.appID, // App ID is used as client ID
      clientSecret: (result as any).clientSecret,
    };
  }

  /**
   * UpdateOIDCApp - Update OIDC application
   */
  async updateOIDCApp(
    ctx: Context,
    request: UpdateOIDCAppRequest
  ): Promise<UpdateOIDCAppResponse> {
    if (!request.appId) {
      throwInvalidArgument('appId is required', 'APPv2-010');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'APPv2-011');
    }

    // Note: updateOIDCApp requires projectId but we don't have it in the request
    // This is a limitation - in production, we'd need to fetch the project from the app
    const details = await this.commands.updateOIDCApp(
      ctx,
      request.appId,
      '', // projectID - would need to be fetched
      request.organizationId,
      {
        redirectURIs: request.redirectUris,
        responseTypes: request.responseTypes,
        grantTypes: request.grantTypes,
        authMethodType: request.authMethodType as any,
        postLogoutRedirectURIs: request.postLogoutRedirectUris,
        devMode: request.devMode,
        accessTokenType: request.accessTokenType,
        accessTokenRoleAssertion: request.accessTokenRoleAssertion,
        idTokenRoleAssertion: request.idTokenRoleAssertion,
        idTokenUserinfoAssertion: request.idTokenUserinfoAssertion,
        clockSkew: request.clockSkew,
        additionalOrigins: request.additionalOrigins,
      }
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  // ====================================================================
  // API APPLICATIONS
  // ====================================================================

  /**
   * AddAPIApp - Create API application
   */
  async addAPIApp(
    ctx: Context,
    request: AddAPIAppRequest
  ): Promise<AddAPIAppResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'APPv2-020');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'APPv2-021');
    }
    if (!request.name || request.name.trim().length === 0) {
      throwInvalidArgument('name is required', 'APPv2-022');
    }
    if (!request.authMethodType) {
      throwInvalidArgument('authMethodType is required', 'APPv2-023');
    }

    const result = await this.commands.addAPIApp(ctx, {
      projectID: request.projectId,
      orgID: request.organizationId,
      name: request.name,
      authMethodType: request.authMethodType as any,
    });

    return {
      details: objectDetailsToDetailsProto(result),
      appId: result.appID,
      clientId: result.appID,
      clientSecret: (result as any).clientSecret,
    };
  }

  /**
   * UpdateAPIApp - Update API application
   */
  async updateAPIApp(
    ctx: Context,
    request: UpdateAPIAppRequest
  ): Promise<UpdateAPIAppResponse> {
    if (!request.appId) {
      throwInvalidArgument('appId is required', 'APPv2-030');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'APPv2-031');
    }
    if (!request.authMethodType) {
      throwInvalidArgument('authMethodType is required', 'APPv2-032');
    }

    // Note: updateAPIApp requires projectId but we don't have it in the request
    const details = await this.commands.updateAPIApp(
      ctx,
      request.appId,
      '', // projectID - would need to be fetched
      request.organizationId,
      { authMethodType: request.authMethodType as any }
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  // ====================================================================
  // SAML APPLICATIONS
  // ====================================================================

  /**
   * AddSAMLApp - Create SAML application
   */
  async addSAMLApp(
    ctx: Context,
    request: AddSAMLAppRequest
  ): Promise<AddSAMLAppResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'APPv2-040');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'APPv2-041');
    }
    if (!request.name || request.name.trim().length === 0) {
      throwInvalidArgument('name is required', 'APPv2-042');
    }

    const result = await this.commands.addSAMLApp(ctx, {
      projectID: request.projectId,
      name: request.name,
      metadata: request.entityId || '', // SAML metadata XML
      metadataURL: request.metadataUrl,
    });

    return {
      details: objectDetailsToDetailsProto(result),
      appId: result.appID,
    };
  }

  // ====================================================================
  // APPLICATION LIFECYCLE
  // ====================================================================

  /**
   * DeactivateApp - Deactivate an application
   */
  async deactivateApp(
    ctx: Context,
    request: DeactivateAppRequest
  ): Promise<DeactivateAppResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'APPv2-050');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'APPv2-051');
    }
    if (!request.appId) {
      throwInvalidArgument('appId is required', 'APPv2-052');
    }

    const details = await this.commands.deactivateApplication(
      ctx,
      request.projectId,
      request.appId
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * ReactivateApp - Reactivate an application
   */
  async reactivateApp(
    ctx: Context,
    request: ReactivateAppRequest
  ): Promise<ReactivateAppResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'APPv2-060');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'APPv2-061');
    }
    if (!request.appId) {
      throwInvalidArgument('appId is required', 'APPv2-062');
    }

    const details = await this.commands.reactivateApplication(
      ctx,
      request.projectId,
      request.appId
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * RemoveApp - Remove/delete an application
   */
  async removeApp(
    ctx: Context,
    request: RemoveAppRequest
  ): Promise<RemoveAppResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'APPv2-070');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'APPv2-071');
    }
    if (!request.appId) {
      throwInvalidArgument('appId is required', 'APPv2-072');
    }

    const details = await this.commands.removeApplication(
      ctx,
      request.projectId,
      request.appId
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * RegenerateAppSecret - Regenerate application secret
   */
  async regenerateAppSecret(
    ctx: Context,
    request: RegenerateAppSecretRequest
  ): Promise<RegenerateAppSecretResponse> {
    if (!request.appId) {
      throwInvalidArgument('appId is required', 'APPv2-080');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'APPv2-081');
    }

    // Note: changeAppSecret requires projectId but we don't have it in request
    const result = await this.commands.changeAppSecret(
      ctx,
      request.appId,
      '', // projectID - would need to be fetched
      request.organizationId
    );

    return {
      details: objectDetailsToDetailsProto(result),
      clientSecret: (result as any).clientSecret || '',
    };
  }
}
