/**
 * Repository implementation for aggregates
 */

import { Eventstore } from '../eventstore/types';
import { AggregateRoot, Repository, AggregateNotFoundError } from './types';

/**
 * Generic repository for aggregate roots
 */
export class AggregateRepository<T extends AggregateRoot> implements Repository<T> {
  constructor(
    private eventstore: Eventstore,
    private aggregateFactory: (id: string) => T
  ) {}

  /**
   * Load an aggregate by ID
   */
  async load(id: string): Promise<T | null> {
    // Get aggregate type from factory
    const aggregate = this.aggregateFactory(id);
    const aggregateType = aggregate.type;

    // Load events from eventstore
    const events = await this.eventstore.query({
      aggregateIDs: [id],
      aggregateTypes: [aggregateType],
    });

    if (events.length === 0) {
      return null;
    }

    // Reconstruct aggregate from events
    aggregate.loadFromHistory(events);

    return aggregate;
  }

  /**
   * Check if aggregate exists
   */
  async exists(id: string): Promise<boolean> {
    const aggregate = await this.load(id);
    return aggregate !== null;
  }

  /**
   * Load or throw if not found
   */
  async loadOrThrow(id: string): Promise<T> {
    const aggregate = await this.load(id);
    
    if (!aggregate) {
      const tempAggregate = this.aggregateFactory(id);
      throw new AggregateNotFoundError(id, tempAggregate.type);
    }

    return aggregate;
  }
}

/**
 * Create a repository for a specific aggregate type
 */
export function createRepository<T extends AggregateRoot>(
  eventstore: Eventstore,
  aggregateFactory: (id: string) => T
): Repository<T> {
  return new AggregateRepository(eventstore, aggregateFactory);
}
