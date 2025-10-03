/**
 * Command module types for Zitadel
 * Implements the write-side of CQRS architecture
 */

import { Event, Command as EventstoreCommand } from '../eventstore/types';

/**
 * Command context for tracking execution metadata
 */
export interface CommandContext {
  userId?: string;
  instanceId: string;
  resourceOwner: string;
  timestamp: Date;
  requestId: string;
}

/**
 * Base command interface for application commands
 */
export interface AppCommand {
  aggregateId: string;
  aggregateType: string;
  context: CommandContext;
}

/**
 * Command result after execution
 */
export interface CommandResult {
  aggregateId: string;
  event: Event;
}

/**
 * Command handler function type
 */
export type CommandHandler<T extends AppCommand> = (
  command: T,
  currentState?: any
) => Promise<EventstoreCommand>;

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Command validator function type
 */
export type CommandValidator<T extends AppCommand> = (command: T) => ValidationResult;

/**
 * Command middleware function type
 */
export type CommandMiddleware = (
  command: AppCommand,
  next: () => Promise<CommandResult>
) => Promise<CommandResult>;

/**
 * Command bus interface
 */
export interface CommandBus {
  /**
   * Execute a command
   */
  execute<T extends AppCommand>(command: T): Promise<CommandResult>;

  /**
   * Register a command handler
   */
  registerHandler<T extends AppCommand>(
    commandType: string,
    handler: CommandHandler<T>,
    validator?: CommandValidator<T>
  ): void;

  /**
   * Register middleware
   */
  use(middleware: CommandMiddleware): void;

  /**
   * Health check
   */
  health(): Promise<boolean>;
}

/**
 * Aggregate root interface
 */
export interface AggregateRoot {
  id: string;
  type: string;
  version: number;
  
  /**
   * Apply an event to update aggregate state
   */
  apply(event: Event): void;

  /**
   * Load from event history
   */
  loadFromHistory(events: Event[]): void;
}

/**
 * Repository interface for aggregates
 */
export interface Repository<T extends AggregateRoot> {
  /**
   * Load aggregate by ID
   */
  load(id: string): Promise<T | null>;

  /**
   * Check if aggregate exists
   */
  exists(id: string): Promise<boolean>;
}

/**
 * Command error types
 */
export class CommandError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'CommandError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public errors: ValidationError[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AggregateNotFoundError extends Error {
  constructor(aggregateId: string, aggregateType: string) {
    super(`Aggregate ${aggregateType}:${aggregateId} not found`);
    this.name = 'AggregateNotFoundError';
  }
}
