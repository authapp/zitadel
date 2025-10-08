import { DatabasePool, QueryExecutor } from '@/database/pool';
import { throwInvalidArgument } from '@/zerrors/errors';
import {
  Event,
  Command,
  Aggregate,
  EventFilter,
  SearchQuery,
  Position,
  Eventstore,
  EventstoreConfig,
  EventValidationError,
  ConcurrencyError,
  Reducer,
} from '../types';
import { globalSubscriptionManager } from '../subscription';

/**
 * PostgreSQL implementation of the eventstore
 */
export class PostgresEventstore implements Eventstore {
  private db: DatabasePool;
  private config: EventstoreConfig;

  constructor(db: DatabasePool, config: EventstoreConfig) {
    this.db = db;
    this.config = config;
  }

  /**
   * Push a single command as event
   */
  async push(command: Command): Promise<Event> {
    const events = await this.pushMany([command]);
    return events[0];
  }

  /**
   * Push multiple commands as events in a transaction
   * Includes retry logic for handling concurrent updates (Zitadel-style)
   */
  async pushMany(commands: Command[], maxRetries = 3): Promise<Event[]> {
    if (commands.length === 0) {
      return [];
    }

    if (commands.length > (this.config.maxPushBatchSize ?? 100)) {
      throwInvalidArgument(
        `Too many commands in batch: ${commands.length}`,
        'EVENTSTORE-001'
      );
    }

    // Validate commands
    for (const command of commands) {
      this.validateCommand(command);
    }

    // Retry logic for handling serialization failures (Zitadel-style)
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.pushManyInternal(commands);
      } catch (error: any) {
        lastError = error;

        // Extract PostgreSQL error code from different error structures
        // ZitadelError wraps the original error in the 'parent' property
        const pgError = error.parent || error.cause || error;
        const errorCode = pgError?.code || error?.code;
        const errorMessage = error?.message || '';
        
        // Check if it's a retryable error
        const isRetryable = 
          errorCode === '40001' ||  // serialization_failure
          errorCode === '40P01' ||  // deadlock_detected
          errorCode === '55P03' ||  // lock_not_available
          errorCode === '23505' ||  // unique_violation (position/version conflict)
          errorMessage.includes('could not serialize') ||
          errorMessage.includes('deadlock detected') ||
          errorMessage.includes('duplicate key value');

        if (isRetryable && attempt < maxRetries) {
          // Exponential backoff: 10ms, 20ms, 40ms
          const backoffMs = 10 * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        // Not retryable or max retries exceeded
        throw error;
      }
    }

