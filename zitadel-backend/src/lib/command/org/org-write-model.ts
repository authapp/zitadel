/**
 * Organization Write Model
 * 
 * Tracks organization aggregate state for command execution
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';

/**
 * Organization state enum
 */
export enum OrgState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
}

/**
 * Organization write model
 */
export class OrgWriteModel extends WriteModel {
  state: OrgState = OrgState.UNSPECIFIED;
  name?: string;
  primaryDomain?: string;
  
  constructor() {
    super('org');
  }
  
  reduce(event: Event): void {
    switch (event.eventType) {
      case 'org.added':
        this.state = OrgState.ACTIVE;
        this.name = event.payload?.name;
        break;
        
      case 'org.changed':
        if (event.payload?.name !== undefined) {
          this.name = event.payload.name;
        }
        break;
        
      case 'org.deactivated':
        this.state = OrgState.INACTIVE;
        break;
        
      case 'org.reactivated':
        this.state = OrgState.ACTIVE;
        break;
        
      case 'org.domain.primary.set':
        this.primaryDomain = event.payload?.domain;
        break;
    }
  }
}

/**
 * Helper functions for org state
 */

export function isOrgStateExists(state: OrgState): boolean {
  return state !== OrgState.UNSPECIFIED;
}

export function isOrgStateActive(state: OrgState): boolean {
  return state === OrgState.ACTIVE;
}

export function isOrgStateInactive(state: OrgState): boolean {
  return state === OrgState.INACTIVE;
}
