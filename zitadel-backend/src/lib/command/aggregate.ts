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

    this.version = Number(event.aggregateVersion);
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
    if (!event.payload) return;
    this.username = event.payload.username;
    this.email = event.payload.email;
    this.firstName = event.payload.firstName;
    this.lastName = event.payload.lastName;
    this.state = 'active';
  }

  /**
   * Handle user updated event
   */
  protected onUserUpdated(event: Event): void {
    if (!event.payload) return;
    if (event.payload.email) this.email = event.payload.email;
    if (event.payload.firstName) this.firstName = event.payload.firstName;
    if (event.payload.lastName) this.lastName = event.payload.lastName;
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
    if (!event.payload) return;
    this.name = event.payload.name;
    this.domain = event.payload.domain;
    this.state = 'active';
  }

  /**
   * Handle organization updated event
   */
  protected onOrganizationUpdated(event: Event): void {
    if (!event.payload) return;
    if (event.payload.name) this.name = event.payload.name;
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
    if (!event.payload) return;
    this.name = event.payload.name;
    this.resourceOwner = event.payload.resourceOwner;
    this.state = 'active';
  }

  /**
   * Handle project updated event
   */
  protected onProjectUpdated(event: Event): void {
    if (!event.payload) return;
    if (event.payload.name) this.name = event.payload.name;
  }

  /**
   * Handle project deactivated event
   */
  protected onProjectDeactivated(_event: Event): void {
    this.state = 'inactive';
  }
}
