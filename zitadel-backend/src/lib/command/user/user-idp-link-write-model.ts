/**
 * User IDP Link Write Model
 * 
 * State tracking for external identity provider links
 * Based on Go: internal/command/user_idp_link_model.go
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';
import { UserIDPLinkState } from '../../domain/user-idp-link';

/**
 * User IDP Link Write Model
 * Tracks a single IDP link for a user
 */
export class UserIDPLinkWriteModel extends WriteModel {
  idpConfigID: string;
  externalUserID: string;
  displayName: string = '';
  state: UserIDPLinkState = UserIDPLinkState.UNSPECIFIED;

  constructor(userID: string, idpConfigID: string, externalUserID: string, orgID: string) {
    super('user');
    this.aggregateID = userID;
    this.resourceOwner = orgID;
    this.idpConfigID = idpConfigID;
    this.externalUserID = externalUserID;
  }

  reduce(event: Event): void {
    // Only process events for this specific IDP link
    const eventIdpConfigID = event.payload?.idpConfigID;
    const eventExternalUserID = event.payload?.externalUserID;
    const eventPreviousID = event.payload?.previousID;

    switch (event.eventType) {
      case 'user.idp.link.added':
        if (eventIdpConfigID === this.idpConfigID && eventExternalUserID === this.externalUserID) {
          this.idpConfigID = eventIdpConfigID;
          this.displayName = event.payload?.displayName || '';
          this.externalUserID = eventExternalUserID;
          this.state = UserIDPLinkState.ACTIVE;
        }
        break;

      case 'user.idp.externalid.migrated':
        // Migration: previousID → newID
        if (eventIdpConfigID === this.idpConfigID && eventPreviousID === this.externalUserID) {
          this.externalUserID = event.payload?.newID || this.externalUserID;
        }
        break;

      case 'user.idp.externalusername.changed':
        if (eventIdpConfigID === this.idpConfigID && eventExternalUserID === this.externalUserID) {
          this.displayName = event.payload?.displayName || event.payload?.newUsername || '';
        }
        break;

      case 'user.idp.link.removed':
      case 'user.idp.link.cascade.removed':
        if (eventIdpConfigID === this.idpConfigID && eventExternalUserID === this.externalUserID) {
          this.state = UserIDPLinkState.REMOVED;
        }
        break;

      case 'user.removed':
      case 'user.deleted':
        this.state = UserIDPLinkState.REMOVED;
        break;
    }
  }
}
