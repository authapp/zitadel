/**
 * User Commands (Zitadel v2)
 * 
 * Implements user aggregate commands using write models
 * Uses event repository for type-safe event creation
 */

import { Context } from '../context';
import { Commands } from '../commands';
import { validateEmail, validateUsername, validatePassword, DEFAULT_PASSWORD_POLICY } from '../validation';
import { throwInvalidArgument, throwAlreadyExists, throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { UserWriteModel, UserState, UserType } from './user-write-model';
import { OrgUsersWriteModel } from './org-users-write-model';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';

// Use event repository for type-safe events
import {
  newHumanAddedEvent,
  newMachineAddedEvent,
  newEmailVerifiedEvent,
  newPhoneVerifiedEvent,
  newPhoneRemovedEvent,
  newUserDeactivatedEvent,
  newUserReactivatedEvent,
  newUserLockedEvent,
  newUserUnlockedEvent,
  newUserRemovedEvent,
  HumanAddedPayload,
  MachineAddedPayload,
  // TODO: Add these as other commands are migrated to event factories
  // newUsernameChangedEvent,
  // newProfileChangedEvent,
  // newEmailChangedEvent,
  // newPasswordChangedEvent,
} from '../../repository/user/events';
import { Command } from '../../eventstore/types';

/**
 * Add Human User Data
 */
export interface AddHumanUserData {
  userID?: string;
  orgID: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  phone?: string;
  preferredLanguage?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
}

/**
 * Add human user command
 */
export async function addHumanUser(
  this: Commands,
  ctx: Context,
  data: AddHumanUserData
): Promise<ObjectDetails & { userID: string }> {
  // 1. Validate input
  validateUsername(data.username);
  validateEmail(data.email);
  
  if (!data.firstName || !data.firstName.trim()) {
    throwInvalidArgument('firstName is required', 'COMMAND-User10');
  }
  if (!data.lastName || !data.lastName.trim()) {
    throwInvalidArgument('lastName is required', 'COMMAND-User11');
  }
  if (!data.orgID) {
    throwInvalidArgument('orgID is required', 'COMMAND-User12');
  }
  
  // Validate password if provided
  if (data.password) {
    validatePassword(data.password, DEFAULT_PASSWORD_POLICY);
  }
  
  // 2. Generate user ID if not provided
  if (!data.userID) {
    data.userID = await this.nextID();
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'user', 'create', data.orgID);
  
  // 4. Check username uniqueness within organization (Option 3: Write Model Validation)
  const orgUsersWM = new OrgUsersWriteModel(data.orgID);
  await orgUsersWM.load(this.getEventstore(), data.orgID);
  
  if (orgUsersWM.isUsernameTaken(data.username)) {
    const existingUserID = orgUsersWM.getUserIDByUsername(data.username);
    throwAlreadyExists(
      `username '${data.username}' is already taken by user ${existingUserID}`, 
      'COMMAND-User14'
    );
  }
  
  // 5. Load write model to check if user ID exists
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), data.userID, data.orgID);
  
  if (wm.state !== UserState.UNSPECIFIED) {
    throwAlreadyExists('user already exists', 'COMMAND-User13');
  }
  
  // 6. Create command using event factory
  const payload: HumanAddedPayload = {
    username: data.username,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    displayName: `${data.firstName} ${data.lastName}`.trim(),
    preferredLanguage: data.preferredLanguage || 'en',
    password: data.password,
    phone: data.phone,
    emailVerified: data.emailVerified || false,
    phoneVerified: data.phoneVerified || false,
  };
  
  const command = newHumanAddedEvent(
    data.userID,
    data.orgID,
    payload,
    ctx.instanceID,
    ctx.userID || 'system'
  );
  
  // 7. Push to eventstore
  const event = await this.getEventstore().push(command);
  
  // 8. Update write model
  appendAndReduce(wm, event);
  
  return {
    ...writeModelToObjectDetails(wm),
    userID: data.userID,
  };
}

/**
 * Add Machine User Data
 */
export interface AddMachineUserData {
  userID?: string;
  orgID: string;
  username: string;
  name: string;
  description?: string;
}

