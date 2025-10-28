/**
 * Projection Handler V2 - Production-Ready Implementation
 * 
 * Critical improvements based on Zitadel Go v2:
 * 1. Transaction-based processing with advisory locks
 * 2. SAVEPOINT rollback for individual events
 * 3. Exact deduplication (position + aggregate + sequence)
 * 4. Atomic position updates
 * 5. Continuous catch-up processing
 */

import { Projection } from './projection';
import { ProjectionHandlerConfig } from './projection-config';
import { FailedEventHandler } from './failed-events';
import { CurrentState } from './current-state';
import { Event, Eventstore } from '../../eventstore/types';
import { DatabasePool, QueryExecutor } from '../../database/pool';

/**
 * Projection handler state
 */
enum HandlerState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  CATCH_UP = 'catch_up',
  LIVE = 'live',
  STOPPING = 'stopping',
  ERROR = 'error',
}

/**
 * Projection handler manages event processing for a projection
 */
export class ProjectionHandler {
  private readonly projection: Projection;
  private readonly config: ProjectionHandlerConfig;
  private readonly eventstore: Eventstore;
  private readonly database: DatabasePool;
  private readonly failedEventHandler: FailedEventHandler;
  
  private state: HandlerState = HandlerState.STOPPED;
  private running: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  private errorCount: number = 0;
  private processingPromise: Promise<boolean> | null = null;

  constructor(
    projection: Projection,
    config: ProjectionHandlerConfig,
    eventstore: Eventstore,
    database: DatabasePool
  ) {
    this.projection = projection;
    this.config = config;
    this.eventstore = eventstore;
    this.database = database;
    this.failedEventHandler = new FailedEventHandler(database);
  }

  /**
   * Start the projection handler
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error(`Projection handler ${this.config.name} is already running`);
    }

    this.state = HandlerState.STARTING;
    this.running = true;

    try {
      // Initialize projection
      await this.projection.init();

      // Start projection
      await this.projection.start();

      // Rebuild if requested
      if (this.config.rebuildOnStart) {
        await this.projection.reset();
      }

      // Start processing loop
      this.startProcessingLoop();

      this.state = HandlerState.CATCH_UP;
    } catch (error) {
      this.state = HandlerState.ERROR;
      this.running = false;
      throw error;
    }
  }

  /**
   * Stop the projection handler
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.state = HandlerState.STOPPING;
    this.running = false;

    // Clear interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    // Wait for current processing to complete
    if (this.processingPromise) {
      try {
        await this.processingPromise;
      } catch (error) {
        // Ignore errors during shutdown
      }
    }

    // Stop projection
    await this.projection.stop();

    this.state = HandlerState.STOPPED;
  }

  /**
   * Get handler state
   */
  getState(): string {
    return this.state;
  }

  /**
   * Check if handler is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get error count
   */
  getErrorCount(): number {
    return this.errorCount;
  }

