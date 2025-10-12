/**
 * Commands Class (Zitadel v2)
 * 
 * Main orchestrator for all write operations.
 * Follows Zitadel's command pattern with write models.
 */

import { Eventstore } from '../eventstore/types';
import { Cache } from '../cache/types';
import { Storage } from '../static/types';
import { SnowflakeGenerator } from '../id';
import { PermissionChecker, SimplePermissionChecker, checkPermission as checkPerm } from './permissions';
import { Context } from './context';

// Type alias for convenience
export type IDGenerator = SnowflakeGenerator;

/**
 * Commands configuration
 */
export interface CommandsConfig {
  externalDomain: string;
  externalSecure: boolean;
  externalPort: number;
  zitadelRoles?: string[];
}

/**
 * Main Commands class
 * 
 * This is the write-side (CQRS) orchestrator.
 * All business logic and state mutations go through here.
 */
export class Commands {
  private permissionChecker: PermissionChecker;
  
  constructor(
    private eventstore: Eventstore,
    private cache: Cache,
    private staticStorage: Storage,
    private idGenerator: IDGenerator,
    private config: CommandsConfig,
    permissionChecker?: PermissionChecker
  ) {
    this.permissionChecker = permissionChecker || new SimplePermissionChecker();
  }
  
  /**
   * Get eventstore (for write models)
   */
  getEventstore(): Eventstore {
    return this.eventstore;
  }
  
  /**
   * Get cache
   */
  getCache(): Cache {
    return this.cache;
  }
  
  /**
   * Get static storage
   */
  getStatic(): Storage {
    return this.staticStorage;
  }
  
  /**
   * Get ID generator
   */
  getIDGenerator(): IDGenerator {
    return this.idGenerator;
  }
  
  /**
   * Get config
   */
  getConfig(): CommandsConfig {
    return this.config;
  }
  
  /**
   * Generate next ID
   */
  async nextID(): Promise<string> {
    return this.idGenerator.generate();
  }
  
  /**
   * Alias for nextID (used by action commands)
   */
  async generateID(): Promise<string> {
    return this.idGenerator.generate();
  }
  
  /**
   * Check permission
   */
  async checkPermission(ctx: Context, resource: string, action: string, scope?: string): Promise<void> {
    await checkPerm(this.permissionChecker, ctx, resource, action, scope);
  }
  
  /**
   * Health check
   */
  async health(): Promise<boolean> {
    try {
      return await this.eventstore.health();
    } catch {
      return false;
    }
  }
  
  // ============================================================================
  // User Commands (Week 2)
  // ============================================================================
  
  /**
   * Add human user
   */
  addHumanUser: typeof import('./user/user-commands').addHumanUser = 
    require('./user/user-commands').addHumanUser;
  
  /**
   * Add machine user
   */
  addMachineUser: typeof import('./user/user-commands').addMachineUser = 
    require('./user/user-commands').addMachineUser;
  
  /**
   * Change username
   */
  changeUsername: typeof import('./user/user-commands').changeUsername = 
    require('./user/user-commands').changeUsername;
  
  /**
   * Change user profile
   */
  changeProfile: typeof import('./user/user-commands').changeProfile = 
    require('./user/user-commands').changeProfile;
  
  /**
   * Change email
   */
  changeEmail: typeof import('./user/user-commands').changeEmail = 
    require('./user/user-commands').changeEmail;
  
  /**
   * Verify email
   */
  verifyEmail: typeof import('./user/user-commands').verifyEmail = 
    require('./user/user-commands').verifyEmail;
  
  /**
   * Change password
   */
  changePassword: typeof import('./user/user-commands').changePassword = 
    require('./user/user-commands').changePassword;
  
  /**
   * Deactivate user
   */
  deactivateUser: typeof import('./user/user-commands').deactivateUser = 
    require('./user/user-commands').deactivateUser;
  
  /**
   * Reactivate user
   */
  reactivateUser: typeof import('./user/user-commands').reactivateUser = 
    require('./user/user-commands').reactivateUser;
  
  /**
   * Remove user
   */
  removeUser: typeof import('./user/user-commands').removeUser = 
    require('./user/user-commands').removeUser;
  
  // --------------------------------------------------------------------------
  // User OTP/MFA Commands (Phase 1)
  // --------------------------------------------------------------------------
  
  /**
   * Import existing TOTP secret
   */
  importHumanTOTP: typeof import('./user/user-otp-commands').importHumanTOTP = 
    require('./user/user-otp-commands').importHumanTOTP;
  
  /**
   * Add TOTP authenticator (generates secret)
   */
  addHumanTOTP: typeof import('./user/user-otp-commands').addHumanTOTP = 
    require('./user/user-otp-commands').addHumanTOTP;
  
