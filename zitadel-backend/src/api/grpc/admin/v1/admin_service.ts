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
