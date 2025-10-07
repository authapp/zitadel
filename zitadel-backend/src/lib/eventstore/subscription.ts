/**
 * Event Subscriptions for Real-Time Event Notifications
 * Based on Go implementation: internal/eventstore/subscription.go
 * 
 * Allows subscribing to events by aggregate type or specific event types
 * for building real-time features and reactive systems.
 */

import { Event } from './types';
import { EventEmitter } from 'events';

/**
 * Subscription to event stream
 * Provides async iteration over events
 */
export class Subscription {
  private emitter: EventEmitter;
  private buffer: Event[] = [];
  private closed = false;
  private resolvers: Array<(value: IteratorResult<Event>) => void> = [];

  constructor(
    private aggregateTypes: Map<string, string[]>,
    emitter: EventEmitter
  ) {
    this.emitter = emitter;
    this.setupListeners();
  }

  private setupListeners(): void {
    for (const [aggregateType, eventTypes] of this.aggregateTypes.entries()) {
      const handler = (event: Event) => {
        // Filter by event types if specified
        if (eventTypes.length > 0 && !eventTypes.includes(event.eventType)) {
          return;
        }

        // Add to buffer or resolve pending iterator
        if (this.resolvers.length > 0) {
          const resolve = this.resolvers.shift()!;
          resolve({ value: event, done: false });
        } else {
          this.buffer.push(event);
        }
      };

      this.emitter.on(`event:${aggregateType}`, handler);
    }
  }

  /**
   * Async iterator for consuming events
   */
  async *[Symbol.asyncIterator](): AsyncIterator<Event> {
    while (!this.closed) {
      // Return buffered events first
      if (this.buffer.length > 0) {
        yield this.buffer.shift()!;
        continue;
      }

      // Wait for next event
      const result = await new Promise<IteratorResult<Event>>((resolve) => {
        if (this.closed) {
          resolve({ value: undefined, done: true });
          return;
        }
        this.resolvers.push(resolve);
      });

      if (result.done) {
        break;
      }

      yield result.value;
    }
  }

  /**
   * Unsubscribe and stop receiving events
   */
  unsubscribe(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;

    // Remove all listeners for this subscription's aggregates
    for (const aggregateType of this.aggregateTypes.keys()) {
      this.emitter.removeAllListeners(`event:${aggregateType}`);
    }

    // Resolve pending iterators
    for (const resolve of this.resolvers) {
      resolve({ value: undefined, done: true });
    }
    this.resolvers = [];
    this.buffer = [];
  }

  /**
   * Check if subscription is still active
   */
  isActive(): boolean {
    return !this.closed;
  }

  /**
   * Get buffered event count
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
}

/**
 * Subscription manager for event notifications
 * Thread-safe subscription management
 */
export class SubscriptionManager {
  private emitter: EventEmitter;
  private subscriptions: Set<Subscription> = new Set();

  constructor() {
    this.emitter = new EventEmitter();
    // Increase max listeners to support many subscriptions
    this.emitter.setMaxListeners(1000);
  }

  /**
   * Subscribe to all events on specified aggregate types
   * 
   * @param aggregateTypes - Array of aggregate types to subscribe to
   * @returns Subscription instance
   * 
   * @example
   * const sub = manager.subscribeAggregates(['user', 'org']);
   * for await (const event of sub) {
   *   console.log('Event:', event);
   * }
   */
  subscribeAggregates(...aggregateTypes: string[]): Subscription {
    const types = new Map<string, string[]>();
    for (const aggregateType of aggregateTypes) {
      types.set(aggregateType, []); // Empty array = all events
    }

    const subscription = new Subscription(types, this.emitter);
    this.subscriptions.add(subscription);
    return subscription;
  }

  /**
   * Subscribe to specific event types on aggregate types
   * 
   * @param types - Map of aggregate types to event types
   * @returns Subscription instance
   * 
   * @example
   * const sub = manager.subscribeEventTypes(new Map([
   *   ['user', ['user.added', 'user.updated']],
   *   ['org', ['org.added']]
   * ]));
   */
  subscribeEventTypes(types: Map<string, string[]>): Subscription {
    const subscription = new Subscription(types, this.emitter);
    this.subscriptions.add(subscription);
    return subscription;
  }

  /**
   * Notify subscribers of new events
   * Called internally after events are pushed to eventstore
   * 
   * @param events - Events to notify about
   */
  notify(events: Event[]): void {
    for (const event of events) {
      // Emit event for aggregate type
      this.emitter.emit(`event:${event.aggregateType}`, event);
    }
  }

  /**
   * Get count of active subscriptions
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Close all subscriptions
   */
  closeAll(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions.clear();
    this.emitter.removeAllListeners();
  }

  /**
   * Remove inactive subscriptions
   */
  cleanup(): void {
    for (const subscription of this.subscriptions) {
      if (!subscription.isActive()) {
        this.subscriptions.delete(subscription);
      }
    }
  }
}

/**
 * Global subscription manager instance
 * Used by eventstore to notify subscribers
 */
export const globalSubscriptionManager = new SubscriptionManager();
