/**
 * Write Model Pattern (Zitadel v2)
 * 
 * Write models track aggregate state during command execution.
 * Unlike BaseAggregate, write models are lightweight and focused
 * on command validation and state tracking.
 */

import { Event, Eventstore } from '../eventstore/types';

/**
 * Base write model for tracking aggregate state
 */
export abstract class WriteModel {
  aggregateID: string = '';
  aggregateType: string = '';
  aggregateVersion: bigint = 0n;
  resourceOwner: string = '';
  instanceID: string = '';
  changeDate?: Date;
  
  constructor(aggregateType: string) {
    this.aggregateType = aggregateType;
  }
  
  /**
   * Reduce event into write model state
   * Must be implemented by subclasses to handle specific events
   */
  abstract reduce(event: Event): void;
  
  /**
   * Load write model from eventstore
   */
  async load(
    eventstore: Eventstore,
    aggregateID: string,
    resourceOwner: string
  ): Promise<void> {
    this.aggregateID = aggregateID;
    this.resourceOwner = resourceOwner;
    
    const events = await eventstore.query({
      aggregateTypes: [this.aggregateType],
      aggregateIDs: [aggregateID],
    });
    
    for (const event of events) {
      this.reduce(event);
      this.aggregateVersion = event.aggregateVersion;
      this.instanceID = event.instanceID;
      this.resourceOwner = event.owner;
      this.changeDate = event.createdAt;
    }
  }
  
  /**
   * Load from specific events (for testing or in-transaction reads)
   */
  loadFromEvents(events: Event[]): void {
    for (const event of events) {
      this.reduce(event);
      this.aggregateVersion = event.aggregateVersion;
      if (!this.instanceID) this.instanceID = event.instanceID;
      if (!this.resourceOwner) this.resourceOwner = event.owner;
      this.changeDate = event.createdAt;
      if (!this.aggregateID) this.aggregateID = event.aggregateID;
    }
  }
}

/**
 * Append events and reduce state
 * Helper function to apply new events to a write model
 */
export function appendAndReduce(
  wm: WriteModel,
  ...events: Event[]
): void {
  for (const event of events) {
    wm.reduce(event);
    wm.aggregateVersion = event.aggregateVersion;
    wm.changeDate = event.createdAt;
  }
}

/**
 * Convert write model to object details
 */
export interface ObjectDetails {
  sequence: bigint;
  eventDate: Date;
  resourceOwner: string;
}

export function writeModelToObjectDetails(wm: WriteModel): ObjectDetails {
  return {
    sequence: wm.aggregateVersion,
    eventDate: wm.changeDate || new Date(),
    resourceOwner: wm.resourceOwner,
  };
}

/**
 * Helper to check if aggregate exists
 */
export function isAggregateExists(wm: WriteModel): boolean {
  return wm.aggregateVersion > 0n;
}

/**
 * Helper to get aggregate for command creation
 */
export interface Aggregate {
  id: string;
  type: string;
  owner: string;
  instanceID: string;
  version: bigint;
}

export function aggregateFromWriteModel(wm: WriteModel): Aggregate {
  return {
    id: wm.aggregateID,
    type: wm.aggregateType,
    owner: wm.resourceOwner,
    instanceID: wm.instanceID,
    version: wm.aggregateVersion,
  };
}
