/**
 * User Refresh Token Commands (Zitadel v2)
 * 
 * Implements refresh token revocation commands
 * Matches Go's command/user_human_refresh_token.go
 */

import { Context } from '../context';
import { Commands } from '../commands';
import { throwInvalidArgument, throwNotFound } from '@/zerrors/errors';
import { ObjectDetails, writeModelToObjectDetails, appendAndReduce } from '../write-model';
import { HumanRefreshTokenWriteModel } from './user-refresh-token-write-model';
import { Command } from '../../eventstore/types';
import { UserState } from './user-write-model';

/**
 * Revoke a single refresh token
 * 
 * This invalidates the specified refresh token, forcing the user to
 * re-authenticate to get a new token.
 * 
 * @param ctx - Command context
 * @param userID - User ID who owns the token
 * @param orgID - Organization ID (resource owner)
 * @param tokenID - Token ID to revoke
 * @returns Object details of the revocation
 * 
 * Matches: RevokeRefreshToken() in Go
 */
export async function revokeRefreshToken(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  tokenID: string
): Promise<ObjectDetails> {
  // Validate inputs
  if (!userID || !orgID || !tokenID) {
    throwInvalidArgument('userID, orgID, and tokenID are required', 'COMMAND-GVDgf');
  }

  // Load write model to verify token exists
  const writeModel = new HumanRefreshTokenWriteModel(tokenID);
  await writeModel.load(this.getEventstore(), userID, orgID);

  // Check if user is active (token can only exist for active users)
  if (writeModel.userState !== UserState.ACTIVE) {
    throwNotFound('Refresh token not found or user not active', 'COMMAND-BHt2w');
  }

  // Create revocation event command
  const command: Command = {
    eventType: 'user.human.refresh.token.removed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      tokenId: tokenID,
    },
  };

  // Push event to eventstore
  const event = await this.getEventstore().push(command);

  // Update write model with new event
  appendAndReduce(writeModel, event);

  return writeModelToObjectDetails(writeModel);
}

/**
 * Revoke multiple refresh tokens
 * 
 * Bulk operation to revoke multiple tokens at once.
 * This is useful for revoking all tokens for a user when
 * compromised or during security events.
 * 
 * @param ctx - Command context
 * @param userID - User ID who owns the tokens
 * @param orgID - Organization ID (resource owner)
 * @param tokenIDs - Array of token IDs to revoke
 * @returns void
 * 
 * Matches: RevokeRefreshTokens() in Go
 */
export async function revokeRefreshTokens(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  tokenIDs: string[]
): Promise<void> {
  // Validate inputs
  if (!tokenIDs || tokenIDs.length === 0) {
    throwInvalidArgument('At least one tokenID is required', 'COMMAND-Gfj42');
  }

  if (!userID || !orgID) {
    throwInvalidArgument('userID and orgID are required', 'COMMAND-GVDgf');
  }

  // Create revocation events for all tokens
  const commands: Command[] = [];

  for (const tokenID of tokenIDs) {
    if (!tokenID) {
      throwInvalidArgument('tokenID cannot be empty', 'COMMAND-GVDgf');
    }

    // Load write model to verify token exists
    const writeModel = new HumanRefreshTokenWriteModel(tokenID);
    await writeModel.load(this.getEventstore(), userID, orgID);

    // Skip if token doesn't exist or user not active
    if (writeModel.userState !== UserState.ACTIVE) {
      continue;
    }

    // Create revocation event command
    const command: Command = {
      eventType: 'user.human.refresh.token.removed',
      aggregateType: 'user',
      aggregateID: userID,
      owner: orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        tokenId: tokenID,
      },
    };

    commands.push(command);
  }

  // Push all events at once using pushMany
  if (commands.length > 0) {
    await this.getEventstore().pushMany(commands);
  }
}

/**
 * Revoke all refresh tokens for a user
 * 
 * This is a security operation that invalidates ALL refresh tokens
 * for a user. Use cases:
 * - User reports account compromise
 * - Password change (force re-authentication)
 * - Administrator security action
 * 
 * Note: In a real implementation, this would query all tokens for a user
 * from a projection/view, then revoke them all.
 * 
 * @param ctx - Command context
 * @param userID - User ID to revoke all tokens for
 * @param orgID - Organization ID (resource owner)
 * @param tokenIDs - Optional specific token IDs (if known from query layer)
 * @returns void
 * 
 * This is an extension beyond Go's implementation for convenience.
 * When query layer is implemented, this will query all active tokens.
 */
export async function revokeAllUserRefreshTokens(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  tokenIDs?: string[]
): Promise<void> {
  // Validate inputs
  if (!userID || !orgID) {
    throwInvalidArgument('userID and orgID are required', 'COMMAND-GVDgf');
  }

  // If tokenIDs provided, use them directly
  if (tokenIDs && tokenIDs.length > 0) {
    await revokeRefreshTokens.call(this, ctx, userID, orgID, tokenIDs);
    return;
  }

  // TODO: When query layer is implemented, query all active tokens:
  // const tokenIDs = await this.queries.getUserRefreshTokens(userID, orgID);
  // await revokeRefreshTokens.call(this, ctx, userID, orgID, tokenIDs);

  // For now, throw an error indicating query layer is needed
  throwInvalidArgument(
    'revokeAllUserRefreshTokens requires either tokenIDs parameter or query layer implementation',
    'COMMAND-NotImpl'
  );
}
