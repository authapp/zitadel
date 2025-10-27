/**
 * Logout Commands (Phase 3 - Week 19-20)
 * 
 * Implements logout flows following Zitadel Go patterns
 * Reference: internal/command/user_v2_session.go
 */

import { Context } from '../context';
import { Commands } from '../commands';
import { ObjectDetails } from '../write-model';
import { throwInvalidArgument } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';

/**
 * Backchannel logout data
 */
export interface BackchannelLogoutData {
  sessionID: string;
  clientID: string;
  logoutToken: string;
  sid?: string;  // Session ID from ID token
}

/**
 * Terminate all user sessions command
 * 
 * Logs out user from all active sessions across all organizations
 */
export async function terminateAllUserSessions(
  this: Commands,
  ctx: Context,
  userID: string,
  reason?: string
): Promise<ObjectDetails & { terminatedCount: number }> {
  // 1. Validate input
  if (!userID) {
    throwInvalidArgument('userID is required', 'COMMAND-Logout01');
  }

  // 2. Check permissions - user can logout themselves or admin can logout user
  if (ctx.userID !== userID) {
    await this.checkPermission(ctx, 'user.session', 'terminate', ctx.instanceID);
  }

  // 3. Query all active sessions for user
  // In a real implementation, this would query the session projection
  // For now, we create an event that projections will process
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'user.sessions.terminated',
    aggregateType: 'user',
    aggregateID: userID,
    owner: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userID,
      reason: reason || 'user_logout_all',
      terminatedAt: new Date(),
      terminatedBy: ctx.userID || 'system',
    },
  };

  await this.getEventstore().push(command);

  return {
    terminatedCount: 0, // Would be populated by actual session count
    sequence: BigInt(1),
    eventDate: new Date(),
    resourceOwner: ctx.instanceID,
  };
}

/**
 * Terminate all sessions of organization command
 * 
 * Logs out all users from all sessions in an organization
 * (Useful for org-wide security events)
 */
export async function terminateAllSessionsOfOrg(
  this: Commands,
  ctx: Context,
  orgID: string,
  reason?: string
): Promise<ObjectDetails & { terminatedCount: number }> {
  // 1. Validate input
  if (!orgID) {
    throwInvalidArgument('orgID is required', 'COMMAND-Logout02');
  }

  // 2. Check permissions - requires org admin
  await this.checkPermission(ctx, 'org.session', 'terminate_all', orgID);

  // 3. Create org-wide session termination event
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'org.sessions.terminated',
    aggregateType: 'org',
    aggregateID: orgID,
    owner: orgID,
    creator: ctx.userID || 'system',
    payload: {
      orgID,
      reason: reason || 'org_security_event',
      terminatedAt: new Date(),
      terminatedBy: ctx.userID || 'system',
    },
  };

  await this.getEventstore().push(command);

  return {
    terminatedCount: 0, // Would be populated by actual session count
    sequence: BigInt(1),
    eventDate: new Date(),
    resourceOwner: orgID,
  };
}

/**
 * Handle backchannel logout command
 * 
 * Processes OIDC backchannel logout request
 * Ref: https://openid.net/specs/openid-connect-backchannel-1_0.html
 */
export async function handleBackchannelLogout(
  this: Commands,
  ctx: Context,
  data: BackchannelLogoutData
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!data.sessionID) {
    throwInvalidArgument('sessionID is required', 'COMMAND-Logout03');
  }
  if (!data.clientID) {
    throwInvalidArgument('clientID is required', 'COMMAND-Logout04');
  }
  if (!data.logoutToken) {
    throwInvalidArgument('logoutToken is required', 'COMMAND-Logout05');
  }

  // 2. Validate logout token (JWT)
  // In production, this would:
  // - Verify JWT signature
  // - Check issuer
  // - Validate audience (must include clientID)
  // - Check 'events' claim contains 'http://schemas.openid.net/event/backchannel-logout'
  // - Verify 'sid' or 'sub' claim matches session

  // For now, we trust the input and create the event
  // Real implementation should call: await this.validateLogoutToken(data.logoutToken)

  // 3. Create backchannel logout event
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'oidc.session.backchannel.logout',
    aggregateType: 'session',
    aggregateID: data.sessionID,
    owner: ctx.instanceID,
    creator: 'system', // Backchannel logout is system-initiated
    payload: {
      sessionID: data.sessionID,
      clientID: data.clientID,
      sid: data.sid,
      logoutToken: data.logoutToken,
      logoutAt: new Date(),
      method: 'backchannel',
    },
  };

  await this.getEventstore().push(command);

  return {
    sequence: BigInt(1),
    eventDate: new Date(),
    resourceOwner: ctx.instanceID,
  };
}

// Note: validateLogoutToken would be implemented here in production
// It would:
// 1. Parse JWT
// 2. Verify signature using JWKS
// 3. Validate claims
// 4. Check token hasn't been used before (jti claim)
