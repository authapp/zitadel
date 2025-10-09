/**
 * Business Rules and Advanced Validation (Phase 3)
 * 
 * Implements complex business logic validation patterns
 * following Zitadel Go's domain validation approach
 */

import { Context } from './context';
import { Commands } from './commands';
import { UserWriteModel, UserState, UserType } from './user/user-write-model';
import { OrgWriteModel, OrgState } from './org/org-write-model';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed, throwAlreadyExists } from '@/zerrors/errors';

/**
 * Domain Policy Types
 */
export interface DomainPolicy {
  userLoginMustBeDomain: boolean;
  validateOrgDomains: boolean;
  smtpSenderAddressMatchesInstanceDomain: boolean;
}

export interface PasswordPolicy {
  minLength: number;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  maxAge?: number;
}

export interface LoginPolicy {
  allowUsernamePassword: boolean;
  allowRegister: boolean;
  allowExternalIDP: boolean;
  forceMFA: boolean;
  hidePasswordReset: boolean;
  ignoreUnknownUsernames: boolean;
  allowDomainDiscovery: boolean;
  disableLoginWithEmail: boolean;
  disableLoginWithPhone: boolean;
}

/**
 * Business Rule Validators
 */
export class BusinessRules {
  constructor(private commands: Commands) {}

  /**
   * Validate user can be created
   */
  async validateUserCreation(
    _ctx: Context,
    orgID: string,
    username: string,
    email?: string
  ): Promise<void> {
    // Check if username already exists
    await this.checkUsernameUnique(_ctx, orgID, username);
    
    // Check if email already exists (if provided)
    if (email) {
      await this.checkEmailUnique(_ctx, orgID, email);
    }
    
    // Validate domain policy
    await this.validateUsernameDomainPolicy(_ctx, orgID, username);
    
    // Check org exists and is active
    await this.validateOrgActive(_ctx, orgID);
  }

  /**
   * Validate organization can be created
   */
  async validateOrgCreation(
    _ctx: Context,
    orgID: string,
    name: string
  ): Promise<void> {
    // Check if org already exists
    const wm = new OrgWriteModel();
    await wm.load(this.commands.getEventstore(), orgID, orgID);
    
    if (wm.state !== OrgState.UNSPECIFIED) {
      throwAlreadyExists('organization already exists', 'BUSINESS-Org01');
    }
    
    // Validate name is not empty
    if (!name || name.trim().length === 0) {
      throwInvalidArgument('organization name cannot be empty', 'BUSINESS-Org02');
    }
  }

  /**
   * Check if username is unique
   */
  private async checkUsernameUnique(
    ctx: Context,
    orgID: string,
    username: string
  ): Promise<void> {
    const events = await this.commands.getEventstore().query({
      aggregateTypes: ['user'],
      instanceID: ctx.instanceID,
      owner: orgID,
      eventTypes: ['user.human.added', 'user.machine.added', 'user.username.changed'],
    });

    // Build current username map
    const usernames = new Map<string, string>(); // userID -> current username
    
    for (const event of events) {
      if (event.eventType === 'user.human.added' || event.eventType === 'user.machine.added') {
        usernames.set(event.aggregateID, event.payload?.username);
      } else if (event.eventType === 'user.username.changed') {
        usernames.set(event.aggregateID, event.payload?.username);
      }
    }

    // Check if username is taken
    for (const [, currentUsername] of usernames) {
      if (currentUsername === username) {
        throwAlreadyExists('username already taken', 'BUSINESS-User01');
      }
    }
  }

  /**
   * Check if email is unique
   */
  private async checkEmailUnique(
    ctx: Context,
    orgID: string,
    email: string
  ): Promise<void> {
    const events = await this.commands.getEventstore().query({
      aggregateTypes: ['user'],
      instanceID: ctx.instanceID,
      owner: orgID,
      eventTypes: ['user.human.added', 'user.email.changed'],
    });

    // Build current email map
    const emails = new Map<string, string>(); // userID -> current email
    
    for (const event of events) {
      if (event.eventType === 'user.human.added') {
        emails.set(event.aggregateID, event.payload?.email);
      } else if (event.eventType === 'user.email.changed') {
        emails.set(event.aggregateID, event.payload?.email);
      }
    }

    // Check if email is taken
    for (const [, currentEmail] of emails) {
      if (currentEmail === email) {
        throwAlreadyExists('email already taken', 'BUSINESS-User02');
      }
    }
  }

  /**
   * Validate username against domain policy
   */
  private async validateUsernameDomainPolicy(
    ctx: Context,
    orgID: string,
    username: string
  ): Promise<void> {
    const domainPolicy = await this.getDomainPolicy(ctx, orgID);
    
    if (domainPolicy.userLoginMustBeDomain) {
      const emailParts = username.split('@');
      if (emailParts.length !== 2) {
        throwPreconditionFailed('username must be email format when domain policy is enabled', 'BUSINESS-User03');
      }
      
      const domain = emailParts[1];
      const isVerified = await this.isDomainVerified(ctx, orgID, domain);
      
      if (!isVerified) {
        throwPreconditionFailed('domain not verified for organization', 'BUSINESS-User04');
      }
    }
  }

