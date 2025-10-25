/**
 * Project Grant Member Commands
 * 
 * Manages members for cross-organization project grants
 * Based on Go: internal/command/project_grant_member.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { WriteModel } from '../write-model';

/**
 * Member State enum
 */
enum MemberState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REMOVED = 2,
}

/**
 * Project Grant Member Write Model
 */
class ProjectGrantMemberWriteModel extends WriteModel {
  userID: string = '';
  grantID: string = '';
  roles: string[] = [];
  state: MemberState = MemberState.UNSPECIFIED;

  constructor(projectID: string) {
    super('project');
    this.aggregateID = projectID;
  }

  reduce(event: any): void {
    switch (event.eventType) {
      case 'project.grant.member.added':
        // Only process if this is the user+grant we're looking for
        if (event.payload?.userID === this.userID && event.payload?.grantID === this.grantID) {
          this.roles = event.payload?.roles || [];
          this.state = MemberState.ACTIVE;
        }
        break;
      case 'project.grant.member.changed':
        if (event.payload?.userID === this.userID && event.payload?.grantID === this.grantID) {
          this.roles = event.payload?.roles || [];
        }
        break;
      case 'project.grant.member.removed':
      case 'project.grant.member.cascade.removed':
        if (event.payload?.userID === this.userID && event.payload?.grantID === this.grantID) {
          this.state = MemberState.REMOVED;
        }
        break;
    }
  }
}

/**
 * Helper function to check if a grant exists by querying events
 */
async function checkGrantExists(
  this: Commands,
  projectID: string,
  grantID: string
): Promise<boolean> {
  const events = await this.getEventstore().query({
    aggregateTypes: ['project'],
    aggregateIDs: [projectID],
  });

  let grantActive = false;
  for (const event of events) {
    const payload = event.payload || {};
    
    // Check for grant.added event
    if (event.eventType === 'project.grant.added' && 
        (payload.grantID === grantID || payload.id === grantID)) {
      grantActive = true;
    }
    
    // Check for grant.removed event
    if (event.eventType === 'project.grant.removed' && 
        (payload.grantID === grantID || payload.id === grantID)) {
      grantActive = false;
    }
  }
  
  return grantActive;
}

/**
 * Add project grant member data
 */
export interface AddProjectGrantMemberData {
  projectID: string;
  userID: string;
  grantID: string;
  orgID: string; // The org that owns the project
  roles: string[];
}

/**
 * Change project grant member data
 */
export interface ChangeProjectGrantMemberData {
  projectID: string;
  userID: string;
  grantID: string;
  orgID: string;
  roles: string[];
}

/**
 * Add member to project grant
 * Based on Go: AddProjectGrantMember (project_grant_member.go:34-89)
 * 
 * Adds a user as a member of a cross-org project grant with specific roles
 */
export async function addProjectGrantMember(
  this: Commands,
  ctx: Context,
  data: AddProjectGrantMemberData
): Promise<ObjectDetails> {
  validateRequired(data.projectID, 'projectID');
  validateRequired(data.userID, 'userID');
  validateRequired(data.grantID, 'grantID');
  validateRequired(data.orgID, 'orgID');

  if (!data.roles || data.roles.length === 0) {
    throwInvalidArgument('at least one roles is required', 'GRANT-MEMBER-001');
  }

  // Check permissions
  await this.checkPermission(ctx, 'project.grant.member', 'write', data.orgID);

  // Validate that grant exists by checking project events
  const grantExists = await checkGrantExists.call(this, data.projectID, data.grantID);
  if (!grantExists) {
    throwNotFound('grant not found', 'GRANT-MEMBER-005');
  }

  // Load write model to check if member already exists
  const wm = new ProjectGrantMemberWriteModel(data.projectID);
  wm.userID = data.userID;
  wm.grantID = data.grantID;
  await wm.load(this.getEventstore(), data.projectID, data.orgID);

  if (wm.state === MemberState.ACTIVE) {
    throwAlreadyExists('member already exists', 'GRANT-MEMBER-002');
  }

  // Create event
  const command: Command = {
    eventType: 'project.grant.member.added',
    aggregateType: 'project',
    aggregateID: data.projectID,
    owner: data.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userID: data.userID,
      grantID: data.grantID,
      roles: data.roles,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Change project grant member roles
 * Based on Go: ChangeProjectGrantMember (project_grant_member.go:110-153)
 * 
 * Updates the roles of an existing project grant member
 */
export async function changeProjectGrantMember(
  this: Commands,
  ctx: Context,
  data: ChangeProjectGrantMemberData
): Promise<ObjectDetails> {
  validateRequired(data.projectID, 'projectID');
  validateRequired(data.userID, 'userID');
  validateRequired(data.grantID, 'grantID');
  validateRequired(data.orgID, 'orgID');

  if (!data.roles || data.roles.length === 0) {
    throwInvalidArgument('at least one roles is required', 'GRANT-MEMBER-003');
  }

  // Check permissions
  await this.checkPermission(ctx, 'project.grant.member', 'write', data.orgID);

  // Load write model
  const wm = new ProjectGrantMemberWriteModel(data.projectID);
  wm.userID = data.userID;
  wm.grantID = data.grantID;
  await wm.load(this.getEventstore(), data.projectID, data.orgID);

  if (wm.state !== MemberState.ACTIVE) {
    throwNotFound('member not found', 'GRANT-MEMBER-004');
  }

  // Check if roles have changed (order-independent comparison)
  const sortedWmRoles = [...wm.roles].sort();
  const sortedDataRoles = [...data.roles].sort();
  const rolesChanged = 
    sortedWmRoles.length !== sortedDataRoles.length ||
    !sortedWmRoles.every((role, index) => role === sortedDataRoles[index]);

  if (!rolesChanged) {
    // No changes needed
    return writeModelToObjectDetails(wm);
  }

  // Create event
  const command: Command = {
    eventType: 'project.grant.member.changed',
    aggregateType: 'project',
    aggregateID: data.projectID,
    owner: data.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userID: data.userID,
      grantID: data.grantID,
      roles: data.roles,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove project grant member
 * Based on Go: RemoveProjectGrantMember (project_grant_member.go:155-189)
 * 
 * Removes a member from a cross-org project grant
 */
export async function removeProjectGrantMember(
  this: Commands,
  ctx: Context,
  projectID: string,
  userID: string,
  grantID: string,
  orgID: string
): Promise<ObjectDetails> {
  validateRequired(projectID, 'projectID');
  validateRequired(userID, 'userID');
  validateRequired(grantID, 'grantID');
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'project.grant.member', 'delete', orgID);

  // Validate that grant exists by checking project events
  const grantExists = await checkGrantExists.call(this, projectID, grantID);
  if (!grantExists) {
    throwNotFound('grant not found', 'GRANT-MEMBER-006');
  }

  // Load write model
  const wm = new ProjectGrantMemberWriteModel(projectID);
  wm.userID = userID;
  wm.grantID = grantID;
  await wm.load(this.getEventstore(), projectID, orgID);

  if (wm.state !== MemberState.ACTIVE) {
    // Member not found or already removed
    throwNotFound('member not found', 'GRANT-MEMBER-007');
  }

  // Create event
  const command: Command = {
    eventType: 'project.grant.member.removed',
    aggregateType: 'project',
    aggregateID: projectID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userID,
      grantID,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}
