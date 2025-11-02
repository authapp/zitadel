/**
 * Milestones Projection
 * Tracks achievement of important system/org/project/user milestones
 */

import { Event } from '../../eventstore/types';
import { Projection } from '../projection/projection';

export class MilestonesProjection extends Projection {
  readonly name = 'milestones_projection';
  readonly tables = ['projections.milestones'];

  async init(): Promise<void> {
    // Table already created by migration
  }
  
  /**
   * Get event types handled by this projection
   * Required for real-time event subscription
   */
  getEventTypes(): string[] {
    return [
      'instance',
      'instance.added',
      'instance.domain.added',
      'instance.removed',
      'milestone.pushed',
      'milestone.reached',
      'org',
      'org.added',
      'org.domain.added',
      'org.removed',
      'organization',
      'project',
      'project.added',
      'project.application.added',
      'project.role.added',
      'session.added',
      'user',
      'user.added',
      'user.email.verified',
      'user.mfa.otp.added',
      'user.mfa.u2f.added',
      'user.phone.verified',
      'user.v1.added',
    ];
  }


  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      // Milestone events
      case 'milestone.pushed':
        await this.handleMilestonePushed(event);
        break;
      case 'milestone.reached':
        await this.handleMilestoneReached(event);
        break;

      // Auto-track milestone achievements based on other events
      case 'instance.added':
        await this.trackMilestone(event, 1, 'instance_created', true);
        break;
      case 'instance.domain.added':
        await this.trackMilestone(event, 1, 'instance_custom_domain', false);
        break;
      
      case 'org.added':
        await this.trackMilestone(event, 2, 'org_created', true);
        break;
      case 'org.domain.added':
        await this.trackMilestone(event, 2, 'org_custom_domain', false);
        break;
      
      case 'project.added':
        await this.trackMilestone(event, 3, 'project_created', true);
        break;
      case 'project.application.added':
        await this.trackMilestone(event, 3, 'project_app_added', false);
        break;
      case 'project.role.added':
        await this.trackMilestone(event, 3, 'project_role_added', false);
        break;
      
      case 'user.added':
      case 'user.v1.added':
        await this.trackMilestone(event, 4, 'user_created', true);
        break;
      case 'user.email.verified':
        await this.trackMilestone(event, 4, 'user_email_verified', false);
        break;
      case 'user.phone.verified':
        await this.trackMilestone(event, 4, 'user_phone_verified', false);
        break;
      case 'user.mfa.otp.added':
      case 'user.mfa.u2f.added':
        await this.trackMilestone(event, 4, 'user_mfa_enabled', false);
        break;
      case 'session.added':
        await this.trackMilestone(event, 4, 'user_first_login', false);
        break;

      // Cleanup events
      case 'org.removed':
        await this.handleOrgRemoved(event);
        break;
      case 'instance.removed':
        await this.handleInstanceRemoved(event);
        break;
    }
  }

  private async handleMilestonePushed(event: Event): Promise<void> {
    const payload = event.payload as any;

    await this.query(
      `INSERT INTO projections.milestones (
        id, instance_id, milestone_type, aggregate_type, aggregate_id,
        name, pushed_date, primary_domain, creation_date, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        pushed_date = EXCLUDED.pushed_date,
        change_date = EXCLUDED.change_date,
        sequence = GREATEST(projections.milestones.sequence, EXCLUDED.sequence)`,
      [
        payload.id || `${event.aggregateType}_${event.aggregateID}_${payload.type}`,
        event.instanceID,
        this.getMilestoneType(event.aggregateType),
        event.aggregateType,
        event.aggregateID,
        payload.type || payload.milestoneType,
        event.createdAt,
        payload.primaryDomain,
        event.createdAt,
        event.createdAt,
        event.aggregateVersion,
      ]
    );
  }

  private async handleMilestoneReached(event: Event): Promise<void> {
    const payload = event.payload as any;

    await this.query(
      `UPDATE projections.milestones 
       SET reached_date = $1, change_date = $2, sequence = $3
       WHERE instance_id = $4 AND id = $5`,
      [
        payload.reachedDate || event.createdAt,
        event.createdAt,
        event.aggregateVersion,
        event.instanceID,
        payload.id || event.aggregateID,
      ]
    );
  }

  private async trackMilestone(
    event: Event,
    milestoneType: number,
    milestoneName: string,
    autoReach: boolean
  ): Promise<void> {
    const milestoneId = `${event.aggregateType}_${event.aggregateID}_${milestoneName}`;

    // Check if milestone already exists
    const existing = await this.query(
      'SELECT id FROM projections.milestones WHERE instance_id = $1 AND id = $2',
      [event.instanceID, milestoneId]
    );

    if (existing.rows.length === 0) {
      await this.query(
        `INSERT INTO projections.milestones (
          id, instance_id, milestone_type, aggregate_type, aggregate_id,
          name, reached_date, creation_date, change_date, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          milestoneId,
          event.instanceID,
          milestoneType,
          event.aggregateType,
          event.aggregateID,
          milestoneName,
          autoReach ? event.createdAt : null,
          event.createdAt,
          event.createdAt,
          event.aggregateVersion,
        ]
      );
    } else if (autoReach) {
      // Update reached date if not already reached
      await this.query(
        `UPDATE projections.milestones 
         SET reached_date = COALESCE(reached_date, $1), change_date = $2, sequence = $3
         WHERE instance_id = $4 AND id = $5`,
        [event.createdAt, event.createdAt, event.aggregateVersion, event.instanceID, milestoneId]
      );
    }
  }

  private getMilestoneType(aggregateType: string): number {
    switch (aggregateType) {
      case 'instance':
        return 1;
      case 'org':
      case 'organization':
        return 2;
      case 'project':
        return 3;
      case 'user':
        return 4;
      default:
        return 1;
    }
  }

  private async handleOrgRemoved(event: Event): Promise<void> {
    // Remove all milestones for this organization
    await this.query(
      `DELETE FROM projections.milestones 
       WHERE instance_id = $1 AND aggregate_type = 'org' AND aggregate_id = $2`,
      [event.instanceID, event.aggregateID]
    );
  }

  private async handleInstanceRemoved(event: Event): Promise<void> {
    // Remove all milestones for this instance
    await this.query(
      `DELETE FROM projections.milestones WHERE instance_id = $1`,
      [event.instanceID]
    );
  }
}

/**
 * Create projection config
 */
export function createMilestonesProjectionConfig() {
  return {
    name: 'milestones_projection',
    tables: ['projections.milestones'],
    eventTypes: [
      // Direct milestone events
      'milestone.pushed',
      'milestone.reached',
      
      // Instance milestones
      'instance.added',
      'instance.domain.added',
      
      // Organization milestones
      'org.added',
      'org.domain.added',
      
      // Project milestones
      'project.added',
      'project.application.added',
      'project.role.added',
      
      // User milestones
      'user.added',
      'user.v1.added',
      'user.email.verified',
      'user.phone.verified',
      'user.mfa.otp.added',
      'user.mfa.u2f.added',
      'session.added',
      
      // Cleanup
      'org.removed',
      'instance.removed',
    ],
    aggregateTypes: ['instance', 'org', 'project', 'user'],
    batchSize: 100,
    interval: 1000,
    enableLocking: false,
  };
}
