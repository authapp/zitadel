/**
 * Execution Projection
 * 
 * Projects execution events into the executions read model
 * Executions define routing rules (conditions -> targets/includes)
 */

import { Eventstore } from '../../eventstore';
import { Event } from '../../eventstore/types';
import { DatabasePool } from '../../database';
import { ExecutionState } from '../../domain/execution';

export class ExecutionProjection {
  constructor(
    _eventstore: Eventstore,
    private readonly database: DatabasePool
  ) {}

  /**
   * Initialize projection
   * Note: Table is created by migrations (02_projections.sql)
   */
  async init(): Promise<void> {
    // No-op: migrations handle table creation with proper constraints
    // Table: projections.executions with PRIMARY KEY (instance_id, id)
  }

  /**
   * Reduce event into projection
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'execution.set':
        await this.handleExecutionSet(event);
        break;
      case 'execution.removed':
        await this.handleExecutionRemoved(event);
        break;
      case 'org.removed':
        await this.handleOrgRemoved(event);
        break;
    }
  }

  private async handleExecutionSet(event: Event): Promise<void> {
    const payload = event.payload as any;

    // Insert or update execution
    await this.database.query(
      `INSERT INTO projections.executions (
        id, instance_id, resource_owner, creation_date, change_date, sequence,
        execution_type, targets, state
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        execution_type = EXCLUDED.execution_type,
        targets = EXCLUDED.targets,
        state = EXCLUDED.state`,
      [
        event.aggregateID,
        event.instanceID,
        event.owner,
        event.createdAt,
        event.createdAt,
        event.aggregateVersion,
        payload.executionType || 0,
        JSON.stringify(payload.targets || []),
        ExecutionState.ACTIVE,
      ]
    );
  }

  private async handleExecutionRemoved(event: Event): Promise<void> {
    // Delete execution
    await this.database.query(
      `DELETE FROM projections.executions
       WHERE instance_id = $1 AND id = $2`,
      [event.instanceID, event.aggregateID]
    );
  }

  private async handleOrgRemoved(event: Event): Promise<void> {
    // Remove all executions for the organization
    await this.database.query(
      `DELETE FROM projections.executions
       WHERE instance_id = $1 AND resource_owner = $2`,
      [event.instanceID, event.aggregateID]
    );
  }
}

/**
 * Create projection config
 */
export function createExecutionProjectionConfig() {
  return {
    name: 'execution_projection',
    eventTypes: [
      'execution.set',
      'execution.removed',
      'org.removed',
    ],
  };
}
