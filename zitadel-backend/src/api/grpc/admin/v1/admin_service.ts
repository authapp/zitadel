/**
 * Admin Service Implementation (v1)
 * 
 * gRPC service handlers for system-level administration
 * Based on: internal/api/grpc/admin/server.go
 */

import { Commands } from '../../../../lib/command/commands';
import { Context } from '../../../../lib/command/context';
import { DatabasePool } from '../../../../lib/database';
import { InstanceQueries } from '../../../../lib/query/instance/instance-queries';
import { OrgQueries } from '../../../../lib/query/org/org-queries';
import {
  HealthzRequest,
  HealthzResponse,
  GetSupportedLanguagesRequest,
  GetSupportedLanguagesResponse,
  GetAllowedLanguagesRequest,
  GetAllowedLanguagesResponse,
  SetDefaultLanguageRequest,
  SetDefaultLanguageResponse,
  GetDefaultLanguageRequest,
  GetDefaultLanguageResponse,
  ListOrgsRequest,
  ListOrgsResponse,
  GetOrgByIDRequest,
  GetOrgByIDResponse,
  IsOrgUniqueRequest,
  IsOrgUniqueResponse,
  OrgState,
  ListSecretGeneratorsRequest,
  ListSecretGeneratorsResponse,
  GetSecretGeneratorRequest,
  GetSecretGeneratorResponse,
  UpdateSecretGeneratorRequest,
  UpdateSecretGeneratorResponse,
  GetSMTPConfigRequest,
  GetSMTPConfigResponse,
  UpdateSMTPConfigRequest,
  UpdateSMTPConfigResponse,
  SecretGeneratorType,
  SMTPConfigState,
  ListEmailProvidersRequest,
  ListEmailProvidersResponse,
  GetEmailProviderRequest,
  GetEmailProviderResponse,
  GetEmailProviderByIdRequest,
  GetEmailProviderByIdResponse,
  AddEmailProviderSMTPRequest,
  AddEmailProviderSMTPResponse,
  UpdateEmailProviderSMTPRequest,
  UpdateEmailProviderSMTPResponse,
  AddEmailProviderHTTPRequest,
  AddEmailProviderHTTPResponse,
  UpdateEmailProviderHTTPRequest,
  UpdateEmailProviderHTTPResponse,
  UpdateEmailProviderSMTPPasswordRequest,
  UpdateEmailProviderSMTPPasswordResponse,
  ActivateEmailProviderRequest,
  ActivateEmailProviderResponse,
  RemoveEmailProviderRequest,
  RemoveEmailProviderResponse,
  EmailProviderState,
} from '../../proto/admin/v1/admin_service';
import { throwInvalidArgument, throwNotFound } from '../../../../lib/zerrors/errors';

/**
 * Supported languages in ZITADEL
 * Based on i18n configuration
 */
const SUPPORTED_LANGUAGES = [
  'de',
  'en',
  'es',
  'fr',
  'it',
  'ja',
  'pl',
  'pt',
  'zh',
  'bg',
  'cs',
  'mk',
  'nl',
  'ru',
  'sv',
];

/**
 * Admin Service
 */
export class AdminService {
  private readonly commands: Commands;
  private readonly instanceQueries: InstanceQueries;
  private readonly orgQueries: OrgQueries;
  
  constructor(
    commands: Commands,
    pool: DatabasePool
  ) {
    this.commands = commands;
    this.instanceQueries = new InstanceQueries(pool);
    this.orgQueries = new OrgQueries(pool);
  }

  // ============================================================================
  // System & Health Endpoints
  // ============================================================================

  /**
   * Healthz - System health check
   */
  async healthz(
    _ctx: Context,
    _request: HealthzRequest
  ): Promise<HealthzResponse> {
    // Simple health check - if we can respond, we're healthy
    return {};
  }

  /**
   * GetSupportedLanguages - Get all languages supported by ZITADEL
   */
  async getSupportedLanguages(
    _ctx: Context,
    _request: GetSupportedLanguagesRequest
  ): Promise<GetSupportedLanguagesResponse> {
    return {
      languages: SUPPORTED_LANGUAGES,
    };
  }