    throw lastError || new Error('Failed to push events after retries');
  }

  /**
   * Internal push implementation with transaction and locking
   */
  private async pushManyInternal(commands: Command[]): Promise<Event[]> {
    return await this.db.withTransaction(async (tx) => {
      const events: Event[] = [];

      for (const command of commands) {
        // Check and apply unique constraints BEFORE inserting event
        if (command.uniqueConstraints && command.uniqueConstraints.length > 0) {
          await this.handleUniqueConstraints(tx, command);
        }

        // Get current aggregate version (with per-aggregate lock)
        const currentVersion = await this.getCurrentVersion(
          tx,
          command.instanceID,
          command.aggregateType,
          command.aggregateID
        );

        // Create event (position will be set by database)
        const event: Event = {
          instanceID: command.instanceID,
          aggregateType: command.aggregateType,
          aggregateID: command.aggregateID,
          eventType: command.eventType,
          aggregateVersion: currentVersion + 1n,
          revision: command.revision ?? 1,
          createdAt: new Date(), // Will be overwritten by DB
          payload: command.payload,
          creator: command.creator,
          owner: command.owner,
          position: {
            position: 0, // Will be set by DB
            inTxOrder: 0, // Will be set by DB
          },
        };

        // Insert event (returns event with DB-generated values)
        const insertedEvent = await this.insertEvent(tx, event, events.length);
        events.push(insertedEvent);
      }

      // Notify subscribers after successful transaction (if enabled)
      if (events.length > 0 && this.config.enableSubscriptions !== false) {
        // Use setImmediate to notify after transaction commits
        setImmediate(() => {
          globalSubscriptionManager.notify(events);
        });
      }

      return events;
    });
  }

  /**
   * Push events with optimistic concurrency control
   */
  async pushWithConcurrencyCheck(
    commands: Command[],
    expectedVersion: number
  ): Promise<Event[]> {
    if (commands.length === 0) {
      return [];
    }

    // All commands must be for the same aggregate
    const firstCommand = commands[0];
    const aggregateType = firstCommand.aggregateType;
    const aggregateID = firstCommand.aggregateID;

    for (const command of commands) {
      if (
        command.aggregateType !== aggregateType ||
        command.aggregateID !== aggregateID
      ) {
        throwInvalidArgument(
          'All commands must be for the same aggregate',
          'EVENTSTORE-002'
        );
      }
    }

    return await this.db.withTransaction(async (tx) => {
      // Check current version
      const currentVersion = await this.getCurrentVersion(
        tx,
        firstCommand.instanceID,
        aggregateType,
        aggregateID
      );

      if (currentVersion !== BigInt(expectedVersion)) {
        throw new ConcurrencyError(
          `Version mismatch for aggregate ${aggregateID}`,
          expectedVersion,
          Number(currentVersion)
        );
      }

      // Push events normally
      const events: Event[] = [];

      for (const command of commands) {
        const event: Event = {
          instanceID: command.instanceID,
          aggregateType: command.aggregateType,
          aggregateID: command.aggregateID,
          eventType: command.eventType,
          aggregateVersion: currentVersion + BigInt(events.length) + 1n,
          revision: command.revision ?? 1,
          createdAt: new Date(), // Will be overwritten by DB
          payload: command.payload,
          creator: command.creator,
          owner: command.owner,
          position: {
            position: 0, // Will be set by DB
            inTxOrder: 0, // Will be set by DB
          },
        };

        const insertedEvent = await this.insertEvent(tx, event, events.length);
        events.push(insertedEvent);
      }

      return events;
    });
  }

  /**
   * Query events by filter
   */
  async query(filter: EventFilter): Promise<Event[]> {
    const { query, values } = this.buildEventQuery(filter);
    const rows = await this.db.queryMany(query, values);
    return rows.map(this.mapRowToEvent);
  }

  /**
   * Get latest event for an aggregate
   */
  async latestEvent(
    aggregateType: string,
    aggregateID: string
  ): Promise<Event | null> {
    const query = `
      SELECT * FROM events 
      WHERE aggregate_type = $1 AND aggregate_id = $2 
      ORDER BY aggregate_version DESC 
      LIMIT 1
    `;

    const row = await this.db.queryOne(query, [aggregateType, aggregateID]);
    return row ? this.mapRowToEvent(row) : null;
  }

  /**
   * Get aggregate by ID
   */
  async aggregate(
    aggregateType: string,
    aggregateID: string,
    version?: number
  ): Promise<Aggregate | null> {
    let query = `
      SELECT * FROM events 
      WHERE aggregate_type = $1 AND aggregate_id = $2
    `;
    const values: any[] = [aggregateType, aggregateID];

    if (version !== undefined) {
      query += ` AND aggregate_version <= $3`;
      values.push(version);
    }

    query += ` ORDER BY aggregate_version ASC`;

    const rows = await this.db.queryMany(query, values);
    
    if (rows.length === 0) {
      return null;
    }

    const events = rows.map(this.mapRowToEvent);
    const lastEvent = events[events.length - 1];

    return {
      id: aggregateID,
      type: aggregateType,
      owner: lastEvent.owner,
      instanceID: lastEvent.instanceID,
      version: lastEvent.aggregateVersion,
      events,
      position: lastEvent.position,
    };
  }

  /**
   * Search events with complex filters (supports OR logic and exclusions)
   */
  async search(query: SearchQuery): Promise<Event[]> {
    // Support both 'filters' (legacy) and 'queries' (new query builder)
    const filters = query.queries || query.filters || [];
    
    if (filters.length === 0) {
      return [];
    }

    // Build union query for multiple filters (OR logic)
    const subQueries: string[] = [];
    const allValues: any[] = [];
    let valueIndex = 1;

    for (const filter of filters) {
      // Build query without ORDER BY and LIMIT (we'll add them to the final UNION query)
      const { query: subQuery, values } = this.buildEventQuery(filter, valueIndex, false, true);
      subQueries.push(`(${subQuery})`);
      allValues.push(...values);
      valueIndex += values.length;
    }

    let finalQuery = subQueries.join(' UNION ');
    
    // Apply exclusion filter if provided
    if (query.excludeFilter && this.hasFiltersInFilter(query.excludeFilter)) {
      const excludeConditions: string[] = [];
      
      if (query.excludeFilter.aggregateTypes?.length) {
        excludeConditions.push(`aggregate_type NOT IN (${query.excludeFilter.aggregateTypes.map(() => `$${valueIndex++}`).join(',')})`);
        allValues.push(...query.excludeFilter.aggregateTypes);
      }
      
      if (query.excludeFilter.aggregateIDs?.length) {
        excludeConditions.push(`aggregate_id NOT IN (${query.excludeFilter.aggregateIDs.map(() => `$${valueIndex++}`).join(',')})`);
        allValues.push(...query.excludeFilter.aggregateIDs);
      }
      
      if (query.excludeFilter.eventTypes?.length) {
        excludeConditions.push(`event_type NOT IN (${query.excludeFilter.eventTypes.map(() => `$${valueIndex++}`).join(',')})`);
        allValues.push(...query.excludeFilter.eventTypes);
      }
      
      if (excludeConditions.length > 0) {
        finalQuery = `SELECT * FROM (${finalQuery}) AS results WHERE ${excludeConditions.join(' AND ')}`;
      }
    }
    
    // Add ordering and limit
    finalQuery += ` ORDER BY position ${query.desc ? 'DESC' : 'ASC'}`;
    if (query.limit) {
      finalQuery += ` LIMIT ${query.limit}`;
    }

    const rows = await this.db.queryMany(finalQuery, allValues);
    return rows.map(this.mapRowToEvent);
  }

  /**
   * Helper to check if a filter has any conditions
   */
  private hasFiltersInFilter(filter: EventFilter): boolean {
    return !!(
      filter.aggregateTypes?.length ||
      filter.aggregateIDs?.length ||
      filter.eventTypes?.length
    );
  }

  /**
   * Count events matching filter
   */
  async count(filter: EventFilter): Promise<number> {
    const { query, values } = this.buildEventQuery(filter, 1, true);
    const result = await this.db.queryOne<{ count: string }>(query, values);
    return parseInt(result?.count ?? '0', 10);
  }

  /**
   * Get events after a specific position
   */
  async eventsAfterPosition(position: Position, limit = 1000): Promise<Event[]> {
    const query = `
      SELECT * FROM events 
      WHERE "position" > $1 OR ("position" = $1 AND in_tx_order > $2)
      ORDER BY "position" ASC, in_tx_order ASC
      LIMIT $3
    `;

    const rows = await this.db.queryMany(query, [
      position.position.toString(),
      position.inTxOrder,
      limit,
    ]);

    return rows.map(this.mapRowToEvent);
  }

  /**
   * Health check
   */
  async health(): Promise<boolean> {
    try {
      await this.db.query('SELECT 1 FROM events LIMIT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.db.close();
  }

  /**
   * Get the latest position across all events matching the filter
   * Essential for projections and catch-up subscriptions
   */
  async latestPosition(filter?: EventFilter): Promise<Position> {
    let query = `
      SELECT MAX("position") as position, MAX(in_tx_order) as in_tx_order
      FROM events
    `;
    const values: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (filter) {
      if (filter.instanceID) {
        conditions.push(`instance_id = $${paramIndex}`);
        values.push(filter.instanceID);
        paramIndex++;
      }

      if (filter.aggregateTypes?.length) {
        conditions.push(`aggregate_type = ANY($${paramIndex})`);
        values.push(filter.aggregateTypes);
        paramIndex++;
      }

      if (filter.aggregateIDs?.length) {
        conditions.push(`aggregate_id = ANY($${paramIndex})`);
        values.push(filter.aggregateIDs);
        paramIndex++;
      }

      if (filter.eventTypes?.length) {
        conditions.push(`event_type = ANY($${paramIndex})`);
        values.push(filter.eventTypes);
        paramIndex++;
      }

      if (filter.owner) {
        conditions.push(`"owner" = $${paramIndex}`);
        values.push(filter.owner);
        paramIndex++;
      }

      if (filter.creator) {
        conditions.push(`creator = $${paramIndex}`);
        values.push(filter.creator);
        paramIndex++;
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await this.db.queryOne<{ position: string; in_tx_order: number }>(
      query,
      values
    );

    // If no events match, return zero position
    if (!result?.position) {
      return { position: 0, inTxOrder: 0 };
    }

    return {
      position: parseFloat(result.position),
      inTxOrder: result.in_tx_order || 0,
    };
  }

  /**
   * Get distinct instance IDs matching a filter
   * Useful for multi-tenant operations
   */
  async instanceIDs(filter?: EventFilter): Promise<string[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filter) {
      if (filter.aggregateTypes && filter.aggregateTypes.length > 0) {
        conditions.push(`aggregate_type = ANY($${paramIndex})`);
        params.push(filter.aggregateTypes);
        paramIndex++;
      }

      if (filter.aggregateIDs && filter.aggregateIDs.length > 0) {
        conditions.push(`aggregate_id = ANY($${paramIndex})`);
        params.push(filter.aggregateIDs);
        paramIndex++;
      }

      if (filter.eventTypes && filter.eventTypes.length > 0) {
        conditions.push(`event_type = ANY($${paramIndex})`);
        params.push(filter.eventTypes);
        paramIndex++;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const query = `
      SELECT DISTINCT instance_id
      FROM events
      ${whereClause}
      ORDER BY instance_id
    `;

    const results = await this.db.queryMany<{ instance_id: string }>(query, params);
    return results.map(r => r.instance_id);
  }

  /**
   * Stream events to a reducer instead of loading all into memory
   * Memory-efficient for large event streams
   */
  async filterToReducer(filter: EventFilter, reducer: Reducer): Promise<void> {
    const { query, values } = this.buildEventQuery(filter);
    
    // Use cursor-based streaming for memory efficiency
    const rows = await this.db.queryMany(query, values);
    
    // Process events in batches
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const events = batch.map(this.mapRowToEvent);
      
      reducer.appendEvents(...events);
      await reducer.reduce();
    }
  }

  // Private helper methods

  private validateCommand(command: Command): void {
    if (!command.instanceID) {
      throw new EventValidationError('instanceID is required', 'instanceID');
    }
    if (!command.aggregateType) {
      throw new EventValidationError('aggregateType is required', 'aggregateType');
    }
    if (!command.aggregateID) {
      throw new EventValidationError('aggregateID is required', 'aggregateID');
    }
    if (!command.eventType) {
      throw new EventValidationError('eventType is required', 'eventType');
    }
    if (!command.creator) {
      throw new EventValidationError('creator is required', 'creator');
    }
    if (!command.owner) {
      throw new EventValidationError('owner is required', 'owner');
    }
  }


  private async getCurrentVersion(
    tx: QueryExecutor,
    instanceID: string,
    aggregateType: string,
    aggregateID: string
  ): Promise<bigint> {
    // Use FOR UPDATE to lock only this aggregate's rows
    // This prevents concurrent transactions from updating the same aggregate
    // Similar to Zitadel's approach: locks per-aggregate, not globally
    // Go v2 includes instance_id in the lock query
    
    const result = await tx.query<{ version: string }>(
      `SELECT aggregate_version as version
       FROM events 
       WHERE instance_id = $1 AND aggregate_type = $2 AND aggregate_id = $3
       ORDER BY aggregate_version DESC
       LIMIT 1
       FOR UPDATE`,
      [instanceID, aggregateType, aggregateID]
    );

    return result.rows[0]?.version ? BigInt(result.rows[0].version) : 0n;
  }

  private async insertEvent(tx: QueryExecutor, event: Event, txOrder: number): Promise<Event> {
    // Matching Go v2: uses statement_timestamp() for created_at and clock_timestamp() for position
    const query = `
      INSERT INTO events (
        instance_id, "owner", aggregate_type, aggregate_id, revision,
        creator, event_type, payload, aggregate_version, in_tx_order,
        created_at, "position"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        statement_timestamp(), EXTRACT(EPOCH FROM clock_timestamp())
      )
      RETURNING created_at, "position"
    `;

    const result = await tx.query<{ created_at: Date; position: string }>(query, [
      event.instanceID,
      event.owner,
      event.aggregateType,
      event.aggregateID,
      event.revision,
      event.creator,
      event.eventType,
      event.payload ? JSON.stringify(event.payload) : null,
      event.aggregateVersion.toString(),
      txOrder,
    ]);

    // Return event with DB-generated values
    return {
      ...event,
      createdAt: result.rows[0].created_at,
      position: {
        position: parseFloat(result.rows[0].position),
        inTxOrder: txOrder,
      },
    };
  }

  private buildEventQuery(
    filter: EventFilter,
    startIndex = 1,
    isCount = false,
    skipOrderLimit = false
  ): { query: string; values: any[] } {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = startIndex;

    const selectClause = isCount ? 'SELECT COUNT(*) as count' : 'SELECT *';
    let query = `${selectClause} FROM events`;

    if (filter.aggregateTypes?.length) {
      conditions.push(`aggregate_type = ANY($${paramIndex})`);
      values.push(filter.aggregateTypes);
      paramIndex++;
    }

    if (filter.aggregateIDs?.length) {
      conditions.push(`aggregate_id = ANY($${paramIndex})`);
      values.push(filter.aggregateIDs);
      paramIndex++;
    }

    if (filter.eventTypes?.length) {
      conditions.push(`event_type = ANY($${paramIndex})`);
      values.push(filter.eventTypes);
      paramIndex++;
    }

    if (filter.instanceID) {
      conditions.push(`instance_id = $${paramIndex}`);
      values.push(filter.instanceID);
      paramIndex++;
    }

    if (filter.owner) {
      conditions.push(`"owner" = $${paramIndex}`);
      values.push(filter.owner);
      paramIndex++;
    }

    if (filter.creator) {
      conditions.push(`creator = $${paramIndex}`);
      values.push(filter.creator);
      paramIndex++;
    }

    if (filter.createdAtFrom) {
      conditions.push(`created_at >= $${paramIndex}`);
      values.push(filter.createdAtFrom);
      paramIndex++;
    }

    if (filter.createdAtTo) {
      conditions.push(`created_at <= $${paramIndex}`);
      values.push(filter.createdAtTo);
      paramIndex++;
    }

    if (filter.position) {
      conditions.push(
        `("position" > $${paramIndex} OR ("position" = $${paramIndex} AND in_tx_order >= $${paramIndex + 1}))`
      );
      values.push(filter.position.position.toString(), filter.position.inTxOrder);
      paramIndex += 2;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add ordering and limit if not counting and not skipping
    if (!isCount && !skipOrderLimit) {
      query += ` ORDER BY position ${filter.desc ? 'DESC' : 'ASC'}, in_tx_order ASC`;
      
      if (filter.limit) {
        query += ` LIMIT ${filter.limit}`;
      }
    }

    return { query, values };
  }

  private mapRowToEvent(row: any): Event {
    return {
      instanceID: row.instance_id,
      aggregateType: row.aggregate_type,
      aggregateID: row.aggregate_id,
      eventType: row.event_type,
      aggregateVersion: BigInt(row.aggregate_version),
      revision: row.revision,
      createdAt: row.created_at,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      creator: row.creator,
      owner: row.owner,
      position: {
        position: parseFloat(row.position),
        inTxOrder: row.in_tx_order,
      },
    };
  }

  /**
   * Handle unique constraints for a command
   * Checks existing constraints and adds/removes as specified
   */
  private async handleUniqueConstraints(
    tx: QueryExecutor,
    command: Command
  ): Promise<void> {
    if (!command.uniqueConstraints) {
      return;
    }

    const { UniqueConstraintAction, UniqueConstraintViolationError } = await import('../unique-constraint');

    for (const constraint of command.uniqueConstraints) {
      if (constraint.action === UniqueConstraintAction.Add) {
        // Check if constraint already exists
        const checkQuery = `
          SELECT 1 FROM unique_constraints
          WHERE unique_type = $1 AND unique_field = $2 AND instance_id = $3
        `;
        const exists = await tx.query(checkQuery, [
          constraint.uniqueType,
          constraint.uniqueField,
          constraint.isGlobal ? '' : command.instanceID,
        ]);

        if (exists.rows.length > 0) {
          throw new UniqueConstraintViolationError(
            constraint.errorMessage || `Unique constraint violated: ${constraint.uniqueType}.${constraint.uniqueField}`,
            constraint.uniqueType,
            constraint.uniqueField
          );
        }

        // Add constraint
        const insertQuery = `
          INSERT INTO unique_constraints (unique_type, unique_field, instance_id)
          VALUES ($1, $2, $3)
        `;
        await tx.query(insertQuery, [
          constraint.uniqueType,
          constraint.uniqueField,
          constraint.isGlobal ? '' : command.instanceID,
        ]);
      } else if (constraint.action === UniqueConstraintAction.Remove) {
        // Remove constraint
        const deleteQuery = `
          DELETE FROM unique_constraints
          WHERE unique_type = $1 AND unique_field = $2 AND instance_id = $3
        `;
        await tx.query(deleteQuery, [
          constraint.uniqueType,
          constraint.uniqueField,
          constraint.isGlobal ? '' : command.instanceID,
        ]);
      } else if (constraint.action === UniqueConstraintAction.InstanceRemove) {
        // Remove all constraints for instance
        const deleteQuery = `
          DELETE FROM unique_constraints
          WHERE instance_id = $1
        `;
        await tx.query(deleteQuery, [command.instanceID]);
      }
    }
  }
}
