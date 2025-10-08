/**
 * Event Mappers & Interceptors
 * Based on Go implementation: internal/eventstore/eventstore.go:45-62
 * 
 * Allows transforming events during retrieval for:
 * - Event versioning
 * - Schema migration
 * - Legacy event handling
 * - Adding computed fields
 */

import { Event } from './types';

/**
 * Event mapper function type
 * Transforms an event before returning it from queries
 */
export type EventMapper = (event: Event) => Event;

/**
 * Event interceptor function type
 * Can observe or modify events, return false to filter out
 */
export type EventInterceptor = (event: Event) => Event | null;

/**
 * Registry for event mappers and interceptors
 */
export class EventMapperRegistry {
  private eventTypeMappers = new Map<string, EventMapper[]>();
  private aggregateTypeMappers = new Map<string, EventMapper[]>();
  private globalMappers: EventMapper[] = [];
  private interceptors: EventInterceptor[] = [];

  /**
   * Register a mapper for a specific event type
   * Multiple mappers can be registered for the same type (executed in order)
   */
  registerEventTypeMapper(eventType: string, mapper: EventMapper): void {
    const mappers = this.eventTypeMappers.get(eventType) || [];
    mappers.push(mapper);
    this.eventTypeMappers.set(eventType, mappers);
  }

  /**
   * Register a mapper for all events of a specific aggregate type
   */
  registerAggregateTypeMapper(aggregateType: string, mapper: EventMapper): void {
    const mappers = this.aggregateTypeMappers.get(aggregateType) || [];
    mappers.push(mapper);
    this.aggregateTypeMappers.set(aggregateType, mappers);
  }

  /**
   * Register a global mapper that applies to all events
   */
  registerGlobalMapper(mapper: EventMapper): void {
    this.globalMappers.push(mapper);
  }

  /**
   * Register an interceptor that can filter or modify events
   * Interceptors run before mappers
   */
  registerInterceptor(interceptor: EventInterceptor): void {
    this.interceptors.push(interceptor);
  }

  /**
   * Apply all registered mappers and interceptors to an event
   * Returns null if event is filtered out by an interceptor
   */
  applyMappers(event: Event): Event | null {
    let mappedEvent = event;

    // First apply interceptors (can filter out events)
    for (const interceptor of this.interceptors) {
      const result = interceptor(mappedEvent);
      if (result === null) {
        return null; // Event filtered out
      }
      mappedEvent = result;
    }

    // Apply global mappers
    for (const mapper of this.globalMappers) {
      mappedEvent = mapper(mappedEvent);
    }

    // Apply aggregate type mappers
    const aggregateMappers = this.aggregateTypeMappers.get(mappedEvent.aggregateType) || [];
    for (const mapper of aggregateMappers) {
      mappedEvent = mapper(mappedEvent);
    }

    // Apply event type mappers
    const eventMappers = this.eventTypeMappers.get(mappedEvent.eventType) || [];
    for (const mapper of eventMappers) {
      mappedEvent = mapper(mappedEvent);
    }

    return mappedEvent;
  }

  /**
   * Apply mappers to an array of events
   * Filters out events that return null from interceptors
   */
  applyMappersToArray(events: Event[]): Event[] {
    const mapped: Event[] = [];
    
    for (const event of events) {
      const result = this.applyMappers(event);
      if (result !== null) {
        mapped.push(result);
      }
    }
    
    return mapped;
  }

  /**
   * Clear all registered mappers and interceptors
   */
  clear(): void {
    this.eventTypeMappers.clear();
    this.aggregateTypeMappers.clear();
    this.globalMappers = [];
    this.interceptors = [];
  }

  /**
   * Get count of registered mappers
   */
  getStats(): {
    eventTypeMappers: number;
    aggregateTypeMappers: number;
    globalMappers: number;
    interceptors: number;
  } {
    let eventTypeCount = 0;
    for (const mappers of this.eventTypeMappers.values()) {
      eventTypeCount += mappers.length;
    }

    let aggregateTypeCount = 0;
    for (const mappers of this.aggregateTypeMappers.values()) {
      aggregateTypeCount += mappers.length;
    }

    return {
      eventTypeMappers: eventTypeCount,
      aggregateTypeMappers: aggregateTypeCount,
      globalMappers: this.globalMappers.length,
      interceptors: this.interceptors.length,
    };
  }
}

/**
 * Global event mapper registry
 * Can be used by eventstore implementations
 */
export const globalEventMapperRegistry = new EventMapperRegistry();

/**
 * Built-in mapper: Add computed display name from payload
 */
export const addDisplayNameMapper: EventMapper = (event) => {
  if (event.eventType === 'user.created' && event.payload) {
    const { firstName, lastName, email, username } = event.payload as any;
    
    if (!event.payload.displayName) {
      let displayName = '';
      if (firstName && lastName) {
        displayName = `${firstName} ${lastName}`;
      } else if (email) {
        displayName = email;
      } else if (username) {
        displayName = username;
      }

      return {
        ...event,
        payload: {
          ...event.payload,
          displayName,
        },
      };
    }
  }
  
  return event;
};

/**
 * Built-in mapper: Migrate old schema to new schema
 * Example: eventData → payload
 */
export const migrateSchemaMapper: EventMapper = (event) => {
  // If event has old schema, migrate it
  const anyEvent = event as any;
  
  if (anyEvent.eventData && !event.payload) {
    return {
      ...event,
      payload: anyEvent.eventData,
    };
  }

  if (anyEvent.editorUser && !event.creator) {
    return {
      ...event,
      creator: anyEvent.editorUser,
    };
  }

  if (anyEvent.resourceOwner && !event.owner) {
    return {
      ...event,
      owner: anyEvent.resourceOwner,
    };
  }

  return event;
};

/**
 * Built-in interceptor: Filter out deleted events
 */
export const filterDeletedEventsInterceptor: EventInterceptor = (event) => {
  if (event.eventType.endsWith('.deleted')) {
    return null; // Filter out
  }
  return event;
};

/**
 * Built-in interceptor: Filter by instance ID
 */
export function createInstanceFilterInterceptor(instanceID: string): EventInterceptor {
  return (event) => {
    if (event.instanceID !== instanceID) {
      return null; // Filter out
    }
    return event;
  };
}

/**
 * Built-in mapper: Add metadata
 */
export function createMetadataMapper(metadata: Record<string, any>): EventMapper {
  return (event) => {
    return {
      ...event,
      payload: {
        ...event.payload,
        _metadata: {
          ...metadata,
          _processedAt: new Date(),
        },
      },
    };
  };
}

/**
 * Built-in mapper: Event versioning
 * Upgrades old event versions to current version
 */
export function createVersionUpgradeMapper(
  eventType: string,
  fromVersion: number,
  toVersion: number,
  upgrader: (payload: any) => any
): EventMapper {
  return (event) => {
    if (event.eventType === eventType) {
      const version = (event.payload as any)?._version || 1;
      
      if (version === fromVersion) {
        return {
          ...event,
          payload: {
            ...upgrader(event.payload),
            _version: toVersion,
          },
        };
      }
    }
    
    return event;
  };
}