  /**
   * GetAllowedLanguages - Get languages allowed for this instance
   * If no restrictions, returns all supported languages
   */
  async getAllowedLanguages(
    _ctx: Context,
    _request: GetAllowedLanguagesRequest
  ): Promise<GetAllowedLanguagesResponse> {
    // For now, no language restrictions - return all supported
    // In future, could check instance-level restrictions
    return {
      languages: SUPPORTED_LANGUAGES,
    };
  }

  /**
   * SetDefaultLanguage - Set the default language for the instance
   */
  async setDefaultLanguage(
    _ctx: Context,
    request: SetDefaultLanguageRequest
  ): Promise<SetDefaultLanguageResponse> {
    // Validate language
    if (!request.language || request.language.trim().length === 0) {
      throwInvalidArgument('language is required', 'ADMIN-001');
    }

    if (!SUPPORTED_LANGUAGES.includes(request.language)) {
      throwInvalidArgument(
        `language '${request.language}' is not supported. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`,
        'ADMIN-002'
      );
    }

    // Get current instance
    const instance = await this.instanceQueries.getDefaultInstance();
    if (!instance) {
      throwNotFound('instance not found', 'ADMIN-003');
    }

    // Update instance language through command
    const details = await this.commands.setDefaultLanguage(
      _ctx,
      instance.id,
      request.language
    );

    return {
      details: {
        sequence: Number(details.sequence),
        changeDate: details.eventDate,
        resourceOwner: instance.id,
      },
    };
  }

  /**
   * GetDefaultLanguage - Get the default language for the instance
   */
  async getDefaultLanguage(
    _ctx: Context,
    _request: GetDefaultLanguageRequest
  ): Promise<GetDefaultLanguageResponse> {
    // Get current instance
    const instance = await this.instanceQueries.getDefaultInstance();
    if (!instance) {
      throwNotFound('instance not found', 'ADMIN-005');
    }

    return {
      language: instance.defaultLanguage || 'en',
    };
  }

  // ============================================================================
  // Organization Endpoints
  // ============================================================================

  /**
   * ListOrgs - List all organizations in the system
   */
  async listOrgs(
    ctx: Context,
    request: ListOrgsRequest
  ): Promise<ListOrgsResponse> {
    // Get current instance ID from context
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-006');
    }

    // Query organizations
    const result = await this.orgQueries.searchOrgs({
      instanceID,
      limit: request.query?.limit || 50,
      offset: request.query?.offset || 0,
    });