  /**
   * Verify TOTP setup code
   */
  humanCheckMFATOTPSetup: typeof import('./user/user-otp-commands').humanCheckMFATOTPSetup = 
    require('./user/user-otp-commands').humanCheckMFATOTPSetup;
  
  /**
   * Remove TOTP authenticator
   */
  humanRemoveTOTP: typeof import('./user/user-otp-commands').humanRemoveTOTP = 
    require('./user/user-otp-commands').humanRemoveTOTP;
  
  /**
   * Add SMS OTP (enable SMS 2FA)
   */
  addHumanOTPSMS: typeof import('./user/user-otp-commands').addHumanOTPSMS = 
    require('./user/user-otp-commands').addHumanOTPSMS;
  
  /**
   * Remove SMS OTP (disable SMS 2FA)
   */
  removeHumanOTPSMS: typeof import('./user/user-otp-commands').removeHumanOTPSMS = 
    require('./user/user-otp-commands').removeHumanOTPSMS;
  
  /**
   * Send SMS OTP code
   */
  humanSendOTPSMS: typeof import('./user/user-otp-commands').humanSendOTPSMS = 
    require('./user/user-otp-commands').humanSendOTPSMS;
  
  /**
   * Verify SMS OTP code
   */
  humanCheckOTPSMS: typeof import('./user/user-otp-commands').humanCheckOTPSMS = 
    require('./user/user-otp-commands').humanCheckOTPSMS;
  
  /**
   * Add Email OTP (enable Email 2FA)
   */
  addHumanOTPEmail: typeof import('./user/user-otp-commands').addHumanOTPEmail = 
    require('./user/user-otp-commands').addHumanOTPEmail;
  
  /**
   * Remove Email OTP (disable Email 2FA)
   */
  removeHumanOTPEmail: typeof import('./user/user-otp-commands').removeHumanOTPEmail = 
    require('./user/user-otp-commands').removeHumanOTPEmail;
  
  /**
   * Verify Email OTP code
   */
  humanCheckOTPEmail: typeof import('./user/user-otp-commands').humanCheckOTPEmail = 
    require('./user/user-otp-commands').humanCheckOTPEmail;
  
  // --------------------------------------------------------------------------
  // User WebAuthn/Passkey Commands (Phase 1B)
  // --------------------------------------------------------------------------
  
  /**
   * Begin U2F registration
   */
  humanAddU2FSetup: typeof import('./user/user-webauthn-commands').humanAddU2FSetup = 
    require('./user/user-webauthn-commands').humanAddU2FSetup;
  
  /**
   * Complete U2F registration
   */
  humanVerifyU2FSetup: typeof import('./user/user-webauthn-commands').humanVerifyU2FSetup = 
    require('./user/user-webauthn-commands').humanVerifyU2FSetup;
  
  /**
   * Begin U2F login
   */
  humanBeginU2FLogin: typeof import('./user/user-webauthn-commands').humanBeginU2FLogin = 
    require('./user/user-webauthn-commands').humanBeginU2FLogin;
  
  /**
   * Complete U2F login
   */
  humanFinishU2FLogin: typeof import('./user/user-webauthn-commands').humanFinishU2FLogin = 
    require('./user/user-webauthn-commands').humanFinishU2FLogin;
  
  /**
   * Remove U2F token
   */
  humanRemoveU2F: typeof import('./user/user-webauthn-commands').humanRemoveU2F = 
    require('./user/user-webauthn-commands').humanRemoveU2F;
  
  /**
   * Begin Passwordless registration
   */
  humanAddPasswordlessSetup: typeof import('./user/user-webauthn-commands').humanAddPasswordlessSetup = 
    require('./user/user-webauthn-commands').humanAddPasswordlessSetup;
  
  /**
   * Begin Passwordless registration with init code
   */
  humanAddPasswordlessSetupInitCode: typeof import('./user/user-webauthn-commands').humanAddPasswordlessSetupInitCode = 
    require('./user/user-webauthn-commands').humanAddPasswordlessSetupInitCode;
  
  /**
   * Complete Passwordless registration with init code
   */
  humanPasswordlessSetupInitCode: typeof import('./user/user-webauthn-commands').humanPasswordlessSetupInitCode = 
    require('./user/user-webauthn-commands').humanPasswordlessSetupInitCode;
  
  /**
   * Complete Passwordless registration
   */
  humanHumanPasswordlessSetup: typeof import('./user/user-webauthn-commands').humanHumanPasswordlessSetup = 
    require('./user/user-webauthn-commands').humanHumanPasswordlessSetup;
  
