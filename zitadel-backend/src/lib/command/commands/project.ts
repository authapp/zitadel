/**
 * Project-related commands and handlers
 * Projects represent applications/services in Zitadel
 */

import { Command as EventstoreCommand } from '../../eventstore/types';
import { AppCommand, CommandContext, CommandHandler, CommandValidator, ValidationResult } from '../types';
import { generateId as generateSnowflakeId } from '../../id/snowflake';

/**
 * Create project command
 */
export class CreateProjectCommand implements AppCommand {
  aggregateId: string;
  aggregateType = 'project';
  context: CommandContext;
  
  constructor(
    public name: string,
    public projectRoleAssertion?: boolean,
    public projectRoleCheck?: boolean,
    public hasProjectCheck?: boolean,
    public privateLabelingSetting?: 'UNSPECIFIED' | 'ENFORCE_PROJECT_RESOURCE_OWNER_POLICY' | 'ALLOW_LOGIN_USER_RESOURCE_OWNER_POLICY',
    context?: Partial<CommandContext>
  ) {
    this.aggregateId = generateSnowflakeId();
    this.context = {
      instanceId: context?.instanceId || 'default',
      resourceOwner: context?.resourceOwner || 'system',
      userId: context?.userId,
      timestamp: context?.timestamp || new Date(),
      requestId: context?.requestId || generateSnowflakeId(),
    };
  }
}

/**
 * Update project command
 */
export class UpdateProjectCommand implements AppCommand {
  aggregateType = 'project';
  context: CommandContext;
  
  constructor(
    public aggregateId: string,
    public name?: string,
    public projectRoleAssertion?: boolean,
    public projectRoleCheck?: boolean,
    public hasProjectCheck?: boolean,
    public privateLabelingSetting?: 'UNSPECIFIED' | 'ENFORCE_PROJECT_RESOURCE_OWNER_POLICY' | 'ALLOW_LOGIN_USER_RESOURCE_OWNER_POLICY',
    context?: Partial<CommandContext>
  ) {
    this.context = {
      instanceId: context?.instanceId || 'default',
      resourceOwner: context?.resourceOwner || 'system',
      userId: context?.userId,
      timestamp: context?.timestamp || new Date(),
      requestId: context?.requestId || generateSnowflakeId(),
    };
  }
}

/**
 * Deactivate project command
 */
export class DeactivateProjectCommand implements AppCommand {
  aggregateType = 'project';
  context: CommandContext;
  
  constructor(
    public aggregateId: string,
    context?: Partial<CommandContext>
  ) {
    this.context = {
      instanceId: context?.instanceId || 'default',
      resourceOwner: context?.resourceOwner || 'system',
      userId: context?.userId,
      timestamp: context?.timestamp || new Date(),
      requestId: context?.requestId || generateSnowflakeId(),
    };
  }
}

/**
 * Create project handler
 */
export const createProjectHandler: CommandHandler<CreateProjectCommand> = async (
  command: CreateProjectCommand,
  currentState?: any
): Promise<EventstoreCommand> => {
  // Business rule: Project must not already exist
  if (currentState) {
    throw new Error('Project already exists');
  }

  // Normalize data
  const name = command.name.trim();

  const eventstoreCommand: EventstoreCommand = {
    eventType: 'project.created',
    aggregateType: 'project',
    aggregateID: command.aggregateId,
    payload: {
      name,
      projectRoleAssertion: command.projectRoleAssertion ?? false,
      projectRoleCheck: command.projectRoleCheck ?? false,
      hasProjectCheck: command.hasProjectCheck ?? false,
      privateLabelingSetting: command.privateLabelingSetting ?? 'UNSPECIFIED',
    },
    creator: command.context.userId || 'system',
    owner: command.context.resourceOwner,
    instanceID: command.context.instanceId,
  };

  return eventstoreCommand;
};

/**
 * Update project handler
 */
