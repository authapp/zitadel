/**
 * Domain Policies
 * 
 * Policy objects that govern behavior across the system
 */

import { throwInvalidArgument } from '@/zerrors/errors';

/**
 * Password complexity policy
 */
export class PasswordComplexityPolicy {
  constructor(
    public minLength: number = 8,
    public hasUppercase: boolean = true,
    public hasLowercase: boolean = true,
    public hasNumber: boolean = true,
    public hasSymbol: boolean = true
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.minLength < 1 || this.minLength > 72) {
      throwInvalidArgument('Password min length must be 1-72', 'POLICY-PWD-001');
    }
  }

  /**
   * Check if password meets policy
   */
  isValid(password: string): boolean {
    if (password.length < this.minLength) {
      return false;
    }

    if (this.hasUppercase && !/[A-Z]/.test(password)) {
      return false;
    }

    if (this.hasLowercase && !/[a-z]/.test(password)) {
      return false;
    }

    if (this.hasNumber && !/[0-9]/.test(password)) {
      return false;
    }

    if (this.hasSymbol && !/[^A-Za-z0-9]/.test(password)) {
      return false;
    }

    return true;
  }

  /**
   * Get validation error message
   */
  getValidationError(password: string): string | null {
    if (password.length < this.minLength) {
      return `Password must be at least ${this.minLength} characters`;
    }

    if (this.hasUppercase && !/[A-Z]/.test(password)) {
      return 'Password must contain uppercase letter';
    }

    if (this.hasLowercase && !/[a-z]/.test(password)) {
      return 'Password must contain lowercase letter';
    }

    if (this.hasNumber && !/[0-9]/.test(password)) {
      return 'Password must contain number';
    }

    if (this.hasSymbol && !/[^A-Za-z0-9]/.test(password)) {
      return 'Password must contain special character';
    }

    return null;
  }
}

/**
 * Password age policy
 */
export class PasswordAgePolicy {
  constructor(
    public expireWarnDays: number = 0,
    public maxAgeDays: number = 0
  ) {}