  /**
   * Begin Passwordless login
   */
  humanBeginPasswordlessLogin: typeof import('./user/user-webauthn-commands').humanBeginPasswordlessLogin = 
    require('./user/user-webauthn-commands').humanBeginPasswordlessLogin;
  
  /**
   * Complete Passwordless login
   */
  humanFinishPasswordlessLogin: typeof import('./user/user-webauthn-commands').humanFinishPasswordlessLogin = 
    require('./user/user-webauthn-commands').humanFinishPasswordlessLogin;
  
  /**
   * Remove Passwordless token
   */
  humanRemovePasswordless: typeof import('./user/user-webauthn-commands').humanRemovePasswordless = 
    require('./user/user-webauthn-commands').humanRemovePasswordless;
  
  // --------------------------------------------------------------------------
  // User Initialization Commands (Phase 2)
  // --------------------------------------------------------------------------
  
  /**
   * Resend initial registration mail
   */
  resendInitialMail: typeof import('./user/user-init-commands').resendInitialMail = 
    require('./user/user-init-commands').resendInitialMail;
  
  /**
   * Verify initialization code
   */
  humanVerifyInitCode: typeof import('./user/user-init-commands').humanVerifyInitCode = 
    require('./user/user-init-commands').humanVerifyInitCode;
  
  /**
   * Mark init code as sent
   */
  humanInitCodeSent: typeof import('./user/user-init-commands').humanInitCodeSent = 
    require('./user/user-init-commands').humanInitCodeSent;
  
  // --------------------------------------------------------------------------
  // User IDP Link Commands (Phase 2B)
  // --------------------------------------------------------------------------
  
  /**
   * Add User IDP Link (social login)
   */
  addUserIDPLink: typeof import('./user/user-idp-link-commands').addUserIDPLink = 
    require('./user/user-idp-link-commands').addUserIDPLink;
  
  /**
   * Bulk Add User IDP Links
   */
  bulkAddedUserIDPLinks: typeof import('./user/user-idp-link-commands').bulkAddedUserIDPLinks = 
    require('./user/user-idp-link-commands').bulkAddedUserIDPLinks;
  
  /**
   * Remove User IDP Link
   */
  removeUserIDPLink: typeof import('./user/user-idp-link-commands').removeUserIDPLink = 
    require('./user/user-idp-link-commands').removeUserIDPLink;
  
  /**
   * Mark IDP login successful
   */
  userIDPLoginChecked: typeof import('./user/user-idp-link-commands').userIDPLoginChecked = 
    require('./user/user-idp-link-commands').userIDPLoginChecked;
  
  /**
   * Migrate User IDP external ID
   */
  migrateUserIDP: typeof import('./user/user-idp-link-commands').migrateUserIDP = 
    require('./user/user-idp-link-commands').migrateUserIDP;
  
  /**
   * Update IDP link username
   */
  updateUserIDPLinkUsername: typeof import('./user/user-idp-link-commands').updateUserIDPLinkUsername = 
    require('./user/user-idp-link-commands').updateUserIDPLinkUsername;
  
  // --------------------------------------------------------------------------
  // User Refresh Token Commands (Phase 4)
  // --------------------------------------------------------------------------
  
  /**
   * Revoke a single refresh token
   */
  revokeRefreshToken: typeof import('./user/user-refresh-token-commands').revokeRefreshToken = 
    require('./user/user-refresh-token-commands').revokeRefreshToken;
  
  /**
   * Revoke multiple refresh tokens
   */
  revokeRefreshTokens: typeof import('./user/user-refresh-token-commands').revokeRefreshTokens = 
    require('./user/user-refresh-token-commands').revokeRefreshTokens;
  
  /**
   * Revoke all refresh tokens for a user
   */
  revokeAllUserRefreshTokens: typeof import('./user/user-refresh-token-commands').revokeAllUserRefreshTokens = 
    require('./user/user-refresh-token-commands').revokeAllUserRefreshTokens;
  
  // --------------------------------------------------------------------------
  // User Metadata Commands
  // --------------------------------------------------------------------------
  
  /**
   * Set user metadata (single key-value)
   */
  setUserMetadata: typeof import('./user/user-metadata-commands').setUserMetadata = 
    require('./user/user-metadata-commands').setUserMetadata;
  
  /**
   * Bulk set user metadata (multiple key-values)
   */
  bulkSetUserMetadata: typeof import('./user/user-metadata-commands').bulkSetUserMetadata = 
    require('./user/user-metadata-commands').bulkSetUserMetadata;
  
  /**
   * Remove user metadata (single key)
   */
  removeUserMetadata: typeof import('./user/user-metadata-commands').removeUserMetadata = 
    require('./user/user-metadata-commands').removeUserMetadata;
  
