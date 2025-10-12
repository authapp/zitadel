/**
 * User WebAuthn Commands
 * 
 * U2F Security Keys and Passwordless/Passkey authentication
 * Based on Go: internal/command/user_human_webauthn.go
 * 
 * ⚠️ SIMPLIFIED IMPLEMENTATION ⚠️
 * Full WebAuthn requires:
 * - @simplewebauthn/server for RP (Relying Party) logic
 * - Challenge generation with cryptographic randomness
 * - Public key verification
 * - Attestation validation
 * - Browser WebAuthn API integration
 * 
 * This implementation provides the command structure and state management.
 * Production requires integrating proper WebAuthn libraries.
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import {
  HumanWebAuthNWriteModel,
  HumanU2FTokensReadModel,
  HumanPasswordlessTokensReadModel,
} from './user-webauthn-write-model';
import { MFAState } from '../../domain/mfa';
import {
  WebAuthNToken,
  WebAuthNLogin,
  UserVerificationRequirement,
  AuthenticatorAttachment,
  getTokenToVerify,
  getTokenByKeyID,
} from '../../domain/webauthn';
import { randomUUID } from 'crypto';

/**
 * Generate a WebAuthn challenge (simplified)
 * Production: Use @simplewebauthn/server generateRegistrationOptions
 */
function generateChallenge(): string {
  return randomUUID();
}

/**
 * Convert write model to WebAuthN token
 */
function writeModelToWebAuthNToken(wm: HumanWebAuthNWriteModel): WebAuthNToken {
  return {
    webAuthNTokenID: wm.webAuthNTokenID,
    state: wm.state,
    challenge: wm.challenge,
    keyID: wm.keyID,
    publicKey: wm.publicKey,
    attestationType: wm.attestationType,
    aaguid: wm.aaguid,
    signCount: wm.signCount,
    webAuthNTokenName: wm.webAuthNTokenName,
    rpID: wm.rpID,
  };
}

// ============================================================================
// U2F Security Key Commands (5 commands)
// ============================================================================

/**
 * Begin U2F registration (setup)
 * Based on Go: HumanAddU2FSetup (user_human_webauthn.go:80-104)
 */
export async function humanAddU2FSetup(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  rpID?: string
): Promise<WebAuthNToken> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'user.credential', 'write', orgID);

  // Load existing U2F tokens
  const tokensModel = new HumanU2FTokensReadModel(userID, orgID);
  await tokensModel.load(this.getEventstore(), userID, orgID);

  if (tokensModel.userState === 'deleted') {
    throwNotFound('User not found', 'U2F-setup01');
  }

  // Generate new token ID and challenge
  const tokenID = randomUUID();
  const challenge = generateChallenge();
  const relyingPartyID = rpID || 'localhost'; // Production: use domain

  // Create event
  const command: Command = {
    eventType: 'user.human.u2f.added',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      webAuthNTokenID: tokenID,
      challenge,
      rpID: relyingPartyID,
    },
  };

  const event = await this.getEventstore().push(command);
  
  // Build write model for this specific token
  const wm = new HumanWebAuthNWriteModel(userID, tokenID, orgID);
  appendAndReduce(wm, event);

  const token = writeModelToWebAuthNToken(wm);
  
  // In production, return credentialCreationData for browser
  // token.credentialCreationData = await generateRegistrationOptions(...)
  
  return token;
}

/**
 * Verify U2F registration (complete setup)
 * Based on Go: HumanVerifyU2FSetup (user_human_webauthn.go:180-212)
 */
