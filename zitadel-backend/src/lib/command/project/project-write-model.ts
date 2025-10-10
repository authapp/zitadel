/**
 * Project Write Model
 * 
 * Tracks project aggregate state for command execution
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';
import { 
  ProjectState, 
  ProjectType,
  isProjectActive,
  isProjectStateExists as projectExists,
  isProjectStateInactive
} from '../../domain/project';
import { ProjectGrant, ProjectGrantState } from '../../domain/entities/project';

// Re-export for backward compatibility
export { ProjectState, ProjectType, ProjectGrantState };

/**
 * Project write model
 */
export class ProjectWriteModel extends WriteModel {
  state: ProjectState = ProjectState.UNSPECIFIED;
  projectType: ProjectType = ProjectType.UNSPECIFIED;
  name?: string;
  projectRoleAssertion: boolean = false;
  projectRoleCheck: boolean = false;
  hasProjectCheck: boolean = false;
  privateLabelingSetting: number = 0;
  grants: ProjectGrant[] = [];
  
  constructor() {
    super('project');
  }
  
  reduce(event: Event): void {
    switch (event.eventType) {
      case 'project.added':
        this.state = ProjectState.ACTIVE;
        this.projectType = ProjectType.OWNED;
        this.name = event.payload?.name;
        this.projectRoleAssertion = event.payload?.projectRoleAssertion ?? false;
        this.projectRoleCheck = event.payload?.projectRoleCheck ?? false;
        this.hasProjectCheck = event.payload?.hasProjectCheck ?? false;
        this.privateLabelingSetting = event.payload?.privateLabelingSetting ?? 0;
        break;
        
      case 'project.changed':
        if (event.payload?.name !== undefined) {
          this.name = event.payload.name;
        }
        if (event.payload?.projectRoleAssertion !== undefined) {
          this.projectRoleAssertion = event.payload.projectRoleAssertion;
        }
        if (event.payload?.projectRoleCheck !== undefined) {
          this.projectRoleCheck = event.payload.projectRoleCheck;
        }
        if (event.payload?.hasProjectCheck !== undefined) {
          this.hasProjectCheck = event.payload.hasProjectCheck;
        }
        if (event.payload?.privateLabelingSetting !== undefined) {
          this.privateLabelingSetting = event.payload.privateLabelingSetting;
        }
        break;
        
      case 'project.deactivated':
        this.state = ProjectState.INACTIVE;
        break;
        
      case 'project.reactivated':
        this.state = ProjectState.ACTIVE;
        break;
        
      case 'project.grant.added':
        if (event.payload) {
          const grant = new ProjectGrant(
            event.payload.grantID,
            this.aggregateID,
            event.payload.grantedOrgID,
            event.payload.roleKeys || [],
            ProjectGrantState.ACTIVE
          );
          this.grants.push(grant);
        }
        break;
        
      case 'project.grant.changed':
        if (event.payload) {
          const grant = this.grants.find(g => g.grantID === event.payload?.grantID);
          if (grant && event.payload?.roleKeys) {
            grant.roleKeys = event.payload.roleKeys;
          }
        }
        break;
        
      case 'project.grant.deactivated':
        if (event.payload) {
          const grant = this.grants.find(g => g.grantID === event.payload?.grantID);
          if (grant) {
            grant.state = ProjectGrantState.INACTIVE;
          }
        }
        break;
        
      case 'project.grant.reactivated':
        if (event.payload) {
          const grant = this.grants.find(g => g.grantID === event.payload?.grantID);
          if (grant) {
            grant.state = ProjectGrantState.ACTIVE;
          }
        }
        break;
        
      case 'project.grant.removed':
        if (event.payload) {
          this.grants = this.grants.filter(g => g.grantID !== event.payload?.grantID);
        }
        break;
    }
  }
}

/**
 * Helper functions for project state
 * These mirror Go's command helpers
 */

export function isProjectStateExists(state: ProjectState): boolean {
  return projectExists(state);
}

export { isProjectActive as isProjectStateActive, isProjectStateInactive };