/**
 * Add machine user command
 */
export async function addMachineUser(
  this: Commands,
  ctx: Context,
  data: AddMachineUserData
): Promise<ObjectDetails & { userID: string }> {
  // 1. Validate input
  validateUsername(data.username);
  
  if (!data.name || !data.name.trim()) {
    throwInvalidArgument('name is required', 'COMMAND-User20');
  }
  if (!data.orgID) {
    throwInvalidArgument('orgID is required', 'COMMAND-User21');
  }
  
  // 2. Generate user ID if not provided
  if (!data.userID) {
    data.userID = await this.nextID();
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'user', 'create', data.orgID);
  
  // 4. Load write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), data.userID, data.orgID);
  
  if (wm.state !== UserState.UNSPECIFIED) {
    throwAlreadyExists('user already exists', 'COMMAND-User22');
  }
  
  // 5. Create command using event factory
  const payload: MachineAddedPayload = {
    username: data.username,
    name: data.name,
    description: data.description,
  };
  
  const command = newMachineAddedEvent(
    data.userID,
    data.orgID,
    payload,
    ctx.instanceID,
    ctx.userID || 'system'
  );
  
  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return {
    ...writeModelToObjectDetails(wm),
    userID: data.userID,
  };
}

/**
 * Change username command
 */
export async function changeUsername(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  newUsername: string
): Promise<ObjectDetails> {
  // 1. Validate
  newUsername = newUsername.trim();
  validateUsername(newUsername);
  
  // 2. Load write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), userID, orgID);
  
  if (wm.state === UserState.UNSPECIFIED) {
    throwNotFound('user not found', 'COMMAND-User30');
  }
  if (wm.state === UserState.DELETED) {
    throwNotFound('user deleted', 'COMMAND-User31');
  }
  
  // 3. Check if username changed
  if (wm.username === newUsername) {
    throwPreconditionFailed('username not changed', 'COMMAND-User32');
  }
  
  // 4. Check permissions
  await this.checkPermission(ctx, 'user', 'update', orgID);
  
  // 5. Create command
  const command: Command = {
    eventType: 'user.username.changed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      oldUsername: wm.username,
      username: newUsername,
    },
  };
  
  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Change profile data
 */
export interface ChangeProfileData {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  preferredLanguage?: string;
}

/**
 * Change user profile command
 */