export async function humanVerifyU2FSetup(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  tokenName: string,
  credentialData: Uint8Array,
  userAgentID?: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(tokenName, 'tokenName');

  // Check permissions
  await this.checkPermission(ctx, 'user.credential', 'write', orgID);

  // Load U2F tokens
  const tokensModel = new HumanU2FTokensReadModel(userID, orgID);
  await tokensModel.load(this.getEventstore(), userID, orgID);

  // Find token to verify (NOT_READY state)
  const tokens = tokensModel.getWebAuthNTokens();
  const tokenToVerify = getTokenToVerify(tokens.map(writeModelToWebAuthNToken));
  
  if (!tokenToVerify) {
    throwPreconditionFailed('No U2F setup in progress', 'U2F-verify01');
  }

  // Production: Verify credential with @simplewebauthn/server
  // const verification = await verifyRegistrationResponse({ ... })
  // For now, simplified:
  const keyID = credentialData; // Should extract from credential
  const publicKey = credentialData; // Should extract public key
  
  // Create verified event
  const command: Command = {
    eventType: 'user.human.u2f.verified',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      webAuthNTokenID: tokenToVerify.webAuthNTokenID,
      webAuthNTokenName: tokenName,
      keyID: Array.from(keyID),
      publicKey: Array.from(publicKey),
      attestationType: 'none',
      aaguid: [],
      signCount: 0,
      userAgentID: userAgentID || 'unknown',
    },
  };

  const event = await this.getEventstore().push(command);
  
  const wm = new HumanWebAuthNWriteModel(userID, tokenToVerify.webAuthNTokenID!, orgID);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Begin U2F login (authentication)
 * Based on Go: HumanBeginU2FLogin (user_human_webauthn.go:292-315)
 */
export async function humanBeginU2FLogin(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  authRequestID?: string
): Promise<WebAuthNLogin> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Load U2F tokens
  const tokensModel = new HumanU2FTokensReadModel(userID, orgID);
  await tokensModel.load(this.getEventstore(), userID, orgID);

  const tokens = tokensModel.getWebAuthNTokens();
  const readyTokens = tokens.filter(t => t.state === MFAState.READY);

  if (readyTokens.length === 0) {
    throwPreconditionFailed('No U2F tokens registered', 'U2F-login01');
  }

  // Generate challenge
  const challenge = generateChallenge();
  const allowedCredentialIDs = readyTokens
    .map(t => t.keyID)
    .filter((id): id is Uint8Array => id !== undefined);

  // Create login begin event
  const command: Command = {
    eventType: 'user.human.u2f.login.begin',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      challenge,
      allowedCredentialIDs: allowedCredentialIDs.map(id => Array.from(id)),
      userVerification: UserVerificationRequirement.DISCOURAGED,
      authRequestID: authRequestID || randomUUID(),
    },
  };

  await this.getEventstore().push(command);

  return {
    challenge,
    allowedCredentialIDs,
    userVerification: UserVerificationRequirement.DISCOURAGED,
    rpID: 'localhost', // Production: use domain
  };
}

/**
 * Complete U2F login (verify authentication)
 * Based on Go: HumanFinishU2FLogin (user_human_webauthn.go:363-405)
 */
export async function humanFinishU2FLogin(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  credentialData: Uint8Array,
  authRequestID?: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Load U2F tokens
  const tokensModel = new HumanU2FTokensReadModel(userID, orgID);
  await tokensModel.load(this.getEventstore(), userID, orgID);

  const tokens = tokensModel.getWebAuthNTokens().map(writeModelToWebAuthNToken);
  
  // Production: Extract keyID from credentialData
  // const { credentialID } = await parseAuthenticatorData(credentialData)
  const keyID = credentialData; // Simplified
  
  const token = getTokenByKeyID(tokens, keyID);
  if (!token) {
    throwPreconditionFailed('Invalid credential', 'U2F-login02');
  }

  // Production: Verify signature with stored public key
  // const verification = await verifyAuthenticationResponse({ ... })
  
  // Create success event
  const command: Command = {
    eventType: 'user.human.u2f.login.succeeded',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      webAuthNTokenID: token.webAuthNTokenID,
      authRequestID: authRequestID || randomUUID(),
    },
  };

  const event = await this.getEventstore().push(command);
  
  const wm = new HumanWebAuthNWriteModel(userID, token.webAuthNTokenID!, orgID);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove U2F token
 * Based on Go: HumanRemoveU2F (user_human_webauthn.go:479-482)
 */