  /**
   * Check if password has expired
   */
  isExpired(passwordChangeDate: Date): boolean {
    if (this.maxAgeDays === 0) {
      return false;
    }

    const ageInDays = Math.floor(
      (Date.now() - passwordChangeDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return ageInDays >= this.maxAgeDays;
  }

  /**
   * Check if password expiration warning should be shown
   */
  shouldWarn(passwordChangeDate: Date): boolean {
    if (this.expireWarnDays === 0 || this.maxAgeDays === 0) {
      return false;
    }

    const ageInDays = Math.floor(
      (Date.now() - passwordChangeDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return ageInDays >= (this.maxAgeDays - this.expireWarnDays);
  }
}

/**
 * Password lockout policy
 */
export class PasswordLockoutPolicy {
  constructor(
    public maxPasswordAttempts: number = 5,
    public showLockOutFailures: boolean = true
  ) {
    if (this.maxPasswordAttempts < 0) {
      this.maxPasswordAttempts = 0;
    }
  }

  /**
   * Check if account should be locked
   */
  shouldLock(failedAttempts: number): boolean {
    if (this.maxPasswordAttempts === 0) {
      return false;
    }
    return failedAttempts >= this.maxPasswordAttempts;
  }

  /**
   * Get remaining attempts
   */
  getRemainingAttempts(failedAttempts: number): number {
    if (this.maxPasswordAttempts === 0) {
      return -1; // Unlimited
    }
    return Math.max(0, this.maxPasswordAttempts - failedAttempts);
  }
}

/**
 * Login policy
 */
export class LoginPolicy {
  constructor(
    public allowUsernamePassword: boolean = true,
    public allowRegister: boolean = true,
    public allowExternalIDP: boolean = true,
    public forceMFA: boolean = false,
    public forceMFALocalOnly: boolean = false,
    public passwordlessType: PasswordlessType = PasswordlessType.NOT_ALLOWED,
    public hidePasswordReset: boolean = false,
    public ignoreUnknownUsernames: boolean = false,
    public defaultRedirectURI: string = '',
    public passwordCheckLifetime: number = 240, // hours
    public externalLoginCheckLifetime: number = 240, // hours
    public mfaInitSkipLifetime: number = 720, // hours
    public secondFactorCheckLifetime: number = 18, // hours
    public multiFactorCheckLifetime: number = 12, // hours
    public allowDomainDiscovery: boolean = true,
    public disableLoginWithEmail: boolean = false,
    public disableLoginWithPhone: boolean = false
  ) {}

  /**
   * Check if MFA is required
   */
  isMFARequired(): boolean {
    return this.forceMFA;
  }

  /**
   * Check if registration is allowed
   */
  isRegistrationAllowed(): boolean {
    return this.allowRegister;
  }

  /**
   * Check if external IDP is allowed
   */
  isExternalIDPAllowed(): boolean {
    return this.allowExternalIDP;
  }
}

/**
 * Passwordless type
 */
export enum PasswordlessType {
  NOT_ALLOWED = 0,
  ALLOWED = 1,
}

/**
 * Domain policy (for username generation)
 */
export class DomainPolicy {
  constructor(
    public userLoginMustBeDomain: boolean = false,
    public validateOrgDomains: boolean = false,
    public smtpSenderAddressMatchesInstanceDomain: boolean = false
  ) {}

  /**
   * Check if user login must be domain
   */
  requiresDomainLogin(): boolean {
    return this.userLoginMustBeDomain;
  }
}

/**
 * Label policy (branding)
 */
export class LabelPolicy {
  constructor(
    public primaryColor: string = '#5469d4',
    public hideLoginNameSuffix: boolean = false,
    public warnColor: string = '#ff3b5b',
    public backgroundColor: string = '#fafafa',
    public fontColor: string = '#000000',
    public primaryColorDark: string = '#2073c4',
    public backgroundColorDark: string = '#111827',
    public warnColorDark: string = '#ff3b5b',
    public fontColorDark: string = '#ffffff',
    public disableWatermark: boolean = false,
    public logoURL?: string,
    public iconURL?: string,
    public logoURLDark?: string,
    public iconURLDark?: string,
    public fontURL?: string
  ) {}
}

/**
 * Privacy policy
 */
export class PrivacyPolicy {
  constructor(
    public tosLink: string = '',
    public privacyLink: string = '',
    public helpLink: string = '',
    public supportEmail: string = '',
    public docsLink: string = '',
    public customLink: string = '',
    public customLinkText: string = ''
  ) {}
}

/**
 * Lockout policy
 */
export class LockoutPolicy {
  constructor(
    public maxPasswordAttempts: number = 5,
    public maxOTPAttempts: number = 5,
    public showLockOutFailures: boolean = true
  ) {}
}

/**
 * Notification policy
 */
export class NotificationPolicy {
  constructor(
    public passwordChange: boolean = true,
    public passwordChangeType: NotificationChannelType = NotificationChannelType.EMAIL
  ) {}
}

/**
 * Notification channel type
 */
export enum NotificationChannelType {
  UNSPECIFIED = 0,
  EMAIL = 1,
  SMS = 2,
}

/**
 * Multi-factor policy
 */
export class MultiFactorPolicy {
  constructor(
    public enforce: boolean = false,
    public requireSecondFactor: boolean = false,
    public requireMultiFactor: boolean = false
  ) {}
}

/**
 * Organization policy set
 */
export interface OrganizationPolicies {
  passwordComplexity?: PasswordComplexityPolicy;
  passwordAge?: PasswordAgePolicy;
  passwordLockout?: PasswordLockoutPolicy;
  login?: LoginPolicy;
  domain?: DomainPolicy;
  label?: LabelPolicy;
  privacy?: PrivacyPolicy;
  notification?: NotificationPolicy;
  multiFactorPolicy?: MultiFactorPolicy;
}

/**
 * Default policies
 */
export const DEFAULT_PASSWORD_COMPLEXITY_POLICY = new PasswordComplexityPolicy();
export const DEFAULT_PASSWORD_AGE_POLICY = new PasswordAgePolicy();
export const DEFAULT_PASSWORD_LOCKOUT_POLICY = new PasswordLockoutPolicy();
export const DEFAULT_LOGIN_POLICY = new LoginPolicy();
export const DEFAULT_DOMAIN_POLICY = new DomainPolicy();
export const DEFAULT_LABEL_POLICY = new LabelPolicy();
export const DEFAULT_PRIVACY_POLICY = new PrivacyPolicy();
