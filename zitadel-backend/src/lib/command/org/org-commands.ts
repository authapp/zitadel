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
