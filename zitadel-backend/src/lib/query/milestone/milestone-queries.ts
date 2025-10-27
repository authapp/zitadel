/**
 * Milestone Queries
 * 
 * Query layer for milestones projection.
 * Provides methods to retrieve milestone tracking data.
 */

import { DatabasePool } from '../../database/pool';

export interface Milestone {
  id: string;
  instanceId: string;
  milestoneType: number; // 1=instance, 2=org, 3=project, 4=user
  aggregateType: string;
  aggregateId: string;
  name: string;
  reachedDate: Date | null;
  pushedDate: Date | null;
  primaryDomain: string | null;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
}

export class MilestoneQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get milestone by ID
   * @param instanceId - Instance ID for multi-tenant isolation
   * @param milestoneId - Milestone ID
   * @returns Milestone or null if not found
   */
  async getMilestoneById(instanceId: string, milestoneId: string): Promise<Milestone | null> {
    const result = await this.database.queryOne<any>(
      `SELECT 
        id, instance_id, milestone_type, aggregate_type, aggregate_id,
        name, reached_date, pushed_date, primary_domain,
        creation_date, change_date, sequence
       FROM projections.milestones
       WHERE instance_id = $1 AND id = $2`,
      [instanceId, milestoneId]
    );

    if (!result) {
      return null;
    }

    return this.mapRowToMilestone(result);
  }

  /**
   * Get milestones by type
   * @param instanceId - Instance ID for multi-tenant isolation
   * @param milestoneType - Type filter (1=instance, 2=org, 3=project, 4=user)
   * @returns Array of milestones
   */
  async getMilestonesByType(instanceId: string, milestoneType: number): Promise<Milestone[]> {
    const results = await this.database.queryMany<any>(
      `SELECT 
        id, instance_id, milestone_type, aggregate_type, aggregate_id,
        name, reached_date, pushed_date, primary_domain,
        creation_date, change_date, sequence
       FROM projections.milestones
       WHERE instance_id = $1 AND milestone_type = $2
       ORDER BY creation_date DESC`,
      [instanceId, milestoneType]
    );

    return results.map(row => this.mapRowToMilestone(row));
  }

  /**
   * Get milestones by aggregate
   * @param instanceId - Instance ID for multi-tenant isolation
   * @param aggregateId - Aggregate ID
   * @returns Array of milestones
   */
  async getMilestonesByAggregate(instanceId: string, aggregateId: string): Promise<Milestone[]> {
    const results = await this.database.queryMany<any>(
      `SELECT 
        id, instance_id, milestone_type, aggregate_type, aggregate_id,
        name, reached_date, pushed_date, primary_domain,
        creation_date, change_date, sequence
       FROM projections.milestones
       WHERE instance_id = $1 AND aggregate_id = $2
       ORDER BY creation_date DESC`,
      [instanceId, aggregateId]
    );

    return results.map(row => this.mapRowToMilestone(row));
  }

  /**
   * Get milestones by name
   * @param instanceId - Instance ID for multi-tenant isolation
   * @param name - Milestone name
   * @returns Array of milestones
   */
  async getMilestonesByName(instanceId: string, name: string): Promise<Milestone[]> {
    const results = await this.database.queryMany<any>(
      `SELECT 
        id, instance_id, milestone_type, aggregate_type, aggregate_id,
        name, reached_date, pushed_date, primary_domain,
        creation_date, change_date, sequence
       FROM projections.milestones
       WHERE instance_id = $1 AND name = $2
       ORDER BY creation_date DESC`,
      [instanceId, name]
    );

    return results.map(row => this.mapRowToMilestone(row));
  }

  /**
   * Map database row to Milestone
   */
  private mapRowToMilestone(row: any): Milestone {
    return {
      id: row.id,
      instanceId: row.instance_id,
      milestoneType: row.milestone_type,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      name: row.name,
      reachedDate: row.reached_date ? new Date(row.reached_date) : null,
      pushedDate: row.pushed_date ? new Date(row.pushed_date) : null,
      primaryDomain: row.primary_domain,
      creationDate: new Date(row.creation_date),
      changeDate: new Date(row.change_date),
      sequence: Number(row.sequence),
    };
  }
}
