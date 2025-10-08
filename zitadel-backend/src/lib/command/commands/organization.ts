/**
 * Organization-related commands and handlers
 * Organizations are the tenant/workspace concept in Zitadel
 */

import { Command as EventstoreCommand } from '../../eventstore/types';
import { AppCommand, CommandContext, CommandHandler, CommandValidator, ValidationResult } from '../types';
import { generateId as generateSnowflakeId } from '../../id/snowflake';

/**
 * Create organization command
 */
export class CreateOrganizationCommand implements AppCommand {
  aggregateId: string;
  aggregateType = 'organization';
  context: CommandContext;
  
  constructor(
    public name: string,
    public domain?: string,
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
 * Update organization command
 */
export class UpdateOrganizationCommand implements AppCommand {
  aggregateType = 'organization';
  context: CommandContext;
  
  constructor(
    public aggregateId: string,
    public name?: string,
    public domain?: string,
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
 * Deactivate organization command
 */
export class DeactivateOrganizationCommand implements AppCommand {
  aggregateType = 'organization';
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
 * Create organization handler
 */
export const createOrganizationHandler: CommandHandler<CreateOrganizationCommand> = async (
  command: CreateOrganizationCommand,
  currentState?: any
): Promise<EventstoreCommand> => {
  // Business rule: Organization must not already exist
  if (currentState) {
    throw new Error('Organization already exists');
  }

  // Normalize data
  const name = command.name.trim();
  const domain = command.domain?.trim().toLowerCase();

  const eventstoreCommand: EventstoreCommand = {
    eventType: 'organization.created',
    aggregateType: 'organization',
    aggregateID: command.aggregateId,
    payload: {
      name,
      ...(domain && { domain }),
    },
    creator: command.context.userId || 'system',
    owner: command.context.resourceOwner,
    instanceID: command.context.instanceId,
  };

  return eventstoreCommand;
};

/**
 * Update organization handler
 */
export const updateOrganizationHandler: CommandHandler<UpdateOrganizationCommand> = async (
  command: UpdateOrganizationCommand,
  currentState?: any
): Promise<EventstoreCommand> => {
  // Business rule: Organization must exist
  if (!currentState) {
    throw new Error('Organization not found');
  }

  // Business rule: Organization must be active
  if (currentState.state !== 'active') {
    throw new Error('Organization is not active');
  }

  // Check if anything changed
  const changes: any = {};
  if (command.name && command.name.trim() !== currentState.name) {
    changes.name = command.name.trim();
  }
  if (command.domain && command.domain.trim().toLowerCase() !== currentState.domain) {
    changes.domain = command.domain.trim().toLowerCase();
  }

  if (Object.keys(changes).length === 0) {
    throw new Error('No changes to apply');
  }

  const eventstoreCommand: EventstoreCommand = {
    eventType: 'organization.updated',
    aggregateType: 'organization',
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
 * Deactivate organization handler
 */
export const deactivateOrganizationHandler: CommandHandler<DeactivateOrganizationCommand> = async (
  command: DeactivateOrganizationCommand,
  currentState?: any
): Promise<EventstoreCommand> => {
  // Business rule: Organization must exist
  if (!currentState) {
    throw new Error('Organization not found');
  }

  // Business rule: Organization must be active
  if (currentState.state !== 'active') {
    throw new Error('Organization is already inactive');
  }

  const eventstoreCommand: EventstoreCommand = {
    eventType: 'organization.deactivated',
    aggregateType: 'organization',
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
 * Create organization validator
 */
export const createOrganizationValidator: CommandValidator<CreateOrganizationCommand> = (
  command: CreateOrganizationCommand
): ValidationResult => {
  const errors: any[] = [];

  // Validate name
  if (!command.name || command.name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: 'Organization name is required',
      code: 'ORG-NAME-REQUIRED',
    });
  } else if (command.name.trim().length < 2) {
    errors.push({
      field: 'name',
      message: 'Organization name must be at least 2 characters',
      code: 'MIN_LENGTH',
    });
  } else if (command.name.length > 255) {
    errors.push({
      field: 'name',
      message: 'Organization name must not exceed 255 characters',
      code: 'MAX_LENGTH',
    });
  }

  // Validate domain if provided
  if (command.domain) {
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    if (!domainRegex.test(command.domain.trim())) {
      errors.push({
        field: 'domain',
        message: 'Invalid domain format',
        code: 'INVALID_DOMAIN',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Update organization validator
 */
export const updateOrganizationValidator: CommandValidator<UpdateOrganizationCommand> = (
  command: UpdateOrganizationCommand
): ValidationResult => {
  const errors: any[] = [];

  // Validate aggregate ID
  if (!command.aggregateId) {
    errors.push({
      field: 'aggregateId',
      message: 'Organization ID is required',
      code: 'REQUIRED',
    });
  }

  // At least one field must be provided
  if (!command.name && !command.domain) {
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
      message: 'Organization name must be at least 2 characters',
      code: 'MIN_LENGTH',
    });
  }

  // Validate domain if provided
  if (command.domain) {
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    if (!domainRegex.test(command.domain.trim())) {
      errors.push({
        field: 'domain',
        message: 'Invalid domain format',
        code: 'INVALID_DOMAIN',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
