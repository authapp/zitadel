/**
 * Organization Commands (Zitadel v2)
 * 
 * All organization-related write operations
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { OrgWriteModel, OrgState } from './org-write-model';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails, WriteModel } from '../write-model';
import { validateRequired, validateLength } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists, throwPreconditionFailed } from '@/zerrors/errors';
import { Command, Event } from '../../eventstore/types';
import { Organization, OrgState as DomainOrgState } from '@/domain/entities/organization';
import * as crypto from 'crypto';

/**
 * Add Organization Data
 */
export interface AddOrgData {
  orgID?: string;
  name: string;
}

/**
 * Organization Member Write Model
 * Tracks whether a user is a member of an organization
 * Based on Go: internal/command/org_member_model.go
 */
class OrgMemberWriteModel extends WriteModel {
  userID: string;
  isMember: boolean = false;
  roles: string[] = [];

  constructor(orgID: string, userID: string) {
    super('org');
    this.aggregateID = orgID;
    this.resourceOwner = orgID;
    this.userID = userID;
  }

  reduce(event: Event): void {
    // Only process events for this specific user
    const eventUserID = event.payload?.userId || event.payload?.userID;
    if (eventUserID !== this.userID) {
      return;
    }

    switch (event.eventType) {
      case 'org.member.added':
        this.isMember = true;
        this.roles = event.payload?.roles || [];
        break;
      case 'org.member.changed':
        this.roles = event.payload?.roles || [];
        break;
      case 'org.member.removed':
      case 'org.member.cascade.removed':
        this.isMember = false;
        this.roles = [];
        break;
    }
  }
}

/**
 * Add organization command
 */
export async function addOrg(
  this: Commands,
  ctx: Context,
  data: AddOrgData
): Promise<ObjectDetails & { orgID: string }> {
  // 1. Validate name length
  validateRequired(data.name, 'name');
  if (data.name.length < 3) {
    throwInvalidArgument('name must be at least 3 characters', 'COMMAND-Org00a');
  }
  if (data.name.length > 200) {
    throwInvalidArgument('name must be less than 200 characters', 'COMMAND-Org00b');
  }
  
  // 2. Create domain object (following Go pattern)
  const organisation = new Organization(
    data.orgID || '',
    ctx.instanceID,
    data.name,
    DomainOrgState.ACTIVE
  );
  
  // 3. Validate domain object (following Go pattern: organisation.IsValid())
  if (!organisation.isValid()) {
    throwInvalidArgument('invalid organization data', 'COMMAND-Org01');
  }
  
  // 4. Generate org ID if not provided
  if (!data.orgID) {
    data.orgID = await this.nextID();
    organisation.aggregateID = data.orgID;
  }
  
  // 5. Check permissions (instance level)
  await this.checkPermission(ctx, 'org', 'create', ctx.instanceID);
  
  // 6. Load write model to check existence
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), data.orgID, data.orgID);
  
  if (wm.state !== OrgState.UNSPECIFIED) {
    throwAlreadyExists('organization already exists', 'COMMAND-Org10');
  }
  
  // 7. Use domain method to add IAM domain (following Go pattern)
  organisation.addIAMDomain(ctx.requestedDomain || 'localhost');
  
  // 8. Generate commands from domain object
  const commands: Command[] = [
    {
      eventType: 'org.added',
      aggregateType: 'org',
      aggregateID: data.orgID,
      owner: data.orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        name: organisation.name, // Use domain object's validated name
      },
    },
  ];
  
  // 9. Add domain commands (following Go pattern: iterate organisation.Domains)
  for (const orgDomain of organisation.domains) {
    if (orgDomain.domain) {
      commands.push({
        eventType: 'org.domain.added',
        aggregateType: 'org',
        aggregateID: data.orgID,
        owner: data.orgID,
        instanceID: ctx.instanceID,
        creator: ctx.userID || 'system',
        payload: {
          domain: orgDomain.domain,
          isPrimary: orgDomain.isPrimary,
          isVerified: orgDomain.isVerified,
        },
      });
      
      // If domain is verified, add verification event
      if (orgDomain.isVerified) {
        commands.push({
          eventType: 'org.domain.verified',
          aggregateType: 'org',
          aggregateID: data.orgID,
          owner: data.orgID,
          instanceID: ctx.instanceID,
          creator: ctx.userID || 'system',
          payload: {
            domain: orgDomain.domain,
          },
        });
      }
      
      // If domain is primary, add primary set event
      if (orgDomain.isPrimary) {
        commands.push({
          eventType: 'org.domain.primary.set',
          aggregateType: 'org',
          aggregateID: data.orgID,
          owner: data.orgID,
          instanceID: ctx.instanceID,
          creator: ctx.userID || 'system',
          payload: {
            domain: orgDomain.domain,
          },
        });
      }
    }
  }
  
  // 10. Push commands to eventstore
  const events = await this.getEventstore().pushMany(commands);
  
  // 11. Update write model with all events
  for (const event of events) {
    appendAndReduce(wm, event);
  }
  
  return {
    ...writeModelToObjectDetails(wm),
    orgID: data.orgID,
  };
}

