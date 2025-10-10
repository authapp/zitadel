/**
 * Project Commands (Zitadel v2)
 * 
 * All project-related write operations
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { ProjectWriteModel, ProjectState, ProjectGrantState } from './project-write-model';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired, validateLength } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists, throwPreconditionFailed } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';

/**
 * Add Project Data
 */
export interface AddProjectData {
  projectID?: string;
  orgID: string;
  name: string;
  projectRoleAssertion?: boolean;
  projectRoleCheck?: boolean;
  hasProjectCheck?: boolean;
  privateLabelingSetting?: number;
}

/**
 * Add project command
 */
export async function addProject(
  this: Commands,
  ctx: Context,
  data: AddProjectData
): Promise<ObjectDetails & { projectID: string }> {
  // 1. Validate input
  validateRequired(data.name, 'name');
  validateLength(data.name, 'name', 1, 200);
  validateRequired(data.orgID, 'orgID');
  
  // 2. Generate project ID if not provided
  if (!data.projectID) {
    data.projectID = await this.nextID();
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'project', 'create', data.orgID);
  
  // 4. Load write model
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), data.projectID, data.orgID);
  
  if (wm.state !== ProjectState.UNSPECIFIED) {
    throwAlreadyExists('project already exists', 'COMMAND-Proj10');
  }
  
  // 5. Create command
  const command: Command = {
    eventType: 'project.added',
    aggregateType: 'project',
    aggregateID: data.projectID,
    owner: data.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      name: data.name,
      projectRoleAssertion: data.projectRoleAssertion ?? false,
      projectRoleCheck: data.projectRoleCheck ?? false,
      hasProjectCheck: data.hasProjectCheck ?? false,
      privateLabelingSetting: data.privateLabelingSetting ?? 0,
    },
  };
  
  // 6. Push to eventstore
  const event = await this.getEventstore().push(command);
  
  // 7. Update write model
  appendAndReduce(wm, event);
  
  return {
    ...writeModelToObjectDetails(wm),
    projectID: data.projectID,
  };
}

/**
 * Change Project Data
 */
export interface ChangeProjectData {
  name?: string;
  projectRoleAssertion?: boolean;
  projectRoleCheck?: boolean;
  hasProjectCheck?: boolean;
  privateLabelingSetting?: number;
}

/**
 * Change project command
 */
