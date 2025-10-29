/**
 * Execution Write Model
 * 
 * Write model for Execution aggregate
 * Based on Zitadel Go: internal/command/execution_model.go
 */

import { WriteModel } from '../write-model';
import { Event } from '../../eventstore/types';
import {
  ExecutionType,
  ExecutionState,
  ExecutionTarget,
  executionStateExists,
  getIncludeIDs,
  targetsEqual,
} from '../../domain/execution';

export class ExecutionWriteModel extends WriteModel {
  executionType: ExecutionType = ExecutionType.UNSPECIFIED;
  targets: ExecutionTarget[] = [];
  state: ExecutionState = ExecutionState.UNSPECIFIED;

  constructor(executionID: string, resourceOwner: string) {
    super('execution');
    this.aggregateID = executionID;
    this.resourceOwner = resourceOwner;
  }

  /**
   * Check if execution exists
   */
  exists(): boolean {
    return executionStateExists(this.state);
  }

  /**
   * Check if targets are equal (for idempotency)
   */
  targetsEqual(newTargets: ExecutionTarget[]): boolean {
    return targetsEqual(this.targets, newTargets);
  }

  /**
   * Get list of included execution IDs
   */
  getIncludes(): string[] {
    return getIncludeIDs(this.targets);
  }

  /**
   * Reduce events to build current state
   */
  reduce(event: Event): void {
    if (!event.payload) return;

    switch (event.eventType) {
      case 'execution.set':
        this.targets = event.payload.targets || [];
        this.state = ExecutionState.ACTIVE;
        break;

      case 'execution.removed':
        this.state = ExecutionState.REMOVED;
        this.targets = [];
        break;

      default:
        // Ignore unknown events
        break;
    }
  }
}

/**
 * Write model for checking if multiple executions exist
 * Used for validating includes
 */
export class ExecutionsExistWriteModel extends WriteModel {
  private executionIDs: string[];
  private foundIDs: Set<string> = new Set();

  constructor(executionIDs: string[], resourceOwner: string) {
    super('execution');
    this.executionIDs = executionIDs;
    this.resourceOwner = resourceOwner;
  }

  /**
   * Check if all execution IDs exist
   */
  allExist(): boolean {
    return this.executionIDs.every(id => this.foundIDs.has(id));
  }

  /**
   * Filter query to find all execution IDs
   */
  query(): any[] {
    return [
      {
        aggregateTypes: ['execution'],
        aggregateIDs: this.executionIDs,
        events: ['execution.set'],
      },
    ];
  }

  /**
   * Reduce events to track which IDs exist
   */
  reduce(event: Event): void {
    if (event.eventType === 'execution.set') {
      this.foundIDs.add(event.aggregateID);
    }
  }
}