  /**
   * Start the processing loop with continuous catch-up support (Priority 2)
   */
  private startProcessingLoop() {
    this.processingInterval = setInterval(async () => {
      if (!this.running) {
        return;
      }

      // Skip if already processing
      if (this.processingPromise) {
        return;
      }

      try {
        // Continuous processing during catch-up (Zitadel Go v2 pattern)
        let shouldContinue = true;
        while (shouldContinue && this.running) {
          this.processingPromise = this.processEventsInTransaction();
          shouldContinue = await this.processingPromise;
          this.processingPromise = null;
          
          // If no more events or not in catch-up mode, stop continuous processing
          if (!shouldContinue || this.state === HandlerState.LIVE) {
            break;
          }
          
          // Small delay between batches to prevent CPU spinning
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      } catch (error) {
        this.processingPromise = null;
        this.errorCount++;
        console.error(`Error processing events for ${this.config.name}:`, error);
        
        // If too many errors, stop the handler
        if (this.errorCount >= 10) {
          console.error(`Too many errors for ${this.config.name}, stopping handler`);
          await this.stop();
        }
      }
    }, this.config.interval);
  }

  /**
   * Process events within a database transaction (Zitadel Go v2 pattern)
   * 
   * This method implements the critical atomicity guarantees:
   * 1. Entire batch processed in single transaction
   * 2. Advisory lock held for duration of transaction
   * 3. Individual event rollback via SAVEPOINT
   * 4. Single position update at end
   * 
   * @returns true if more events are available (continue immediately), false otherwise
   */
  private async processEventsInTransaction(): Promise<boolean> {
    return await this.database.withTransaction(async (tx) => {
      // Step 1: Acquire advisory lock (prevents concurrent processing)
      const locked = await this.acquireAdvisoryLock(tx);
      if (!locked) {
        // Another instance is processing, skip this iteration
        return false;
      }

      // Step 2: Get current state within transaction
      const currentState = await this.getCurrentStateInTx(tx);

      // Step 3: Fetch events from current position
      const events = await this.fetchEventsFromPosition(
        currentState.position,
        currentState.positionOffset
      );

      if (events.length === 0) {
        // No new events
        if (this.state === HandlerState.CATCH_UP) {
          this.state = HandlerState.LIVE;
        }
        return false;
      }

      // Step 4: Skip previously reduced events (exact deduplication)
      const eventsToProcess = this.skipProcessedEvents(events, currentState);

      if (eventsToProcess.length === 0) {
        // All events already processed
        return false;
      }

      // Step 5: Process each event with SAVEPOINT rollback
      let lastProcessedIndex = -1;
      let positionOffset = currentState.positionOffset;

      for (let i = 0; i < eventsToProcess.length; i++) {
        const event = eventsToProcess[i];

        try {
          // Create savepoint for this event
          await tx.query(`SAVEPOINT exec_stmt_${i}`);

          // Set transaction on projection for transaction-aware queries
          this.projection.setTransaction(tx);

          // Process event through projection's reduce method
          await this.projection.reduce(event);

          // Clear transaction from projection
          this.projection.setTransaction(undefined);

          // Update state tracking
          currentState.position = event.position.position;
          currentState.aggregateID = event.aggregateID;
          currentState.aggregateType = event.aggregateType;
          currentState.sequence = Number(event.aggregateVersion);
          currentState.eventTimestamp = event.createdAt;
          currentState.instanceID = this.config.instanceID || undefined;

          // Use inTxOrder from event as position offset
          positionOffset = event.position.inTxOrder;
          currentState.positionOffset = positionOffset;

          lastProcessedIndex = i;

          // Remove from failed events if it was there
          try {
            await this.failedEventHandler.removeFailedEventByPosition(
              this.config.name,
              event.position.position
            );
          } catch (err) {
            // Ignore errors from failed event cleanup
          }

        } catch (error) {
          // Clear transaction from projection
          this.projection.setTransaction(undefined);

          // Rollback to savepoint (partial rollback)
          await tx.query(`ROLLBACK TO SAVEPOINT exec_stmt_${i}`);

          // Record failed event
          await this.recordFailedEventInTx(tx, event, error as Error);

          // Continue processing next event (Zitadel Go v2 behavior)
          console.error(`Event ${event.position.position} failed, continuing with next event:`, error);
        }
      }

      // Step 6: Update position once at end (atomic)
      if (lastProcessedIndex >= 0) {
        await this.setStateInTx(tx, currentState);
      }

      // Return true if fetched full batch (more events likely available)
      // Priority 2: Enables continuous catch-up without waiting between batches
      const shouldContinue = events.length === this.config.batchSize;
      return shouldContinue;
    });
  }

  /**
   * Acquire PostgreSQL advisory lock within transaction
   * Returns true if lock acquired, false if already locked by another process
   */
  private async acquireAdvisoryLock(tx: QueryExecutor): Promise<boolean> {
    const result = await tx.query(
      `SELECT pg_try_advisory_xact_lock(hashtext($1), hashtext($2))`,
      [this.config.name, this.config.instanceID || '']
    );

    return result.rows[0]?.pg_try_advisory_xact_lock === true;
  }

  /**
   * Get current state within transaction
   */
  private async getCurrentStateInTx(tx: QueryExecutor): Promise<CurrentState> {
    const result = await tx.query(
      `SELECT 
        name as "projectionName",
        position,
        position_offset as "positionOffset",
        event_timestamp as "eventTimestamp",
        updated_at as "lastUpdated",
        instance_id as "instanceID",
        aggregate_type as "aggregateType",
        aggregate_id as "aggregateID",
        sequence
      FROM projections.projection_states
      WHERE name = $1`,
      [this.config.name]
    );

    if (result.rows.length === 0) {
      // Initialize default state
      return {
        projectionName: this.config.name,
        position: 0,
        positionOffset: 0,
        eventTimestamp: new Date(),
        lastUpdated: new Date(),
        instanceID: this.config.instanceID || '',
        aggregateType: '',
        aggregateID: '',
        sequence: 0,
      };
    }

    return result.rows[0] as CurrentState;
  }

  /**
   * Set state within transaction
   */
  private async setStateInTx(tx: QueryExecutor, state: CurrentState): Promise<void> {
    await tx.query(
      `INSERT INTO projections.projection_states (
        name,
        position,
        position_offset,
        event_timestamp,
        updated_at,
        instance_id,
        aggregate_type,
        aggregate_id,
        sequence
      ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8)
      ON CONFLICT (name)
      DO UPDATE SET
        position = EXCLUDED.position,
        position_offset = EXCLUDED.position_offset,
        event_timestamp = EXCLUDED.event_timestamp,
        updated_at = NOW(),
        instance_id = EXCLUDED.instance_id,
        aggregate_type = EXCLUDED.aggregate_type,
        aggregate_id = EXCLUDED.aggregate_id,
        sequence = EXCLUDED.sequence`,
      [
        state.projectionName,
        state.position,
        state.positionOffset,
        state.eventTimestamp,
        state.instanceID,
        state.aggregateType,
        state.aggregateID,
        state.sequence,
      ]
    );
  }

  /**
   * Fetch events from position with offset (Zitadel Go v2 pattern)
   */
  private async fetchEventsFromPosition(
    fromPosition: number,
    offset: number
  ): Promise<Event[]> {
    try {
      // Zitadel Go v2 pattern: Use eventsAfterPosition for exclusive (>) filtering
      // SQL: position > $1 OR (position = $1 AND in_tx_order > $2)
      // This ensures we don't reprocess the event we just completed
      const allEvents = await this.eventstore.eventsAfterPosition(
        { position: fromPosition, inTxOrder: offset },
        this.config.batchSize
      );

      // Apply projection-specific filters (aggregate types and event types)
      let filteredEvents = allEvents;
      
      if (this.config.aggregateTypes.length > 0) {
        filteredEvents = filteredEvents.filter(e => 
          this.config.aggregateTypes.includes(e.aggregateType)
        );
      }
      
      if (this.config.eventTypes.length > 0) {
        filteredEvents = filteredEvents.filter(e => 
          this.config.eventTypes.includes(e.eventType)
        );
      }
      
      return filteredEvents;
    } catch (error) {
      console.error(`Error fetching events for ${this.config.name}:`, error);
      return [];
    }
  }

  /**
   * Skip previously processed events (exact deduplication)
   * 
   * Zitadel Go v2 pattern: Match position + aggregateID + aggregateType + sequence
   * to find exact last processed event, then skip it
   */
  private skipProcessedEvents(events: Event[], currentState: CurrentState): Event[] {
    if (currentState.position === 0 || currentState.aggregateID === '') {
      // No previous state, process all events
      return events;
    }

    // Find exact match of last processed event
    let startIndex = -1;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (
        e.position.position === currentState.position &&
        e.aggregateID === currentState.aggregateID &&
        e.aggregateType === currentState.aggregateType &&
        Number(e.aggregateVersion) === currentState.sequence
      ) {
        startIndex = i;
        break;
      }
    }

    // Return events after the match
    return startIndex >= 0 ? events.slice(startIndex + 1) : events;
  }