export async function changeProject(
  this: Commands,
  ctx: Context,
  projectID: string,
  orgID: string,
  data: ChangeProjectData
): Promise<ObjectDetails> {
  // 1. Validate at least one field changed
  if (!data.name && 
      data.projectRoleAssertion === undefined && 
      data.projectRoleCheck === undefined &&
      data.hasProjectCheck === undefined &&
      data.privateLabelingSetting === undefined) {
    throwInvalidArgument('at least one field must be provided', 'COMMAND-Proj20');
  }
  
  if (data.name) {
    validateLength(data.name, 'name', 1, 200);
  }
  
  // 2. Load write model
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), projectID, orgID);
  
  if (wm.state === ProjectState.UNSPECIFIED) {
    throwNotFound('project not found', 'COMMAND-Proj21');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'project', 'update', orgID);
  
  // 4. Create command
  const command: Command = {
    eventType: 'project.changed',
    aggregateType: 'project',
    aggregateID: projectID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      name: data.name,
      projectRoleAssertion: data.projectRoleAssertion,
      projectRoleCheck: data.projectRoleCheck,
      hasProjectCheck: data.hasProjectCheck,
      privateLabelingSetting: data.privateLabelingSetting,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Deactivate project command
 */
export async function deactivateProject(
  this: Commands,
  ctx: Context,
  projectID: string,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Load write model
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), projectID, orgID);
  
  if (wm.state === ProjectState.UNSPECIFIED) {
    throwNotFound('project not found', 'COMMAND-Proj30');
  }
  if (wm.state === ProjectState.INACTIVE) {
    throwPreconditionFailed('project already inactive', 'COMMAND-Proj31');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'project', 'update', orgID);
  
  // 3. Create command
  const command: Command = {
    eventType: 'project.deactivated',
    aggregateType: 'project',
    aggregateID: projectID,
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
 * Reactivate project command
 */
export async function reactivateProject(
  this: Commands,
  ctx: Context,
  projectID: string,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Load write model
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), projectID, orgID);
  
  if (wm.state === ProjectState.UNSPECIFIED) {
    throwNotFound('project not found', 'COMMAND-Proj40');
  }
  if (wm.state === ProjectState.ACTIVE) {
    throwPreconditionFailed('project already active', 'COMMAND-Proj41');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'project', 'update', orgID);
  
  // 3. Create command
  const command: Command = {
    eventType: 'project.reactivated',
    aggregateType: 'project',
    aggregateID: projectID,
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
 * Add project role data
 */
export interface AddProjectRoleData {
  roleKey: string;
  displayName: string;
  group?: string;
}

/**
 * Add project role command
 */
export async function addProjectRole(
  this: Commands,
  ctx: Context,
  projectID: string,
  orgID: string,
  data: AddProjectRoleData
): Promise<ObjectDetails> {
  // 1. Validate
  validateRequired(data.roleKey, 'roleKey');
  validateRequired(data.displayName, 'displayName');
  validateLength(data.roleKey, 'roleKey', 1, 200);
  validateLength(data.displayName, 'displayName', 1, 200);
  
  // 2. Load project write model
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), projectID, orgID);
  
  if (wm.state === ProjectState.UNSPECIFIED) {
    throwNotFound('project not found', 'COMMAND-Proj50');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'project.role', 'create', orgID);
  
  // 4. Create command
  const command: Command = {
    eventType: 'project.role.added',
    aggregateType: 'project',
    aggregateID: projectID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      roleKey: data.roleKey,
      displayName: data.displayName,
      group: data.group,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Change project role command
 */
export async function changeProjectRole(
  this: Commands,
  ctx: Context,
  projectID: string,
  orgID: string,
  roleKey: string,
  displayName: string,
  group?: string
): Promise<ObjectDetails> {
  // 1. Validate
  validateRequired(displayName, 'displayName');
  validateLength(displayName, 'displayName', 1, 200);
  
  // 2. Load project write model
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), projectID, orgID);
  
  if (wm.state === ProjectState.UNSPECIFIED) {
    throwNotFound('project not found', 'COMMAND-Proj60');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'project.role', 'update', orgID);
  
  // 4. Create command
  const command: Command = {
    eventType: 'project.role.changed',
    aggregateType: 'project',
    aggregateID: projectID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      roleKey,
      displayName,
      group,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Remove project role command
 */
export async function removeProjectRole(
  this: Commands,
  ctx: Context,
  projectID: string,
  orgID: string,
  roleKey: string
): Promise<ObjectDetails> {
  // 1. Load project write model
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), projectID, orgID);
  
  if (wm.state === ProjectState.UNSPECIFIED) {
    throwNotFound('project not found', 'COMMAND-Proj70');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'project.role', 'delete', orgID);
  
  // 3. Create command
  const command: Command = {
    eventType: 'project.role.removed',
    aggregateType: 'project',
    aggregateID: projectID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      roleKey,
    },
  };
  
  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Add project member data
 */
export interface AddProjectMemberData {
  userID: string;
  roles: string[];
}

/**
 * Add project member command
 */