  /**
   * Validate organization is active
   */
  private async validateOrgActive(_ctx: Context, orgID: string): Promise<void> {
    const wm = new OrgWriteModel();
    await wm.load(this.commands.getEventstore(), orgID, orgID);
    
    if (wm.state === OrgState.UNSPECIFIED) {
      throwNotFound('organization not found', 'BUSINESS-Org03');
    }
    
    if (wm.state === OrgState.INACTIVE) {
      throwPreconditionFailed('organization is inactive', 'BUSINESS-Org04');
    }
  }

  /**
   * Get domain policy for organization
   */
  private async getDomainPolicy(_ctx: Context, _orgID: string): Promise<DomainPolicy> {
    // For now, return default policy
    // TODO: Implement actual policy loading from events
    return {
      userLoginMustBeDomain: false,
      validateOrgDomains: true,
      smtpSenderAddressMatchesInstanceDomain: false,
    };
  }

  /**
   * Check if domain is verified for organization
   */
  private async isDomainVerified(_ctx: Context, orgID: string, domain: string): Promise<boolean> {
    const events = await this.commands.getEventstore().query({
      aggregateTypes: ['org'],
      aggregateIDs: [orgID],
      eventTypes: ['org.domain.added', 'org.domain.verified', 'org.domain.removed'],
    });

    let domainExists = false;
    let domainVerified = false;

    for (const event of events) {
      if (event.payload?.domain === domain) {
        if (event.eventType === 'org.domain.added') {
          domainExists = true;
          domainVerified = false;
        } else if (event.eventType === 'org.domain.verified') {
          domainVerified = true;
        } else if (event.eventType === 'org.domain.removed') {
          domainExists = false;
          domainVerified = false;
        }
      }
    }

    return domainExists && domainVerified;
  }

  /**
   * Get password policy for organization
   */
  async getPasswordPolicy(_ctx: Context, _orgID: string): Promise<PasswordPolicy> {
    // For now, return default policy
    // TODO: Implement actual policy loading from events
    return {
      minLength: 8,
      hasUppercase: true,
      hasLowercase: true,
      hasNumber: true,
      hasSymbol: false,
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days in ms
    };
  }

  /**
   * Get login policy for organization
   */
  async getLoginPolicy(_ctx: Context, _orgID: string): Promise<LoginPolicy> {
    // For now, return default policy
    // TODO: Implement actual policy loading from events
    return {
      allowUsernamePassword: true,
      allowRegister: true,
      allowExternalIDP: false,
      forceMFA: false,
      hidePasswordReset: false,
      ignoreUnknownUsernames: false,
      allowDomainDiscovery: true,
      disableLoginWithEmail: false,
      disableLoginWithPhone: true,
    };
  }

  /**
   * Validate user state for operations
   */
  validateUserState(user: UserWriteModel, operation: string): void {
    if (user.state === UserState.UNSPECIFIED) {
      throwNotFound('user not found', 'BUSINESS-User05');
    }
    
    if (user.state === UserState.DELETED) {
      throwNotFound('user deleted', 'BUSINESS-User06');
    }
    
    if (operation === 'activate' && user.state === UserState.ACTIVE) {
      throwPreconditionFailed('user already active', 'BUSINESS-User07');
    }
    
    if (operation === 'deactivate' && user.state === UserState.INACTIVE) {
      throwPreconditionFailed('user already inactive', 'BUSINESS-User08');
    }
    
    if (operation === 'lock' && user.state === UserState.LOCKED) {
      throwPreconditionFailed('user already locked', 'BUSINESS-User09');
    }
  }

  /**
   * Validate user type for operations
   */
  validateUserType(user: UserWriteModel, requiredType: UserType, operation: string): void {
    if (user.userType !== requiredType) {
      const typeStr = requiredType === UserType.HUMAN ? 'human' : 'machine';
      throwPreconditionFailed(`operation ${operation} only allowed for ${typeStr} users`, 'BUSINESS-User10');
    }
  }

  /**
   * Validate organization state for operations
   */
  validateOrgState(org: OrgWriteModel, operation: string): void {
    if (org.state === OrgState.UNSPECIFIED) {
      throwNotFound('organization not found', 'BUSINESS-Org05');
    }
    
    if (operation === 'activate' && org.state === OrgState.ACTIVE) {
      throwPreconditionFailed('organization already active', 'BUSINESS-Org06');
    }
    
    if (operation === 'deactivate' && org.state === OrgState.INACTIVE) {
      throwPreconditionFailed('organization already inactive', 'BUSINESS-Org07');
    }
  }
}

/**
 * Create business rules instance
 */
export function createBusinessRules(commands: Commands): BusinessRules {
  return new BusinessRules(commands);
}
