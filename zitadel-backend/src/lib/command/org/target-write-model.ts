/**
 * Target Write Model
 * 
 * Write model for Target aggregate
 * Based on Zitadel Go: internal/command/target.go
 */

import { WriteModel } from '../write-model';
import { Event } from '../../eventstore/types';
import { TargetType, TargetState, targetStateExists } from '../../domain/target';

export class TargetWriteModel extends WriteModel {
  name: string = '';
  targetType: TargetType = TargetType.UNSPECIFIED;
  endpoint: string = '';
  timeout: number = 0;
  interruptOnError: boolean = false;
  state: TargetState = TargetState.UNSPECIFIED;

  constructor(targetID: string, resourceOwner: string) {
    super('target');
    this.aggregateID = targetID;
    this.resourceOwner = resourceOwner;
  }

  /**
   * Check if target exists (not removed/unspecified)
   */
  exists(): boolean {
    return targetStateExists(this.state);
  }

  /**
   * Reduce events to build current state
   */
  reduce(event: Event): void {
    if (!event.payload) return;

    switch (event.eventType) {
      case 'target.added':
        this.name = event.payload.name;
        this.targetType = event.payload.targetType;
        this.endpoint = event.payload.endpoint;
        this.timeout = event.payload.timeout;
        this.interruptOnError = event.payload.interruptOnError || false;
        this.state = TargetState.ACTIVE;
        break;

      case 'target.changed':
        if (event.payload.name !== undefined) {
          this.name = event.payload.name;
        }
        if (event.payload.targetType !== undefined) {
          this.targetType = event.payload.targetType;
        }
        if (event.payload.endpoint !== undefined) {
          this.endpoint = event.payload.endpoint;
        }
        if (event.payload.timeout !== undefined) {
          this.timeout = event.payload.timeout;
        }
        if (event.payload.interruptOnError !== undefined) {
          this.interruptOnError = event.payload.interruptOnError;
        }
        break;

      case 'target.removed':
        this.state = TargetState.REMOVED;
        break;

      default:
        // Ignore unknown events
        break;
    }
  }

  /**
   * Check if changes are detected
   */
  hasChanges(changes: {
    name?: string;
    targetType?: TargetType;
    endpoint?: string;
    timeout?: number;
    interruptOnError?: boolean;
  }): boolean {
    let hasChanges = false;

    if (changes.name !== undefined && this.name !== changes.name) {
      hasChanges = true;
    }
    if (changes.targetType !== undefined && this.targetType !== changes.targetType) {
      hasChanges = true;
    }
    if (changes.endpoint !== undefined && this.endpoint !== changes.endpoint) {
      hasChanges = true;
    }
    if (changes.timeout !== undefined && this.timeout !== changes.timeout) {
      hasChanges = true;
    }
    if (changes.interruptOnError !== undefined && this.interruptOnError !== changes.interruptOnError) {
      hasChanges = true;
    }

    return hasChanges;
  }

  /**
   * Build change payload
   */
  buildChangePayload(changes: {
    name?: string;
    targetType?: TargetType;
    endpoint?: string;
    timeout?: number;
    interruptOnError?: boolean;
    signingKey?: string;
  }): Record<string, any> {
    const payload: Record<string, any> = {};

    if (changes.name !== undefined && this.name !== changes.name) {
      payload.name = changes.name;
      payload.oldName = this.name;
    }
    if (changes.targetType !== undefined && this.targetType !== changes.targetType) {
      payload.targetType = changes.targetType;
    }
    if (changes.endpoint !== undefined && this.endpoint !== changes.endpoint) {
      payload.endpoint = changes.endpoint;
    }
    if (changes.timeout !== undefined && this.timeout !== changes.timeout) {
      payload.timeout = changes.timeout;
    }
    if (changes.interruptOnError !== undefined && this.interruptOnError !== changes.interruptOnError) {
      payload.interruptOnError = changes.interruptOnError;
    }
    if (changes.signingKey !== undefined) {
      payload.signingKey = changes.signingKey;
    }

    return payload;
  }
}