  /**
   * Bulk remove user metadata (multiple keys)
   */
  bulkRemoveUserMetadata: typeof import('./user/user-metadata-commands').bulkRemoveUserMetadata = 
    require('./user/user-metadata-commands').bulkRemoveUserMetadata;
  
  // ============================================================================
  // Organization Commands (Week 3)
  // ============================================================================
  
  /**
   * Add organization
   */
  addOrg: typeof import('./org/org-commands').addOrg = 
    require('./org/org-commands').addOrg;
  
  /**
   * Change organization
   */
  changeOrg: typeof import('./org/org-commands').changeOrg = 
    require('./org/org-commands').changeOrg;
  
  /**
   * Deactivate organization
   */
  deactivateOrg: typeof import('./org/org-commands').deactivateOrg = 
    require('./org/org-commands').deactivateOrg;
  
  /**
   * Reactivate organization
   */
  reactivateOrg: typeof import('./org/org-commands').reactivateOrg = 
    require('./org/org-commands').reactivateOrg;
  
  /**
   * Add organization member
   */
  addOrgMember: typeof import('./org/org-commands').addOrgMember = 
    require('./org/org-commands').addOrgMember;
  
  /**
   * Change organization member roles
   */
  changeOrgMember: typeof import('./org/org-commands').changeOrgMember = 
    require('./org/org-commands').changeOrgMember;
  
  /**
   * Remove organization member
   */
  removeOrgMember: typeof import('./org/org-commands').removeOrgMember = 
    require('./org/org-commands').removeOrgMember;
  
  /**
   * Add domain to organization
   */
  addDomain: typeof import('./org/org-commands').addDomain = 
    require('./org/org-commands').addDomain;
  
  /**
   * Verify domain
   */
  verifyDomain: typeof import('./org/org-commands').verifyDomain = 
    require('./org/org-commands').verifyDomain;
  
  /**
   * Set primary domain
   */
  setPrimaryDomain: typeof import('./org/org-commands').setPrimaryDomain = 
    require('./org/org-commands').setPrimaryDomain;
  
  /**
   * Remove domain
   */
  removeDomain: typeof import('./org/org-commands').removeDomain = 
    require('./org/org-commands').removeDomain;
  
  /**
   * Setup organization with admins and domains
   */
  setupOrg: typeof import('./org/org-setup-commands').setupOrg = 
    require('./org/org-setup-commands').setupOrg;
  
  /**
   * Remove organization
   */
  removeOrg: typeof import('./org/org-setup-commands').removeOrg = 
    require('./org/org-setup-commands').removeOrg;
  
  /**
   * Add organization action
   */
  addAction: typeof import('./org/org-action-commands').addAction = 
    require('./org/org-action-commands').addAction;
  
  /**
   * Add organization action with ID
   */
  addActionWithID: typeof import('./org/org-action-commands').addActionWithID = 
    require('./org/org-action-commands').addActionWithID;
  
  /**
   * Change organization action
   */
  changeAction: typeof import('./org/org-action-commands').changeAction = 
    require('./org/org-action-commands').changeAction;
  
  /**
   * Deactivate organization action
   */
  deactivateAction: typeof import('./org/org-action-commands').deactivateAction = 
    require('./org/org-action-commands').deactivateAction;
  
  /**
   * Reactivate organization action
   */
  reactivateAction: typeof import('./org/org-action-commands').reactivateAction = 
    require('./org/org-action-commands').reactivateAction;
  
  /**
   * Delete organization action
   */
  deleteAction: typeof import('./org/org-action-commands').deleteAction = 
    require('./org/org-action-commands').deleteAction;
  
  /**
   * Clear organization flow
   */
  clearFlow: typeof import('./org/org-flow-commands').clearFlow = 
    require('./org/org-flow-commands').clearFlow;
  
  /**
   * Set trigger actions for organization flow
   */
  setTriggerActions: typeof import('./org/org-flow-commands').setTriggerActions = 
    require('./org/org-flow-commands').setTriggerActions;
  
  // --------------------------------------------------------------------------
  // Organization Policy Commands (Phase 3)
  // --------------------------------------------------------------------------
  
  /**
   * Add organization domain policy
   */
  addOrgDomainPolicy: typeof import('./org/org-domain-policy-commands').addOrgDomainPolicy = 
    require('./org/org-domain-policy-commands').addOrgDomainPolicy;
  
  /**
   * Change organization domain policy
   */
  changeOrgDomainPolicy: typeof import('./org/org-domain-policy-commands').changeOrgDomainPolicy = 
    require('./org/org-domain-policy-commands').changeOrgDomainPolicy;
  