export async function humanRemoveU2F(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  webAuthNID: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(webAuthNID, 'webAuthNID');

  // Check permissions
  await this.checkPermission(ctx, 'user.credential', 'delete', orgID);

  // Load and verify token exists
  const tokensModel = new HumanU2FTokensReadModel(userID, orgID);
  await tokensModel.load(this.getEventstore(), userID, orgID);

  const token = tokensModel.webAuthNTokenByID(webAuthNID);
  if (!token || token.state === MFAState.REMOVED) {
    throwNotFound('U2F token not found', 'U2F-remove01');
  }

  // Create event
  const command: Command = {
    eventType: 'user.human.u2f.removed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      webAuthNTokenID: webAuthNID,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(token, event);

  return writeModelToObjectDetails(token);
}

// ============================================================================
// Passwordless/Passkey Commands (7 commands)
// ============================================================================

/**
 * Begin Passwordless registration (setup)
 * Based on Go: HumanAddPasswordlessSetup (user_human_webauthn.go:106-130)
 */
export async function humanAddPasswordlessSetup(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  authenticatorAttachment?: AuthenticatorAttachment,
  rpID?: string
): Promise<WebAuthNToken> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'user.credential', 'write', orgID);

  // Load existing passwordless tokens
  const tokensModel = new HumanPasswordlessTokensReadModel(userID, orgID);
  await tokensModel.load(this.getEventstore(), userID, orgID);

  if (tokensModel.userState === 'deleted') {
    throwNotFound('User not found', 'PWL-setup01');
  }

  // Generate new token ID and challenge
  const tokenID = randomUUID();
  const challenge = generateChallenge();
  const relyingPartyID = rpID || 'localhost';

  // Create event
  const command: Command = {
    eventType: 'user.human.passwordless.added',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      webAuthNTokenID: tokenID,
      challenge,
      rpID: relyingPartyID,
      authenticatorAttachment: authenticatorAttachment || AuthenticatorAttachment.UNSPECIFIED,
    },
  };

  const event = await this.getEventstore().push(command);
  
  const wm = new HumanWebAuthNWriteModel(userID, tokenID, orgID);
  appendAndReduce(wm, event);

  const token = writeModelToWebAuthNToken(wm);
  
  // Production: Generate registration options
  // token.credentialCreationData = generateRegistrationOptions({ userVerification: 'required' })
  
  return token;
}

/**
 * Begin Passwordless registration with init code
 * Based on Go: HumanAddPasswordlessSetupInitCode (user_human_webauthn.go:132-138)
 */
export async function humanAddPasswordlessSetupInitCode(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  _codeID: string,
  _verificationCode: string,
  authenticatorAttachment?: AuthenticatorAttachment
): Promise<WebAuthNToken> {
  // Verify init code first
  // In production: check code expiry, validity
  // For now, simplified
  
  return humanAddPasswordlessSetup.call(
    this,
    ctx,
    userID,
    orgID,
    authenticatorAttachment
  );
}

/**
 * Complete Passwordless registration with init code
 * Based on Go: HumanPasswordlessSetupInitCode (user_human_webauthn.go:214-223)
 */
export async function humanPasswordlessSetupInitCode(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  tokenName: string,
  _codeID: string,
  _verificationCode: string,
  credentialData: Uint8Array,
  userAgentID?: string
): Promise<ObjectDetails> {
  // Verify code then complete setup
  return humanHumanPasswordlessSetup.call(
    this,
    ctx,
    userID,
    orgID,
    tokenName,
    credentialData,
    userAgentID
  );
}

/**
 * Complete Passwordless registration (verify)
 * Based on Go: HumanHumanPasswordlessSetup (user_human_webauthn.go:225-227 + 229-267)
 */
export async function humanHumanPasswordlessSetup(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  tokenName: string,
  credentialData: Uint8Array,
  userAgentID?: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(tokenName, 'tokenName');

  // Check permissions
  await this.checkPermission(ctx, 'user.credential', 'write', orgID);

  // Load passwordless tokens
  const tokensModel = new HumanPasswordlessTokensReadModel(userID, orgID);
  await tokensModel.load(this.getEventstore(), userID, orgID);

  // Find token to verify
  const tokens = tokensModel.getWebAuthNTokens();
  const tokenToVerify = getTokenToVerify(tokens.map(writeModelToWebAuthNToken));
  
  if (!tokenToVerify) {
    throwPreconditionFailed('No passwordless setup in progress', 'PWL-verify01');
  }

  // Production: Verify credential
  const keyID = credentialData;
  const publicKey = credentialData;
  
  // Create verified event
  const command: Command = {
    eventType: 'user.human.passwordless.verified',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      webAuthNTokenID: tokenToVerify.webAuthNTokenID,
      webAuthNTokenName: tokenName,
      keyID: Array.from(keyID),
      publicKey: Array.from(publicKey),
      attestationType: 'none',
      aaguid: [],
      signCount: 0,
      userAgentID: userAgentID || 'unknown',
    },
  };

  const event = await this.getEventstore().push(command);
  
  const wm = new HumanWebAuthNWriteModel(userID, tokenToVerify.webAuthNTokenID!, orgID);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Begin Passwordless login
 * Based on Go: HumanBeginPasswordlessLogin (user_human_webauthn.go:317-338)
 */