export async function changeProfile(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  data: ChangeProfileData
): Promise<ObjectDetails> {
  // 1. Validate at least one field changed
  if (!data.firstName && !data.lastName && !data.displayName && !data.preferredLanguage) {
    throwInvalidArgument('at least one field must be provided', 'COMMAND-User40');
  }
  
  // 2. Load write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), userID, orgID);
  
  if (wm.state === UserState.UNSPECIFIED) {
    throwNotFound('user not found', 'COMMAND-User41');
  }
  if (wm.state === UserState.DELETED) {
    throwNotFound('user deleted', 'COMMAND-User42');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'user', 'update', orgID);
  
  // 4. Create command
  const command: Command = {
    eventType: 'user.profile.changed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: data.displayName,
      preferredLanguage: data.preferredLanguage,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Change email command
 */
export async function changeEmail(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  newEmail: string
): Promise<ObjectDetails> {
  // 1. Validate
  newEmail = newEmail.trim();
  validateEmail(newEmail);
  
  // 2. Load write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), userID, orgID);
  
  if (wm.state === UserState.UNSPECIFIED) {
    throwNotFound('user not found', 'COMMAND-User50');
  }
  if (wm.state === UserState.DELETED) {
    throwNotFound('user deleted', 'COMMAND-User51');
  }
  if (wm.userType !== UserType.HUMAN) {
    throwPreconditionFailed('only human users have email', 'COMMAND-User52');
  }
  
  // 3. Check if email changed
  if (wm.email === newEmail) {
    throwPreconditionFailed('email not changed', 'COMMAND-User53');
  }
  
  // 4. Check permissions
  await this.checkPermission(ctx, 'user', 'update', orgID);
  
  // 5. Create command
  const command: Command = {
    eventType: 'user.email.changed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      oldEmail: wm.email,
      email: newEmail,
    },
  };
  
  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Verify email command
 */
export async function verifyEmail(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Load write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), userID, orgID);
  
  if (wm.state === UserState.UNSPECIFIED) {
    throwNotFound('user not found', 'COMMAND-User60');
  }
  if (wm.state === UserState.DELETED) {
    throwNotFound('user deleted', 'COMMAND-User61');
  }
  if (wm.userType !== UserType.HUMAN) {
    throwPreconditionFailed('only human users have email', 'COMMAND-User62');
  }
  if (wm.emailVerified) {
    throwPreconditionFailed('email already verified', 'COMMAND-User63');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'user', 'update', orgID);
  
  // 3. Create command using event factory
  const command = newEmailVerifiedEvent(
    userID,
    orgID,
    ctx.instanceID,
    ctx.userID || 'system'
  );
  
  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Change password command
 */
export async function changePassword(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  newPassword: string
): Promise<ObjectDetails> {
  // 1. Validate
  validatePassword(newPassword, DEFAULT_PASSWORD_POLICY);
  
  // 2. Load write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), userID, orgID);
  
  if (wm.state === UserState.UNSPECIFIED) {
    throwNotFound('user not found', 'COMMAND-User70');
  }
  if (wm.state === UserState.DELETED) {
    throwNotFound('user deleted', 'COMMAND-User71');
  }
  if (wm.userType !== UserType.HUMAN) {
    throwPreconditionFailed('only human users have password', 'COMMAND-User72');
  }
  
  // 3. Check permissions
  await this.checkPermission(ctx, 'user', 'update', orgID);
  
  // 4. Create command
  const command: Command = {
    eventType: 'user.password.changed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      password: newPassword,
    },
  };
  
  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Deactivate user command
 */
export async function deactivateUser(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Load write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), userID, orgID);
  
  if (wm.state === UserState.UNSPECIFIED) {
    throwNotFound('user not found', 'COMMAND-User80');
  }
  if (wm.state === UserState.DELETED) {
    throwNotFound('user deleted', 'COMMAND-User81');
  }
  if (wm.state === UserState.INACTIVE) {
    throwPreconditionFailed('user already inactive', 'COMMAND-User82');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'user', 'update', orgID);
  
  // 3. Create command using event factory
  const command = newUserDeactivatedEvent(
    userID,
    orgID,
    ctx.instanceID,
    ctx.userID || 'system'
  );
  
  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Reactivate user command
 */
export async function reactivateUser(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Load write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), userID, orgID);
  
  if (wm.state === UserState.UNSPECIFIED) {
    throwNotFound('user not found', 'COMMAND-User90');
  }
  if (wm.state === UserState.DELETED) {
    throwNotFound('user deleted', 'COMMAND-User91');
  }
  if (wm.state === UserState.ACTIVE) {
    throwPreconditionFailed('user already active', 'COMMAND-User92');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'user', 'update', orgID);
  
  // 3. Create command using event factory
  const command = newUserReactivatedEvent(
    userID,
    orgID,
    ctx.instanceID,
    ctx.userID || 'system'
  );
  
  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Remove user command
 */
export async function removeUser(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Load write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), userID, orgID);
  
  if (wm.state === UserState.UNSPECIFIED) {
    throwNotFound('user not found', 'COMMAND-UserA0');
  }
  if (wm.state === UserState.DELETED) {
    throwPreconditionFailed('user already deleted', 'COMMAND-UserA1');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'user', 'delete', orgID);
  
  // 3. Create command using event factory
  const command = newUserRemovedEvent(
    userID,
    orgID,
    ctx.instanceID,
    ctx.userID || 'system'
  );
  
  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Lock user command
 */