  /**
   * Remove organization domain policy
   */
  removeOrgDomainPolicy: typeof import('./org/org-domain-policy-commands').removeOrgDomainPolicy = 
    require('./org/org-domain-policy-commands').removeOrgDomainPolicy;
  
  /**
   * Add organization privacy policy
   */
  addOrgPrivacyPolicy: typeof import('./org/org-privacy-policy-commands').addOrgPrivacyPolicy = 
    require('./org/org-privacy-policy-commands').addOrgPrivacyPolicy;
  
  /**
   * Change organization privacy policy
   */
  changeOrgPrivacyPolicy: typeof import('./org/org-privacy-policy-commands').changeOrgPrivacyPolicy = 
    require('./org/org-privacy-policy-commands').changeOrgPrivacyPolicy;
  
  /**
   * Remove organization privacy policy
   */
  removeOrgPrivacyPolicy: typeof import('./org/org-privacy-policy-commands').removeOrgPrivacyPolicy = 
    require('./org/org-privacy-policy-commands').removeOrgPrivacyPolicy;
  
  /**
   * Add organization notification policy
   */
  addOrgNotificationPolicy: typeof import('./org/org-notification-policy-commands').addOrgNotificationPolicy = 
    require('./org/org-notification-policy-commands').addOrgNotificationPolicy;
  
  /**
   * Change organization notification policy
   */
  changeOrgNotificationPolicy: typeof import('./org/org-notification-policy-commands').changeOrgNotificationPolicy = 
    require('./org/org-notification-policy-commands').changeOrgNotificationPolicy;
  
  /**
   * Remove organization notification policy
   */
  removeOrgNotificationPolicy: typeof import('./org/org-notification-policy-commands').removeOrgNotificationPolicy = 
    require('./org/org-notification-policy-commands').removeOrgNotificationPolicy;
  
  /**
   * Add organization mail template policy
   */
  addOrgMailTemplatePolicy: typeof import('./org/org-mail-template-policy-commands').addOrgMailTemplatePolicy = 
    require('./org/org-mail-template-policy-commands').addOrgMailTemplatePolicy;
  
  /**
   * Change organization mail template policy
   */
  changeOrgMailTemplatePolicy: typeof import('./org/org-mail-template-policy-commands').changeOrgMailTemplatePolicy = 
    require('./org/org-mail-template-policy-commands').changeOrgMailTemplatePolicy;
  
  /**
   * Remove organization mail template policy
   */
  removeOrgMailTemplatePolicy: typeof import('./org/org-mail-template-policy-commands').removeOrgMailTemplatePolicy = 
    require('./org/org-mail-template-policy-commands').removeOrgMailTemplatePolicy;
  
  // ============================================================================
  // Project Commands (Week 4)
  // ============================================================================
  
  /**
   * Add project
   */
  addProject: typeof import('./project/project-commands').addProject = 
    require('./project/project-commands').addProject;
  
  /**
   * Change project
   */
  changeProject: typeof import('./project/project-commands').changeProject = 
    require('./project/project-commands').changeProject;
  
  /**
   * Deactivate project
   */
  deactivateProject: typeof import('./project/project-commands').deactivateProject = 
    require('./project/project-commands').deactivateProject;
  
  /**
   * Reactivate project
   */
  reactivateProject: typeof import('./project/project-commands').reactivateProject = 
    require('./project/project-commands').reactivateProject;
  
  /**
   * Add project role
   */
  addProjectRole: typeof import('./project/project-commands').addProjectRole = 
    require('./project/project-commands').addProjectRole;
  
  /**
   * Change project role
   */
  changeProjectRole: typeof import('./project/project-commands').changeProjectRole = 
    require('./project/project-commands').changeProjectRole;
  
  /**
   * Remove project role
   */
  removeProjectRole: typeof import('./project/project-commands').removeProjectRole = 
    require('./project/project-commands').removeProjectRole;
  
  /**
   * Add project member
   */
  addProjectMember: typeof import('./project/project-commands').addProjectMember = 
    require('./project/project-commands').addProjectMember;
  
  /**
   * Change project member roles
   */
  changeProjectMember: typeof import('./project/project-commands').changeProjectMember = 
    require('./project/project-commands').changeProjectMember;
  
  /**
   * Add project grant
   */
  addProjectGrant: typeof import('./project/project-commands').addProjectGrant = 
    require('./project/project-commands').addProjectGrant;
  
  /**
   * Change project grant
   */
  changeProjectGrant: typeof import('./project/project-commands').changeProjectGrant = 
    require('./project/project-commands').changeProjectGrant;
  
