/**
 * Snowflake ID Generator
 * Based on Twitter's Snowflake algorithm, adapted for Zitadel
 *
 * Structure (64 bits):
 * - 41 bits: timestamp (milliseconds since custom epoch)
 * - 10 bits: machine/node ID
 * - 12 bits: sequence number
 *
 * This provides:
 * - Chronologically sortable IDs
 * - ~69 years of IDs from custom epoch
 * - Up to 1024 machines
 * - Up to 4096 IDs per millisecond per machine
 */

const EPOCH = 1609459200000; // 2021-01-01 00:00:00 UTC (Zitadel custom epoch)
const MACHINE_ID_BITS = 10;
const SEQUENCE_BITS = 12;
const MAX_MACHINE_ID = (1 << MACHINE_ID_BITS) - 1; // 1023
const MAX_SEQUENCE = (1 << SEQUENCE_BITS) - 1; // 4095
const MACHINE_ID_SHIFT = SEQUENCE_BITS;
const TIMESTAMP_SHIFT = SEQUENCE_BITS + MACHINE_ID_BITS;

export interface SnowflakeConfig {
  machineId?: number;
  epoch?: number;
}

export class SnowflakeGenerator {
  private readonly machineId: number;
  private readonly epoch: number;
  private sequence: number;
  private lastTimestamp: number;

  constructor(config: SnowflakeConfig = {}) {
    this.machineId = config.machineId ?? this.generateMachineId();
    this.epoch = config.epoch ?? EPOCH;
    this.sequence = 0;
    this.lastTimestamp = -1;

    if (this.machineId < 0 || this.machineId > MAX_MACHINE_ID) {
      throw new Error(`Machine ID must be between 0 and ${MAX_MACHINE_ID}`);
    }
  }

  /**
   * Generate machine ID based on hostname or random
   */
  private generateMachineId(): number {
    // In a distributed system, this should be:
    // - Read from environment variable
    // - Assigned by service discovery
    // - Derived from hostname hash
    // For now, use a random number
    return Math.floor(Math.random() * MAX_MACHINE_ID);
  }

  /**
   * Wait until next millisecond
   */
  private waitNextMillis(lastTimestamp: number): number {
    let timestamp = this.currentTimestamp();
    while (timestamp <= lastTimestamp) {
      timestamp = this.currentTimestamp();
    }
    return timestamp;
  }

  /**
   * Get current timestamp in milliseconds since epoch
   */
  private currentTimestamp(): number {
    return Date.now();
  }

  /**
   * Generate the next ID
   */
  generate(): string {
    let timestamp = this.currentTimestamp();

    // Check clock moved backwards
    if (timestamp < this.lastTimestamp) {
      throw new Error(
        `Clock moved backwards. Refusing to generate ID for ${this.lastTimestamp - timestamp}ms`,
      );
    }

    // Same millisecond - increment sequence
    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1) & MAX_SEQUENCE;

      // Sequence overflow - wait for next millisecond
      if (this.sequence === 0) {
        timestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      // New millisecond - reset sequence
      this.sequence = 0;
    }

    this.lastTimestamp = timestamp;

    // Construct the ID
    const timeDiff = BigInt(timestamp - this.epoch);
    const id =
      (timeDiff << BigInt(TIMESTAMP_SHIFT)) |
      (BigInt(this.machineId) << BigInt(MACHINE_ID_SHIFT)) |
      BigInt(this.sequence);

    return id.toString();
  }

  /**
   * Parse a snowflake ID to extract components
   */
  parse(id: string): {
    timestamp: Date;
    machineId: number;
    sequence: number;
  } {
    const bigId = BigInt(id);

    const timestamp = Number(bigId >> BigInt(TIMESTAMP_SHIFT));
    const machineId = Number((bigId >> BigInt(MACHINE_ID_SHIFT)) & BigInt(MAX_MACHINE_ID));
    const sequence = Number(bigId & BigInt(MAX_SEQUENCE));

    return {
      timestamp: new Date(timestamp + this.epoch),
      machineId,
      sequence,
    };
  }

  /**
   * Generate multiple IDs
   */
  generateBatch(count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(this.generate());
    }
    return ids;
  }
}

// Default global instance
let defaultGenerator: SnowflakeGenerator | null = null;

/**
 * Initialize the default generator
 */
export function initializeGenerator(config?: SnowflakeConfig): void {
  defaultGenerator = new SnowflakeGenerator(config);
}

/**
 * Generate an ID using the default generator
 */
export function generateId(): string {
  if (!defaultGenerator) {
    defaultGenerator = new SnowflakeGenerator();
  }
  return defaultGenerator.generate();
}

/**
 * Parse an ID using the default generator
 */
export function parseId(id: string): ReturnType<SnowflakeGenerator['parse']> {
  if (!defaultGenerator) {
    defaultGenerator = new SnowflakeGenerator();
  }
  return defaultGenerator.parse(id);
}
