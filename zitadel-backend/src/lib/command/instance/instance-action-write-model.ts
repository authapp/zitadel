/**
 * Instance Action Write Model
 * 
 * Tracks instance-level action aggregate state for command execution
 * Instance actions apply to all organizations in the instance
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';
import { ActionState } from '../../domain/action';

/**
 * Instance action write model
 */
export class InstanceActionWriteModel extends WriteModel {
  name: string = '';
  script: string = '';
  timeout: number = 0; // milliseconds
  allowedToFail: boolean = false;
  state: ActionState = ActionState.UNSPECIFIED;

  constructor(actionID: string, instanceID: string) {
    super('instance_action');
    this.aggregateID = actionID;
    this.resourceOwner = instanceID; // Instance-level actions are owned by instance
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'instance.action.added':
        this.name = event.payload?.name || '';
        this.script = event.payload?.script || '';
        this.timeout = event.payload?.timeout || 0;
        this.allowedToFail = event.payload?.allowedToFail || false;
        this.state = ActionState.ACTIVE;
        break;

      case 'instance.action.changed':
        if (event.payload?.name !== undefined) {
          this.name = event.payload.name;
        }
        if (event.payload?.script !== undefined) {
          this.script = event.payload.script;
        }
        if (event.payload?.timeout !== undefined) {
          this.timeout = event.payload.timeout;
        }
        if (event.payload?.allowedToFail !== undefined) {
          this.allowedToFail = event.payload.allowedToFail;
        }
        break;

      case 'instance.action.deactivated':
        this.state = ActionState.INACTIVE;
        break;

      case 'instance.action.reactivated':
        this.state = ActionState.ACTIVE;
        break;

      case 'instance.action.removed':
        this.state = ActionState.REMOVED;
        break;
    }
  }
}
