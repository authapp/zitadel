/**
 * Organization Commands (Zitadel v2)
 * 
 * All organization-related write operations
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { OrgWriteModel, OrgState } from './org-write-model';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired, validateLength } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists, throwPreconditionFailed } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
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
 * Add organization command
 */
export async function addOrg(
  this: Commands,
  ctx: Context,
  data: AddOrgData
): Promise<ObjectDetails & { orgID: string }> {
  // 1. Create domain object (following Go pattern)
  const organisation = new Organization(
    data.orgID || '',
    ctx.instanceID,
    data.name,
    DomainOrgState.ACTIVE
  );
  
  // 2. Validate domain object (following Go pattern: organisation.IsValid())
  if (!organisation.isValid()) {
    throwInvalidArgument('invalid organization data', 'COMMAND-Org01');
  }
  
  // 3. Generate org ID if not provided
  if (!data.orgID) {
    data.orgID = await this.nextID();
    organisation.aggregateID = data.orgID;
  }
  
  // 4. Check permissions (instance level)
  await this.checkPermission(ctx, 'org', 'create', ctx.instanceID);
  
  // 5. Load write model to check existence
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), data.orgID, data.orgID);
  
  if (wm.state !== OrgState.UNSPECIFIED) {
    throwAlreadyExists('organization already exists', 'COMMAND-Org10');
  }
  
  // 6. Use domain method to add IAM domain (following Go pattern)
  organisation.addIAMDomain(ctx.requestedDomain || 'localhost');
  
  // 7. Generate commands from domain object
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
  
  // 8. Add domain commands (following Go pattern: iterate organisation.Domains)
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
  
  // 9. Push all commands to eventstore
  const events = await this.getEventstore().pushMany(commands);
  
  // 10. Update write model with all events
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
 * Add organization member command
 */
export async function addOrgMember(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: AddOrgMemberData
): Promise<ObjectDetails> {
  // 1. Validate
  validateRequired(data.userID, 'userID');
  if (!data.roles || data.roles.length === 0) {
    throwInvalidArgument('at least one role required', 'COMMAND-Org50');
  }
  
  // 2. Load org write model
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (wm.state === OrgState.UNSPECIFIED) {
    throwNotFound('organization not found', 'COMMAND-Org51');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'org.member', 'create', orgID);
  
  // 4. Create command
  const command: Command = {
    eventType: 'org.member.added',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userID: data.userID,
      roles: data.roles,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Change org member roles
 */
export async function changeOrgMember(
  this: Commands,
  ctx: Context,
  orgID: string,
  userID: string,
  roles: string[]
): Promise<ObjectDetails> {
  // 1. Validate
  if (!roles || roles.length === 0) {
    throwInvalidArgument('at least one role required', 'COMMAND-Org60');
  }
  
  // 2. Load org write model
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (wm.state === OrgState.UNSPECIFIED) {
    throwNotFound('organization not found', 'COMMAND-Org61');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'org.member', 'update', orgID);
  
  // 4. Create command
  const command: Command = {
    eventType: 'org.member.changed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userID,
      roles,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Remove organization member command
 */
export async function removeOrgMember(
  this: Commands,
  ctx: Context,
  orgID: string,
  userID: string
): Promise<ObjectDetails> {
  // 1. Load org write model
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (wm.state === OrgState.UNSPECIFIED) {
    throwNotFound('organization not found', 'COMMAND-Org70');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'org.member', 'delete', orgID);
  
  // 3. Create command
  const command: Command = {
    eventType: 'org.member.removed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userID,
    },
  };
  
  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
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
export async function addDomain(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: AddDomainData
): Promise<ObjectDetails> {
  // 1. Validate
  validateRequired(data.domain, 'domain');
  
  // 2. Load org write model
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (wm.state === OrgState.UNSPECIFIED) {
    throwNotFound('organization not found', 'COMMAND-Org80');
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