  /**
   * Remove project
   */
  removeProject: typeof import('./project/project-commands').removeProject = 
    require('./project/project-commands').removeProject;
  
  /**
   * Remove project member
   */
  removeProjectMember: typeof import('./project/project-commands').removeProjectMember = 
    require('./project/project-commands').removeProjectMember;
  
  /**
   * Deactivate project grant
   */
  deactivateProjectGrant: typeof import('./project/project-commands').deactivateProjectGrant = 
    require('./project/project-commands').deactivateProjectGrant;
  
  /**
   * Reactivate project grant
   */
  reactivateProjectGrant: typeof import('./project/project-commands').reactivateProjectGrant = 
    require('./project/project-commands').reactivateProjectGrant;
  
  /**
   * Remove project grant
   */
  removeProjectGrant: typeof import('./project/project-commands').removeProjectGrant = 
    require('./project/project-commands').removeProjectGrant;
  
  // ============================================================================
  // Application Commands (Week 5)
  // ============================================================================
  
  /**
   * Add OIDC application
   */
  addOIDCApp: typeof import('./application/app-commands').addOIDCApp = 
    require('./application/app-commands').addOIDCApp;
  
  /**
   * Update OIDC application
   */
  updateOIDCApp: typeof import('./application/app-commands').updateOIDCApp = 
    require('./application/app-commands').updateOIDCApp;
  
  /**
   * Add API application
   */
  addAPIApp: typeof import('./application/app-commands').addAPIApp = 
    require('./application/app-commands').addAPIApp;
  
  /**
   * Update API application
   */
  updateAPIApp: typeof import('./application/app-commands').updateAPIApp = 
    require('./application/app-commands').updateAPIApp;
  
  /**
   * Change application secret
   */
  changeAppSecret: typeof import('./application/app-commands').changeAppSecret = 
    require('./application/app-commands').changeAppSecret;
  
  /**
   * Add application key
   */
  addAppKey: typeof import('./application/app-commands').addAppKey = 
    require('./application/app-commands').addAppKey;

  /**
   * Remove application key
   */
  removeAppKey: typeof import('./application/app-commands').removeAppKey = 
    require('./application/app-commands').removeAppKey;

  /**
   * Add SAML application
   */
  addSAMLApp: typeof import('./application/app-commands').addSAMLApp = 
    require('./application/app-commands').addSAMLApp;

  /**
   * Update SAML application
   */
  updateSAMLApp: typeof import('./application/app-commands').updateSAMLApp = 
    require('./application/app-commands').updateSAMLApp;

  /**
   * Deactivate application
   */
  deactivateApplication: typeof import('./application/app-commands').deactivateApplication = 
    require('./application/app-commands').deactivateApplication;

  /**
   * Reactivate application
   */
  reactivateApplication: typeof import('./application/app-commands').reactivateApplication = 
    require('./application/app-commands').reactivateApplication;

  /**
   * Remove application
   */
  removeApplication: typeof import('./application/app-commands').removeApplication = 
    require('./application/app-commands').removeApplication;

  // ============================================================================
  // Session Commands (Phase 3)
  // ============================================================================
  
  /**
   * Create session
   */
  createSession: typeof import('./session/session-commands').createSession = 
    require('./session/session-commands').createSession;
  
  /**
   * Update session
   */
  updateSession: typeof import('./session/session-commands').updateSession = 
    require('./session/session-commands').updateSession;
  
  /**
   * Terminate session
   */
  terminateSession: typeof import('./session/session-commands').terminateSession = 
    require('./session/session-commands').terminateSession;
  
  /**
   * Set session token
   */
  setSessionToken: typeof import('./session/session-commands').setSessionToken = 
    require('./session/session-commands').setSessionToken;
  
  /**
   * Check session token
   */
  checkSessionToken: typeof import('./session/session-commands').checkSessionToken = 
    require('./session/session-commands').checkSessionToken;
  
  /**
   * Set authentication factor
   */
  setAuthFactor: typeof import('./session/session-commands').setAuthFactor = 
    require('./session/session-commands').setAuthFactor;
  
  /**
   * Set session metadata
   */
  setSessionMetadata: typeof import('./session/session-commands').setSessionMetadata = 
    require('./session/session-commands').setSessionMetadata;
  
  /**
   * Delete session metadata
   */
  deleteSessionMetadata: typeof import('./session/session-commands').deleteSessionMetadata = 
    require('./session/session-commands').deleteSessionMetadata;

  // ============================================================================
  // Instance Commands (Phase 3)
  // ============================================================================
  
  /**
   * Setup instance
   */
  setupInstance: typeof import('./instance/instance-commands').setupInstance = 
    require('./instance/instance-commands').setupInstance;
  
