/**
 * Organization Privacy Policy Write Model
 * 
 * Tracks privacy policy state for terms of service, privacy links, etc.
 * Based on Go: internal/command/org_policy_privacy_model.go
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
 * Organization Privacy Policy Write Model
 */
export class OrgPrivacyPolicyWriteModel extends WriteModel {
  tosLink: string = '';
  privacyLink: string = '';
  helpLink: string = '';
  supportEmail: string = '';
  docsLink: string = '';
  customLink: string = '';
  customLinkText: string = '';
  state: PolicyState = PolicyState.UNSPECIFIED;

  constructor(orgID: string) {
    super('org');
    this.aggregateID = orgID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'org.privacy.policy.added':
        this.tosLink = event.payload?.tosLink || '';
        this.privacyLink = event.payload?.privacyLink || '';
        this.helpLink = event.payload?.helpLink || '';
        this.supportEmail = event.payload?.supportEmail || '';
        this.docsLink = event.payload?.docsLink || '';
        this.customLink = event.payload?.customLink || '';
        this.customLinkText = event.payload?.customLinkText || '';
        this.state = PolicyState.ACTIVE;
        break;

      case 'org.privacy.policy.changed':
        if (event.payload?.tosLink !== undefined) {
          this.tosLink = event.payload.tosLink;
        }
        if (event.payload?.privacyLink !== undefined) {
          this.privacyLink = event.payload.privacyLink;
        }
        if (event.payload?.helpLink !== undefined) {
          this.helpLink = event.payload.helpLink;
        }
        if (event.payload?.supportEmail !== undefined) {
          this.supportEmail = event.payload.supportEmail;
        }
        if (event.payload?.docsLink !== undefined) {
          this.docsLink = event.payload.docsLink;
        }
        if (event.payload?.customLink !== undefined) {
          this.customLink = event.payload.customLink;
        }
        if (event.payload?.customLinkText !== undefined) {
          this.customLinkText = event.payload.customLinkText;
        }
        break;

      case 'org.privacy.policy.removed':
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
   * Check if any values changed
   */
  hasChanged(
    tosLink: string,
    privacyLink: string,
    helpLink: string,
    supportEmail: string,
    docsLink: string,
    customLink: string,
    customLinkText: string
  ): boolean {
    return (
      this.tosLink !== tosLink ||
      this.privacyLink !== privacyLink ||
      this.helpLink !== helpLink ||
      this.supportEmail !== supportEmail ||
      this.docsLink !== docsLink ||
      this.customLink !== customLink ||
      this.customLinkText !== customLinkText
    );
  }
}
