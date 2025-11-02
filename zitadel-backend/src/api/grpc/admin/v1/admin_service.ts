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
import { PasswordComplexityQueries } from '../../../../lib/query/policy/password-complexity-queries';
import { PasswordAgeQueries } from '../../../../lib/query/policy/password-age-queries';
import { SecurityPolicyQueries } from '../../../../lib/query/policy/security-policy-queries';
import { DomainPolicyQueries } from '../../../../lib/query/policy/domain-policy-queries';
// import { MilestoneQueries } from '../../../../lib/query/milestone/milestone-queries'; // TODO: Use for ListMilestones
// import { FailedEventHandler } from '../../../../lib/query/projection/failed-events'; // TODO: Use for advanced operations
import { AdminQueries } from '../../../../lib/query/admin/admin-queries';
import { CurrentStateTracker } from '../../../../lib/query/projection/current-state';
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
  GetDefaultLoginPolicyRequest,
  GetDefaultLoginPolicyResponse,
  UpdateDefaultLoginPolicyRequest,
  UpdateDefaultLoginPolicyResponse,
  GetLabelPolicyRequest,
  GetLabelPolicyResponse,
  UpdateLabelPolicyRequest,
  UpdateLabelPolicyResponse,
  GetPrivacyPolicyRequest,
  GetPrivacyPolicyResponse,
  UpdatePrivacyPolicyRequest,
  UpdatePrivacyPolicyResponse,
  GetLockoutPolicyRequest,
  GetLockoutPolicyResponse,
  UpdateLockoutPolicyRequest,
  UpdateLockoutPolicyResponse,
  GetPasswordComplexityPolicyRequest,
  GetPasswordComplexityPolicyResponse,
  UpdatePasswordComplexityPolicyRequest,
  UpdatePasswordComplexityPolicyResponse,
  GetPasswordAgePolicyRequest,
  GetPasswordAgePolicyResponse,
  UpdatePasswordAgePolicyRequest,
  UpdatePasswordAgePolicyResponse,
  GetSecurityPolicyRequest,
  GetSecurityPolicyResponse,
  GetDomainPolicyRequest,
  GetDomainPolicyResponse,
  UpdateDomainPolicyRequest,
  UpdateDomainPolicyResponse,
  ListViewsRequest,
  ListViewsResponse,
  ListMilestonesRequest,
  ListMilestonesResponse,
  ListEventsRequest,
  ListEventsResponse,
  ListEventTypesRequest,
  ListEventTypesResponse,
  ListAggregateTypesRequest,
  ListAggregateTypesResponse,
  GetRestrictionsRequest,
  GetRestrictionsResponse,
  SetRestrictionsRequest,
  SetRestrictionsResponse,
  ExportDataRequest,
  ExportDataResponse,
  ImportDataRequest,
  ImportDataResponse,
  // Additional types for failed events
  ListFailedEventsRequest,
  ListFailedEventsResponse,
  RemoveFailedEventRequest,
  RemoveFailedEventResponse,
  // Enhanced monitoring (our extensions)
  GetSystemHealthRequest,
  GetSystemHealthResponse,
  GetSystemMetricsRequest,
  GetSystemMetricsResponse,
  GetDatabaseStatusRequest,
  GetDatabaseStatusResponse,
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
  private readonly database: DatabasePool;
  private readonly instanceQueries: InstanceQueries;
  private readonly orgQueries: OrgQueries;
  private readonly passwordComplexityQueries: PasswordComplexityQueries;
  private readonly passwordAgeQueries: PasswordAgeQueries;
  private readonly securityPolicyQueries: SecurityPolicyQueries;
  private readonly domainPolicyQueries: DomainPolicyQueries;
  // private readonly milestoneQueries: MilestoneQueries; // TODO: Use for ListMilestones
  // private readonly failedEventHandler: FailedEventHandler; // TODO: Use for advanced failed event operations
  private readonly adminQueries: AdminQueries;
  private readonly stateTracker: CurrentStateTracker;
  // Temporary state for HTTP provider (until command implementation)
  private httpProviderState: Map<string, { sequence: number; changeDate: Date }> = new Map();

  constructor(commands: Commands, pool: DatabasePool) {
    this.commands = commands;
    this.database = pool;
    this.instanceQueries = new InstanceQueries(pool);
    this.orgQueries = new OrgQueries(pool);
    this.passwordComplexityQueries = new PasswordComplexityQueries(pool);
    this.passwordAgeQueries = new PasswordAgeQueries(pool);
    this.securityPolicyQueries = new SecurityPolicyQueries(pool);
    this.domainPolicyQueries = new DomainPolicyQueries(pool);
    // this.milestoneQueries = new MilestoneQueries(pool); // TODO: Re-enable when implementing ListMilestones
    // this.failedEventHandler = new FailedEventHandler(pool); // TODO: Re-enable for advanced failed event operations
    this.adminQueries = new AdminQueries(pool);
    this.stateTracker = new CurrentStateTracker(pool);
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
   * SetDefaultOrg - Set default organization for instance
   */
  async setDefaultOrg(
    ctx: Context,
    request: { orgId: string }
  ): Promise<{ details: { sequence: number; changeDate: Date; resourceOwner: string } }> {
    // Validate request
    if (!request.orgId || request.orgId.trim().length === 0) {
      throwInvalidArgument('organization ID is required', 'ADMIN-012');
    }

    // Get instance ID from context
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-013');
    }

    // Execute command
    const result = await this.commands.setDefaultOrg(ctx, instanceID, request.orgId);

    return {
      details: {
        sequence: Number(result.sequence),
        changeDate: result.eventDate,
        resourceOwner: result.resourceOwner,
      },
    };
  }

  /**
   * GetDefaultOrg - Get default organization for instance
   */
  async getDefaultOrg(
    ctx: Context,
    _request: Record<string, never>
  ): Promise<{ org: { id: string; details: { sequence: number; changeDate: Date; resourceOwner: string }; state: OrgState; name: string; primaryDomain: string } | null }> {
    // Get instance ID from context
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throwInvalidArgument('instance ID required', 'ADMIN-014');
    }

    // Get instance to find defaultOrgID
    const instance = await this.instanceQueries.getInstanceByID(instanceID);
    if (!instance || !instance.defaultOrgID) {
      return { org: null };
    }

    // Get the default organization
    const org = await this.orgQueries.getOrgByID(instance.defaultOrgID, instanceID);
    if (!org) {
      return { org: null };
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

  // ============================================================================
  // Domain Settings Endpoints
  // ============================================================================

  /**
   * GetDomainPolicy - Get domain policy for the instance
   */
  async getDomainPolicy(
    ctx: Context,
    _request: GetDomainPolicyRequest
  ): Promise<GetDomainPolicyResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throw new Error('Instance ID required');
    }

    // Get domain policy (returns default if no custom policy exists)
    const policy = await this.domainPolicyQueries.getDomainPolicy(instanceID);

    return {
      policy: {
        userLoginMustBeDomain: policy.userLoginMustBeDomain,
        validateOrgDomains: policy.validateOrgDomains,
        smtpSenderAddressMatchesInstanceDomain: policy.smtpSenderAddressMatchesInstanceDomain,
        isDefault: policy.isDefault,
        details: {
          sequence: Number(policy.sequence),
          changeDate: policy.changeDate,
          resourceOwner: policy.resourceOwner,
        },
      },
    };
  }

  /**
   * UpdateDomainPolicy - Update domain policy for the instance
   */
  async updateDomainPolicy(
    ctx: Context,
    request: UpdateDomainPolicyRequest
  ): Promise<UpdateDomainPolicyResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throw new Error('Instance ID required');
    }

    // Prepare config with current values as defaults
    const currentPolicy = await this.domainPolicyQueries.getDomainPolicy(instanceID);
    
    const config = {
      userLoginMustBeDomain: request.userLoginMustBeDomain ?? currentPolicy.userLoginMustBeDomain,
      validateOrgDomains: request.validateOrgDomains ?? currentPolicy.validateOrgDomains,
      smtpSenderAddressMatchesInstanceDomain: request.smtpSenderAddressMatchesInstanceDomain ?? currentPolicy.smtpSenderAddressMatchesInstanceDomain,
    };

    // Check if this is a default (instance-level) policy or org-level
    // For admin API, we work at instance level (org context from ctx.orgID would be for org-level)
    let result;
    if (currentPolicy.organizationID) {
      // Update existing org policy
      result = await this.commands.changeOrgDomainPolicy(ctx, currentPolicy.organizationID, config);
    } else {
      // This is instance default - need to create/update at instance level
      // For now, treat as org-level since instance policies are typically read-only defaults
      throw new Error('Instance-level domain policy updates not yet supported. Use organization-level policies.');
    }

    return {
      details: {
        sequence: Number(result.sequence),
        changeDate: result.eventDate,
        resourceOwner: result.resourceOwner,
      },
    };
  }


  // ============================================================================
  // Milestones & Events Endpoints
  // ============================================================================

  /**
   * ListMilestones - List all milestones for the instance
   */
  async listMilestones(
    ctx: Context,
    _request: ListMilestonesRequest
  ): Promise<ListMilestonesResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throw new Error('Instance ID required');
    }

    console.log('\n--- Listing milestones ---');
    
    // Query all milestones for this instance from milestone table
    const query = `
      SELECT 
        type, instance_id, reached, pushed_date, reached_date,
        name, aggregate_id, aggregate_type
      FROM projections.milestones
      WHERE instance_id = $1
      ORDER BY type
    `;

    try {
      const result = await this.database.query(query, [instanceID]);
      
      return {
        result: result.rows.map((row: any) => ({
          type: row.type || 0,
          instanceID: row.instance_id,
          reached: row.reached || false,
          pushedDate: row.pushed_date || undefined,
          reachedDate: row.reached_date || undefined,
          name: row.name || undefined,
          aggregateID: row.aggregate_id || undefined,
        })),
      };
    } catch (error) {
      console.warn('Milestones table not found or query failed, returning empty list');
      return { result: [] };
    }
  }

  /**
   * ListEvents - List events from the event store
   */
  async listEvents(
    ctx: Context,
    request: ListEventsRequest
  ): Promise<ListEventsResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throw new Error('Instance ID required');
    }

    console.log('\n--- Listing events ---');
    
    const limit = request.limit || 100;
    const conditions: string[] = ['instance_id = $1'];
    const params: any[] = [instanceID];
    let paramIndex = 2;

    // Add filters
    if (request.aggregateTypes && request.aggregateTypes.length > 0) {
      conditions.push(`aggregate_type = ANY($${paramIndex})`);
      params.push(request.aggregateTypes);
      paramIndex++;
    }

    if (request.aggregateId) {
      conditions.push(`aggregate_id = $${paramIndex}`);
      params.push(request.aggregateId);
      paramIndex++;
    }

    if (request.eventTypes && request.eventTypes.length > 0) {
      conditions.push(`event_type = ANY($${paramIndex})`);
      params.push(request.eventTypes);
      paramIndex++;
    }

    if (request.resourceOwner) {
      conditions.push(`owner = $${paramIndex}`);
      params.push(request.resourceOwner);
      paramIndex++;
    }

    if (request.editorUserId) {
      conditions.push(`creator = $${paramIndex}`);
      params.push(request.editorUserId);
      paramIndex++;
    }

    if (request.sequence !== undefined) {
      conditions.push(`position >= $${paramIndex}`);
      params.push(request.sequence.toString());
      paramIndex++;
    }

    const query = `
      SELECT 
        instance_id, aggregate_type, aggregate_id, event_type,
        aggregate_version, created_at, creator, owner, position, payload
      FROM events
      WHERE ${conditions.join(' AND ')}
      ORDER BY position DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await this.database.query(query, params);

    return {
      events: result.rows.map((row: any) => ({
        sequence: Number(row.position) || 0,
        creationDate: row.created_at,
        eventType: row.event_type,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        resourceOwner: row.owner,
        editorUserId: row.creator,
        payload: row.payload,
      })),
    };
  }

  /**
   * ListEventTypes - List all distinct event types in the system
   */
  async listEventTypes(
    ctx: Context,
    _request: ListEventTypesRequest
  ): Promise<ListEventTypesResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throw new Error('Instance ID required');
    }

    console.log('\n--- Listing event types ---');
    
    const query = `
      SELECT DISTINCT event_type
      FROM events
      WHERE instance_id = $1
      ORDER BY event_type
    `;

    const result = await this.database.query(query, [instanceID]);

    return {
      eventTypes: result.rows.map((row: any) => row.event_type),
    };
  }

  /**
   * ListAggregateTypes - List all distinct aggregate types in the system
   */
  async listAggregateTypes(
    ctx: Context,
    _request: ListAggregateTypesRequest
  ): Promise<ListAggregateTypesResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throw new Error('Instance ID required');
    }

    console.log('\n--- Listing aggregate types ---');
    
    const query = `
      SELECT DISTINCT aggregate_type
      FROM events
      WHERE instance_id = $1
      ORDER BY aggregate_type
    `;

    const result = await this.database.query(query, [instanceID]);

    return {
      aggregateTypes: result.rows.map((row: any) => row.aggregate_type),
    };
  }


  // ============================================================================
  // Feature Flags (Restrictions) Endpoints
  // ============================================================================

  /**
   * GetRestrictions - Get feature restrictions for the instance
   */
  async getRestrictions(
    ctx: Context,
    _request: GetRestrictionsRequest
  ): Promise<GetRestrictionsResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throw new Error('Instance ID required');
    }

    console.log('\n--- Getting restrictions ---');
    
    const restrictions = await this.adminQueries.getRestrictions(instanceID);

    console.log('✓ Restrictions retrieved:', restrictions);

    return {
      restrictions,
    };
  }

  /**
   * SetRestrictions - Set feature restrictions for the instance
   */
  async setRestrictions(
    ctx: Context,
    request: SetRestrictionsRequest
  ): Promise<SetRestrictionsResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throw new Error('Instance ID required');
    }

    console.log('\n--- Setting restrictions ---');
    
    // Get current restrictions
    const current = await this.adminQueries.getRestrictions(instanceID);
    
    // Merge with requested changes
    const updated = {
      disallowPublicOrgRegistration: request.disallowPublicOrgRegistration ?? current.disallowPublicOrgRegistration,
      allowedLanguages: request.allowedLanguages ?? current.allowedLanguages,
    };

    console.log('  Current:', current);
    console.log('  Updated:', updated);

    // Direct database update for restrictions (configuration data, not domain events)
    const query = `
      INSERT INTO projections.restrictions (
        instance_id, 
        disallow_public_org_registration, 
        allowed_languages
      ) VALUES ($1, $2, $3)
      ON CONFLICT (instance_id) 
      DO UPDATE SET
        disallow_public_org_registration = EXCLUDED.disallow_public_org_registration,
        allowed_languages = EXCLUDED.allowed_languages
    `;

    await this.database.query(query, [
      instanceID,
      updated.disallowPublicOrgRegistration,
      updated.allowedLanguages,
    ]);

    console.log('✓ Restrictions updated');

    return {
      details: {
        sequence: 1, // Configuration updates don't have event sequences
        changeDate: new Date(),
      },
    };
  }

  // ============================================================================
  // Import/Export Endpoints
  // ============================================================================

  /**
   * ExportData - Export instance data for backup/migration
   * 
   * Note: This is a stub implementation. Full production implementation would:
   * - Export all organizations, users, projects, applications
   * - Export policies, settings, and configurations
   * - Handle large datasets with streaming
   * - Support incremental exports
   * - Encrypt sensitive data
   */
  async exportData(
    ctx: Context,
    request: ExportDataRequest
  ): Promise<ExportDataResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throw new Error('Instance ID required');
    }

    console.log('\n--- Exporting instance data (STUB) ---');
    console.log('  Format:', request.format || 'json');
    console.log('  Timeout:', request.timeout || 60, 'seconds');

    // Stub: Get basic instance info
    const instance = await this.instanceQueries.getInstanceByID(instanceID);
    
    // Stub: Export basic data structure
    const exportData = {
      version: '1.0',
      instanceID,
      instanceName: instance?.name || 'Unknown',
      exportDate: new Date().toISOString(),
      // In full implementation, would include:
      // organizations: [...],
      // users: [...],
      // projects: [...],
      // policies: [...],
      // settings: {...},
      note: 'STUB: Full export implementation pending. Would include all instance data.',
    };

    console.log('✓ Export completed (stub)');

    return {
      data: JSON.stringify(exportData, null, 2),
      metadata: {
        exportDate: new Date(),
        instanceID,
        format: request.format || 'json',
        version: '1.0',
      },
    };
  }

  /**
   * ImportData - Import instance data from backup/migration
   * 
   * Note: This is a stub implementation. Full production implementation would:
   * - Validate data format and version
   * - Check for conflicts with existing data
   * - Support transaction rollback on errors
   * - Handle relationships between entities
   * - Support incremental imports
   * - Audit trail of imports
   */
  async importData(
    ctx: Context,
    request: ImportDataRequest
  ): Promise<ImportDataResponse> {
    const instanceID = ctx.instanceID;
    if (!instanceID) {
      throw new Error('Instance ID required');
    }

    console.log('\n--- Importing instance data (STUB) ---');
    console.log('  Dry run:', request.options?.dryRun || false);
    console.log('  Skip existing:', request.options?.skipExisting || false);

    // Validate JSON format
    let importData: any;
    try {
      importData = JSON.parse(request.data);
    } catch (error) {
      throw new Error('Invalid JSON data format');
    }

    // Basic validation
    if (!importData.version) {
      throw new Error('Missing version in import data');
    }

    console.log('  Import data version:', importData.version);
    console.log('  Import data instanceID:', importData.instanceID);

    // Stub: Count entities (in full impl, would actually import)
    const totalEntities = 0; // Would count all entities in import data
    const imported = 0; // Would count successful imports
    const skipped = 0; // Would count skipped due to conflicts
    const failed = 0; // Would count failed imports

    if (request.options?.dryRun) {
      console.log('✓ Dry run validation completed (stub)');
    } else {
      console.log('✓ Import completed (stub - no data actually imported)');
    }

    return {
      summary: {
        totalEntities,
        imported,
        skipped,
        failed,
      },
      details: {
        sequence: 1,
        changeDate: new Date(),
      },
      errors: [
        'STUB: Full import implementation pending. No data was actually imported.',
      ],
    };
  }

  // ============================================================================
  // System API Endpoints (Sprint 16)
  // ============================================================================

  /**
   * GetSystemHealth - Comprehensive system health check
   */
  async getSystemHealth(
    _ctx: Context,
    _request: GetSystemHealthRequest
  ): Promise<GetSystemHealthResponse> {
    console.log('\n--- Checking system health ---');
    
    const checks = {
      database: { status: 'unknown', responseTime: 0 },
      eventstore: { status: 'unknown', responseTime: 0 },
      projections: { status: 'unknown', healthy: 0, unhealthy: 0 },
    };

    // Check database
    try {
      const dbStart = Date.now();
      await this.database.query('SELECT 1', []);
      checks.database = {
        status: 'healthy',
        responseTime: Date.now() - dbStart,
      };
    } catch (error) {
      checks.database = { status: 'unhealthy', responseTime: 0 };
    }

    // Check eventstore (via events table)
    try {
      const esStart = Date.now();
      await this.database.query('SELECT COUNT(*) FROM public.events LIMIT 1', []);
      checks.eventstore = {
        status: 'healthy',
        responseTime: Date.now() - esStart,
      };
    } catch (error) {
      checks.eventstore = { status: 'unhealthy', responseTime: 0 };
    }

    // Check projections
    try {
      const states = await this.stateTracker.getAllProjectionStates();
      let healthy = 0;
      let unhealthy = 0;
      
      for (const state of states) {
        // Consider healthy if processed recently (within last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (state.lastUpdated && new Date(state.lastUpdated) > fiveMinutesAgo) {
          healthy++;
        } else {
          unhealthy++;
        }
      }
      
      checks.projections = {
        status: unhealthy === 0 ? 'healthy' : 'degraded',
        healthy,
        unhealthy,
      };
    } catch (error) {
      checks.projections = { status: 'unhealthy', healthy: 0, unhealthy: 0 };
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (checks.database.status === 'unhealthy' || checks.eventstore.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (checks.projections.status !== 'healthy') {
      overallStatus = 'degraded';
    }

    console.log(`✓ System health: ${overallStatus}`);

    return {
      status: overallStatus,
      checks,
      timestamp: new Date(),
    };
  }

  /**
   * GetSystemMetrics - Get system-wide metrics
   */
  async getSystemMetrics(
    ctx: Context,
    _request: GetSystemMetricsRequest
  ): Promise<GetSystemMetricsResponse> {
    const instanceID = ctx.instanceID || 'default';
    
    console.log('\n--- Gathering system metrics ---');

    // Get event count
    const eventResult = await this.database.query(
      'SELECT COUNT(*) as count FROM public.events WHERE instance_id = $1',
      [instanceID]
    );
    const totalEvents = Number(eventResult.rows[0]?.count || 0);

    // Get organization count
    const orgResult = await this.database.query(
      'SELECT COUNT(*) as count FROM projections.orgs WHERE instance_id = $1 AND state = $2',
      [instanceID, 'active']
    );
    const totalOrganizations = Number(orgResult.rows[0]?.count || 0);

    // Get user count
    const userResult = await this.database.query(
      'SELECT COUNT(*) as count FROM projections.users WHERE instance_id = $1 AND state = $2',
      [instanceID, 'active']
    );
    const totalUsers = Number(userResult.rows[0]?.count || 0);

    // Get project count
    const projectResult = await this.database.query(
      'SELECT COUNT(*) as count FROM projections.projects WHERE instance_id = $1 AND state = $2',
      [instanceID, 'active']
    );
    const totalProjects = Number(projectResult.rows[0]?.count || 0);

    // Calculate max projection lag
    let maxLag = 0;
    try {
      const latestEventResult = await this.database.query(
        'SELECT MAX(position) as max_pos FROM public.events WHERE instance_id = $1',
        [instanceID]
      );
      const latestPosition = Number(latestEventResult.rows[0]?.max_pos || 0);
      
      const states = await this.stateTracker.getAllProjectionStates();
      for (const state of states) {
        const lag = latestPosition - state.position;
        if (lag > maxLag) {
          maxLag = lag;
        }
      }
    } catch (error) {
      console.warn('Could not calculate projection lag:', error);
    }

    console.log('✓ Metrics gathered');

    return {
      metrics: {
        totalEvents,
        totalOrganizations,
        totalUsers,
        totalProjects,
        projectionLag: maxLag,
      },
      timestamp: new Date(),
    };
  }

  /**
   * ListViews - List all projection states (Zitadel Go aligned)
   */
  async listViews(
    _ctx: Context,
    _request: ListViewsRequest
  ): Promise<ListViewsResponse> {
    console.log('\n--- Listing views (projections) ---');
    
    const states = await this.stateTracker.getAllProjectionStates();

    const result = states.map(state => ({
      database: this.database.constructor.name,
      viewName: state.projectionName,
      processedSequence: Number(state.position),
      eventTimestamp: state.eventTimestamp || new Date(0),
      lastSuccessfulSpoolerRun: state.lastUpdated || new Date(0),
    }));

    console.log(`✓ Found ${result.length} views`);

    return { result };
  }

  /**
   * ListFailedEvents - List failed projection events (Zitadel Go aligned)
   */
  async listFailedEvents(
    ctx: Context,
    _request: ListFailedEventsRequest
  ): Promise<ListFailedEventsResponse> {
    console.log('\n--- Listing failed events ---');
    
    const instanceID = ctx.instanceID || 'default';
    
    // Query failed events from database
    const query = `
      SELECT 
        projection_name,
        failed_sequence,
        failure_count,
        error,
        last_failed
      FROM projections.projection_failed_events
      WHERE instance_id = $1
      ORDER BY last_failed DESC
    `;
    
    const queryResult = await this.database.query(query, [instanceID]);
    
    const result = queryResult.rows.map((row: any) => ({
      database: this.database.constructor.name,
      viewName: row.projection_name,
      failedSequence: Number(row.failed_sequence),
      failureCount: Number(row.failure_count),
      errorMessage: row.error,
      lastFailed: row.last_failed ? new Date(row.last_failed) : undefined,
    }));

    console.log(`✓ Found ${result.length} failed events`);

    return { result };
  }

  /**
   * RemoveFailedEvent - Remove a failed event (Zitadel Go aligned)
   */
  async removeFailedEvent(
    ctx: Context,
    request: RemoveFailedEventRequest
  ): Promise<RemoveFailedEventResponse> {
    console.log(`\n--- Removing failed event: ${request.viewName} @ ${request.failedSequence} ---`);
    
    const instanceID = ctx.instanceID || 'default';
    
    // Delete the failed event
    const query = `
      DELETE FROM projections.projection_failed_events
      WHERE instance_id = $1
        AND projection_name = $2
        AND failed_sequence = $3
    `;
    
    const result = await this.database.query(query, [
      instanceID,
      request.viewName,
      request.failedSequence,
    ]);
    
    if (result.rowCount === 0) {
      console.log('⚠ Failed event not found');
      throwNotFound('Failed event not found', 'ADMIN-FE01');
    }
    
    console.log('✓ Failed event removed');

    return {};
  }

  /**
   * GetDatabaseStatus - Get database connection status
   */
  async getDatabaseStatus(
    _ctx: Context,
    _request: GetDatabaseStatusRequest
  ): Promise<GetDatabaseStatusResponse> {
    console.log('\n--- Checking database status ---');
    
    let connected = false;
    let version = 'unknown';
    let poolSize = 0;
    let activeConnections = 0;

    try {
      // Check connection
      await this.database.query('SELECT 1', []);
      connected = true;

      // Get PostgreSQL version
      const versionResult = await this.database.query('SELECT version()', []);
      version = versionResult.rows[0]?.version || 'unknown';
      
      // Get connection pool stats (if available)
      try {
        const poolStats = await this.database.query(
          'SELECT count(*) as total FROM pg_stat_activity WHERE datname = current_database()',
          []
        );
        activeConnections = Number(poolStats.rows[0]?.total || 0);
      } catch (error) {
        // Pool stats might not be available
      }

      poolSize = 10; // Default pool size (would get from config in production)
    } catch (error) {
      console.error('Database check failed:', error);
    }

    console.log(`✓ Database ${connected ? 'connected' : 'disconnected'}`);

    return {
      connected,
      version,
      poolSize,
      activeConnections,
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
  // Policy Endpoints (Login & Branding)
  // ============================================================================

  /**
   * GetDefaultLoginPolicy - Get instance-level login policy
   */
  async getDefaultLoginPolicy(
    ctx: Context,
    _request: GetDefaultLoginPolicyRequest
  ): Promise<GetDefaultLoginPolicyResponse> {
    const instanceID = ctx.instanceID || 'test-instance';

    // Get login policy via queries
    const loginPolicyQueries = new (await import('../../../../lib/query/login-policy/login-policy-queries')).LoginPolicyQueries(this.database);
    
    const policy = await loginPolicyQueries.getActiveLoginPolicy(instanceID, instanceID);
    
    if (!policy) {
      throwNotFound('ADMIN-POL01', 'Login policy not found');
    }

    return {
      policy: {
        details: {
          sequence: Number(policy.sequence),
          changeDate: policy.changeDate,
          resourceOwner: instanceID,
        },
        allowUsernamePassword: policy.allowUsernamePassword,
        allowRegister: policy.allowRegister,
        allowExternalIdp: policy.allowExternalIDP,
        forceMfa: policy.forceMFA,
        forceMfaLocalOnly: policy.forceMFALocalOnly,
        hidePasswordReset: policy.hidePasswordReset,
        ignoreUnknownUsernames: policy.ignoreUnknownUsernames,
        allowDomainDiscovery: policy.allowDomainDiscovery,
        disableLoginWithEmail: policy.disableLoginWithEmail,
        disableLoginWithPhone: policy.disableLoginWithPhone,
        defaultRedirectUri: policy.defaultRedirectURI,
        passwordCheckLifetime: policy.passwordCheckLifetime,
        externalLoginCheckLifetime: policy.externalLoginCheckLifetime,
        mfaInitSkipLifetime: policy.mfaInitSkipLifetime,
        secondFactorCheckLifetime: policy.secondFactorCheckLifetime,
        multiFactorCheckLifetime: policy.multiFactorCheckLifetime,
      },
    };
  }

  /**
   * UpdateDefaultLoginPolicy - Update instance-level login policy
   */
  async updateDefaultLoginPolicy(
    ctx: Context,
    request: UpdateDefaultLoginPolicyRequest
  ): Promise<UpdateDefaultLoginPolicyResponse> {
    const instanceID = ctx.instanceID || 'test-instance';

    // Call command to update login policy
    const result = await this.commands.changeDefaultLoginPolicy(ctx, {
      allowUsernamePassword: request.allowUsernamePassword,
      allowRegister: request.allowRegister,
      allowExternalIDP: request.allowExternalIdp,
      forceMFA: request.forceMfa,
      forceMFALocalOnly: request.forceMfaLocalOnly,
      hidePasswordReset: request.hidePasswordReset,
      ignoreUnknownUsernames: request.ignoreUnknownUsernames,
      allowDomainDiscovery: request.allowDomainDiscovery,
      disableLoginWithEmail: request.disableLoginWithEmail,
      disableLoginWithPhone: request.disableLoginWithPhone,
      defaultRedirectURI: request.defaultRedirectUri,
      passwordCheckLifetime: request.passwordCheckLifetime,
      externalLoginCheckLifetime: request.externalLoginCheckLifetime,
      mfaInitSkipLifetime: request.mfaInitSkipLifetime,
      secondFactorCheckLifetime: request.secondFactorCheckLifetime,
      multiFactorCheckLifetime: request.multiFactorCheckLifetime,
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
   * GetLabelPolicy - Get instance-level label/branding policy
   */
  async getLabelPolicy(
    ctx: Context,
    _request: GetLabelPolicyRequest
  ): Promise<GetLabelPolicyResponse> {
    const instanceID = ctx.instanceID || 'test-instance';

    // Get label policy via queries
    const labelPolicyQueries = new (await import('../../../../lib/query/policy/label-policy-queries')).LabelPolicyQueries(this.database);
    
    const policy = await labelPolicyQueries.getActiveLabelPolicy(instanceID, instanceID);
    
    if (!policy) {
      throwNotFound('ADMIN-POL02', 'Label policy not found');
    }

    return {
      policy: {
        details: {
          sequence: Number(policy.sequence),
          changeDate: policy.changeDate,
          resourceOwner: instanceID,
        },
        primaryColor: policy.primaryColor,
        backgroundColor: policy.backgroundColor,
        warnColor: policy.warnColor,
        fontColor: policy.fontColor,
        primaryColorDark: policy.primaryColorDark,
        backgroundColorDark: policy.backgroundColorDark,
        warnColorDark: policy.warnColorDark,
        fontColorDark: policy.fontColorDark,
        logoUrl: policy.logoURL,
        iconUrl: policy.iconURL,
        logoUrlDark: policy.logoURLDark,
        iconUrlDark: policy.iconURLDark,
        fontUrl: policy.fontURL,
        hideLoginNameSuffix: policy.hideLoginNameSuffix,
        errorMsgPopup: policy.errorMsgPopup,
        disableWatermark: policy.disableWatermark,
        themeMode: policy.themeMode,
      },
    };
  }

  /**
   * UpdateLabelPolicy - Update instance-level label/branding policy
   */
  async updateLabelPolicy(
    ctx: Context,
    request: UpdateLabelPolicyRequest
  ): Promise<UpdateLabelPolicyResponse> {
    const instanceID = ctx.instanceID || 'test-instance';

    // Call command to update label policy
    const result = await this.commands.changeDefaultLabelPolicy(ctx, {
      primaryColor: request.primaryColor,
      backgroundColor: request.backgroundColor,
      warnColor: request.warnColor,
      fontColor: request.fontColor,
      primaryColorDark: request.primaryColorDark,
      backgroundColorDark: request.backgroundColorDark,
      warnColorDark: request.warnColorDark,
      fontColorDark: request.fontColorDark,
      logoURL: request.logoUrl,
      iconURL: request.iconUrl,
      logoURLDark: request.logoUrlDark,
      iconURLDark: request.iconUrlDark,
      fontURL: request.fontUrl,
      hideLoginNameSuffix: request.hideLoginNameSuffix,
      errorMsgPopup: request.errorMsgPopup,
      disableWatermark: request.disableWatermark,
      themeMode: request.themeMode,
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
   * GetPrivacyPolicy - Get instance-level privacy policy
   */
  async getPrivacyPolicy(
    ctx: Context,
    _request: GetPrivacyPolicyRequest
  ): Promise<GetPrivacyPolicyResponse> {
    const instanceID = ctx.instanceID || 'test-instance';

    // Get privacy policy via queries
    const privacyPolicyQueries = new (await import('../../../../lib/query/policy/privacy-policy-queries')).PrivacyPolicyQueries(this.database);
    
    const policy = await privacyPolicyQueries.getPrivacyPolicy(instanceID, instanceID);
    
    if (!policy) {
      throwNotFound('ADMIN-POL04', 'Privacy policy not found');
    }

    return {
      policy: {
        details: {
          sequence: Number(policy.sequence),
          changeDate: policy.changeDate,
          resourceOwner: instanceID,
        },
        tosLink: policy.tosLink,
        privacyLink: policy.privacyLink,
        helpLink: policy.helpLink,
        supportEmail: policy.supportEmail,
        docsLink: policy.docsLink,
        customLink: policy.customLink,
        customLinkText: policy.customLinkText,
      },
    };
  }

  /**
   * UpdatePrivacyPolicy - Update instance-level privacy policy
   */
  async updatePrivacyPolicy(
    ctx: Context,
    request: UpdatePrivacyPolicyRequest
  ): Promise<UpdatePrivacyPolicyResponse> {
    const instanceID = ctx.instanceID || 'test-instance';

    // Call command to update privacy policy
    const result = await this.commands.changeDefaultPrivacyPolicy(ctx, {
      tosLink: request.tosLink,
      privacyLink: request.privacyLink,
      helpLink: request.helpLink,
      supportEmail: request.supportEmail,
      docsLink: request.docsLink,
      customLink: request.customLink,
      customLinkText: request.customLinkText,
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
   * GetLockoutPolicy - Get instance-level lockout policy
   */
  async getLockoutPolicy(
    ctx: Context,
    _request: GetLockoutPolicyRequest
  ): Promise<GetLockoutPolicyResponse> {
    const instanceID = ctx.instanceID || 'test-instance';

    // Get lockout policy via queries
    const lockoutPolicyQueries = new (await import('../../../../lib/query/policy/lockout-policy-queries')).LockoutPolicyQueries(this.database);
    
    const policy = await lockoutPolicyQueries.getLockoutPolicy(instanceID, instanceID);
    
    if (!policy) {
      throwNotFound('ADMIN-POL06', 'Lockout policy not found');
    }

    return {
      policy: {
        details: {
          sequence: Number(policy.sequence),
          changeDate: policy.changeDate,
          resourceOwner: instanceID,
        },
        maxPasswordAttempts: policy.maxPasswordAttempts,
        maxOtpAttempts: policy.maxOTPAttempts,
        showLockOutFailures: policy.showFailures,
      },
    };
  }

  /**
   * UpdateLockoutPolicy - Update instance-level lockout policy
   */
  async updateLockoutPolicy(
    ctx: Context,
    request: UpdateLockoutPolicyRequest
  ): Promise<UpdateLockoutPolicyResponse> {
    const instanceID = ctx.instanceID || 'test-instance';

    // Call command to update lockout policy
    const result = await this.commands.changeDefaultPasswordLockoutPolicy(ctx, {
      maxPasswordAttempts: request.maxPasswordAttempts,
      maxOTPAttempts: request.maxOtpAttempts,
      showLockoutFailures: request.showLockOutFailures,
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
   * GetPasswordComplexityPolicy - Get instance-level password complexity policy
   */
  async getPasswordComplexityPolicy(
    ctx: Context,
    _request: GetPasswordComplexityPolicyRequest
  ): Promise<GetPasswordComplexityPolicyResponse> {
    const instanceID = ctx.instanceID || 'test-instance';

    // Query the password complexity policy
    const policy = await this.passwordComplexityQueries.getPasswordComplexityPolicy(instanceID);

    if (!policy) {
      // Return default policy
      return {
        policy: {
          details: {
            sequence: 0,
            changeDate: new Date(),
            resourceOwner: instanceID,
          },
          minLength: 8,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: true,
          hasSymbol: true,
        },
      };
    }

    return {
      policy: {
        details: {
          sequence: Number(policy.sequence),
          changeDate: policy.changeDate,
          resourceOwner: instanceID,
        },
        minLength: policy.minLength,
        hasUppercase: policy.hasUppercase,
        hasLowercase: policy.hasLowercase,
        hasNumber: policy.hasNumber,
        hasSymbol: policy.hasSymbol,
      },
    };
  }

  /**
   * UpdatePasswordComplexityPolicy - Update instance-level password complexity policy
   */
  async updatePasswordComplexityPolicy(
    ctx: Context,
    request: UpdatePasswordComplexityPolicyRequest
  ): Promise<UpdatePasswordComplexityPolicyResponse> {
    const instanceID = ctx.instanceID || 'test-instance';

    // Call command to update password complexity policy
    const result = await this.commands.changeDefaultPasswordComplexityPolicy(ctx, {
      minLength: request.minLength,
      hasLowercase: request.hasLowercase,
      hasUppercase: request.hasUppercase,
      hasNumber: request.hasNumber,
      hasSymbol: request.hasSymbol,
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
   * GetPasswordAgePolicy - Get instance-level password age policy
   */
  async getPasswordAgePolicy(
    ctx: Context,
    _request: GetPasswordAgePolicyRequest
  ): Promise<GetPasswordAgePolicyResponse> {
    const instanceID = ctx.instanceID || 'test-instance';

    // Query the password age policy
    const policy = await this.passwordAgeQueries.getPasswordAgePolicy(instanceID);

    if (!policy) {
      // Return default policy
      return {
        policy: {
          details: {
            sequence: 0,
            changeDate: new Date(),
            resourceOwner: instanceID,
          },
          maxAgeDays: 0, // 0 means no expiration
          expireWarnDays: 0,
        },
      };
    }

    return {
      policy: {
        details: {
          sequence: Number(policy.sequence),
          changeDate: policy.changeDate,
          resourceOwner: instanceID,
        },
        maxAgeDays: policy.maxAgeDays,
        expireWarnDays: policy.expireWarnDays,
      },
    };
  }

  /**
   * UpdatePasswordAgePolicy - Update instance-level password age policy
   */
  async updatePasswordAgePolicy(
    ctx: Context,
    request: UpdatePasswordAgePolicyRequest
  ): Promise<UpdatePasswordAgePolicyResponse> {
    const instanceID = ctx.instanceID || 'test-instance';

    // Call command to update password age policy
    const result = await this.commands.changeDefaultPasswordAgePolicy(ctx, {
      maxAgeDays: request.maxAgeDays ?? 0,
      expireWarnDays: request.expireWarnDays ?? 0,
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
   * GetSecurityPolicy - Get instance-level security policy
   */
  async getSecurityPolicy(
    ctx: Context,
    _request: GetSecurityPolicyRequest
  ): Promise<GetSecurityPolicyResponse> {
    const instanceID = ctx.instanceID || 'test-instance';

    // Query the security policy
    const policy = await this.securityPolicyQueries.getSecurityPolicy(instanceID);

    return {
      policy: {
        details: {
          sequence: policy.sequence,
          changeDate: policy.changeDate,
          resourceOwner: instanceID,
        },
        enableIframeEmbedding: policy.enableIframeEmbedding,
        allowedOrigins: policy.allowedOrigins,
        enableImpersonation: policy.enableImpersonation,
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
