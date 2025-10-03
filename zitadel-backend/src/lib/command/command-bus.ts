/**
 * Command bus implementation
 */

import { Eventstore } from '../eventstore/types';
import {
  AppCommand,
  CommandBus,
  CommandHandler,
  CommandValidator,
  CommandMiddleware,
  CommandResult,
  CommandError,
  ValidationError as ValidationErrorClass,
} from './types';

/**
 * In-memory command bus implementation
 */
export class InMemoryCommandBus implements CommandBus {
  private handlers = new Map<string, CommandHandler<any>>();
  private validators = new Map<string, CommandValidator<any>>();
  private middlewares: CommandMiddleware[] = [];

  constructor(private eventstore: Eventstore) {}

  /**
   * Execute a command
   */
  async execute<T extends AppCommand>(command: T): Promise<CommandResult> {
    const commandType = command.constructor.name;

    // Get handler
    const handler = this.handlers.get(commandType);
    if (!handler) {
      throw new CommandError(`No handler registered for command: ${commandType}`, 'NO_HANDLER');
    }

    // Validate command
    const validator = this.validators.get(commandType);
    if (validator) {
      const validationResult = validator(command);
      if (!validationResult.valid) {
        throw new ValidationErrorClass(
          'Command validation failed',
          validationResult.errors
        );
      }
    }

    // Execute through middleware chain
    const executeCommand = async (): Promise<CommandResult> => {
      // Load current aggregate state
      const existingEvents = await this.eventstore.query({
        aggregateTypes: [command.aggregateType],
        aggregateIDs: [command.aggregateId],
      });

      // Reconstruct current state from events
      const currentState = this.reconstructState(existingEvents);

      // Execute handler to generate eventstore command
      const eventstoreCommand = await handler(command, currentState);

      // Push command to eventstore (eventstore will create and return the event)
      const event = await this.eventstore.push(eventstoreCommand);

      return {
        aggregateId: command.aggregateId,
        event,
      };
    };

    // Apply middleware
    return this.applyMiddleware(command, executeCommand);
  }

  /**
   * Register a command handler
   */
  registerHandler<T extends AppCommand>(
    commandType: string,
    handler: CommandHandler<T>,
    validator?: CommandValidator<T>
  ): void {
    if (this.handlers.has(commandType)) {
      throw new CommandError(`Handler already registered for: ${commandType}`, 'DUPLICATE_HANDLER');
    }

    this.handlers.set(commandType, handler);
    
    if (validator) {
      this.validators.set(commandType, validator);
    }
  }

  /**
   * Register middleware
   */
  use(middleware: CommandMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Health check
   */
  async health(): Promise<boolean> {
    try {
      return await this.eventstore.health();
    } catch {
      return false;
    }
  }

  /**
   * Apply middleware chain
   */
  private async applyMiddleware(
    command: AppCommand,
    execute: () => Promise<CommandResult>
  ): Promise<CommandResult> {
    if (this.middlewares.length === 0) {
      return execute();
    }

    let index = 0;

    const next = async (): Promise<CommandResult> => {
      if (index >= this.middlewares.length) {
        return execute();
      }

      const middleware = this.middlewares[index++];
      return middleware(command, next);
    };

    return next();
  }

  /**
   * Reconstruct aggregate state from events
   */
  private reconstructState(events: any[]): any {
    if (events.length === 0) {
      return null;
    }

    // Basic state reconstruction with proper handling
    const state: any = {
      id: events[0].aggregateID,
      type: events[0].aggregateType,
      version: events[events.length - 1].aggregateVersion,
    };

    // Apply each event's data to build up state
    for (const event of events) {
      // Merge event data
      Object.assign(state, event.eventData);
      
      // Handle special state transitions based on event type
      if (event.eventType.endsWith('.created')) {
        state.state = 'active';
      } else if (event.eventType.endsWith('.deactivated')) {
        state.state = 'inactive';
      } else if (event.eventType.endsWith('.deleted')) {
        state.state = 'deleted';
      }
    }

    return state;
  }
}