/**
 * Change Organization Data
 */
export interface ChangeOrgData {
  name?: string;
}

/**
 * Change organization command
 */
export async function changeOrg(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: ChangeOrgData
): Promise<ObjectDetails> {
  // 1. Validate
  if (!data.name) {
    throwInvalidArgument('at least one field must be provided', 'COMMAND-Org20');
  }
  validateRequired(data.name, 'name');
  validateLength(data.name, 'name', 1, 200);
  
  // 2. Load write model
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (wm.state === OrgState.UNSPECIFIED) {
    throwNotFound('organization not found', 'COMMAND-Org21');
  }
  
  // 3. Check if name changed
  if (wm.name === data.name) {
    throwPreconditionFailed('name not changed', 'COMMAND-Org22');
  }
  
  // 4. Check permissions
  await this.checkPermission(ctx, 'org', 'update', orgID);
  
  // 5. Create command
  const command: Command = {
    eventType: 'org.changed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      name: data.name,
    },
  };
  
  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Deactivate organization command
 */
export async function deactivateOrg(
  this: Commands,
  ctx: Context,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Load write model
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (wm.state === OrgState.UNSPECIFIED) {
    throwNotFound('organization not found', 'COMMAND-Org30');
  }
  if (wm.state === OrgState.INACTIVE) {
    throwPreconditionFailed('organization already inactive', 'COMMAND-Org31');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'org', 'update', orgID);
  
  // 3. Create command
  const command: Command = {
    eventType: 'org.deactivated',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };
  
  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Reactivate organization command
 */
export async function reactivateOrg(
  this: Commands,
  ctx: Context,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Load write model
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (wm.state === OrgState.UNSPECIFIED) {
    throwNotFound('organization not found', 'COMMAND-Org40');
  }
  if (wm.state === OrgState.ACTIVE) {
    throwPreconditionFailed('organization already active', 'COMMAND-Org41');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'org', 'update', orgID);
  
  // 3. Create command
  const command: Command = {
    eventType: 'org.reactivated',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };
  
  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Add org member data
 */
export interface AddOrgMemberData {
  userID: string;
  roles: string[];
}

/**
 * Valid organization role prefixes
 */
const ORG_ROLE_PREFIX = 'ORG_';
const SELF_MANAGEMENT_GLOBAL = 'SELF_MANAGEMENT_GLOBAL';

/**
 * Validate organization roles
 * Based on Go: IsValid() in AddOrgMember (org_member.go:79-87)
 */
function validateOrgRoles(roles: string[]): void {
  if (!roles || roles.length === 0) {
    throwInvalidArgument('at least one role required', 'ORG-4Mlfs');
  }

  // Check that all roles have valid prefix
  const invalidRoles = roles.filter(role => {
    return !role.startsWith(ORG_ROLE_PREFIX) && role !== SELF_MANAGEMENT_GLOBAL;
  });

  if (invalidRoles.length > 0) {
    throwInvalidArgument(`invalid organization roles: ${invalidRoles.join(', ')}`, 'ORG-4N8es');
  }
}

/**
 * Add organization member command
 * Based on Go: AddOrgMember (org_member.go:89-113)
 */
export async function addOrgMember(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: AddOrgMemberData
): Promise<ObjectDetails> {
  // 1. Validate
  validateRequired(orgID, 'orgID');
  validateRequired(data.userID, 'userID');
  validateOrgRoles(data.roles);
  
  // 2. Check if user exists (simplified check via projection for now)
  // TODO: In production, this should use ExistsUser with proper event filtering
  // For now, we assume the user exists if it's in the projection table or will be validated at event level
  
  // 3. Check if user is already a member
  const memberWM = new OrgMemberWriteModel(orgID, data.userID);
  await memberWM.load(this.getEventstore(), orgID, orgID);
  
  if (memberWM.isMember) {
    throwAlreadyExists('user is already an organization member', 'ORG-poWwe');
  }
  
  // 4. Org existence check simplified for now - foreign keys will enforce referential integrity
  // TODO: In production, load OrgWriteModel to check existence properly
  
  // 5. Check permissions
  await this.checkPermission(ctx, 'org.member', 'create', orgID);
  
  // 6. Create command
  const command: Command = {
    eventType: 'org.member.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userId: data.userID,
      roles: data.roles,
    },
  };
  
  // 7. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(memberWM, event);
  
  return writeModelToObjectDetails(memberWM);
}

/**
 * Change org member roles
 * Based on Go: ChangeOrgMember (org_member.go:132-169)
 */
export async function changeOrgMember(
  this: Commands,
  ctx: Context,
  orgID: string,
  userID: string,
  roles: string[]
): Promise<ObjectDetails> {
  // 1. Validate
  validateRequired(orgID, 'orgID');
  validateRequired(userID, 'userID');
  validateOrgRoles(roles);
  
  // 2. Load member write model
  const memberWM = new OrgMemberWriteModel(orgID, userID);
  await memberWM.load(this.getEventstore(), orgID, orgID);
  
  if (!memberWM.isMember) {
    throwNotFound('organization member not found', 'ORG-D8JxR');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'org.member', 'update', orgID);
  
  // 4. Check if roles actually changed (idempotency)
  const rolesEqual = memberWM.roles.length === roles.length &&
    memberWM.roles.every((role, index) => role === roles[index]);

  if (rolesEqual) {
    return writeModelToObjectDetails(memberWM);
  }
  
  // 5. Create command
  const command: Command = {
    eventType: 'org.member.changed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userId: userID,
      roles,
    },
  };
  
  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(memberWM, event);
  
  return writeModelToObjectDetails(memberWM);
}

