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

// Re-export for backward compatibility
export { ProjectState, ProjectType };

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
