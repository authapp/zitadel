/**
 * Read Model Pattern for Building Projections
 * Based on Go implementation: internal/eventstore/read_model.go
 * 
 * Provides a base class for building read models/projections with automatic state tracking.
 * Read models are used in CQRS to build denormalized views optimized for queries.
 */

import { Event, Position, Reducer } from './types';

/**
 * Base class for building read models/projections
 * 
 * Automatically tracks:
 * - aggregate ID
 * - processed sequence (for ordering)
 * - position (for event sourcing)
 * - timestamps (creation and last change)
 * - resource owner and instance ID (for multi-tenancy)
 * 
 * @example
 * class UserReadModel extends ReadModel {
 *   username?: string;
 *   email?: string;
 *   
 *   protected handleEvent(event: Event): void {
 *     switch (event.eventType) {
 *       case 'user.added':
 *         this.username = event.payload?.username;
 *         this.email = event.payload?.email;
 *         break;
 *       case 'user.updated':
 *         if (event.payload?.email) this.email = event.payload.email;
 *         break;
 *     }
 *   }
 * }
 */
export abstract class ReadModel implements Reducer {
  /**
   * The aggregate ID this read model represents
   */
  aggregateID: string = '';

  /**
   * Sequence number for ordering (typically same as aggregate version)
   */
  processedSequence: bigint = 0n;

  /**
   * Position in the event stream
   */
  position: Position = { position: 0, inTxOrder: 0 };

  /**
   * When this read model was created (first event timestamp)
   */
  creationDate?: Date;

  /**
   * When this read model was last updated (most recent event timestamp)
   */
  changeDate?: Date;

  /**
   * Resource owner (for multi-tenancy / organizational hierarchy)
   */
  resourceOwner: string = '';

  /**
   * Instance ID (for multi-instance deployments)
   */
  instanceID: string = '';

  /**
   * Buffered events waiting to be processed
   */
  private eventBuffer: Event[] = [];

  /**
   * Append events to be processed by this read model
   * Events are buffered until reduce() is called
   */
  appendEvents(...events: Event[]): void {
    this.eventBuffer.push(...events);
  }

  /**
   * Process all buffered events and update the read model state
   * Called automatically by filterToReducer
   */
  async reduce(): Promise<void> {
    for (const event of this.eventBuffer) {
      this.applyEvent(event);
    }
    
    // Clear buffer after processing
    this.eventBuffer = [];
  }

  /**
   * Apply a single event to the read model
   * Updates tracking fields and calls handleEvent for custom logic
   */
  private applyEvent(event: Event): void {
    // Update aggregate ID on first event
    if (!this.aggregateID) {
      this.aggregateID = event.aggregateID;
    }

    // Update sequence
    this.processedSequence = event.aggregateVersion;

    // Update position
    this.position = event.position;

    // Update timestamps
    if (!this.creationDate) {
      this.creationDate = event.createdAt;
    }
    this.changeDate = event.createdAt;

    // Update multi-tenancy fields
    this.resourceOwner = event.owner;
    this.instanceID = event.instanceID;

    // Call subclass handler
    this.handleEvent(event);
  }

  /**
   * Handle a specific event
   * Override this method to implement custom read model logic
   * 
   * @param event - The event to handle
   * 
   * @example
   * protected handleEvent(event: Event): void {
   *   switch (event.eventType) {
   *     case 'user.added':
   *       this.username = event.payload?.username;
   *       break;
   *   }
   * }
   */
  protected abstract handleEvent(event: Event): void;

  /**
   * Reset the read model to initial state
   * Useful for rebuilding projections
   */
  reset(): void {
    this.aggregateID = '';
    this.processedSequence = 0n;
    this.position = { position: 0, inTxOrder: 0 };
    this.creationDate = undefined;
    this.changeDate = undefined;
    this.resourceOwner = '';
    this.instanceID = '';
    this.eventBuffer = [];
  }

  /**
   * Check if this read model has been initialized with events
   */
  isInitialized(): boolean {
    return this.aggregateID !== '';
  }

  /**
   * Get the number of events processed
   * Uses processedSequence as a proxy
   */
  getEventCount(): number {
    return Number(this.processedSequence);
  }

  /**
   * Convert read model to plain object (for serialization)
   */
  toJSON(): Record<string, any> {
    return {
      aggregateID: this.aggregateID,
      processedSequence: this.processedSequence.toString(),
      position: this.position,
      creationDate: this.creationDate?.toISOString(),
      changeDate: this.changeDate?.toISOString(),
      resourceOwner: this.resourceOwner,
      instanceID: this.instanceID,
      ...this.serializeState(),
    };
  }

  /**
   * Serialize custom state for this read model
   * Override to include additional fields in toJSON()
   */
  protected serializeState(): Record<string, any> {
    return {};
  }
}

/**
 * Helper function to create a read model from event history
 * 
 * @param readModel - The read model instance to populate
 * @param events - Events to apply to the read model
 * 
 * @example
 * const userModel = new UserReadModel();
 * await buildReadModel(userModel, events);
 * console.log(userModel.username);
 */
export async function buildReadModel<T extends ReadModel>(
  readModel: T,
  events: Event[]
): Promise<T> {
  readModel.appendEvents(...events);
  await readModel.reduce();
  return readModel;
}

/**
 * Helper function to rebuild a read model from scratch
 * Resets the model first, then applies events
 * 
 * @param readModel - The read model instance to rebuild
 * @param events - Events to apply after reset
 */
export async function rebuildReadModel<T extends ReadModel>(
  readModel: T,
  events: Event[]
): Promise<T> {
  readModel.reset();
  return buildReadModel(readModel, events);
}
