/**
 * Command Preparation Pattern
 * 
 * Inspired by Zitadel Go's internal/command/preparation
 * Allows complex validation and multi-step command creation
 */

import { Context } from './context';
import { Event, Eventstore } from '../eventstore/types';
import { throwInvalidArgument } from '../zerrors/errors';

/**
 * Validation function that returns a command creator or throws an error
 */
export type Validation<T = any> = () => Promise<CreateCommands<T>> | CreateCommands<T>;

/**
 * Function that creates events based on current state
 */
export type CreateCommands<T = any> = (
  ctx: Context,
  eventstore: Eventstore,
  pendingEvents?: Event[]
) => Promise<T>;

/**
 * Prepare and execute multiple validation steps
 * Each validation can depend on previous steps
 */
export async function prepareCommands<T>(
  ctx: Context,
  eventstore: Eventstore,
  validations: Validation<T>[]
): Promise<T[]> {
  // Step 1: Run all validations
  const commanders: CreateCommands<T>[] = [];
  
  for (const validation of validations) {
    try {
      const commander = await validation();
      commanders.push(commander);
    } catch (error) {
      throw error;
    }
  }
  
  if (commanders.length === 0) {
    throwInvalidArgument('no executable commands', 'PREPA-pH70n');
  }
  
  // Step 2: Execute command creators in sequence
  const results: T[] = [];
  const pendingEvents: Event[] = [];
  
  for (const commander of commanders) {
    const result = await commander(ctx, eventstore, pendingEvents);
    results.push(result);
    
    // If result contains events, add them to pending
    if (result && typeof result === 'object' && 'events' in result) {
      const eventsResult = result as any;
      if (Array.isArray(eventsResult.events)) {
        pendingEvents.push(...eventsResult.events);
      }
    }
  }
  
  return results;
}

/**
 * Single validation helper
 */
export async function prepareSingleCommand<T>(
  ctx: Context,
  eventstore: Eventstore,
  validation: Validation<T>
): Promise<T> {
  const results = await prepareCommands(ctx, eventstore, [validation]);
  return results[0];
}

/**
 * Validation builder for common patterns
 */
export class ValidationBuilder<T> {
  private validations: Validation<T>[] = [];
  
  /**
   * Add a validation step
   */
  add(validation: Validation<T>): this {
    this.validations.push(validation);
    return this;
  }
  
  /**
   * Add a simple check that throws on failure
   */
  check(predicate: () => boolean | Promise<boolean>, errorMessage: string, errorCode: string): this {
    this.validations.push(async () => {
      const result = await predicate();
      if (!result) {
        throwInvalidArgument(errorMessage, errorCode);
      }
      return async () => ({} as T); // No-op creator
    });
    return this;
  }
  
  /**
   * Execute all validations
   */
  async execute(ctx: Context, eventstore: Eventstore): Promise<T[]> {
    return prepareCommands(ctx, eventstore, this.validations);
  }
}

/**
 * Create a validation builder
 */
export function createValidationBuilder<T>(): ValidationBuilder<T> {
  return new ValidationBuilder<T>();
}
