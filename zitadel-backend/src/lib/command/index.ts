/**
 * Command Module
 * 
 * Write-side (CQRS) implementation for Zitadel
 */

// Core infrastructure
export * from './types';
export * from './aggregate';
export * from './command-bus';
export * from './repository';
export * from './factory';

// Zitadel v2 command infrastructure
export * from './write-model';
export * from './context';
export * from './validation';
export * from './permissions';
export * from './preparation';
export * from './commands';

// Write models by aggregate
export * from './user';
export * from './org';
export * from './project';
export * from './application';

// Legacy command types (Phase 3)
export * from './commands/user';
export * from './commands/organization';
export * from './commands/project';

// Re-export commonly used types for convenience
export type {
  AppCommand,
  CommandContext,
  CommandResult,
  CommandHandler,
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
