/**
 * Organization Notification Policy Write Model
 * 
 * Tracks notification policy state for email notifications
 * Based on Go: internal/command/org_policy_notification_model.go
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';

/**
 * Policy State enumeration
 */
export enum PolicyState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REMOVED = 2,
}

/**
 * Organization Notification Policy Write Model
 */
export class OrgNotificationPolicyWriteModel extends WriteModel {
  passwordChange: boolean = false;
  state: PolicyState = PolicyState.UNSPECIFIED;

  constructor(orgID: string) {
    super('org');
    this.aggregateID = orgID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'org.notification.policy.added':
        this.passwordChange = event.payload?.passwordChange ?? false;
        this.state = PolicyState.ACTIVE;
        break;

      case 'org.notification.policy.changed':
        if (event.payload?.passwordChange !== undefined) {
          this.passwordChange = event.payload.passwordChange;
        }
        break;

      case 'org.notification.policy.removed':
        this.state = PolicyState.REMOVED;
        break;

      case 'org.removed':
        this.state = PolicyState.REMOVED;
        break;
    }
  }

  /**
   * Check if state exists (active)
   */
  exists(): boolean {
    return this.state === PolicyState.ACTIVE;
  }

  /**
   * Check if value changed
   */
  hasChanged(passwordChange: boolean): boolean {
    return this.passwordChange !== passwordChange;
  }
}
