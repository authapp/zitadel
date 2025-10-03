/**
 * Base aggregate root implementation
 */

import { Event } from '../eventstore/types';
import { AggregateRoot } from './types';

/**
 * Base class for aggregate roots
 */
export abstract class BaseAggregate implements AggregateRoot {
  id: string;
  type: string;
  version: number = 0;

  constructor(id: string, type: string) {
    this.id = id;
    this.type = type;
  }

  /**
   * Apply an event to the aggregate
   */
  apply(event: Event): void {
    // Call specific handler based on event type
    const handlerName = this.getHandlerName(event.eventType);
    const handler = (this as any)[handlerName];
    
    if (handler && typeof handler === 'function') {
      handler.call(this, event);
    }

    this.version = event.aggregateVersion;
  }

  /**
   * Load from history
   */
  loadFromHistory(events: Event[]): void {
    events.forEach(event => this.apply(event));
  }

  /**
   * Get handler method name from event type
   */
  private getHandlerName(eventType: string): string {
    // Convert "user.created" to "onUserCreated"
    const parts = eventType.split('.');
    const methodName = parts
      .map((part, index) => {
        if (index === 0) return 'on' + this.capitalize(part);
        return this.capitalize(part);
      })
      .join('');
    
    return methodName;
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * User aggregate
 */
export class UserAggregate extends BaseAggregate {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  state: string = 'active';

  constructor(id: string) {
    super(id, 'user');
  }

  /**
   * Handle user created event
   */
  protected onUserCreated(event: Event): void {
    this.username = event.eventData.username;
    this.email = event.eventData.email;
    this.firstName = event.eventData.firstName;
    this.lastName = event.eventData.lastName;
    this.state = 'active';
  }

  /**
   * Handle user updated event
   */
  protected onUserUpdated(event: Event): void {
    if (event.eventData.email) this.email = event.eventData.email;
    if (event.eventData.firstName) this.firstName = event.eventData.firstName;
    if (event.eventData.lastName) this.lastName = event.eventData.lastName;
  }

  /**
   * Handle user deactivated event
   */
  protected onUserDeactivated(_event: Event): void {
    this.state = 'inactive';
  }
}

/**
 * Organization aggregate
 */
export class OrganizationAggregate extends BaseAggregate {
  name?: string;
  domain?: string;
  state: string = 'active';

  constructor(id: string) {
    super(id, 'organization');
  }

  /**
   * Handle organization created event
   */
  protected onOrganizationCreated(event: Event): void {
    this.name = event.eventData.name;
    this.domain = event.eventData.domain;
    this.state = 'active';
  }

  /**
   * Handle organization updated event
   */
  protected onOrganizationUpdated(event: Event): void {
    if (event.eventData.name) this.name = event.eventData.name;
  }

  /**
   * Handle organization deactivated event
   */
  protected onOrganizationDeactivated(_event: Event): void {
    this.state = 'inactive';
  }
}

/**
 * Project aggregate
 */
export class ProjectAggregate extends BaseAggregate {
  name?: string;
  resourceOwner?: string;
  state: string = 'active';

  constructor(id: string) {
    super(id, 'project');
  }

  /**
   * Handle project created event
   */
  protected onProjectCreated(event: Event): void {
    this.name = event.eventData.name;
    this.resourceOwner = event.eventData.resourceOwner;
    this.state = 'active';
  }

  /**
   * Handle project updated event
   */
  protected onProjectUpdated(event: Event): void {
    if (event.eventData.name) this.name = event.eventData.name;
  }

  /**
   * Handle project deactivated event
   */
  protected onProjectDeactivated(_event: Event): void {
    this.state = 'inactive';
  }
}