export async function humanBeginPasswordlessLogin(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  authRequestID?: string
): Promise<WebAuthNLogin> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Load passwordless tokens
  const tokensModel = new HumanPasswordlessTokensReadModel(userID, orgID);
  await tokensModel.load(this.getEventstore(), userID, orgID);

  const tokens = tokensModel.getWebAuthNTokens();
  const readyTokens = tokens.filter(t => t.state === MFAState.READY);

  if (readyTokens.length === 0) {
    throwPreconditionFailed('No passwordless tokens registered', 'PWL-login01');
  }

  // Generate challenge
  const challenge = generateChallenge();
  const allowedCredentialIDs = readyTokens
    .map(t => t.keyID)
    .filter((id): id is Uint8Array => id !== undefined);

  // Create login begin event
  const command: Command = {
    eventType: 'user.human.passwordless.login.begin',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      challenge,
      allowedCredentialIDs: allowedCredentialIDs.map(id => Array.from(id)),
      userVerification: UserVerificationRequirement.REQUIRED,
      authRequestID: authRequestID || randomUUID(),
    },
  };

  await this.getEventstore().push(command);

  return {
    challenge,
    allowedCredentialIDs,
    userVerification: UserVerificationRequirement.REQUIRED,
    rpID: 'localhost',
  };
}

/**
 * Complete Passwordless login
 * Based on Go: HumanFinishPasswordlessLogin (user_human_webauthn.go:407-449)
 */
export async function humanFinishPasswordlessLogin(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  credentialData: Uint8Array,
  authRequestID?: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Load passwordless tokens
  const tokensModel = new HumanPasswordlessTokensReadModel(userID, orgID);
  await tokensModel.load(this.getEventstore(), userID, orgID);

  const tokens = tokensModel.getWebAuthNTokens().map(writeModelToWebAuthNToken);
  
  // Production: Extract keyID from credentialData
  const keyID = credentialData;
  
  const token = getTokenByKeyID(tokens, keyID);
  if (!token) {
    throwPreconditionFailed('Invalid credential', 'PWL-login02');
  }

  // Production: Verify signature
  
  // Create success event
  const command: Command = {
    eventType: 'user.human.passwordless.login.succeeded',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      webAuthNTokenID: token.webAuthNTokenID,
      authRequestID: authRequestID || randomUUID(),
    },
  };

  const event = await this.getEventstore().push(command);
  
  const wm = new HumanWebAuthNWriteModel(userID, token.webAuthNTokenID!, orgID);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove Passwordless token
 * Based on Go: HumanRemovePasswordless (user_human_webauthn.go:484-487)
 */
export async function humanRemovePasswordless(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  webAuthNID: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(webAuthNID, 'webAuthNID');

  // Check permissions
  await this.checkPermission(ctx, 'user.credential', 'delete', orgID);

  // Load and verify token exists
  const tokensModel = new HumanPasswordlessTokensReadModel(userID, orgID);
  await tokensModel.load(this.getEventstore(), userID, orgID);

  const token = tokensModel.webAuthNTokenByID(webAuthNID);
  if (!token || token.state === MFAState.REMOVED) {
    throwNotFound('Passwordless token not found', 'PWL-remove01');
  }

  // Create event
  const command: Command = {
    eventType: 'user.human.passwordless.removed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      webAuthNTokenID: webAuthNID,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(token, event);

  return writeModelToObjectDetails(token);
}
