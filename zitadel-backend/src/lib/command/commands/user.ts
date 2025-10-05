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
import { normalizePhoneNumber, isValidPhoneNumber, PHONE_ERROR_CODES } from '../../domain/phone';

/**
 * Auto-generate display name (matching Zitadel's ensureDisplayName logic)
 * Priority: firstName + lastName → email → username
 */
function ensureDisplayName(
  firstName: string,
  lastName: string,
  email: string,
  username: string
): string {
  // If both firstName and lastName exist, combine them
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  
  // Fall back to email if available
  if (email && email.trim()) {
    return email;
  }
  
  // Last resort: use username
  return username;
}

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
    public phone?: string,
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
 * 
 * DATA NORMALIZATION (matching Zitadel):
 * - Trims all text fields
 * - Auto-generates displayName if not provided
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

  // Normalize data (trim whitespace) - matching Zitadel's Normalize()
  const username = command.username.trim();
  const email = command.email.trim();
  const firstName = command.firstName?.trim() || '';
  const lastName = command.lastName?.trim() || '';

  // Normalize phone to E.164 format (matching Zitadel's PhoneNumber.Normalize)
  let normalizedPhone: string | undefined;
  if (command.phone && command.phone.trim().length > 0) {
    try {
      normalizedPhone = normalizePhoneNumber(command.phone);
    } catch (error) {
      // If normalization fails, it should have been caught by validator
      // But include this as a safety check
      throw new Error(`Phone normalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Auto-generate displayName (matching Zitadel's ensureDisplayName)
  const displayName = ensureDisplayName(firstName, lastName, email, username);

  // Create eventstore command
  const eventstoreCommand: EventstoreCommand = {
    eventType: 'user.created',
    aggregateType: 'user',
    aggregateID: command.aggregateId,
    eventData: {
      username,
      email,
      firstName,
      lastName,
      displayName,
      ...(normalizedPhone && { phone: normalizedPhone }),
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
 * 
 * MATCHES ZITADEL VALIDATION RULES:
 * - Username: Required, trimmed, 3-255 chars
 * - Email: Required, valid format (Zitadel regex)
 * - FirstName: Required, trimmed, not empty
 * - LastName: Required, trimmed, not empty
 */
export const createUserValidator: CommandValidator<CreateUserCommand> = (
  command: CreateUserCommand
): ValidationResult => {
  const errors: any[] = [];

  // Validate username (matching Zitadel: V2-zzad3)
  if (!command.username || command.username.trim().length === 0) {
    errors.push({
      field: 'username',
      message: 'Username is required',
      code: 'V2-zzad3',
    });
  } else if (command.username.trim().length < 3) {
    errors.push({
      field: 'username',
      message: 'Username must be at least 3 characters',
      code: 'MIN_LENGTH',
    });
  } else if (command.username.length > 255) {
    errors.push({
      field: 'username',
      message: 'Username must not exceed 255 characters',
      code: 'MAX_LENGTH',
    });
  }

  // Validate email (matching Zitadel regex: EMAIL-599BI)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!command.email || command.email.trim().length === 0) {
    errors.push({
      field: 'email',
      message: 'Email is required',
      code: 'EMAIL-spblu',
    });
  } else if (!emailRegex.test(command.email.trim())) {
    errors.push({
      field: 'email',
      message: 'Invalid email format',
      code: 'EMAIL-599BI',
    });
  }

  // Validate firstName (matching Zitadel: USER-UCej2)
  if (!command.firstName || command.firstName.trim().length === 0) {
    errors.push({
      field: 'firstName',
      message: 'First name is required',
      code: 'USER-UCej2',
    });
  } else if (command.firstName.length > 255) {
    errors.push({
      field: 'firstName',
      message: 'First name must not exceed 255 characters',
      code: 'MAX_LENGTH',
    });
  }

  // Validate lastName (matching Zitadel: USER-4hB7d)
  if (!command.lastName || command.lastName.trim().length === 0) {
    errors.push({
      field: 'lastName',
      message: 'Last name is required',
      code: 'USER-4hB7d',
    });
  } else if (command.lastName.length > 255) {
    errors.push({
      field: 'lastName',
      message: 'Last name must not exceed 255 characters',
      code: 'MAX_LENGTH',
    });
  }

  // Validate phone (optional, but must be valid if provided)
  if (command.phone && command.phone.trim().length > 0) {
    if (!isValidPhoneNumber(command.phone)) {
      errors.push({
        field: 'phone',
        message: 'Invalid phone number format',
        code: PHONE_ERROR_CODES.INVALID,
      });
    }
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
