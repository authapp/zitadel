/**
 * User-related commands and handlers
 * 
 * VALIDATION PATTERN:
 * ------------------
 * 1. Same-aggregate validation: Uses currentState (from events)
 * 2. Cross-aggregate validation: Query other aggregates' events
 * 3. Uniqueness constraints: Can use projections (pragmatic approach)
 * 
 * IMPORTANT: Commands NEVER query projections for business rules on their own aggregate.
 * The CommandBus reconstructs state from events before calling handlers.
 */

import { Command as EventstoreCommand } from '../../eventstore/types';
import { AppCommand, CommandContext, CommandHandler, CommandValidator, ValidationResult } from '../types';
import { generateId as generateSnowflakeId } from '../../id/snowflake';

/**
 * Create user command
 */
export class CreateUserCommand implements AppCommand {
  aggregateId: string;
  aggregateType = 'user';
  context: CommandContext;
  
  constructor(
    public username: string,
    public email: string,
    public firstName?: string,
    public lastName?: string,
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
 * Update user command
 */
export class UpdateUserCommand implements AppCommand {
  aggregateType = 'user';
  context: CommandContext;
  
  constructor(
    public aggregateId: string,
    public email?: string,
    public firstName?: string,
    public lastName?: string,
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
 * Deactivate user command
 */
export class DeactivateUserCommand implements AppCommand {
  aggregateType = 'user';
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
 * Create user command handler
 * 
 * VALIDATION APPROACH:
 * - currentState is reconstructed from events (NOT projections)
 * - If you need to check email uniqueness, use UserRepository in the service layer
 *   before calling this command
 */
export const createUserHandler: CommandHandler<CreateUserCommand> = async (
  command: CreateUserCommand,
  currentState?: any
): Promise<EventstoreCommand> => {
  // Business rule: User must not already exist
  // currentState is reconstructed from events for THIS aggregate
  if (currentState) {
    throw new Error('User already exists');
  }

  // NOTE: Email uniqueness check should happen BEFORE this handler is called
  // See AdminService.createUser() for proper cross-aggregate validation

  // Create eventstore command
  const eventstoreCommand: EventstoreCommand = {
    eventType: 'user.created',
    aggregateType: 'user',
    aggregateID: command.aggregateId,
    eventData: {
      username: command.username,
      email: command.email,
      firstName: command.firstName,
      lastName: command.lastName,
    },
    editorUser: command.context.userId || 'system',
    resourceOwner: command.context.resourceOwner,
    instanceID: command.context.instanceId,
  };

  return eventstoreCommand;
};

/**
 * Update user command handler
 * 
 * SAME-AGGREGATE VALIDATION:
 * - Uses currentState which is reconstructed from events
 * - Validates business rules like "must exist", "must be active"
 * - This is the correct pattern for aggregate-level validation
 */
export const updateUserHandler: CommandHandler<UpdateUserCommand> = async (
  command: UpdateUserCommand,
  currentState?: any
): Promise<EventstoreCommand> => {
  // Business rule: User must exist
  // currentState = null means no events found for this aggregate
  if (!currentState) {
    throw new Error('User not found');
  }

  // Business rule: User must be active
  // This state comes from event sourcing, not projection
  if (currentState.state !== 'active') {
    throw new Error('User is not active');
  }

  // Check if anything changed
  const changes: any = {};
  if (command.email && command.email !== currentState.email) {
    changes.email = command.email;
  }
  if (command.firstName && command.firstName !== currentState.firstName) {
    changes.firstName = command.firstName;
  }
  if (command.lastName && command.lastName !== currentState.lastName) {
    changes.lastName = command.lastName;
  }

  if (Object.keys(changes).length === 0) {
    throw new Error('No changes to apply');
  }

  // Create eventstore command with optimistic concurrency control
  const eventstoreCommand: EventstoreCommand = {
    eventType: 'user.updated',
    aggregateType: 'user',
    aggregateID: command.aggregateId,
    eventData: changes,
    editorUser: command.context.userId || 'system',
    resourceOwner: command.context.resourceOwner,
    instanceID: command.context.instanceId,
    revision: currentState.version,  // ← Ensures we're updating the right version
  };

  return eventstoreCommand;
};

/**
 * Deactivate user command handler
 */
export const deactivateUserHandler: CommandHandler<DeactivateUserCommand> = async (
  command: DeactivateUserCommand,
  currentState?: any
): Promise<EventstoreCommand> => {
  // Business rule: User must exist
  if (!currentState) {
    throw new Error('User not found');
  }

  // Business rule: User must be active
  if (currentState.state !== 'active') {
    throw new Error('User is already inactive');
  }

  // Create eventstore command
  const eventstoreCommand: EventstoreCommand = {
    eventType: 'user.deactivated',
    aggregateType: 'user',
    aggregateID: command.aggregateId,
    eventData: {
      deactivatedBy: command.context.userId,
    },
    editorUser: command.context.userId || 'system',
    resourceOwner: command.context.resourceOwner,
    instanceID: command.context.instanceId,
    revision: currentState.version,
  };

  return eventstoreCommand;
};

/**
 * Create user command validator
 */
export const createUserValidator: CommandValidator<CreateUserCommand> = (
  command: CreateUserCommand
): ValidationResult => {
  const errors: any[] = [];

  // Validate username
  if (!command.username || command.username.trim().length === 0) {
    errors.push({
      field: 'username',
      message: 'Username is required',
      code: 'REQUIRED',
    });
  } else if (command.username.length < 3) {
    errors.push({
      field: 'username',
      message: 'Username must be at least 3 characters',
      code: 'MIN_LENGTH',
    });
  }

  // Validate email
  if (!command.email || command.email.trim().length === 0) {
    errors.push({
      field: 'email',
      message: 'Email is required',
      code: 'REQUIRED',
    });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(command.email)) {
    errors.push({
      field: 'email',
      message: 'Invalid email format',
      code: 'INVALID_FORMAT',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Update user command validator
 */
export const updateUserValidator: CommandValidator<UpdateUserCommand> = (
  command: UpdateUserCommand
): ValidationResult => {
  const errors: any[] = [];

  // Validate aggregate ID
  if (!command.aggregateId) {
    errors.push({
      field: 'aggregateId',
      message: 'User ID is required',
      code: 'REQUIRED',
    });
  }

  // Validate email if provided
  if (command.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(command.email)) {
    errors.push({
      field: 'email',
      message: 'Invalid email format',
      code: 'INVALID_FORMAT',
    });
  }

  // At least one field must be provided
  if (!command.email && !command.firstName && !command.lastName) {
    errors.push({
      field: 'general',
      message: 'At least one field must be updated',
      code: 'NO_CHANGES',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