export const updateProjectHandler: CommandHandler<UpdateProjectCommand> = async (
  command: UpdateProjectCommand,
  currentState?: any
): Promise<EventstoreCommand> => {
  // Business rule: Project must exist
  if (!currentState) {
    throw new Error('Project not found');
  }

  // Business rule: Project must be active
  if (currentState.state !== 'active') {
    throw new Error('Project is not active');
  }

  // Check if anything changed
  const changes: any = {};
  if (command.name && command.name.trim() !== currentState.name) {
    changes.name = command.name.trim();
  }
  if (command.projectRoleAssertion !== undefined && command.projectRoleAssertion !== currentState.projectRoleAssertion) {
    changes.projectRoleAssertion = command.projectRoleAssertion;
  }
  if (command.projectRoleCheck !== undefined && command.projectRoleCheck !== currentState.projectRoleCheck) {
    changes.projectRoleCheck = command.projectRoleCheck;
  }
  if (command.hasProjectCheck !== undefined && command.hasProjectCheck !== currentState.hasProjectCheck) {
    changes.hasProjectCheck = command.hasProjectCheck;
  }
  if (command.privateLabelingSetting && command.privateLabelingSetting !== currentState.privateLabelingSetting) {
    changes.privateLabelingSetting = command.privateLabelingSetting;
  }

  if (Object.keys(changes).length === 0) {
    throw new Error('No changes to apply');
  }

  const eventstoreCommand: EventstoreCommand = {
    eventType: 'project.updated',
    aggregateType: 'project',
    aggregateID: command.aggregateId,
    payload: changes,
    creator: command.context.userId || 'system',
    owner: command.context.resourceOwner,
    instanceID: command.context.instanceId,
    revision: currentState.version,
  };

  return eventstoreCommand;
};

/**
 * Deactivate project handler
 */
export const deactivateProjectHandler: CommandHandler<DeactivateProjectCommand> = async (
  command: DeactivateProjectCommand,
  currentState?: any
): Promise<EventstoreCommand> => {
  // Business rule: Project must exist
  if (!currentState) {
    throw new Error('Project not found');
  }

  // Business rule: Project must be active
  if (currentState.state !== 'active') {
    throw new Error('Project is already inactive');
  }

  const eventstoreCommand: EventstoreCommand = {
    eventType: 'project.deactivated',
    aggregateType: 'project',
    aggregateID: command.aggregateId,
    payload: {
      deactivatedBy: command.context.userId,
    },
    creator: command.context.userId || 'system',
    owner: command.context.resourceOwner,
    instanceID: command.context.instanceId,
    revision: currentState.version,
  };

  return eventstoreCommand;
};

/**
 * Create project validator
 */
export const createProjectValidator: CommandValidator<CreateProjectCommand> = (
  command: CreateProjectCommand
): ValidationResult => {
  const errors: any[] = [];

  // Validate name
  if (!command.name || command.name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: 'Project name is required',
      code: 'PROJECT-NAME-REQUIRED',
    });
  } else if (command.name.trim().length < 2) {
    errors.push({
      field: 'name',
      message: 'Project name must be at least 2 characters',
      code: 'MIN_LENGTH',
    });
  } else if (command.name.length > 255) {
    errors.push({
      field: 'name',
      message: 'Project name must not exceed 255 characters',
      code: 'MAX_LENGTH',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Update project validator
 */
export const updateProjectValidator: CommandValidator<UpdateProjectCommand> = (
  command: UpdateProjectCommand
): ValidationResult => {
  const errors: any[] = [];

  // Validate aggregate ID
  if (!command.aggregateId) {
    errors.push({
      field: 'aggregateId',
      message: 'Project ID is required',
      code: 'REQUIRED',
    });
  }

  // At least one field must be provided
  if (!command.name && command.projectRoleAssertion === undefined && 
      command.projectRoleCheck === undefined && command.hasProjectCheck === undefined &&
      !command.privateLabelingSetting) {
    errors.push({
      field: 'general',
      message: 'At least one field must be updated',
      code: 'NO_CHANGES',
    });
  }

  // Validate name if provided
  if (command.name && command.name.trim().length < 2) {
    errors.push({
      field: 'name',
      message: 'Project name must be at least 2 characters',
      code: 'MIN_LENGTH',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
