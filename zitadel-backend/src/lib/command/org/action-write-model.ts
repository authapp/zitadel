/**
 * Action Write Model
 * 
 * Tracks action aggregate state for command execution
 * Based on Go: internal/command/org_action_model.go
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';
import { ActionState } from '../../domain/action';

/**
 * Action write model
 */
export class ActionWriteModel extends WriteModel {
  name: string = '';
  script: string = '';
  timeout: number = 0; // milliseconds
  allowedToFail: boolean = false;
  state: ActionState = ActionState.UNSPECIFIED;

  constructor(actionID: string, orgID: string) {
    super('action');
    this.aggregateID = actionID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'action.added':
        this.name = event.payload?.name || '';
        this.script = event.payload?.script || '';
        this.timeout = event.payload?.timeout || 0;
        this.allowedToFail = event.payload?.allowedToFail || false;
        this.state = ActionState.ACTIVE;
        break;

      case 'action.changed':
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

      case 'action.deactivated':
        this.state = ActionState.INACTIVE;
        break;

      case 'action.reactivated':
        this.state = ActionState.ACTIVE;
        break;

      case 'action.removed':
        this.state = ActionState.REMOVED;
        break;
    }
  }
}

/**
 * Actions list by org write model
 */
export class ActionsListByOrgWriteModel extends WriteModel {
  actions: Map<string, ActionWriteModel> = new Map();

  constructor(orgID: string) {
    super('action');
    this.aggregateID = orgID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'action.added':
        if (event.aggregateID) {
          const action = new ActionWriteModel(event.aggregateID, this.resourceOwner);
          action.name = event.payload?.name || '';
          action.state = ActionState.ACTIVE;
          this.actions.set(event.aggregateID, action);
        }
        break;

      case 'action.deactivated':
        if (event.aggregateID) {
          const action = this.actions.get(event.aggregateID);
          if (action) {
            action.state = ActionState.INACTIVE;
          }
        }
        break;

      case 'action.reactivated':
        if (event.aggregateID) {
          const action = this.actions.get(event.aggregateID);
          if (action) {
            action.state = ActionState.ACTIVE;
          }
        }
        break;

      case 'action.removed':
        if (event.aggregateID) {
          this.actions.delete(event.aggregateID);
        }
        break;
    }
  }
}