    return {
      details: {
        totalResult: result.total,
        processedSequence: 0,
        timestamp: new Date(),
      },
      result: result.orgs.map(org => ({
        id: org.id,
        details: {
          sequence: org.sequence,
          changeDate: org.updatedAt,
          resourceOwner: org.id,
        },
        state: this.mapOrgState(org.state),
        name: org.name,
        primaryDomain: org.primaryDomain || '',
      })),
    };
  }

  /**
   * GetOrgByID - Get organization by ID
   */
  async getOrgByID(
    ctx: Context,
    request: GetOrgByIDRequest
  ): Promise<GetOrgByIDResponse> {
    // Validate request
    if (!request.id || request.id.trim().length === 0) {
      throwInvalidArgument('organization ID is required', 'ADMIN-007');
    }

    // Get instance ID from context
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-008');
    }

    // Query organization
    // CORRECT: getOrgByID(orgID, instanceID) - orgID is first parameter
    const org = await this.orgQueries.getOrgByID(request.id, instanceID);
    if (!org) {
      throwNotFound('organization not found', 'ADMIN-009');
    }

    return {
      org: {
        id: org.id,
        details: {
          sequence: org.sequence,
          changeDate: org.updatedAt,
          resourceOwner: org.id,
        },
        state: this.mapOrgState(org.state),
        name: org.name,
        primaryDomain: org.primaryDomain || '',
      },
    };
  }

  /**
   * IsOrgUnique - Check if organization name/domain is unique
   */
  async isOrgUnique(
    ctx: Context,
    request: IsOrgUniqueRequest
  ): Promise<IsOrgUniqueResponse> {
    // Validate request
    if (!request.name || request.name.trim().length === 0) {
      throwInvalidArgument('organization name is required', 'ADMIN-010');
    }

    // Get instance ID from context
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-011');
    }

    // Check if organization name exists
    const result = await this.orgQueries.searchOrgs({
      instanceID,
      name: request.name,
      limit: 1,
    });

    return {
      isUnique: result.total === 0,
    };
  }

  // ============================================================================
  // Secret Generator Endpoints
  // ============================================================================

  /**
   * ListSecretGenerators - List all secret generator configurations
   */
  async listSecretGenerators(
    _ctx: Context,
    _request: ListSecretGeneratorsRequest
  ): Promise<ListSecretGeneratorsResponse> {
    // Return default secret generator configurations
    // In production, these would be stored in the database
    const generators = this.getDefaultSecretGenerators();

    return {
      details: {
        totalResult: generators.length,
        processedSequence: 0,
        timestamp: new Date(),
      },
      result: generators,
    };
  }

  /**
   * GetSecretGenerator - Get specific secret generator configuration
   */
  async getSecretGenerator(
    _ctx: Context,
    request: GetSecretGeneratorRequest
  ): Promise<GetSecretGeneratorResponse> {
    if (!request.generatorType) {
      throwInvalidArgument('generator type is required', 'ADMIN-SG01');
    }

    const generator = this.getGeneratorByType(request.generatorType);
    if (!generator) {
      throwNotFound('secret generator not found', 'ADMIN-SG02');
    }

    return {
      secretGenerator: generator,
    };
  }

  /**
   * UpdateSecretGenerator - Update secret generator configuration
   */
  async updateSecretGenerator(
    _ctx: Context,
    request: UpdateSecretGeneratorRequest
  ): Promise<UpdateSecretGeneratorResponse> {
    if (!request.generatorType) {
      throwInvalidArgument('generator type is required', 'ADMIN-SG03');
    }

    // Validate length
    if (request.length !== undefined && (request.length < 1 || request.length > 255)) {
      throwInvalidArgument('length must be between 1 and 255', 'ADMIN-SG04');
    }

    // In production, this would update the database
    // For now, return success with current timestamp
    return {
      details: {
        sequence: 1,
        changeDate: new Date(),
        resourceOwner: '',
      },
    };
  }

  // ============================================================================
  // SMTP Configuration Endpoints (Deprecated)
  // ============================================================================

  /**
   * GetSMTPConfig - Get SMTP configuration (deprecated)
   */
  async getSMTPConfig(
    ctx: Context,
    _request: GetSMTPConfigRequest
  ): Promise<GetSMTPConfigResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-SMTP01');
    }

    // Return placeholder SMTP config
    // In production, query from SMTP projection
    return {
      smtpConfig: {
        details: {
          sequence: 1,
          changeDate: new Date(),
          resourceOwner: instanceID,
        },
        senderAddress: 'noreply@example.com',
        senderName: 'ZITADEL',
        tls: true,
        host: 'smtp.example.com',
        user: 'smtp-user',
        state: SMTPConfigState.SMTP_CONFIG_STATE_INACTIVE,
      },
    };
  }

  /**
   * UpdateSMTPConfig - Update SMTP configuration (deprecated)
   */
  async updateSMTPConfig(
    ctx: Context,
    request: UpdateSMTPConfigRequest
  ): Promise<UpdateSMTPConfigResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-SMTP02');
    }

    // Validate required fields
    if (request.senderAddress && !request.senderAddress.includes('@')) {
      throwInvalidArgument('invalid sender address', 'ADMIN-SMTP03');
    }

    if (request.host && request.host.trim().length === 0) {
      throwInvalidArgument('host is required', 'ADMIN-SMTP04');
    }

    // In production, call addSMTPConfigToOrg or changeSMTPConfig command
    // For now, return success
    return {
      details: {
        sequence: 1,
        changeDate: new Date(),
        resourceOwner: instanceID,
      },
    };
  }

  // ============================================================================
  // Email Provider Endpoints
  // ============================================================================

  /**
   * ListEmailProviders - List all email providers
   */
  async listEmailProviders(
    ctx: Context,
    _request: ListEmailProvidersRequest
  ): Promise<ListEmailProvidersResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-EP01');
    }

    // In production, query from email provider projection
    // For now, return empty list (providers can be added via AddEmailProviderSMTP/HTTP)
    return {
      details: {
        totalResult: 0,
        processedSequence: 0,
        timestamp: new Date(),
      },
      result: [],
    };
  }

  /**
   * GetEmailProvider - Get active email provider
   */
  async getEmailProvider(
    ctx: Context,
    _request: GetEmailProviderRequest
  ): Promise<GetEmailProviderResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-EP02');
    }

    // In production, query active provider from projection
    // For now, return placeholder
    return {
      config: {
        id: 'default',
        details: {
          sequence: 1,
          changeDate: new Date(),
          resourceOwner: instanceID,
        },
        state: EmailProviderState.EMAIL_PROVIDER_STATE_INACTIVE,
        description: 'Default email provider',
        smtpConfig: {
          senderAddress: 'noreply@example.com',
          senderName: 'ZITADEL',
          tls: true,
          host: 'smtp.example.com',
          user: 'smtp-user',
        },
      },
    };
  }

  /**
   * GetEmailProviderById - Get specific email provider by ID
   */
  async getEmailProviderById(
    ctx: Context,
    request: GetEmailProviderByIdRequest
  ): Promise<GetEmailProviderByIdResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-EP03');
    }

    if (!request.id || request.id.trim().length === 0) {
      throwInvalidArgument('provider ID is required', 'ADMIN-EP04');
    }

    // In production, query specific provider from projection
    // For now, return placeholder
    return {
      config: {
        id: request.id,
        details: {
          sequence: 1,
          changeDate: new Date(),
          resourceOwner: instanceID,
        },
        state: EmailProviderState.EMAIL_PROVIDER_STATE_INACTIVE,
        description: 'Email provider',
        smtpConfig: {
          senderAddress: 'noreply@example.com',
          senderName: 'ZITADEL',
          tls: true,
          host: 'smtp.example.com',
          user: 'smtp-user',
        },
      },
    };
  }

  /**
   * AddEmailProviderSMTP - Add SMTP email provider
   */
  async addEmailProviderSMTP(
    ctx: Context,
    request: AddEmailProviderSMTPRequest
  ): Promise<AddEmailProviderSMTPResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-EP05');
    }

    // Validate required fields
    if (!request.senderAddress || !request.senderAddress.includes('@')) {
      throwInvalidArgument('valid sender address is required', 'ADMIN-EP06');
    }

    if (!request.host || request.host.trim().length === 0) {
      throwInvalidArgument('host is required', 'ADMIN-EP07');
    }

    // In production, call addSMTPConfigToOrg command
    const details = await this.commands.addSMTPConfigToOrg(ctx, instanceID, {
      senderAddress: request.senderAddress,
      senderName: request.senderName,
      tls: request.tls !== false,
      host: request.host,
      user: request.user,
      password: request.password,
      replyToAddress: request.replyToAddress,
      description: request.description,
    });

    // Generate provider ID from details
    const providerId = `smtp-${Date.now()}`;

    return {
      details: {
        sequence: Number(details.sequence),
        changeDate: details.eventDate,
        resourceOwner: instanceID,
      },
      id: providerId,
    };
  }

  /**
   * UpdateEmailProviderSMTP - Update SMTP email provider
   */
  async updateEmailProviderSMTP(
    ctx: Context,
    request: UpdateEmailProviderSMTPRequest
  ): Promise<UpdateEmailProviderSMTPResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-EP08');
    }

    if (!request.id || request.id.trim().length === 0) {
      throwInvalidArgument('provider ID is required', 'ADMIN-EP09');
    }

    // Validate email addresses if provided
    if (request.senderAddress && !request.senderAddress.includes('@')) {
      throwInvalidArgument('invalid sender address', 'ADMIN-EP10');
    }

    if (request.replyToAddress && !request.replyToAddress.includes('@')) {
      throwInvalidArgument('invalid reply-to address', 'ADMIN-EP11');
    }

    // In production, call changeSMTPConfig command
    const details = await this.commands.changeSMTPConfig(ctx, instanceID, request.id, {
      senderAddress: request.senderAddress,
      senderName: request.senderName,
      tls: request.tls,
      host: request.host,
      user: request.user,
      replyToAddress: request.replyToAddress,
      description: request.description,
    });

    return {
      details: {
        sequence: Number(details.sequence),
        changeDate: details.eventDate,
        resourceOwner: instanceID,
      },
    };
  }

  /**
   * AddEmailProviderHTTP - Add HTTP email provider
   */
  async addEmailProviderHTTP(
    ctx: Context,
    request: AddEmailProviderHTTPRequest
  ): Promise<AddEmailProviderHTTPResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-EP12');
    }

    if (!request.endpoint || request.endpoint.trim().length === 0) {
      throwInvalidArgument('endpoint is required', 'ADMIN-EP13');
    }

    // Validate endpoint is a valid URL
    try {
      new URL(request.endpoint);
    } catch {
      throwInvalidArgument('invalid endpoint URL', 'ADMIN-EP14');
    }

    // In production, this would call addHTTPEmailProvider command
    // For now, return success with generated ID
    const providerId = `http-${Date.now()}`;

    return {
      details: {
        sequence: 1,
        changeDate: new Date(),
        resourceOwner: instanceID,
      },
      id: providerId,
    };
  }

  /**
   * UpdateEmailProviderHTTP - Update HTTP email provider
   */
  async updateEmailProviderHTTP(
    ctx: Context,
    request: UpdateEmailProviderHTTPRequest
  ): Promise<UpdateEmailProviderHTTPResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-EP15');
    }

    if (!request.id || request.id.trim().length === 0) {
      throwInvalidArgument('provider ID is required', 'ADMIN-EP16');
    }

    // Validate endpoint if provided
    if (request.endpoint) {
      try {
        new URL(request.endpoint);
      } catch {
        throwInvalidArgument('invalid endpoint URL', 'ADMIN-EP17');
      }
    }

    // In production, this would call updateHTTPEmailProvider command
    // For now, return success
    return {
      details: {
        sequence: 1,
        changeDate: new Date(),
        resourceOwner: instanceID,
      },
    };
  }

  /**
   * UpdateEmailProviderSMTPPassword - Update SMTP password
   */
  async updateEmailProviderSMTPPassword(
    ctx: Context,
    request: UpdateEmailProviderSMTPPasswordRequest
  ): Promise<UpdateEmailProviderSMTPPasswordResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-EP18');
    }

    if (!request.id || request.id.trim().length === 0) {
      throwInvalidArgument('provider ID is required', 'ADMIN-EP19');
    }

    if (!request.password || request.password.trim().length === 0) {
      throwInvalidArgument('password is required', 'ADMIN-EP20');
    }

    // In production, call changeSMTPConfig with password
    const details = await this.commands.changeSMTPConfig(ctx, instanceID, request.id, {
      password: request.password,
    });

    return {
      details: {
        sequence: Number(details.sequence),
        changeDate: details.eventDate,
        resourceOwner: instanceID,
      },
    };
  }

  /**
   * ActivateEmailProvider - Activate email provider
   */
  async activateEmailProvider(
    ctx: Context,
    request: ActivateEmailProviderRequest
  ): Promise<ActivateEmailProviderResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-EP21');
    }

    if (!request.id || request.id.trim().length === 0) {
      throwInvalidArgument('provider ID is required', 'ADMIN-EP22');
    }

    // In production, call activateSMTPConfig command
    const details = await this.commands.activateSMTPConfig(ctx, instanceID, request.id);

    return {
      details: {
        sequence: Number(details.sequence),
        changeDate: details.eventDate,
        resourceOwner: instanceID,
      },
    };
  }

  /**
   * RemoveEmailProvider - Remove email provider
   */
  async removeEmailProvider(
    ctx: Context,
    request: RemoveEmailProviderRequest
  ): Promise<RemoveEmailProviderResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-EP23');
    }

    if (!request.id || request.id.trim().length === 0) {
      throwInvalidArgument('provider ID is required', 'ADMIN-EP24');
    }

    // In production, call removeSMTPConfig command
    const details = await this.commands.removeSMTPConfig(ctx, instanceID, request.id);

    return {
      details: {
        sequence: Number(details.sequence),
        changeDate: details.eventDate,
        resourceOwner: instanceID,
      },
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get default secret generator configurations
   */
  private getDefaultSecretGenerators() {
    const now = new Date();
    const details = {
      sequence: 1,
      changeDate: now,
      resourceOwner: '',
    };

    return [
      {
        generatorType: SecretGeneratorType.SECRET_GENERATOR_TYPE_INIT_CODE,
        details,
        length: 6,
        expiry: '72h',
        includeUpperCase: false,
        includeLowerCase: false,
        includeDigits: true,
        includeSymbols: false,
      },
      {
        generatorType: SecretGeneratorType.SECRET_GENERATOR_TYPE_VERIFY_EMAIL_CODE,
        details,
        length: 6,
        expiry: '10m',
        includeUpperCase: false,
        includeLowerCase: false,
        includeDigits: true,
        includeSymbols: false,
      },
      {
        generatorType: SecretGeneratorType.SECRET_GENERATOR_TYPE_VERIFY_PHONE_CODE,
        details,
        length: 6,
        expiry: '10m',
        includeUpperCase: false,
        includeLowerCase: false,
        includeDigits: true,
        includeSymbols: false,
      },
      {
        generatorType: SecretGeneratorType.SECRET_GENERATOR_TYPE_PASSWORD_RESET_CODE,
        details,
        length: 6,
        expiry: '1h',
        includeUpperCase: false,
        includeLowerCase: false,
        includeDigits: true,
        includeSymbols: false,
      },
      {
        generatorType: SecretGeneratorType.SECRET_GENERATOR_TYPE_PASSWORDLESS_INIT_CODE,
        details,
        length: 6,
        expiry: '10m',
        includeUpperCase: false,
        includeLowerCase: false,
        includeDigits: true,
        includeSymbols: false,
      },
      {
        generatorType: SecretGeneratorType.SECRET_GENERATOR_TYPE_APP_SECRET,
        details,
        length: 32,
        expiry: '0', // No expiry
        includeUpperCase: true,
        includeLowerCase: true,
        includeDigits: true,
        includeSymbols: false,
      },
      {
        generatorType: SecretGeneratorType.SECRET_GENERATOR_TYPE_OTP_SMS,
        details,
        length: 6,
        expiry: '5m',
        includeUpperCase: false,
        includeLowerCase: false,
        includeDigits: true,
        includeSymbols: false,
      },
      {
        generatorType: SecretGeneratorType.SECRET_GENERATOR_TYPE_OTP_EMAIL,
        details,
        length: 6,
        expiry: '5m',
        includeUpperCase: false,
        includeLowerCase: false,
        includeDigits: true,
        includeSymbols: false,
      },
    ];
  }

  /**
   * Get generator by type
   */
  private getGeneratorByType(type: SecretGeneratorType) {
    const generators = this.getDefaultSecretGenerators();
    return generators.find(g => g.generatorType === type);
  }

  /**
   * Helper: Map org state from query to proto enum
   */
  private mapOrgState(state: string): OrgState {
    switch (state?.toLowerCase()) {
      case 'active':
        return OrgState.ORG_STATE_ACTIVE;
      case 'inactive':
        return OrgState.ORG_STATE_INACTIVE;
      case 'removed':
        return OrgState.ORG_STATE_REMOVED;
      default:
        return OrgState.ORG_STATE_UNSPECIFIED;
    }
  }
}
