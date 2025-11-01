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
import { IDPQueries } from '../../../../lib/query/idp/idp-queries';
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
  GetSMSProviderRequest,
  GetSMSProviderResponse,
  AddSMSProviderTwilioRequest,
  AddSMSProviderTwilioResponse,
  UpdateSMSProviderTwilioRequest,
  UpdateSMSProviderTwilioResponse,
  ActivateSMSProviderRequest,
  ActivateSMSProviderResponse,
  RemoveSMSProviderRequest,
  RemoveSMSProviderResponse,
  SMSProviderState,
  ListIDPsRequest,
  ListIDPsResponse,
  GetIDPRequest,
  GetIDPResponse,
  AddOIDCIDPRequest,
  AddOIDCIDPResponse,
  AddOAuthIDPRequest,
  AddOAuthIDPResponse,
  UpdateIDPRequest,
  UpdateIDPResponse,
  RemoveIDPRequest,
  RemoveIDPResponse,
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
  private commands: Commands;
  private readonly instanceQueries: InstanceQueries;
  private readonly orgQueries: OrgQueries;
  // Temporary state for HTTP provider (until command implementation)
  private httpProviderState: Map<string, { sequence: number; changeDate: Date }> = new Map();

  constructor(commands: Commands, pool: DatabasePool) {
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
    const result = await this.commands.addSMTPConfigToOrg(ctx, instanceID, {
      senderAddress: request.senderAddress,
      senderName: request.senderName,
      tls: request.tls !== false,
      host: request.host,
      user: request.user,
      password: request.password,
      replyToAddress: request.replyToAddress,
      description: request.description,
    });

    // Use actual config ID from command
    return {
      details: {
        sequence: Number(result.details.sequence),
        changeDate: result.details.eventDate,
        resourceOwner: instanceID,
      },
      id: result.configID,
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
    let url: URL;
    try {
      url = new URL(request.endpoint);
    } catch {
      throwInvalidArgument('invalid endpoint URL', 'ADMIN-EP14');
    }

    // Validate URL scheme (must be http or https)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throwInvalidArgument('endpoint must use http:// or https://', 'ADMIN-EP15');
    }

    // In production, this would call addHTTPEmailProvider command
    // For now, use placeholder with state tracking
    const state = { sequence: 1, changeDate: new Date() };
    this.httpProviderState.set(instanceID, state);

    return {
      details: {
        sequence: state.sequence,
        changeDate: state.changeDate,
        resourceOwner: instanceID,
      },
      id: instanceID,
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
      let url: URL;
      try {
        url = new URL(request.endpoint);
      } catch {
        throwInvalidArgument('invalid endpoint URL', 'ADMIN-EP17');
      }

      // Validate URL scheme (must be http or https)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throwInvalidArgument('endpoint must use http:// or https://', 'ADMIN-EP18');
      }
    }

    // In production, this would call updateHTTPEmailProvider command
    // For now, update placeholder state
    const currentState = this.httpProviderState.get(instanceID);
    if (!currentState) {
      throwNotFound('HTTP provider not found', 'ADMIN-EP19');
    }

    const newState = {
      sequence: currentState.sequence + 1,
      changeDate: new Date(),
    };
    this.httpProviderState.set(instanceID, newState);

    return {
      details: {
        sequence: newState.sequence,
        changeDate: newState.changeDate,
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
  // SMS Provider Endpoints
  // ============================================================================

  /**
   * GetSMSProvider - Get active SMS provider
   */
  async getSMSProvider(
    ctx: Context,
    _request: GetSMSProviderRequest
  ): Promise<GetSMSProviderResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-SP01');
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
        state: SMSProviderState.SMS_PROVIDER_STATE_INACTIVE,
        description: 'Default SMS provider',
        twilioConfig: {
          sid: 'AC...',
          senderNumber: '+1234567890',
        },
      },
    };
  }

  /**
   * AddSMSProviderTwilio - Add Twilio SMS provider
   */
  async addSMSProviderTwilio(
    ctx: Context,
    request: AddSMSProviderTwilioRequest
  ): Promise<AddSMSProviderTwilioResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-SP02');
    }

    // Validate required fields
    if (!request.sid || request.sid.trim().length === 0) {
      throwInvalidArgument('Twilio SID is required', 'ADMIN-SP03');
    }

    if (!request.token || request.token.trim().length === 0) {
      throwInvalidArgument('Twilio token is required', 'ADMIN-SP04');
    }

    if (!request.senderNumber || request.senderNumber.trim().length === 0) {
      throwInvalidArgument('sender number is required', 'ADMIN-SP05');
    }

    // In production, call addTwilioSMSConfigToOrg command
    const result = await this.commands.addTwilioSMSConfigToOrg(ctx, instanceID, {
      sid: request.sid,
      token: request.token,
      senderNumber: request.senderNumber,
      verifyServiceSID: request.verifyServiceSid,
      description: request.description,
    });

    // Use actual config ID from command
    return {
      details: {
        sequence: Number(result.details.sequence),
        changeDate: result.details.eventDate,
        resourceOwner: instanceID,
      },
      id: result.configID,
    };
  }

  /**
   * UpdateSMSProviderTwilio - Update Twilio SMS provider
   */
  async updateSMSProviderTwilio(
    ctx: Context,
    request: UpdateSMSProviderTwilioRequest
  ): Promise<UpdateSMSProviderTwilioResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-SP06');
    }

    if (!request.id || request.id.trim().length === 0) {
      throwInvalidArgument('provider ID is required', 'ADMIN-SP07');
    }

    // Validate fields if provided
    if (request.sid !== undefined && request.sid.trim().length === 0) {
      throwInvalidArgument('SID cannot be empty', 'ADMIN-SP08');
    }

    if (request.senderNumber !== undefined && request.senderNumber.trim().length === 0) {
      throwInvalidArgument('sender number cannot be empty', 'ADMIN-SP09');
    }

    // In production, call changeTwilioSMSConfig command
    const details = await this.commands.changeTwilioSMSConfig(ctx, instanceID, request.id, {
      sid: request.sid,
      token: request.token,
      senderNumber: request.senderNumber,
      verifyServiceSID: request.verifyServiceSid,
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
   * ActivateSMSProvider - Activate SMS provider
   */
  async activateSMSProvider(
    ctx: Context,
    request: ActivateSMSProviderRequest
  ): Promise<ActivateSMSProviderResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-SP10');
    }

    if (!request.id || request.id.trim().length === 0) {
      throwInvalidArgument('provider ID is required', 'ADMIN-SP11');
    }

    // In production, call activateSMSConfig command
    const details = await this.commands.activateSMSConfig(ctx, instanceID, request.id);

    return {
      details: {
        sequence: Number(details.sequence),
        changeDate: details.eventDate,
        resourceOwner: instanceID,
      },
    };
  }

  /**
   * RemoveSMSProvider - Remove SMS provider
   */
  async removeSMSProvider(
    ctx: Context,
    request: RemoveSMSProviderRequest
  ): Promise<RemoveSMSProviderResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-SP12');
    }

    if (!request.id || request.id.trim().length === 0) {
      throwInvalidArgument('provider ID is required', 'ADMIN-SP13');
    }

    // In production, call removeSMSConfig command
    const details = await this.commands.removeSMSConfig(ctx, instanceID, request.id);

    return {
      details: {
        sequence: Number(details.sequence),
        changeDate: details.eventDate,
        resourceOwner: instanceID,
      },
    };
  }

  // ============================================================================
  // Identity Provider (IDP) Endpoints
  // ============================================================================

  /**
   * ListIDPs - List all identity providers
   */
  async listIDPs(
    ctx: Context,
    request: ListIDPsRequest
  ): Promise<ListIDPsResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-IDP01');
    }

    const idpQueries = new IDPQueries(this.instanceQueries['database'] || (this.instanceQueries as any).pool);
    
    const searchQuery: any = {
      instanceID,
      resourceOwner: instanceID,
      limit: request.query?.limit || 50,
      offset: request.query?.offset || 0,
    };

    if (request.query?.name) {
      searchQuery.name = request.query.name;
    }

    if (request.query?.type !== undefined) {
      searchQuery.type = request.query.type;
    }

    const result = await idpQueries.searchIDPs(searchQuery);

    return {
      idps: result.idps.map((idp: any) => ({
        id: idp.id,
        details: {
          sequence: Number(idp.sequence || 1),
          changeDate: idp.changeDate || new Date(),
          resourceOwner: idp.resourceOwner || instanceID,
        },
        name: idp.name,
        type: idp.type,
        state: idp.state,
        stylingType: idp.stylingType,
        isCreationAllowed: idp.isCreationAllowed,
        isLinkingAllowed: idp.isLinkingAllowed,
        isAutoCreation: idp.isAutoCreation,
        isAutoUpdate: idp.isAutoUpdate,
        config: undefined, // Config details available in type-specific queries
      })),
      totalResults: result.total,
    };
  }

  /**
   * GetIDP - Get single identity provider
   */
  async getIDP(
    ctx: Context,
    request: GetIDPRequest
  ): Promise<GetIDPResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-IDP02');
    }

    if (!request.id || request.id.trim().length === 0) {
      throwInvalidArgument('IDP ID is required', 'ADMIN-IDP03');
    }

    const idpQueries = new IDPQueries(this.instanceQueries['database'] || (this.instanceQueries as any).pool);
    const idp = await idpQueries.getIDPByID(request.id, instanceID);

    if (!idp) {
      throwNotFound('IDP not found', 'ADMIN-IDP04');
    }

    return {
      idp: {
        id: idp.id,
        details: {
          sequence: Number(idp.sequence || 1),
          changeDate: idp.changeDate || new Date(),
          resourceOwner: idp.resourceOwner || instanceID,
        },
        name: idp.name,
        type: idp.type,
        state: idp.state,
        stylingType: idp.stylingType,
        isCreationAllowed: idp.isCreationAllowed,
        isLinkingAllowed: idp.isLinkingAllowed,
        isAutoCreation: idp.isAutoCreation,
        isAutoUpdate: idp.isAutoUpdate,
        config: undefined, // Config details available in type-specific queries
      },
    };
  }

  /**
   * AddOIDCIDP - Add OIDC identity provider
   */
  async addOIDCIDP(
    ctx: Context,
    request: AddOIDCIDPRequest
  ): Promise<AddOIDCIDPResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-IDP05');
    }

    // Validate required fields
    if (!request.name || request.name.trim().length === 0) {
      throwInvalidArgument('name is required', 'ADMIN-IDP06');
    }

    if (!request.clientId || request.clientId.trim().length === 0) {
      throwInvalidArgument('client ID is required', 'ADMIN-IDP07');
    }

    if (!request.clientSecret || request.clientSecret.trim().length === 0) {
      throwInvalidArgument('client secret is required', 'ADMIN-IDP08');
    }

    if (!request.issuer || request.issuer.trim().length === 0) {
      throwInvalidArgument('issuer is required', 'ADMIN-IDP09');
    }

    // Call command to add OIDC IDP
    const result = await this.commands.addOIDCIDPToInstance(ctx, instanceID, {
      name: request.name,
      clientID: request.clientId,
      clientSecret: request.clientSecret,
      issuer: request.issuer,
      scopes: request.scopes,
      displayNameMapping: request.displayNameMapping,
      usernameMapping: request.usernameMapping,
      isCreationAllowed: request.isCreationAllowed,
      isLinkingAllowed: request.isLinkingAllowed,
      isAutoCreation: request.isAutoCreation,
      isAutoUpdate: request.isAutoUpdate,
    });

    return {
      details: {
        sequence: Number(result.details.sequence),
        changeDate: result.details.eventDate,
        resourceOwner: instanceID,
      },
      id: result.idpID,
    };
  }

  /**
   * AddOAuthIDP - Add OAuth identity provider
   */
  async addOAuthIDP(
    ctx: Context,
    request: AddOAuthIDPRequest
  ): Promise<AddOAuthIDPResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-IDP10');
    }

    // Validate required fields
    if (!request.name || request.name.trim().length === 0) {
      throwInvalidArgument('name is required', 'ADMIN-IDP11');
    }

    if (!request.clientId || request.clientId.trim().length === 0) {
      throwInvalidArgument('client ID is required', 'ADMIN-IDP12');
    }

    if (!request.clientSecret || request.clientSecret.trim().length === 0) {
      throwInvalidArgument('client secret is required', 'ADMIN-IDP13');
    }

    if (!request.authorizationEndpoint || request.authorizationEndpoint.trim().length === 0) {
      throwInvalidArgument('authorization endpoint is required', 'ADMIN-IDP14');
    }

    if (!request.tokenEndpoint || request.tokenEndpoint.trim().length === 0) {
      throwInvalidArgument('token endpoint is required', 'ADMIN-IDP15');
    }

    if (!request.userEndpoint || request.userEndpoint.trim().length === 0) {
      throwInvalidArgument('user endpoint is required', 'ADMIN-IDP16');
    }

    // Call command to add OAuth IDP
    const result = await this.commands.addOAuthIDPToInstance(ctx, instanceID, {
      name: request.name,
      clientID: request.clientId,
      clientSecret: request.clientSecret,
      authorizationEndpoint: request.authorizationEndpoint,
      tokenEndpoint: request.tokenEndpoint,
      userEndpoint: request.userEndpoint,
      scopes: request.scopes,
      idAttribute: request.idAttribute,
      isCreationAllowed: request.isCreationAllowed,
      isLinkingAllowed: request.isLinkingAllowed,
      isAutoCreation: request.isAutoCreation,
      isAutoUpdate: request.isAutoUpdate,
    });

    return {
      details: {
        sequence: Number(result.details.sequence),
        changeDate: result.details.eventDate,
        resourceOwner: instanceID,
      },
      id: result.idpID,
    };
  }

  /**
   * UpdateIDP - Update identity provider
   */
  async updateIDP(
    ctx: Context,
    request: UpdateIDPRequest
  ): Promise<UpdateIDPResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-IDP17');
    }

    if (!request.id || request.id.trim().length === 0) {
      throwInvalidArgument('IDP ID is required', 'ADMIN-IDP18');
    }

    // Call command to update IDP
    const result = await this.commands.updateInstanceIDP(ctx, instanceID, request.id, {
      name: request.name,
      stylingType: request.stylingType,
    });

    return {
      details: {
        sequence: Number(result.sequence),
        changeDate: result.eventDate,
        resourceOwner: instanceID,
      },
    };
  }

  /**
   * RemoveIDP - Remove identity provider
   */
  async removeIDP(
    ctx: Context,
    request: RemoveIDPRequest
  ): Promise<RemoveIDPResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-IDP19');
    }

    if (!request.id || request.id.trim().length === 0) {
      throwInvalidArgument('IDP ID is required', 'ADMIN-IDP20');
    }

    // Call command to remove IDP
    const result = await this.commands.removeInstanceIDP(ctx, instanceID, request.id);

    return {
      details: {
        sequence: Number(result.sequence),
        changeDate: result.eventDate,
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