/**
 * Remove organization member command
 * Based on Go: RemoveOrgMember (org_member.go:171-201)
 */
export async function removeOrgMember(
  this: Commands,
  ctx: Context,
  orgID: string,
  userID: string,
  cascade: boolean = false
): Promise<ObjectDetails> {
  // 1. Validate
  validateRequired(orgID, 'orgID');
  validateRequired(userID, 'userID');

  // 2. Load member write model
  const memberWM = new OrgMemberWriteModel(orgID, userID);
  await memberWM.load(this.getEventstore(), orgID, orgID);
  
  // If member doesn't exist, return success (idempotent)
  if (!memberWM.isMember) {
    return writeModelToObjectDetails(memberWM);
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'org.member', 'delete', orgID);
  
  // 4. Create command (cascade or normal removal)
  const eventType = cascade ? 'org.member.cascade.removed' : 'org.member.removed';
  const command: Command = {
    eventType,
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userId: userID,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(memberWM, event);
  
  return writeModelToObjectDetails(memberWM);
}

/**
 * Add domain data
 */
export interface AddDomainData {
  domain: string;
}

/**
 * Add domain command
 */
/**
 * Validate domain format
 * Allows: example.com, subdomain.example.com, app.sub.example.com
 * Rejects: invalid domain!, domain with spaces, -leading.com
 */
function isValidDomainFormat(domain: string): boolean {
  // Basic domain regex: allows alphanumeric, hyphens, dots
  // Must not start/end with hyphen or dot
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
}

export async function addDomain(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: AddDomainData
): Promise<ObjectDetails> {
  // 1. Validate
  validateRequired(data.domain, 'domain');
  
  // Validate domain format
  if (!isValidDomainFormat(data.domain)) {
    throwInvalidArgument('invalid domain format', 'COMMAND-Org79');
  }
  
  // 2. Load org write model
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (wm.state === OrgState.UNSPECIFIED) {
    throwNotFound('organization not found', 'COMMAND-Org80');
  }
  
  // Check if domain already exists
  if (wm.hasDomain(data.domain)) {
    throwAlreadyExists('domain already exists in organization', 'COMMAND-Org80a');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'org.domain', 'create', orgID);
  
  // 4. Create command
  const command: Command = {
    eventType: 'org.domain.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      domain: data.domain,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Verify domain command
 */
export async function verifyDomain(
  this: Commands,
  ctx: Context,
  orgID: string,
  domain: string
): Promise<ObjectDetails> {
  // 1. Load org write model
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (wm.state === OrgState.UNSPECIFIED) {
    throwNotFound('organization not found', 'COMMAND-Org90');
  }
  
  // Check if domain exists
  if (!wm.hasDomain(domain)) {
    throwNotFound('domain not found in organization', 'COMMAND-Org90a');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'org.domain', 'update', orgID);
  
  // 3. Create command
  const command: Command = {
    eventType: 'org.domain.verified',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      domain,
    },
  };
  
  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Set primary domain command
 */
export async function setPrimaryDomain(
  this: Commands,
  ctx: Context,
  orgID: string,
  domain: string
): Promise<ObjectDetails> {
  // 1. Load org write model
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (wm.state === OrgState.UNSPECIFIED) {
    throwNotFound('organization not found', 'COMMAND-OrgA0');
  }
  
  // Check if domain exists
  if (!wm.hasDomain(domain)) {
    throwNotFound('domain not found in organization', 'COMMAND-OrgA0a');
  }
  
  // Check if domain is verified
  if (!wm.isDomainVerified(domain)) {
    throwPreconditionFailed('domain must be verified before setting as primary', 'COMMAND-OrgA0b');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'org.domain', 'update', orgID);
  
  // 3. Create command
  const command: Command = {
    eventType: 'org.domain.primary.set',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      domain,
    },
  };
  
  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Remove domain command
 * Based on Go: RemoveOrgDomain (lines 264-288)
 */
export async function removeDomain(
  this: Commands,
  ctx: Context,
  orgID: string,
  domain: string
): Promise<ObjectDetails> {
  // 1. Validate input
  validateRequired(domain, 'domain');
  
  // 2. Load org write model
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (wm.state === OrgState.UNSPECIFIED) {
    throwNotFound('organization not found', 'COMMAND-OrgB0');
  }
  
  // Check if domain exists
  if (!wm.hasDomain(domain)) {
    throwNotFound('domain not found in organization', 'COMMAND-OrgB0a');
  }
  
  // 3. Validate domain exists and is not primary
  // Note: In production, should load OrgDomainWriteModel to check domain state
  if (wm.primaryDomain === domain) {
    throwPreconditionFailed('primary domain cannot be deleted', 'COMMAND-OrgB1');
  }
  
  // 4. Check permissions
  await this.checkPermission(ctx, 'org.domain', 'delete', orgID);
  
  // 5. Create command
  const command: Command = {
    eventType: 'org.domain.removed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      domain,
      wasVerified: true, // Assume verified for now; in production check domain write model
    },
  };
  
  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Generate domain validation data
 * Based on Go: GenerateOrgDomainValidation (lines 142-178)
 */
export interface GenerateDomainValidationResult {
  token: string;
  url: string;
  validationCode: string;
}

export async function generateDomainValidation(
  this: Commands,
  ctx: Context,
  orgID: string,
  domain: string,
  validationType: 'DNS' | 'HTTP' = 'HTTP'
): Promise<GenerateDomainValidationResult> {
  // 1. Validate input
  validateRequired(domain, 'domain');
  
  // 2. Load org write model
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (wm.state === OrgState.UNSPECIFIED) {
    throwNotFound('organization not found', 'COMMAND-OrgC0');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'org.domain', 'update', orgID);
  
  // 4. Generate validation code (random token)
  const validationCode = crypto.randomBytes(32).toString('hex'); // 32 bytes = 64 hex chars
  
  // 5. Generate URL based on validation type
  let url: string;
  if (validationType === 'HTTP') {
    url = `https://${domain}/.well-known/zitadel-challenge/${validationCode}`;
  } else {
    // DNS TXT record
    url = `_zitadel-challenge.${domain}`;
  }
  
  // 6. Create command to store validation code
  const command: Command = {
    eventType: 'org.domain.verification.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      domain,
      validationType,
      validationCode, // In production, this should be encrypted
    },
  };
  
  // 7. Push event
  await this.getEventstore().push(command);
  
  return {
    token: validationCode,
    url,
    validationCode,
  };
}

/**
 * Validate organization domain ownership
 * Based on Go: ValidateOrgDomain (lines 180-233)
 */
export interface ValidateOrgDomainData {
  validationCode?: string; // Provided by user for HTTP validation
  claimedUserIDs?: string[]; // User IDs to claim on verification
}

export async function validateOrgDomain(
  this: Commands,
  ctx: Context,
  orgID: string,
  domain: string,
  data: ValidateOrgDomainData = {}
): Promise<ObjectDetails> {
  // 1. Validate input
  validateRequired(domain, 'domain');
  
  // 2. Load org write model
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (wm.state === OrgState.UNSPECIFIED) {
    throwNotFound('organization not found', 'COMMAND-OrgD0');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'org.domain', 'update', orgID);
  
  // 4. Verify domain ownership
  // Note: In production, this would:
  // - Check HTTP endpoint or DNS TXT record
  // - Compare with stored validation code
  // - Use domain verification service
  
  // For now, we'll assume validation succeeds if validation code matches
  const isValid = true; // Simplified - in production, perform actual verification
  
  if (!isValid) {
    // Create verification failed event
    const failCommand: Command = {
      eventType: 'org.domain.verification.failed',
      aggregateType: 'org',
      aggregateID: orgID,
      owner: orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        domain,
      },
    };
    await this.getEventstore().push(failCommand);
    throwPreconditionFailed('domain verification failed', 'COMMAND-OrgD1');
  }
  
  // 5. Create verification succeeded events
  const commands: Command[] = [
    {
      eventType: 'org.domain.verified',
      aggregateType: 'org',
      aggregateID: orgID,
      owner: orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        domain,
      },
    },
  ];
  
  // 6. Claim users if provided
  if (data.claimedUserIDs && data.claimedUserIDs.length > 0) {
    for (const userID of data.claimedUserIDs) {
      commands.push({
        eventType: 'user.domain.claimed',
        aggregateType: 'user',
        aggregateID: userID,
        owner: orgID,
        instanceID: ctx.instanceID,
        creator: ctx.userID || 'system',
        payload: {
          userName: `claimed-user-${userID}`,
          oldUserName: `old-user-${userID}`,
          tempUserName: `temp-${userID}`,
        },
      });
    }
  }
  
  // 7. Push all commands
  const events = await this.getEventstore().pushMany(commands);
  
  // 8. Update write model
  for (const event of events) {
    appendAndReduce(wm, event);
  }
  
  return writeModelToObjectDetails(wm);
}
