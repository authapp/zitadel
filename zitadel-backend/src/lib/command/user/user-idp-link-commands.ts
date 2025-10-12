/**
 * User IDP Link Commands
 * 
 * External Identity Provider linking for social login (Google, GitHub, Microsoft, etc.)
 * Based on Go: internal/command/user_idp_link.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { UserIDPLinkWriteModel } from './user-idp-link-write-model';
import { UserIDPLink, UserIDPLinkState, isIDPLinkValid } from '../../domain/user-idp-link';

/**
 * Add User IDP Link
 * Links a user to an external identity provider
 * Based on Go: AddUserIDPLink (user_idp_link.go:14-49)
 */
export async function addUserIDPLink(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  link: UserIDPLink
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  if (!isIDPLinkValid(link)) {
    throwInvalidArgument('IDP link is invalid', 'IDP-link01');
  }

  // Check user exists
  // In production: use getUserWriteModel or similar
  // For now, simplified check

  // Check permissions
  await this.checkPermission(ctx, 'user.write', 'write', orgID);

  // Create event
  const command: Command = {
    eventType: 'user.idp.link.added',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      idpConfigID: link.idpConfigID,
      externalUserID: link.externalUserID,
      displayName: link.displayName,
    },
  };

  const event = await this.getEventstore().push(command);

  return {
    sequence: event.aggregateVersion,
    eventDate: event.createdAt,
    resourceOwner: orgID,
  };
}

/**
 * Bulk Add User IDP Links
 * Links multiple external IDPs to a user at once
 * Based on Go: BulkAddedUserIDPLinks (user_idp_link.go:51-76)
 */
export async function bulkAddedUserIDPLinks(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  links: UserIDPLink[]
): Promise<void> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  if (!links || links.length === 0) {
    throwInvalidArgument('At least one IDP link required', 'IDP-bulk01');
  }

  // Validate all links
  for (const link of links) {
    if (!isIDPLinkValid(link)) {
      throwInvalidArgument('One or more IDP links are invalid', 'IDP-bulk02');
    }
  }

  // Check user exists
  // In production: verify user exists before bulk linking

  // Check permissions
  await this.checkPermission(ctx, 'user.write', 'write', orgID);

  // Create events for all links
  const commands: Command[] = links.map(link => ({
    eventType: 'user.idp.link.added',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      idpConfigID: link.idpConfigID,
      externalUserID: link.externalUserID,
      displayName: link.displayName,
    },
  }));

  await this.getEventstore().pushMany(commands);
}

/**
 * Remove User IDP Link
 * Unlinks a user from an external identity provider
 * Based on Go: RemoveUserIDPLink (user_idp_link.go:102-116)
 */
export async function removeUserIDPLink(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  idpConfigID: string,
  externalUserID: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(idpConfigID, 'idpConfigID');
  validateRequired(externalUserID, 'externalUserID');

  // Check permissions
  await this.checkPermission(ctx, 'user.write', 'write', orgID);

  // Load IDP link
  const wm = new UserIDPLinkWriteModel(userID, idpConfigID, externalUserID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.state === UserIDPLinkState.UNSPECIFIED || wm.state === UserIDPLinkState.REMOVED) {
    throwNotFound('IDP link not found', 'IDP-remove01');
  }

  // Create event
  const command: Command = {
    eventType: 'user.idp.link.removed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      idpConfigID,
      externalUserID,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * User IDP Login Checked
 * Marks that a user successfully logged in via external IDP
 * Based on Go: UserIDPLoginChecked (user_idp_link.go:142-158)
 */
export async function userIDPLoginChecked(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  authRequestID?: string
): Promise<void> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Check user exists
  // In production: verify user exists before checking IDP login

  // Create event
  const command: Command = {
    eventType: 'user.idp.check.succeeded',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      authRequestID: authRequestID || '',
    },
  };

  await this.getEventstore().push(command);
}

/**
 * Migrate User IDP
 * Migrates a user's external ID from one to another (provider migration)
 * Based on Go: MigrateUserIDP (user_idp_link.go:160-176)
 */
export async function migrateUserIDP(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  idpConfigID: string,
  previousExternalID: string,
  newExternalID: string
): Promise<void> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(idpConfigID, 'idpConfigID');
  validateRequired(previousExternalID, 'previousExternalID');
  validateRequired(newExternalID, 'newExternalID');

  // Check permissions
  await this.checkPermission(ctx, 'user.write', 'write', orgID);

  // Load IDP link with previous ID
  const wm = new UserIDPLinkWriteModel(userID, idpConfigID, previousExternalID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.state !== UserIDPLinkState.ACTIVE) {
    throwPreconditionFailed('IDP link not found or not active', 'IDP-migrate01');
  }

  // Create migration event
  const command: Command = {
    eventType: 'user.idp.externalid.migrated',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      idpConfigID,
      previousID: previousExternalID,
      newID: newExternalID,
    },
  };

  await this.getEventstore().push(command);
}

/**
 * Update User IDP Link Username
 * Updates the display name (username) from external provider
 * Based on Go: UpdateUserIDPLinkUsername (user_idp_link.go:178-197)
 */
export async function updateUserIDPLinkUsername(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  idpConfigID: string,
  externalUserID: string,
  newUsername: string
): Promise<void> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(idpConfigID, 'idpConfigID');
  validateRequired(externalUserID, 'externalUserID');
  validateRequired(newUsername, 'newUsername');

  // Check permissions
  await this.checkPermission(ctx, 'user.write', 'write', orgID);

  // Load IDP link
  const wm = new UserIDPLinkWriteModel(userID, idpConfigID, externalUserID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.state !== UserIDPLinkState.ACTIVE) {
    throwPreconditionFailed('IDP link not found or not active', 'IDP-username01');
  }

  // No change, skip
  if (wm.displayName === newUsername) {
    return;
  }

  // Create event
  const command: Command = {
    eventType: 'user.idp.externalusername.changed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      idpConfigID,
      externalUserID,
      displayName: newUsername,
      newUsername,
    },
  };

  await this.getEventstore().push(command);
}