export async function addProjectMember(
  this: Commands,
  ctx: Context,
  projectID: string,
  orgID: string,
  data: AddProjectMemberData
): Promise<ObjectDetails> {
  // 1. Validate
  validateRequired(data.userID, 'userID');
  if (!data.roles || data.roles.length === 0) {
    throwInvalidArgument('at least one role required', 'COMMAND-Proj80');
  }
  
  // 2. Load project write model
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), projectID, orgID);
  
  if (wm.state === ProjectState.UNSPECIFIED) {
    throwNotFound('project not found', 'COMMAND-Proj81');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'project.member', 'create', orgID);
  
  // 4. Create command
  const command: Command = {
    eventType: 'project.member.added',
    aggregateType: 'project',
    aggregateID: projectID,
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
 * Change project member roles
 */
export async function changeProjectMember(
  this: Commands,
  ctx: Context,
  projectID: string,
  orgID: string,
  userID: string,
  roles: string[]
): Promise<ObjectDetails> {
  // 1. Validate
  if (!roles || roles.length === 0) {
    throwInvalidArgument('at least one role required', 'COMMAND-Proj90');
  }
  
  // 2. Load project write model
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), projectID, orgID);
  
  if (wm.state === ProjectState.UNSPECIFIED) {
    throwNotFound('project not found', 'COMMAND-Proj91');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'project.member', 'update', orgID);
  
  // 4. Create command
  const command: Command = {
    eventType: 'project.member.changed',
    aggregateType: 'project',
    aggregateID: projectID,
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
 * Add project grant data
 */
export interface AddProjectGrantData {
  grantedOrgID: string;
  roleKeys: string[];
}

/**
 * Add project grant command
 */
export async function addProjectGrant(
  this: Commands,
  ctx: Context,
  projectID: string,
  orgID: string,
  data: AddProjectGrantData
): Promise<ObjectDetails> {
  // 1. Validate
  validateRequired(data.grantedOrgID, 'grantedOrgID');
  if (!data.roleKeys || data.roleKeys.length === 0) {
    throwInvalidArgument('at least one role required', 'COMMAND-ProjA0');
  }
  
  // 2. Load project write model
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), projectID, orgID);
  
  if (wm.state === ProjectState.UNSPECIFIED) {
    throwNotFound('project not found', 'COMMAND-ProjA1');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'project.grant', 'create', orgID);
  
  // 4. Create command
  const command: Command = {
    eventType: 'project.grant.added',
    aggregateType: 'project',
    aggregateID: projectID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      grantedOrgID: data.grantedOrgID,
      roleKeys: data.roleKeys,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Change project grant roles
 */
export async function changeProjectGrant(
  this: Commands,
  ctx: Context,
  projectID: string,
  orgID: string,
  grantID: string,
  roleKeys: string[]
): Promise<ObjectDetails> {
  // 1. Validate
  if (!roleKeys || roleKeys.length === 0) {
    throwInvalidArgument('at least one role required', 'COMMAND-ProjB0');
  }
  
  // 2. Load project write model
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), projectID, orgID);
  
  if (wm.state === ProjectState.UNSPECIFIED) {
    throwNotFound('project not found', 'COMMAND-ProjB1');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'project.grant', 'update', orgID);
  
  // 4. Create command
  const command: Command = {
    eventType: 'project.grant.changed',
    aggregateType: 'project',
    aggregateID: projectID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      grantID,
      roleKeys,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Remove project command
 * Based on Go: RemoveProject (project.go:317-366)
 */
export async function removeProject(
  this: Commands,
  ctx: Context,
  projectID: string
): Promise<ObjectDetails> {
  validateRequired(projectID, 'projectID');
  
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), projectID, ctx.orgID);
  
  if (wm.state === ProjectState.UNSPECIFIED) {
    throwNotFound('project not found', 'COMMAND-Prj50');
  }
  
  await this.checkPermission(ctx, 'project', 'delete', projectID);
  
  const command: Command = {
    eventType: 'project.removed',
    aggregateType: 'project',
    aggregateID: projectID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: { name: wm.name },
  };
  
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  return writeModelToObjectDetails(wm);
}

/**
 * Remove project member command
 * Based on Go: RemoveProjectMember (project_member.go:134-160)
 */
export async function removeProjectMember(
  this: Commands,
  ctx: Context,
  projectID: string,
  userID: string
): Promise<ObjectDetails> {
  validateRequired(projectID, 'projectID');
  validateRequired(userID, 'userID');
  
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), projectID, ctx.orgID);
  
  if (wm.state === ProjectState.UNSPECIFIED) {
    throwNotFound('project not found', 'COMMAND-Prj60');
  }
  
  await this.checkPermission(ctx, 'project.member', 'delete', projectID);
  
  const command: Command = {
    eventType: 'project.member.removed',
    aggregateType: 'project',
    aggregateID: projectID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: { userID },
  };
  
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  return writeModelToObjectDetails(wm);
}