  /**
   * Record failed event in transaction for retry
   */
  private async recordFailedEventInTx(
    tx: any,
    event: Event,
    error: Error
  ): Promise<void> {
    // Convert position to bigint (multiply by 1000000 to preserve microsecond precision)
    const failedSequence = Math.floor(event.position.position * 1000000);
    const eventID = `${this.config.name}:${failedSequence}`;

    // Check if this event has failed before
    const existing = await tx.query(
      `SELECT failure_count FROM projections.projection_failed_events 
       WHERE projection_name = $1 AND failed_sequence = $2`,
      [this.config.name, failedSequence]
    );

    if (existing.rows.length > 0) {
      // Increment failure count
      await tx.query(
        `UPDATE projections.projection_failed_events 
         SET failure_count = failure_count + 1,
             error = $1,
             last_failed = NOW()
         WHERE projection_name = $2 AND failed_sequence = $3`,
        [error.message, this.config.name, failedSequence]
      );
    } else {
      // Insert new failed event
      await tx.query(
        `INSERT INTO projections.projection_failed_events (
          id, projection_name, failed_sequence, failure_count, error, 
          event_data, last_failed, instance_id
        ) VALUES ($1, $2, $3, 1, $4, $5, NOW(), $6)`,
        [
          eventID,
          this.config.name,
          failedSequence,
          error.message,
          JSON.stringify(event, (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
          this.config.instanceID || '',
        ]
      );
    }
  }

}
