/**
 * User WebAuthn Write Models
 * 
 * State tracking for U2F and Passwordless/Passkey credentials
 * Based on Go: internal/command/user_human_webauthn_model.go
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';
import { MFAState } from '../../domain/mfa';
import { UserVerificationRequirement } from '../../domain/webauthn';

/**
 * WebAuthN Token Write Model
 * Tracks a single WebAuthn credential (U2F or Passwordless)
 */
export class HumanWebAuthNWriteModel extends WriteModel {
  webAuthNTokenID: string;
  challenge: string = '';
  keyID?: Uint8Array;
  publicKey?: Uint8Array;
  attestationType?: string;
  aaguid?: Uint8Array;
  signCount: number = 0;
  webAuthNTokenName: string = '';
  rpID: string = '';
  state: MFAState = MFAState.UNSPECIFIED;

  constructor(userID: string, webAuthNTokenID: string, orgID: string) {
    super('user');
    this.aggregateID = userID;
    this.webAuthNTokenID = webAuthNTokenID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'user.human.webauthn.added':
      case 'user.human.u2f.added':
      case 'user.human.passwordless.added':
        if (event.payload?.webAuthNTokenID === this.webAuthNTokenID) {
          this.webAuthNTokenID = event.payload.webAuthNTokenID;
          this.challenge = event.payload.challenge || '';
          this.rpID = event.payload.rpID || '';
          this.state = MFAState.NOT_READY;
        }
        break;

      case 'user.human.webauthn.verified':
      case 'user.human.u2f.verified':
      case 'user.human.passwordless.verified':
        if (event.payload?.webAuthNTokenID === this.webAuthNTokenID) {
          this.keyID = event.payload.keyID;
          this.publicKey = event.payload.publicKey;
          this.attestationType = event.payload.attestationType;
          this.aaguid = event.payload.aaguid;
          this.signCount = event.payload.signCount || 0;
          this.webAuthNTokenName = event.payload.webAuthNTokenName || '';
          this.state = MFAState.READY;
        }
        break;

      case 'user.human.webauthn.signcount.changed':
      case 'user.human.u2f.signcount.changed':
      case 'user.human.passwordless.signcount.changed':
        if (event.payload?.webAuthNTokenID === this.webAuthNTokenID) {
          this.signCount = event.payload.signCount || 0;
        }
        break;

      case 'user.human.webauthn.removed':
      case 'user.human.u2f.removed':
      case 'user.human.passwordless.removed':
        if (event.payload?.webAuthNTokenID === this.webAuthNTokenID) {
          this.state = MFAState.REMOVED;
        }
        break;

      case 'user.removed':
      case 'user.deleted':
        this.state = MFAState.REMOVED;
        break;
    }
  }
}

/**
 * U2F Tokens Read Model (all U2F tokens for a user)
 */
export class HumanU2FTokensReadModel extends WriteModel {
  webAuthNTokens: HumanWebAuthNWriteModel[] = [];
  userState: string = 'active';

  constructor(userID: string, orgID: string) {
    super('user');
    this.aggregateID = userID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'user.human.u2f.added':
        const addedToken = new HumanWebAuthNWriteModel(
          this.aggregateID,
          event.payload?.webAuthNTokenID || '',
          this.resourceOwner
        );
        addedToken.reduce(event);

        // Replace any NOT_READY token or append new
        const notReadyIndex = this.webAuthNTokens.findIndex(
          t => t.state === MFAState.NOT_READY
        );
        if (notReadyIndex >= 0) {
          this.webAuthNTokens[notReadyIndex] = addedToken;
        } else {
          this.webAuthNTokens.push(addedToken);
        }
        break;

      case 'user.human.u2f.verified':
      case 'user.human.u2f.signcount.changed':
      case 'user.human.u2f.removed':
        const tokenID = event.payload?.webAuthNTokenID;
        const token = this.webAuthNTokens.find(t => t.webAuthNTokenID === tokenID);
        if (token) {
          token.reduce(event);
        }
        break;

      case 'user.removed':
      case 'user.deleted':
        this.userState = 'deleted';
        this.webAuthNTokens = [];
        break;
    }
  }

  getWebAuthNTokens(): HumanWebAuthNWriteModel[] {
    return this.webAuthNTokens;
  }

  webAuthNTokenByID(id: string): HumanWebAuthNWriteModel | null {
    return this.webAuthNTokens.find(t => t.webAuthNTokenID === id) || null;
  }
}

