import { DatabasePool, QueryExecutor } from '@/database/pool';
import { generateId } from '@/id/snowflake';
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
} from '../types';

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
        // Get next position (with global lock)
        const position = await this.getNextPosition(tx);

        // Get current aggregate version (with per-aggregate lock)
        const currentVersion = await this.getCurrentVersion(
          tx,
          command.aggregateType,
          command.aggregateID
        );

        // Create event
        const event: Event = {
          id: generateId(),
          eventType: command.eventType,
          aggregateType: command.aggregateType,
          aggregateID: command.aggregateID,
          aggregateVersion: currentVersion + 1,
          eventData: command.eventData,
          editorUser: command.editorUser,
          editorService: command.editorService,
          resourceOwner: command.resourceOwner,
          instanceID: command.instanceID,
          position,
          creationDate: new Date(),
          revision: 1,
        };

        // Insert event
        await this.insertEvent(tx, event);
        events.push(event);
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
        aggregateType,
        aggregateID
      );

      if (currentVersion !== expectedVersion) {
        throw new ConcurrencyError(
          `Version mismatch for aggregate ${aggregateID}`,
          expectedVersion,
          currentVersion
        );
      }

      // Push events normally
      const events: Event[] = [];

      for (const command of commands) {
        const position = await this.getNextPosition(tx);

        const event: Event = {
          id: generateId(),
          eventType: command.eventType,
          aggregateType: command.aggregateType,
          aggregateID: command.aggregateID,
          aggregateVersion: currentVersion + events.length + 1,
          eventData: command.eventData,
          editorUser: command.editorUser,
          editorService: command.editorService,
          resourceOwner: command.resourceOwner,
          instanceID: command.instanceID,
          position,
          creationDate: new Date(),
          revision: 1,
        };

        await this.insertEvent(tx, event);
        events.push(event);
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
      resourceOwner: lastEvent.resourceOwner,
      instanceID: lastEvent.instanceID,
      version: lastEvent.aggregateVersion,
      events,
      position: lastEvent.position,
    };
  }

  /**
   * Search events with complex filters
   */
  async search(query: SearchQuery): Promise<Event[]> {
    if (query.filters.length === 0) {
      return [];
    }

    // Build union query for multiple filters
    const subQueries: string[] = [];
    const allValues: any[] = [];
    let valueIndex = 1;

    for (const filter of query.filters) {
      const { query: subQuery, values } = this.buildEventQuery(filter, valueIndex);
      subQueries.push(`(${subQuery})`);
      allValues.push(...values);
      valueIndex += values.length;
    }

    let finalQuery = subQueries.join(' UNION ');
    
    // Add ordering and limit
    finalQuery += ` ORDER BY position ${query.desc ? 'DESC' : 'ASC'}`;
    
    if (query.limit) {
      finalQuery += ` LIMIT ${query.limit}`;
    }

    const rows = await this.db.queryMany(finalQuery, allValues);
    return rows.map(this.mapRowToEvent);
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
      WHERE position > $1 OR (position = $1 AND in_position_order > $2)
      ORDER BY position ASC, in_position_order ASC
      LIMIT $3
    `;

    const rows = await this.db.queryMany(query, [
      position.position.toString(),
      position.inPositionOrder,
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

  // Private helper methods

  private validateCommand(command: Command): void {
    if (!command.aggregateType) {
      throw new EventValidationError('aggregateType is required', 'aggregateType');
    }
    if (!command.aggregateID) {
      throw new EventValidationError('aggregateID is required', 'aggregateID');
    }
    if (!command.eventType) {
      throw new EventValidationError('eventType is required', 'eventType');
    }
    if (!command.editorUser) {
      throw new EventValidationError('editorUser is required', 'editorUser');
    }
    if (!command.resourceOwner) {
      throw new EventValidationError('resourceOwner is required', 'resourceOwner');
    }
    if (!command.instanceID) {
      throw new EventValidationError('instanceID is required', 'instanceID');
    }
  }

  private async getNextPosition(tx: QueryExecutor): Promise<Position> {
    // Lock the latest position row to prevent concurrent position generation
    // We first find the max position, then lock those rows
    // Note: We can't use FOR UPDATE with MAX() directly in PostgreSQL
    
    // Get current max position
    const maxResult = await tx.query<{ position: string }>(
      'SELECT COALESCE(MAX(position), 0) as position FROM events'
    );
    
    const currentMaxPosition = BigInt(maxResult.rows[0]?.position ?? '0');
    
    // Lock rows at max position to prevent concurrent inserts at same position
    // This is a lightweight advisory approach
    if (currentMaxPosition > 0n) {
      await tx.query(
        'SELECT position FROM events WHERE position = $1 FOR UPDATE',
        [currentMaxPosition.toString()]
      );
    }

    return {
      position: currentMaxPosition + 1n,
      inPositionOrder: 0,
    };
  }

  private async getCurrentVersion(
    tx: QueryExecutor,
    aggregateType: string,
    aggregateID: string
  ): Promise<number> {
    // Use FOR UPDATE to lock only this aggregate's rows
    // This prevents concurrent transactions from updating the same aggregate
    // Similar to Zitadel's approach: locks per-aggregate, not globally
    
    // We need to lock the latest event row for this aggregate
    // Using a subquery approach since FOR UPDATE doesn't work with MAX()
    const result = await tx.query<{ version: number }>(
      `SELECT aggregate_version as version
       FROM events 
       WHERE aggregate_type = $1 AND aggregate_id = $2
       ORDER BY aggregate_version DESC
       LIMIT 1
       FOR UPDATE`,
      [aggregateType, aggregateID]
    );

    return result.rows[0]?.version ?? 0;
  }

  private async insertEvent(tx: QueryExecutor, event: Event): Promise<void> {
    const query = `
      INSERT INTO events (
        id, event_type, aggregate_type, aggregate_id, aggregate_version,
        event_data, editor_user, editor_service, resource_owner, instance_id,
        position, in_position_order, creation_date, revision
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
    `;

    await tx.query(query, [
      event.id,
      event.eventType,
      event.aggregateType,
      event.aggregateID,
      event.aggregateVersion,
      JSON.stringify(event.eventData),
      event.editorUser,
      event.editorService,
      event.resourceOwner,
      event.instanceID,
      event.position.position.toString(),
      event.position.inPositionOrder,
      event.creationDate,
      event.revision,
    ]);
  }

  private buildEventQuery(
    filter: EventFilter,
    startIndex = 1,
    isCount = false
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

    if (filter.resourceOwner) {
      conditions.push(`resource_owner = $${paramIndex}`);
      values.push(filter.resourceOwner);
      paramIndex++;
    }

    if (filter.instanceID) {
      conditions.push(`instance_id = $${paramIndex}`);
      values.push(filter.instanceID);
      paramIndex++;
    }

    if (filter.editorUser) {
      conditions.push(`editor_user = $${paramIndex}`);
      values.push(filter.editorUser);
      paramIndex++;
    }

    if (filter.editorService) {
      conditions.push(`editor_service = $${paramIndex}`);
      values.push(filter.editorService);
      paramIndex++;
    }

    if (filter.creationDateFrom) {
      conditions.push(`creation_date >= $${paramIndex}`);
      values.push(filter.creationDateFrom);
      paramIndex++;
    }

    if (filter.creationDateTo) {
      conditions.push(`creation_date <= $${paramIndex}`);
      values.push(filter.creationDateTo);
      paramIndex++;
    }

    if (filter.position) {
      conditions.push(
        `(position > $${paramIndex} OR (position = $${paramIndex} AND in_position_order >= $${paramIndex + 1}))`
      );
      values.push(filter.position.position.toString(), filter.position.inPositionOrder);
      paramIndex += 2;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (!isCount) {
      query += ` ORDER BY position ${filter.desc ? 'DESC' : 'ASC'}, in_position_order ${filter.desc ? 'DESC' : 'ASC'}`;

      if (filter.limit) {
        query += ` LIMIT ${filter.limit}`;
      }
    }

    return { query, values };
  }

  private mapRowToEvent(row: any): Event {
    return {
      id: row.id,
      eventType: row.event_type,
      aggregateType: row.aggregate_type,
      aggregateID: row.aggregate_id,
      aggregateVersion: row.aggregate_version,
      eventData: typeof row.event_data === 'string' ? JSON.parse(row.event_data) : row.event_data,
      editorUser: row.editor_user,
      editorService: row.editor_service,
      resourceOwner: row.resource_owner,
      instanceID: row.instance_id,
      position: {
        position: BigInt(row.position),
        inPositionOrder: row.in_position_order,
      },
      creationDate: row.creation_date,
      revision: row.revision,
    };
  }
}
