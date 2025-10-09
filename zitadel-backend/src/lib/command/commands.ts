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
  constructor(
    private eventstore: Eventstore,
    private cache: Cache,
    private staticStorage: Storage,
    private idGenerator: IDGenerator,
    private config: CommandsConfig
  ) {}
  
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
   * Health check
   */
  async health(): Promise<boolean> {
    try {
      return await this.eventstore.health();
    } catch {
      return false;
    }
  }
  
  // User commands will be added here
  // Organization commands will be added here
  // Project commands will be added here
  // etc.
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
