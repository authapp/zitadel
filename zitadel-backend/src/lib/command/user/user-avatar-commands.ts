/**
 * User Avatar Commands
 * 
 * User profile avatar image management
 * Based on Go: internal/command/user_human_avatar.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwInternal } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { UserWriteModel, UserState } from './user-write-model';

/**
 * Avatar upload data
 */
export interface AvatarUpload {
  contentType: string; // e.g., 'image/png', 'image/jpeg'
  data: Buffer;       // Image binary data
  filename?: string;  // Optional original filename
}

/**
 * Add/upload user avatar
 * Based on Go: AddHumanAvatar (user_human_avatar.go:11-37)
 * 
 * Uploads an avatar image to static storage and associates it with the user
 */
export async function addHumanAvatar(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  upload: AvatarUpload
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  if (!upload.data || upload.data.length === 0) {
    throwInvalidArgument('avatar data is required', 'AVATAR-001');
  }

  if (!upload.contentType || !upload.contentType.startsWith('image/')) {
    throwInvalidArgument('invalid image content type', 'AVATAR-002');
  }

  // Load user write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.state === UserState.UNSPECIFIED || wm.state === UserState.DELETED) {
    throwNotFound('user not found', 'AVATAR-003');
  }

  // Check permissions
  await this.checkPermission(ctx, 'user.avatar', 'write', orgID);

  // Generate unique avatar filename
  const timestamp = Date.now();
  const extension = upload.contentType.split('/')[1] || 'png';
  const objectName = `avatars/${orgID}/${userID}/${timestamp}.${extension}`;

  // Upload to static storage
  try {
    await this.getStatic().upload(objectName, upload.data, {
      contentType: upload.contentType,
      metadata: {
        userId: userID,
        orgId: orgID,
        uploadedBy: ctx.userID || 'system',
      },
    });
  } catch (error) {
    throwInternal('failed to upload avatar', 'AVATAR-004');
  }

  // Create event
  const command: Command = {
    eventType: 'user.human.avatar.added',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      storeKey: objectName,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove user avatar
 * Based on Go: RemoveHumanAvatar (user_human_avatar.go:39-64)
 * 
 * Removes the user's avatar image from storage and the user record
 */
export async function removeHumanAvatar(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Load user write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.state === UserState.UNSPECIFIED || wm.state === UserState.DELETED) {
    throwNotFound('user not found', 'AVATAR-005');
  }

  if (!wm.avatar) {
    throwNotFound('user has no avatar', 'AVATAR-006');
  }

  // Check permissions
  await this.checkPermission(ctx, 'user.avatar', 'delete', orgID);

  // Remove from static storage
  try {
    await this.getStatic().delete(wm.avatar);
  } catch (error) {
    // Log error but don't fail - the avatar may already be deleted
    console.warn(`Failed to remove avatar from storage: ${error}`);
  }

  // Create event
  const command: Command = {
    eventType: 'user.human.avatar.removed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      storeKey: wm.avatar,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}
