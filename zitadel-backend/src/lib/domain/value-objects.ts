/**
 * Domain Value Objects
 * 
 * Immutable value objects representing domain concepts
 */

import { Gender, Language } from './types';
import { throwInvalidArgument } from '@/zerrors/errors';

/**
 * Email value object
 */
export class Email {
  constructor(
    public readonly email: string,
    public readonly isVerified: boolean = false,
    public readonly verifyCode?: string
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.email || this.email.trim().length === 0) {
      throwInvalidArgument('Email cannot be empty', 'DOMAIN-Email-001');
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      throwInvalidArgument('Invalid email format', 'DOMAIN-Email-002');
    }
  }

  normalize(): Email {
    return new Email(
      this.email.toLowerCase().trim(),
      this.isVerified,
      this.verifyCode
    );
  }

  equals(other: Email): boolean {
    return this.email.toLowerCase() === other.email.toLowerCase();
  }
}

/**
 * Phone value object
 */
export class Phone {
  constructor(
    public readonly phoneNumber: string,
    public readonly isVerified: boolean = false,
    public readonly verifyCode?: string
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.phoneNumber || this.phoneNumber.trim().length === 0) {
      throwInvalidArgument('Phone number cannot be empty', 'DOMAIN-Phone-001');
    }
    
    // Basic phone validation (E.164 format)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(this.phoneNumber)) {
      throwInvalidArgument(
        'Invalid phone format. Must be E.164 format (e.g., +1234567890)',
        'DOMAIN-Phone-002'
      );
    }
  }

  normalize(): Phone {
    return new Phone(
      this.phoneNumber.replace(/\s+/g, ''),
      this.isVerified,
      this.verifyCode
    );
  }

  equals(other: Phone): boolean {
    return this.phoneNumber === other.phoneNumber;
  }
}

/**
 * Address value object
 */
export class Address {
  constructor(
    public readonly country: string,
    public readonly locality?: string,
    public readonly postalCode?: string,
    public readonly region?: string,
    public readonly streetAddress?: string
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.country || this.country.trim().length === 0) {
      throwInvalidArgument('Country is required', 'DOMAIN-Address-001');
    }
    
    // Country code should be 2 characters (ISO 3166-1 alpha-2)
    if (this.country.length !== 2) {
      throwInvalidArgument(
        'Country must be ISO 3166-1 alpha-2 code',
        'DOMAIN-Address-002'
      );
    }
  }

  equals(other: Address): boolean {
    return (
      this.country === other.country &&
      this.locality === other.locality &&
      this.postalCode === other.postalCode &&
      this.region === other.region &&
      this.streetAddress === other.streetAddress
    );
  }
}

/**
 * Profile value object
 */
export class Profile {
  constructor(
    public readonly givenName: string,
    public readonly familyName: string,
    public readonly displayName?: string,
    public readonly nickName?: string,
    public readonly preferredLanguage?: Language,
    public readonly gender?: Gender
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.givenName || this.givenName.trim().length === 0) {
      throwInvalidArgument('Given name is required', 'DOMAIN-Profile-001');
    }
    
    if (!this.familyName || this.familyName.trim().length === 0) {
      throwInvalidArgument('Family name is required', 'DOMAIN-Profile-002');
    }
    
    if (this.givenName.length > 200) {
      throwInvalidArgument('Given name too long (max 200)', 'DOMAIN-Profile-003');
    }
    
    if (this.familyName.length > 200) {
      throwInvalidArgument('Family name too long (max 200)', 'DOMAIN-Profile-004');
    }
  }

  getFullName(): string {
    return `${this.givenName} ${this.familyName}`;
  }

  getDisplayName(): string {
    return this.displayName || this.getFullName();
  }

  equals(other: Profile): boolean {
    return (
      this.givenName === other.givenName &&
      this.familyName === other.familyName &&
      this.displayName === other.displayName &&
      this.nickName === other.nickName &&
      this.preferredLanguage === other.preferredLanguage &&
      this.gender === other.gender
    );
  }
}

/**
 * Password value object (for validation, not storage)
 */
export class Password {
  constructor(
    public readonly password: string,
    public readonly changeRequired: boolean = false
  ) {
    // Note: Actual validation happens via password policy
    if (!password || password.length === 0) {
      throwInvalidArgument('Password cannot be empty', 'DOMAIN-Password-001');
    }
  }
}

/**
 * Domain name value object
 */
export class DomainName {
  constructor(public readonly domain: string) {
    this.validate();
  }

  private validate(): void {
    if (!this.domain || this.domain.trim().length === 0) {
      throwInvalidArgument('Domain cannot be empty', 'DOMAIN-Domain-001');
    }
    
    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(this.domain)) {
      throwInvalidArgument('Invalid domain format', 'DOMAIN-Domain-002');
    }
  }

  normalize(): DomainName {
    return new DomainName(this.domain.toLowerCase());
  }

  equals(other: DomainName): boolean {
    return this.domain.toLowerCase() === other.domain.toLowerCase();
  }
}

/**
 * Role value object
 */
export class Role {
  constructor(
    public readonly key: string,
    public readonly displayName?: string,
    public readonly group?: string
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.key || this.key.trim().length === 0) {
      throwInvalidArgument('Role key cannot be empty', 'DOMAIN-Role-001');
    }
    
    // Role key format validation
    const roleKeyRegex = /^[A-Z][A-Z0-9_]*$/;
    if (!roleKeyRegex.test(this.key)) {
      throwInvalidArgument(
        'Role key must be uppercase with underscores',
        'DOMAIN-Role-002'
      );
    }
  }

  equals(other: Role): boolean {
    return this.key === other.key;
  }
}
