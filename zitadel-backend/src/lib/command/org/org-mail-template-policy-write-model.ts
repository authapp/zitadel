/**
 * Organization Mail Template Policy Write Model
 * 
 * Tracks mail template policy state for custom email templates
 * Based on Go: internal/command/org_policy_mail_template_model.go
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
 * Organization Mail Template Policy Write Model
 */
export class OrgMailTemplatePolicyWriteModel extends WriteModel {
  template: string = '';  // HTML template for emails
  state: PolicyState = PolicyState.UNSPECIFIED;

  constructor(orgID: string) {
    super('org');
    this.aggregateID = orgID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'org.mail.template.added':
        this.template = event.payload?.template || '';
        this.state = PolicyState.ACTIVE;
        break;

      case 'org.mail.template.changed':
        if (event.payload?.template !== undefined) {
          this.template = event.payload.template;
        }
        break;

      case 'org.mail.template.removed':
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
   * Check if template changed
   */
  hasChanged(template: string): boolean {
    return this.template !== template;
  }

  /**
   * Validate template
   */
  isValid(template: string): boolean {
    return template !== undefined && template !== null && template.length > 0;
  }
}