/**
 * Deactivate project grant command
 * Based on Go: DeactivateProjectGrant (project_grant.go:189-235)
 */
export async function deactivateProjectGrant(
  this: Commands,
  ctx: Context,
  projectID: string,
  grantID: string
): Promise<ObjectDetails> {
  validateRequired(projectID, 'projectID');
  validateRequired(grantID, 'grantID');
  
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), projectID, ctx.orgID);
  
  if (wm.state === ProjectState.UNSPECIFIED) {
    throwNotFound('project not found', 'COMMAND-Prj70');
  }
  
  const grant = wm.grants.find(g => g.grantID === grantID);
  if (!grant) {
    throwNotFound('project grant not found', 'COMMAND-Prj71');
  }
  
  if (grant.state === ProjectGrantState.INACTIVE) {
    return writeModelToObjectDetails(wm);
  }
  
  if (grant.state !== ProjectGrantState.ACTIVE) {
    throwPreconditionFailed('project grant is not active', 'COMMAND-Prj72');
  }
  
  await this.checkPermission(ctx, 'project.grant', 'update', projectID);
  
  const command: Command = {
    eventType: 'project.grant.deactivated',
    aggregateType: 'project',
    aggregateID: projectID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: { grantID },
  };
  
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  return writeModelToObjectDetails(wm);
}

/**
 * Reactivate project grant command
 * Based on Go: ReactivateProjectGrant (project_grant.go:248-294)
 */
export async function reactivateProjectGrant(
  this: Commands,
  ctx: Context,
  projectID: string,
  grantID: string
): Promise<ObjectDetails> {
  validateRequired(projectID, 'projectID');
  validateRequired(grantID, 'grantID');
  
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), projectID, ctx.orgID);
  
  if (wm.state === ProjectState.UNSPECIFIED) {
    throwNotFound('project not found', 'COMMAND-Prj80');
  }
  
  const grant = wm.grants.find(g => g.grantID === grantID);
  if (!grant) {
    throwNotFound('project grant not found', 'COMMAND-Prj81');
  }
  
  if (grant.state === ProjectGrantState.ACTIVE) {
    return writeModelToObjectDetails(wm);
  }
  
  if (grant.state !== ProjectGrantState.INACTIVE) {
    throwPreconditionFailed('project grant is not inactive', 'COMMAND-Prj82');
  }
  
  await this.checkPermission(ctx, 'project.grant', 'update', projectID);
  
  const command: Command = {
    eventType: 'project.grant.reactivated',
    aggregateType: 'project',
    aggregateID: projectID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: { grantID },
  };
  
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  return writeModelToObjectDetails(wm);
}

/**
 * Remove project grant command
 * Based on Go: RemoveProjectGrant (project_grant.go:297-337)
 */
export async function removeProjectGrant(
  this: Commands,
  ctx: Context,
  projectID: string,
  grantID: string
): Promise<ObjectDetails> {
  validateRequired(projectID, 'projectID');
  validateRequired(grantID, 'grantID');
  
  const wm = new ProjectWriteModel();
  await wm.load(this.getEventstore(), projectID, ctx.orgID);
  
  if (wm.state === ProjectState.UNSPECIFIED) {
    throwNotFound('project not found', 'COMMAND-Prj90');
  }
  
  const grant = wm.grants.find(g => g.grantID === grantID);
  if (!grant) {
    throwNotFound('project grant not found', 'COMMAND-Prj91');
  }
  
  await this.checkPermission(ctx, 'project.grant', 'delete', projectID);
  
  const command: Command = {
    eventType: 'project.grant.removed',
    aggregateType: 'project',
    aggregateID: projectID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      grantID,
      grantedOrgID: grant.grantedOrgID,
    },
  };
  
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  return writeModelToObjectDetails(wm);
}