/**
 * Passwordless Tokens Read Model (all Passwordless tokens for a user)
 */
export class HumanPasswordlessTokensReadModel extends WriteModel {
  webAuthNTokens: HumanWebAuthNWriteModel[] = [];
  userState: string = 'active';

  constructor(userID: string, orgID: string) {
    super('user');
    this.aggregateID = userID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'user.human.passwordless.added':
        const addedToken = new HumanWebAuthNWriteModel(
          this.aggregateID,
          event.payload?.webAuthNTokenID || '',
          this.resourceOwner
        );
        addedToken.reduce(event);

        // Replace any NOT_READY token or append new
        const notReadyIndex = this.webAuthNTokens.findIndex(
          t => t.state === MFAState.NOT_READY
        );
        if (notReadyIndex >= 0) {
          this.webAuthNTokens[notReadyIndex] = addedToken;
        } else {
          this.webAuthNTokens.push(addedToken);
        }
        break;

      case 'user.human.passwordless.verified':
      case 'user.human.passwordless.signcount.changed':
      case 'user.human.passwordless.removed':
        const tokenID = event.payload?.webAuthNTokenID;
        const token = this.webAuthNTokens.find(t => t.webAuthNTokenID === tokenID);
        if (token) {
          token.reduce(event);
        }
        break;

      case 'user.removed':
      case 'user.deleted':
        this.userState = 'deleted';
        this.webAuthNTokens = [];
        break;
    }
  }

  getWebAuthNTokens(): HumanWebAuthNWriteModel[] {
    return this.webAuthNTokens;
  }

  webAuthNTokenByID(id: string): HumanWebAuthNWriteModel | null {
    return this.webAuthNTokens.find(t => t.webAuthNTokenID === id) || null;
  }
}

/**
 * U2F Login Read Model (tracks login challenge)
 */
export class HumanU2FLoginReadModel extends WriteModel {
  challenge: string = '';
  allowedCredentialIDs: Uint8Array[] = [];
  userVerification: UserVerificationRequirement = UserVerificationRequirement.DISCOURAGED;
  state: string = 'active';

  constructor(userID: string, _authReqID: string, orgID: string) {
    super('user');
    this.aggregateID = userID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'user.human.u2f.login.begin':
        this.challenge = event.payload?.challenge || '';
        this.allowedCredentialIDs = event.payload?.allowedCredentialIDs || [];
        this.userVerification = event.payload?.userVerification || UserVerificationRequirement.DISCOURAGED;
        break;

      case 'user.removed':
      case 'user.deleted':
        this.state = 'deleted';
        break;
    }
  }
}

/**
 * Passwordless Login Read Model (tracks login challenge)
 */
export class HumanPasswordlessLoginReadModel extends WriteModel {
  challenge: string = '';
  allowedCredentialIDs: Uint8Array[] = [];
  userVerification: UserVerificationRequirement = UserVerificationRequirement.REQUIRED;
  state: string = 'active';

  constructor(userID: string, _authReqID: string, orgID: string) {
    super('user');
    this.aggregateID = userID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'user.human.passwordless.login.begin':
        this.challenge = event.payload?.challenge || '';
        this.allowedCredentialIDs = event.payload?.allowedCredentialIDs || [];
        this.userVerification = event.payload?.userVerification || UserVerificationRequirement.REQUIRED;
        break;

      case 'user.removed':
      case 'user.deleted':
        this.state = 'deleted';
        break;
    }
  }
}

/**
 * Passwordless Init Code Write Model
 */
export class HumanPasswordlessInitCodeWriteModel extends WriteModel {
  codeID: string = '';
  code: string = '';
  expiration: number = 0;
  state: string = 'unspecified';

  constructor(userID: string, orgID: string) {
    super('user');
    this.aggregateID = userID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'user.human.passwordless.initcode.requested':
        this.codeID = event.payload?.codeID || '';
        this.code = event.payload?.code || '';
        this.expiration = event.payload?.expiration || 0;
        this.state = 'requested';
        break;

      case 'user.human.passwordless.initcode.verified':
        this.state = 'active';
        break;

      case 'user.removed':
      case 'user.deleted':
        this.state = 'removed';
        break;
    }
  }
}
