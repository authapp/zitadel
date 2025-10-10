/**
 * Project Aggregate
 * 
 * Aggregate root for project with event handling
 */

import { Event } from '@/eventstore/types';
import { Project, ProjectState, ProjectRole, ProjectGrant, ProjectGrantState } from '../entities/project';
import { throwNotFound } from '@/zerrors/errors';

/**
 * Project aggregate
 * Handles all project state changes through events
 */
export class ProjectAggregate {
  private project: Project | null = null;

  constructor(private readonly projectID: string) {}

  /**
   * Get current project state
   */
  getProject(): Project {
    if (!this.project) {
      throwNotFound('Project not found', 'PROJECT-AGG-001');
    }
    return this.project;
  }

  /**
   * Check if project exists
   */
  exists(): boolean {
    return this.project !== null && this.project.exists();
  }

  /**
   * Apply events to rebuild state
   */
  applyEvents(events: Event[]): void {
    for (const event of events) {
      this.applyEvent(event);
    }
  }

  /**
   * Apply single event
   */
  private applyEvent(event: Event): void {
    switch (event.eventType) {
      case 'project.added':
        this.applyProjectAdded(event);
        break;
      case 'project.changed':
        this.applyProjectChanged(event);
        break;
      case 'project.deactivated':
        this.applyProjectDeactivated(event);
        break;
      case 'project.reactivated':
        this.applyProjectReactivated(event);
        break;
      case 'project.removed':
        this.applyProjectRemoved(event);
        break;
      case 'project.role.added':
        this.applyRoleAdded(event);
        break;
      case 'project.role.changed':
        this.applyRoleChanged(event);
        break;
      case 'project.role.removed':
        this.applyRoleRemoved(event);
        break;
      case 'project.grant.added':
        this.applyGrantAdded(event);
        break;
      case 'project.grant.changed':
        this.applyGrantChanged(event);
        break;
      case 'project.grant.deactivated':
        this.applyGrantDeactivated(event);
        break;
      case 'project.grant.reactivated':
        this.applyGrantReactivated(event);
        break;
      case 'project.grant.removed':
        this.applyGrantRemoved(event);
        break;
      default:
        // Ignore unknown events
        break;
    }
  }

  /**
   * Apply project added event
   */
  private applyProjectAdded(event: Event): void {
    const data = event.payload as any;
    
    this.project = new Project(
      event.aggregateID,
      event.owner,
      data.name,
      ProjectState.ACTIVE,
      data.projectRoleAssertion || false,
      data.projectRoleCheck || false,
      data.hasProjectCheck || false,
      data.privateLabelingSetting,
      event.createdAt,
      event.createdAt,
      BigInt(event.position.position)
    );
  }

  /**
   * Apply project changed event
   */
  private applyProjectChanged(event: Event): void {
    if (!this.project) return;
    
    const data = event.payload as any;
    
    if (data.name) {
      this.project.name = data.name;
    }
    if (data.projectRoleAssertion !== undefined) {
      this.project.projectRoleAssertion = data.projectRoleAssertion;
    }
    if (data.projectRoleCheck !== undefined) {
      this.project.projectRoleCheck = data.projectRoleCheck;
    }
    if (data.hasProjectCheck !== undefined) {
      this.project.hasProjectCheck = data.hasProjectCheck;
    }
    if (data.privateLabelingSetting !== undefined) {
      this.project.privateLabelingSetting = data.privateLabelingSetting;
    }
    
    this.project.changeDate = event.createdAt;
    this.project.sequence = BigInt(event.position.position);
  }

  /**
   * Apply project deactivated event
   */
  private applyProjectDeactivated(event: Event): void {
    if (!this.project) return;
    
    this.project.state = ProjectState.INACTIVE;
    this.project.changeDate = event.createdAt;
    this.project.sequence = BigInt(event.position.position);
  }

  /**
   * Apply project reactivated event
   */
  private applyProjectReactivated(event: Event): void {
    if (!this.project) return;
    
    this.project.state = ProjectState.ACTIVE;
    this.project.changeDate = event.createdAt;
    this.project.sequence = BigInt(event.position.position);
  }

  /**
   * Apply project removed event
   */
  private applyProjectRemoved(event: Event): void {
    if (!this.project) return;
    
    this.project.state = ProjectState.REMOVED;
    this.project.changeDate = event.createdAt;
    this.project.sequence = BigInt(event.position.position);
  }

