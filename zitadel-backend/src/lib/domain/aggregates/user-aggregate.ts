/**
 * User Aggregate
 * 
 * Aggregate root for user with event handling
 */

import { Event } from '@/eventstore/types';
import { HumanUser, MachineUser, UserState, UserType, User } from '../entities/user';
import { Email, Phone, Address, Profile } from '../value-objects';
import { Gender, Language } from '../types';
import { throwNotFound } from '@/zerrors/errors';

/**
 * User aggregate
 * Handles all user state changes through events
 */
export class UserAggregate {
  private user: User | null = null;

  constructor(private readonly userID: string) {}

  /**
   * Get current user state
   */
  getUser(): User {
    if (!this.user) {
      throwNotFound('User not found', 'USER-AGG-001');
    }
    return this.user;
  }

  /**
   * Check if user exists
   */
  exists(): boolean {
    return this.user !== null && this.user.exists();
  }

  /**
   * Apply events to rebuild state
   */
  applyEvents(events: Event[]): void {
    for (const event of events) {
      this.applyEvent(event);
    }
  }

  /**
   * Apply single event
   */
  private applyEvent(event: Event): void {
    switch (event.eventType) {
      // Human user events
      case 'user.human.added':
        this.applyHumanUserAdded(event);
        break;
      case 'user.username.changed':
        this.applyUsernameChanged(event);
        break;
      case 'user.profile.changed':
        this.applyProfileChanged(event);
        break;
      case 'user.email.changed':
        this.applyEmailChanged(event);
        break;
      case 'user.email.verified':
        this.applyEmailVerified(event);
        break;
      case 'user.phone.changed':
        this.applyPhoneChanged(event);
        break;
      case 'user.phone.verified':
        this.applyPhoneVerified(event);
        break;
      case 'user.phone.removed':
        this.applyPhoneRemoved(event);
        break;
      case 'user.address.changed':
        this.applyAddressChanged(event);
        break;
      case 'user.password.changed':
        this.applyPasswordChanged(event);
        break;
      case 'user.locked':
        this.applyUserLocked(event);
        break;
      case 'user.unlocked':
        this.applyUserUnlocked(event);
        break;
      case 'user.deactivated':
        this.applyUserDeactivated(event);
        break;
      case 'user.reactivated':
        this.applyUserReactivated(event);
        break;
      case 'user.removed':
        this.applyUserRemoved(event);
        break;
      
      // Machine user events
      case 'user.machine.added':
        this.applyMachineUserAdded(event);
        break;
      case 'user.machine.changed':
        this.applyMachineUserChanged(event);
        break;
      
      default:
        // Ignore unknown events
        break;
    }
  }

  /**
   * Apply human user added event
   */
  private applyHumanUserAdded(event: Event): void {
    const data = event.payload as any;
    
    const profile = new Profile(
      data.profile.givenName,
      data.profile.familyName,
      data.profile.displayName,
      data.profile.nickName,
      data.profile.preferredLanguage as Language,
      data.profile.gender as Gender
    );
    
    const email = new Email(
      data.email.email,
      data.email.isVerified || false
    );
    
    let phone: Phone | undefined;
    if (data.phone) {
      phone = new Phone(
        data.phone.phoneNumber,
        data.phone.isVerified || false
      );
    }
    
    let address: Address | undefined;
    if (data.address) {
      address = new Address(
        data.address.country,
        data.address.locality,
        data.address.postalCode,
        data.address.region,
        data.address.streetAddress
      );
    }
    
    this.user = new HumanUser(
      event.aggregateID,
      event.owner,
      data.username,
      UserState.ACTIVE,
      profile,
      email,
      phone,
      address,
      data.hashedPassword,
      data.passwordChangeRequired || false,
      event.createdAt,
      event.createdAt,
      BigInt(event.position.position)
    );
  }

  /**
   * Apply username changed event
   */
  private applyUsernameChanged(event: Event): void {
    if (!this.user) return;
    
    const data = event.payload as any;
    this.user.username = data.username;
    this.user.changeDate = event.createdAt;
    this.user.sequence = BigInt(event.position.position);
  }

  /**
   * Apply profile changed event
   */
  private applyProfileChanged(event: Event): void {
    if (!this.user || this.user.type !== UserType.HUMAN) return;
    
    const data = event.payload as any;
    const humanUser = this.user as HumanUser;
    
    humanUser.profile = new Profile(
      data.givenName || humanUser.profile.givenName,
      data.familyName || humanUser.profile.familyName,
      data.displayName,
      data.nickName,
      data.preferredLanguage as Language,
      data.gender as Gender
    );
    
    humanUser.changeDate = event.createdAt;
    humanUser.sequence = BigInt(event.position.position);
  }

  /**
   * Apply email changed event
   */
  private applyEmailChanged(event: Event): void {
    if (!this.user || this.user.type !== UserType.HUMAN) return;
    
    const data = event.payload as any;
    const humanUser = this.user as HumanUser;
    
    humanUser.email = new Email(
      data.email,
      false  // New email is not verified
    );
    
    humanUser.changeDate = event.createdAt;
    humanUser.sequence = BigInt(event.position.position);
  }

