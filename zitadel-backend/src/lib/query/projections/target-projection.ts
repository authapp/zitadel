/**
 * Target Projection
 * 
 * Projects target events into the targets read model
 * Targets are external endpoints (webhooks) for action execution
 */

import { Eventstore } from '../../eventstore';
import { Event } from '../../eventstore/types';
import { DatabasePool } from '../../database';
import { TargetState } from '../../domain/target';

export class TargetProjection {
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
    // Table: projections.targets with PRIMARY KEY (instance_id, id)
  }

  /**
   * Reduce event into projection
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'target.added':
        await this.handleTargetAdded(event);
        break;
      case 'target.changed':
        await this.handleTargetChanged(event);
        break;
      case 'target.removed':
        await this.handleTargetRemoved(event);
        break;
      case 'org.removed':
        await this.handleOrgRemoved(event);
        break;
    }
  }

  private async handleTargetAdded(event: Event): Promise<void> {
    const payload = event.payload as any;

    await this.database.query(
      `INSERT INTO projections.targets (
        id, instance_id, resource_owner, creation_date, change_date, sequence,
        name, target_type, endpoint, timeout, interrupt_on_error, state
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (instance_id, id) DO NOTHING`,
      [
        event.aggregateID,
        event.instanceID,
        event.owner,
        event.createdAt,
        event.createdAt,
        event.aggregateVersion,
        payload.name,
        payload.targetType || 1,
        payload.endpoint,
        payload.timeout || 10000,
        payload.interruptOnError || false,
        TargetState.ACTIVE,
      ]
    );
  }

  private async handleTargetChanged(event: Event): Promise<void> {
    const payload = event.payload as any;
    
    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    updates.push(`change_date = $${paramIndex++}`);
    values.push(event.createdAt);

    updates.push(`sequence = $${paramIndex++}`);
    values.push(event.aggregateVersion);

    if (payload.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(payload.name);
    }

    if (payload.targetType !== undefined) {
      updates.push(`target_type = $${paramIndex++}`);
      values.push(payload.targetType);
    }

    if (payload.endpoint !== undefined) {
      updates.push(`endpoint = $${paramIndex++}`);
      values.push(payload.endpoint);
    }

    if (payload.timeout !== undefined) {
      updates.push(`timeout = $${paramIndex++}`);
      values.push(payload.timeout);
    }

    if (payload.interruptOnError !== undefined) {
      updates.push(`interrupt_on_error = $${paramIndex++}`);
      values.push(payload.interruptOnError);
    }

    // Add WHERE clause parameters
    values.push(event.instanceID);
    values.push(event.aggregateID);

    await this.database.query(
      `UPDATE projections.targets 
       SET ${updates.join(', ')}
       WHERE instance_id = $${paramIndex++} AND id = $${paramIndex}`,
      values
    );
  }

  private async handleTargetRemoved(event: Event): Promise<void> {
    // Soft delete by setting state to REMOVED
    await this.database.query(
      `DELETE FROM projections.targets
       WHERE instance_id = $1 AND id = $2`,
      [event.instanceID, event.aggregateID]
    );
  }

  private async handleOrgRemoved(event: Event): Promise<void> {
    // Remove all targets for the organization
    await this.database.query(
      `DELETE FROM projections.targets
       WHERE instance_id = $1 AND resource_owner = $2`,
      [event.instanceID, event.aggregateID]
    );
  }
}

/**
 * Create projection config
 */
export function createTargetProjectionConfig() {
  return {
    name: 'target_projection',
    eventTypes: [
      'target.added',
      'target.changed',
      'target.removed',
      'org.removed',
    ],
  };
}