  /**
   * Add instance domain
   */
  addInstanceDomain: typeof import('./instance/instance-commands').addInstanceDomain = 
    require('./instance/instance-commands').addInstanceDomain;
  
  /**
   * Set default instance domain
   */
  setDefaultInstanceDomain: typeof import('./instance/instance-commands').setDefaultInstanceDomain = 
    require('./instance/instance-commands').setDefaultInstanceDomain;
  
  /**
   * Remove instance domain
   */
  removeInstanceDomain: typeof import('./instance/instance-commands').removeInstanceDomain = 
    require('./instance/instance-commands').removeInstanceDomain;
  
  /**
   * Set instance features
   */
  setInstanceFeatures: typeof import('./instance/instance-commands').setInstanceFeatures = 
    require('./instance/instance-commands').setInstanceFeatures;
  
  /**
   * Reset instance features
   */
  resetInstanceFeatures: typeof import('./instance/instance-commands').resetInstanceFeatures = 
    require('./instance/instance-commands').resetInstanceFeatures;
  
  /**
   * Add instance member
   */
  addInstanceMember: typeof import('./instance/instance-commands').addInstanceMember = 
    require('./instance/instance-commands').addInstanceMember;
  
  /**
   * Change instance member
   */
  changeInstanceMember: typeof import('./instance/instance-commands').changeInstanceMember = 
    require('./instance/instance-commands').changeInstanceMember;
  
  /**
   * Remove instance member
   */
  removeInstanceMember: typeof import('./instance/instance-commands').removeInstanceMember = 
    require('./instance/instance-commands').removeInstanceMember;

  // ============================================================================
  // Policy Commands (Phase 3)
  // ============================================================================
  
  /**
   * Add default password age policy
   */
  addDefaultPasswordAgePolicy: typeof import('./policy/password-age-policy-commands').addDefaultPasswordAgePolicy = 
    require('./policy/password-age-policy-commands').addDefaultPasswordAgePolicy;
  
  /**
   * Change default password age policy
   */
  changeDefaultPasswordAgePolicy: typeof import('./policy/password-age-policy-commands').changeDefaultPasswordAgePolicy = 
    require('./policy/password-age-policy-commands').changeDefaultPasswordAgePolicy;
  
  /**
   * Remove default password age policy
   */
  removeDefaultPasswordAgePolicy: typeof import('./policy/password-age-policy-commands').removeDefaultPasswordAgePolicy = 
    require('./policy/password-age-policy-commands').removeDefaultPasswordAgePolicy;
  
  /**
   * Add organization password age policy
   */
  addOrgPasswordAgePolicy: typeof import('./policy/password-age-policy-commands').addOrgPasswordAgePolicy = 
    require('./policy/password-age-policy-commands').addOrgPasswordAgePolicy;
  
  /**
   * Add default login policy
   */
  addDefaultLoginPolicy: typeof import('./policy/login-policy-commands').addDefaultLoginPolicy = 
    require('./policy/login-policy-commands').addDefaultLoginPolicy;
  
  /**
   * Change default login policy
   */
  changeDefaultLoginPolicy: typeof import('./policy/login-policy-commands').changeDefaultLoginPolicy = 
    require('./policy/login-policy-commands').changeDefaultLoginPolicy;
  
  /**
   * Add second factor to default login policy
   */
  addSecondFactorToDefaultLoginPolicy: typeof import('./policy/login-policy-commands').addSecondFactorToDefaultLoginPolicy = 
    require('./policy/login-policy-commands').addSecondFactorToDefaultLoginPolicy;
  
  /**
   * Remove second factor from default login policy
   */
  removeSecondFactorFromDefaultLoginPolicy: typeof import('./policy/login-policy-commands').removeSecondFactorFromDefaultLoginPolicy = 
    require('./policy/login-policy-commands').removeSecondFactorFromDefaultLoginPolicy;
  
  /**
   * Add multi factor to default login policy
   */
  addMultiFactorToDefaultLoginPolicy: typeof import('./policy/login-policy-commands').addMultiFactorToDefaultLoginPolicy = 
    require('./policy/login-policy-commands').addMultiFactorToDefaultLoginPolicy;
  
  /**
   * Add default password complexity policy
   */
  addDefaultPasswordComplexityPolicy: typeof import('./policy/password-complexity-policy-commands').addDefaultPasswordComplexityPolicy = 
    require('./policy/password-complexity-policy-commands').addDefaultPasswordComplexityPolicy;
  
  /**
   * Change default password complexity policy
   */
  changeDefaultPasswordComplexityPolicy: typeof import('./policy/password-complexity-policy-commands').changeDefaultPasswordComplexityPolicy = 
    require('./policy/password-complexity-policy-commands').changeDefaultPasswordComplexityPolicy;
  