  /**
   * Apply email verified event
   */
  private applyEmailVerified(event: Event): void {
    if (!this.user || this.user.type !== UserType.HUMAN) return;
    
    const humanUser = this.user as HumanUser;
    humanUser.email = new Email(humanUser.email.email, true);
    
    humanUser.changeDate = event.createdAt;
    humanUser.sequence = BigInt(event.position.position);
  }

  /**
   * Apply phone changed event
   */
  private applyPhoneChanged(event: Event): void {
    if (!this.user || this.user.type !== UserType.HUMAN) return;
    
    const data = event.payload as any;
    const humanUser = this.user as HumanUser;
    
    humanUser.phone = new Phone(
      data.phoneNumber,
      false  // New phone is not verified
    );
    
    humanUser.changeDate = event.createdAt;
    humanUser.sequence = BigInt(event.position.position);
  }

  /**
   * Apply phone verified event
   */
  private applyPhoneVerified(event: Event): void {
    if (!this.user || this.user.type !== UserType.HUMAN) return;
    
    const humanUser = this.user as HumanUser;
    if (humanUser.phone) {
      humanUser.phone = new Phone(humanUser.phone.phoneNumber, true);
    }
    
    humanUser.changeDate = event.createdAt;
    humanUser.sequence = BigInt(event.position.position);
  }

  /**
   * Apply phone removed event
   */
  private applyPhoneRemoved(event: Event): void {
    if (!this.user || this.user.type !== UserType.HUMAN) return;
    
    const humanUser = this.user as HumanUser;
    humanUser.phone = undefined;
    
    humanUser.changeDate = event.createdAt;
    humanUser.sequence = BigInt(event.position.position);
  }

  /**
   * Apply address changed event
   */
  private applyAddressChanged(event: Event): void {
    if (!this.user || this.user.type !== UserType.HUMAN) return;
    
    const data = event.payload as any;
    const humanUser = this.user as HumanUser;
    
    humanUser.address = new Address(
      data.country,
      data.locality,
      data.postalCode,
      data.region,
      data.streetAddress
    );
    
    humanUser.changeDate = event.createdAt;
    humanUser.sequence = BigInt(event.position.position);
  }

  /**
   * Apply password changed event
   */
  private applyPasswordChanged(event: Event): void {
    if (!this.user || this.user.type !== UserType.HUMAN) return;
    
    const data = event.payload as any;
    const humanUser = this.user as HumanUser;
    
    humanUser.hashedPassword = data.hashedPassword;
    humanUser.passwordChangeRequired = data.changeRequired || false;
    
    humanUser.changeDate = event.createdAt;
    humanUser.sequence = BigInt(event.position.position);
  }

  /**
   * Apply user locked event
   */
  private applyUserLocked(event: Event): void {
    if (!this.user) return;
    
    this.user.state = UserState.LOCKED;
    this.user.changeDate = event.createdAt;
    this.user.sequence = BigInt(event.position.position);
  }

  /**
   * Apply user unlocked event
   */
  private applyUserUnlocked(event: Event): void {
    if (!this.user) return;
    
    this.user.state = UserState.ACTIVE;
    this.user.changeDate = event.createdAt;
    this.user.sequence = BigInt(event.position.position);
  }

  /**
   * Apply user deactivated event
   */
  private applyUserDeactivated(event: Event): void {
    if (!this.user) return;
    
    this.user.state = UserState.INACTIVE;
    this.user.changeDate = event.createdAt;
    this.user.sequence = BigInt(event.position.position);
  }

  /**
   * Apply user reactivated event
   */
  private applyUserReactivated(event: Event): void {
    if (!this.user) return;
    
    this.user.state = UserState.ACTIVE;
    this.user.changeDate = event.createdAt;
    this.user.sequence = BigInt(event.position.position);
  }

  /**
   * Apply user removed event
   */
  private applyUserRemoved(event: Event): void {
    if (!this.user) return;
    
    this.user.state = UserState.DELETED;
    this.user.changeDate = event.createdAt;
    this.user.sequence = BigInt(event.position.position);
  }

  /**
   * Apply machine user added event
   */
  private applyMachineUserAdded(event: Event): void {
    const data = event.payload as any;
    
    this.user = new MachineUser(
      event.aggregateID,
      event.owner,
      data.username,
      UserState.ACTIVE,
      data.name,
      data.description,
      data.accessTokenType,
      event.createdAt,
      event.createdAt,
      BigInt(event.position.position)
    );
  }

  /**
   * Apply machine user changed event
   */
  private applyMachineUserChanged(event: Event): void {
    if (!this.user || this.user.type !== UserType.MACHINE) return;
    
    const data = event.payload as any;
    const machineUser = this.user as MachineUser;
    
    if (data.name) {
      machineUser.name = data.name;
    }
    if (data.description !== undefined) {
      machineUser.description = data.description;
    }
    if (data.accessTokenType !== undefined) {
      machineUser.accessTokenType = data.accessTokenType;
    }
    
    machineUser.changeDate = event.createdAt;
    machineUser.sequence = BigInt(event.position.position);
  }

  /**
   * Get aggregate ID
   */
  getAggregateID(): string {
    return this.userID;
  }

  /**
   * Get aggregate type
   */
  getAggregateType(): string {
    return 'user';
  }
}
