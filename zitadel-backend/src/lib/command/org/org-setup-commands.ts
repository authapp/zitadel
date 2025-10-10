/**
 * Organization Setup Commands (Phase 3)
 * 
 * Complex organization initialization commands
 * Based on: internal/command/org.go SetUpOrg function
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { OrgWriteModel, OrgState } from './org-write-model';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired, validateLength } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists, throwPreconditionFailed } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';

/**
 * Organization Setup Admin
 */
export interface OrgSetupAdmin {
  userID?: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  roles?: string[];
}

/**
 * Organization Setup Data
 */
export interface OrgSetupData {
  orgID?: string;
  name: string;
  customDomain?: string;
  admins: OrgSetupAdmin[];
}

/**
 * Setup organization command - creates org with admins and domains
 * This is the complex organization initialization used for instance setup
 * Based on Go: SetUpOrg (lines 266-310)
 */
export async function setupOrg(
  this: Commands,
  ctx: Context,
  setup: OrgSetupData
): Promise<ObjectDetails & { 
  orgID: string;
  createdAdmins: Array<{ userID: string; username: string }>;
}> {
  // 1. Validate input
  validateRequired(setup.name, 'name');
  validateLength(setup.name, 'name', 1, 200);
  
  if (!setup.admins || setup.admins.length === 0) {
    throwInvalidArgument('at least one admin is required', 'COMMAND-OrgSetup01');
  }
  
  // 2. Generate org ID if not provided
  if (!setup.orgID) {
    setup.orgID = await this.nextID();
  }
  
  // 3. Check org doesn't already exist
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), setup.orgID, setup.orgID);
  
  if (wm.state !== OrgState.UNSPECIFIED) {
    throwAlreadyExists('organization already exists', 'COMMAND-OrgSetup02');
  }
  
  // 4. Check permissions (instance level)
  await this.checkPermission(ctx, 'org', 'create', ctx.instanceID);
  
  // 5. Create org command
  const orgCommand: Command = {
    eventType: 'org.added',
    aggregateType: 'org',
    aggregateID: setup.orgID,
    owner: setup.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      name: setup.name,
    },
  };
  
  // 6. Push org creation
  let event = await this.getEventstore().push(orgCommand);
  appendAndReduce(wm, event);
  
  // 7. Add custom domain if provided
  if (setup.customDomain) {
    const domainCommand: Command = {
      eventType: 'org.domain.added',
      aggregateType: 'org',
      aggregateID: setup.orgID,
      owner: setup.orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        domain: setup.customDomain,
      },
    };
    
    event = await this.getEventstore().push(domainCommand);
    
    // Verify domain
    const verifyCommand: Command = {
      eventType: 'org.domain.verified',
      aggregateType: 'org',
      aggregateID: setup.orgID,
      owner: setup.orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        domain: setup.customDomain,
      },
    };
    
    await this.getEventstore().push(verifyCommand);
    
    // Set as primary domain
    const primaryCommand: Command = {
      eventType: 'org.domain.primary.set',
      aggregateType: 'org',
      aggregateID: setup.orgID,
      owner: setup.orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        domain: setup.customDomain,
      },
    };
    
    await this.getEventstore().push(primaryCommand);
  }
  
  // 8. Create admin users
  const createdAdmins: Array<{ userID: string; username: string }> = [];
  
  for (const admin of setup.admins) {
    // Generate user ID if not provided
    const userID = admin.userID || await this.nextID();
    
    // Determine default roles
    const roles = admin.roles && admin.roles.length > 0 
      ? admin.roles 
      : ['ORG_OWNER'];
    
    // Create human user command
    const userCommand: Command = {
      eventType: 'user.human.added',
      aggregateType: 'user',
      aggregateID: userID,
      owner: setup.orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        username: admin.username || admin.email,
        email: admin.email,
        firstName: admin.firstName || '',
        lastName: admin.lastName || '',
        passwordSet: !!admin.password,
      },
    };
    
    await this.getEventstore().push(userCommand);
    
    // Add as org member
    const memberCommand: Command = {
      eventType: 'org.member.added',
      aggregateType: 'org',
      aggregateID: setup.orgID,
      owner: setup.orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        userID,
        roles,
      },
    };
    
    await this.getEventstore().push(memberCommand);
    
    createdAdmins.push({
      userID,
      username: admin.username || admin.email || userID,
    });
  }
  
  return {
    ...writeModelToObjectDetails(wm),
    orgID: setup.orgID,
    createdAdmins,
  };
}

/**
 * Remove organization command
 * Based on Go: RemoveOrg (lines 480-498)
 */
export async function removeOrg(
  this: Commands,
  ctx: Context,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Validate input
  validateRequired(orgID, 'orgID');
  
  // 2. Check this is not the default instance org
  if (orgID === ctx.instanceID) {
    throwPreconditionFailed('cannot remove default instance organization', 'COMMAND-OrgRemove01');
  }
  
  // 3. Load org write model to verify it exists
  const wm = new OrgWriteModel();
  await wm.load(this.getEventstore(), orgID, orgID);
  
  if (wm.state === OrgState.UNSPECIFIED) {
    throwNotFound('organization not found', 'COMMAND-OrgRemove02');
  }
  
  if (wm.state === OrgState.INACTIVE) {
    throwPreconditionFailed('organization is inactive', 'COMMAND-OrgRemove03');
  }
  
  // 4. Check permissions
  await this.checkPermission(ctx, 'org', 'delete', orgID);
  
  // 5. Create command
  const command: Command = {
    eventType: 'org.removed',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };
  
  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}
