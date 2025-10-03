/**
 * Command module - CQRS Write-side implementation for Zitadel
 * 
 * This module provides command handling capabilities including:
 * - Command bus for executing commands
 * - Aggregate root base class
 * - Repository pattern for loading aggregates
 * - Command validation
 * - Event generation from commands
 */

export * from './types';
export * from './command-bus';
export * from './aggregate';
export * from './repository';

// Re-export commonly used types for convenience
export type {
  AppCommand,
  CommandContext,
  CommandResult,
  CommandHandler,
  CommandValidator,
  CommandMiddleware,
  CommandBus,
  AggregateRoot,
  Repository,
  ValidationResult,
  ValidationError,
} from './types';

export {
  CommandError,
  AggregateNotFoundError,
} from './types';

export {
  BaseAggregate,
  UserAggregate,
  OrganizationAggregate,
  ProjectAggregate,
} from './aggregate';

export {
  AggregateRepository,
  createRepository,
} from './repository';

export {
  InMemoryCommandBus,
} from './command-bus';