  /**
   * Apply role added event
   */
  private applyRoleAdded(event: Event): void {
    if (!this.project) return;
    
    const data = event.payload as any;
    
    const role = new ProjectRole(
      this.project.aggregateID,
      data.key,
      data.displayName,
      data.group,
      event.createdAt,
      event.createdAt,
      BigInt(event.position.position)
    );
    
    this.project.roles.push(role);
    this.project.changeDate = event.createdAt;
    this.project.sequence = BigInt(event.position.position);
  }

  /**
   * Apply role changed event
   */
  private applyRoleChanged(event: Event): void {
    if (!this.project) return;
    
    const data = event.payload as any;
    const role = this.project.roles.find(r => r.key === data.key);
    
    if (role) {
      if (data.displayName) {
        role.displayName = data.displayName;
      }
      if (data.group !== undefined) {
        role.group = data.group;
      }
      role.changeDate = event.createdAt;
      role.sequence = BigInt(event.position.position);
    }
    
    this.project.changeDate = event.createdAt;
    this.project.sequence = BigInt(event.position.position);
  }

  /**
   * Apply role removed event
   */
  private applyRoleRemoved(event: Event): void {
    if (!this.project) return;
    
    const data = event.payload as any;
    this.project.roles = this.project.roles.filter(r => r.key !== data.key);
    
    this.project.changeDate = event.createdAt;
    this.project.sequence = BigInt(event.position.position);
  }

  /**
   * Apply grant added event
   */
  private applyGrantAdded(event: Event): void {
    if (!this.project) return;
    
    const data = event.payload as any;
    
    const grant = new ProjectGrant(
      data.grantID,
      this.project.aggregateID,
      data.grantedOrgID,
      data.roleKeys,
      ProjectGrantState.ACTIVE,
      event.createdAt,
      event.createdAt,
      BigInt(event.position.position)
    );
    
    this.project.grants.push(grant);
    this.project.changeDate = event.createdAt;
    this.project.sequence = BigInt(event.position.position);
  }

  /**
   * Apply grant changed event
   */
  private applyGrantChanged(event: Event): void {
    if (!this.project) return;
    
    const data = event.payload as any;
    const grant = this.project.grants.find(g => g.grantID === data.grantID);
    
    if (grant) {
      if (data.roleKeys) {
        grant.roleKeys = data.roleKeys;
      }
      grant.changeDate = event.createdAt;
      grant.sequence = BigInt(event.position.position);
    }
    
    this.project.changeDate = event.createdAt;
    this.project.sequence = BigInt(event.position.position);
  }

  /**
   * Apply grant deactivated event
   */
  private applyGrantDeactivated(event: Event): void {
    if (!this.project) return;
    
    const data = event.payload as any;
    const grant = this.project.grants.find(g => g.grantID === data.grantID);
    
    if (grant) {
      grant.state = ProjectGrantState.INACTIVE;
      grant.changeDate = event.createdAt;
      grant.sequence = BigInt(event.position.position);
    }
    
    this.project.changeDate = event.createdAt;
    this.project.sequence = BigInt(event.position.position);
  }

  /**
   * Apply grant reactivated event
   */
  private applyGrantReactivated(event: Event): void {
    if (!this.project) return;
    
    const data = event.payload as any;
    const grant = this.project.grants.find(g => g.grantID === data.grantID);
    
    if (grant) {
      grant.state = ProjectGrantState.ACTIVE;
      grant.changeDate = event.createdAt;
      grant.sequence = BigInt(event.position.position);
    }
    
    this.project.changeDate = event.createdAt;
    this.project.sequence = BigInt(event.position.position);
  }

  /**
   * Apply grant removed event
   */
  private applyGrantRemoved(event: Event): void {
    if (!this.project) return;
    
    const data = event.payload as any;
    this.project.grants = this.project.grants.filter(g => g.grantID !== data.grantID);
    
    this.project.changeDate = event.createdAt;
    this.project.sequence = BigInt(event.position.position);
  }

  /**
   * Get aggregate ID
   */
  getAggregateID(): string {
    return this.projectID;
  }

  /**
   * Get aggregate type
   */
  getAggregateType(): string {
    return 'project';
  }
}