  /**
   * Remove default password complexity policy
   */
  removeDefaultPasswordComplexityPolicy: typeof import('./policy/password-complexity-policy-commands').removeDefaultPasswordComplexityPolicy = 
    require('./policy/password-complexity-policy-commands').removeDefaultPasswordComplexityPolicy;
  
  /**
   * Add organization password complexity policy
   */
  addOrgPasswordComplexityPolicy: typeof import('./policy/password-complexity-policy-commands').addOrgPasswordComplexityPolicy = 
    require('./policy/password-complexity-policy-commands').addOrgPasswordComplexityPolicy;
  
  /**
   * Change organization password complexity policy
   */
  changeOrgPasswordComplexityPolicy: typeof import('./policy/password-complexity-policy-commands').changeOrgPasswordComplexityPolicy = 
    require('./policy/password-complexity-policy-commands').changeOrgPasswordComplexityPolicy;
  
  /**
   * Remove organization password complexity policy
   */
  removeOrgPasswordComplexityPolicy: typeof import('./policy/password-complexity-policy-commands').removeOrgPasswordComplexityPolicy = 
    require('./policy/password-complexity-policy-commands').removeOrgPasswordComplexityPolicy;
  
  /**
   * Add default password lockout policy
   */
  addDefaultPasswordLockoutPolicy: typeof import('./policy/password-lockout-policy-commands').addDefaultPasswordLockoutPolicy = 
    require('./policy/password-lockout-policy-commands').addDefaultPasswordLockoutPolicy;
  
  /**
   * Change default password lockout policy
   */
  changeDefaultPasswordLockoutPolicy: typeof import('./policy/password-lockout-policy-commands').changeDefaultPasswordLockoutPolicy = 
    require('./policy/password-lockout-policy-commands').changeDefaultPasswordLockoutPolicy;
  
  /**
   * Remove default password lockout policy
   */
  removeDefaultPasswordLockoutPolicy: typeof import('./policy/password-lockout-policy-commands').removeDefaultPasswordLockoutPolicy = 
    require('./policy/password-lockout-policy-commands').removeDefaultPasswordLockoutPolicy;
  
  /**
   * Add organization password lockout policy
   */
  addOrgPasswordLockoutPolicy: typeof import('./policy/password-lockout-policy-commands').addOrgPasswordLockoutPolicy = 
    require('./policy/password-lockout-policy-commands').addOrgPasswordLockoutPolicy;
  
  /**
   * Change organization password lockout policy
   */
  changeOrgPasswordLockoutPolicy: typeof import('./policy/password-lockout-policy-commands').changeOrgPasswordLockoutPolicy = 
    require('./policy/password-lockout-policy-commands').changeOrgPasswordLockoutPolicy;
  
  /**
   * Remove organization password lockout policy
   */
  removeOrgPasswordLockoutPolicy: typeof import('./policy/password-lockout-policy-commands').removeOrgPasswordLockoutPolicy = 
    require('./policy/password-lockout-policy-commands').removeOrgPasswordLockoutPolicy;

  // ============================================================================
  // Authentication Commands (Phase 3)
  // ============================================================================
  
  /**
   * Add authentication request
   */
  addAuthRequest: typeof import('./auth/auth-commands').addAuthRequest = 
    require('./auth/auth-commands').addAuthRequest;
  
  /**
   * Select user for authentication
   */
  selectUser: typeof import('./auth/auth-commands').selectUser = 
    require('./auth/auth-commands').selectUser;
  
  /**
   * Check password for authentication
   */
  checkPassword: typeof import('./auth/auth-commands').checkPassword = 
    require('./auth/auth-commands').checkPassword;
  
  /**
   * Check TOTP for authentication
   */
  checkTOTP: typeof import('./auth/auth-commands').checkTOTP = 
    require('./auth/auth-commands').checkTOTP;
  
  /**
   * Succeed authentication request
   */
  succeedAuthRequest: typeof import('./auth/auth-commands').succeedAuthRequest = 
    require('./auth/auth-commands').succeedAuthRequest;
  
  /**
   * Fail authentication request
   */
  failAuthRequest: typeof import('./auth/auth-commands').failAuthRequest = 
    require('./auth/auth-commands').failAuthRequest;
}

/**
 * Factory function to create Commands instance
 */
export function createCommands(
  eventstore: Eventstore,
  cache: Cache,
  staticStorage: Storage,
  idGenerator: IDGenerator,
  config: CommandsConfig
): Commands {
  return new Commands(eventstore, cache, staticStorage, idGenerator, config);
}