export async function lockUser(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Load write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), userID, orgID);
  
  if (wm.state === UserState.UNSPECIFIED) {
    throwNotFound('user not found', 'COMMAND-UserB0');
  }
  if (wm.state === UserState.DELETED) {
    throwNotFound('user deleted', 'COMMAND-UserB1');
  }
  if (wm.state === UserState.LOCKED) {
    throwPreconditionFailed('user already locked', 'COMMAND-UserB2');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'user', 'update', orgID);
  
  // 3. Create command using event factory
  const command = newUserLockedEvent(
    userID,
    orgID,
    ctx.instanceID,
    ctx.userID || 'system'
  );
  
  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Unlock user command
 */
export async function unlockUser(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Load write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), userID, orgID);
  
  if (wm.state === UserState.UNSPECIFIED) {
    throwNotFound('user not found', 'COMMAND-UserC0');
  }
  if (wm.state === UserState.DELETED) {
    throwNotFound('user deleted', 'COMMAND-UserC1');
  }
  if (wm.state !== UserState.LOCKED) {
    throwPreconditionFailed('user not locked', 'COMMAND-UserC2');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'user', 'update', orgID);
  
  // 3. Create command using event factory
  const command = newUserUnlockedEvent(
    userID,
    orgID,
    ctx.instanceID,
    ctx.userID || 'system'
  );
  
  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Change phone command
 */
export async function changePhone(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  newPhone: string
): Promise<ObjectDetails> {
  // 1. Validate
  newPhone = newPhone.trim();
  if (!newPhone) {
    throwInvalidArgument('phone is required', 'COMMAND-User70');
  }
  
  // 2. Load write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), userID, orgID);
  
  if (wm.state === UserState.UNSPECIFIED) {
    throwNotFound('user not found', 'COMMAND-User71');
  }
  if (wm.state === UserState.DELETED) {
    throwNotFound('user deleted', 'COMMAND-User72');
  }
  if (wm.userType !== UserType.HUMAN) {
    throwPreconditionFailed('only human users have phone', 'COMMAND-User73');
  }
  
  // 3. Check if phone changed
  if (wm.phone === newPhone) {
    throwPreconditionFailed('phone not changed', 'COMMAND-User74');
  }
  
  // 4. Check permissions
  await this.checkPermission(ctx, 'user', 'update', orgID);
  
  // 5. Create command
  const command: Command = {
    eventType: 'user.phone.changed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      oldPhone: wm.phone,
      phone: newPhone,
    },
  };
  
  // 6. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Verify phone command
 */
export async function verifyPhone(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Load write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), userID, orgID);
  
  if (wm.state === UserState.UNSPECIFIED) {
    throwNotFound('user not found', 'COMMAND-User75');
  }
  if (wm.state === UserState.DELETED) {
    throwNotFound('user deleted', 'COMMAND-User76');
  }
  if (wm.userType !== UserType.HUMAN) {
    throwPreconditionFailed('only human users have phone', 'COMMAND-User77');
  }
  if (!wm.phone) {
    throwPreconditionFailed('user has no phone', 'COMMAND-User78');
  }
  if (wm.phoneVerified) {
    throwPreconditionFailed('phone already verified', 'COMMAND-User79');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'user', 'update', orgID);
  
  // 3. Create command using event factory
  const command = newPhoneVerifiedEvent(
    userID,
    orgID,
    ctx.instanceID,
    ctx.userID || 'system'
  );
  
  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}

/**
 * Remove phone command
 */
export async function removePhone(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Load write model
  const wm = new UserWriteModel();
  await wm.load(this.getEventstore(), userID, orgID);
  
  if (wm.state === UserState.UNSPECIFIED) {
    throwNotFound('user not found', 'COMMAND-User80');
  }
  if (wm.state === UserState.DELETED) {
    throwNotFound('user deleted', 'COMMAND-User81');
  }
  if (wm.userType !== UserType.HUMAN) {
    throwPreconditionFailed('only human users have phone', 'COMMAND-User82');
  }
  if (!wm.phone) {
    throwPreconditionFailed('user has no phone', 'COMMAND-User83');
  }
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'user', 'update', orgID);
  
  // 3. Create command using event factory
  const command = newPhoneRemovedEvent(
    userID,
    orgID,
    ctx.instanceID,
    ctx.userID || 'system'
  );
  
  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);
  
  return writeModelToObjectDetails(wm);
}
