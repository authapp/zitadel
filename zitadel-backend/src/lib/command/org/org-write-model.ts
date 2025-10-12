/**
 * Organization Write Model
 * 
 * Tracks organization aggregate state for command execution
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';
import { OrgState, isOrgActive, isOrgStateExists as orgExists, isOrgStateInactive } from '../../domain/organization';

// Re-export for backward compatibility
export { OrgState };

/**
 * Domain info tracked in org write model
 */
interface DomainInfo {
  domain: string;
  isVerified: boolean;
  isPrimary: boolean;
}

/**
 * Organization write model
 */
export class OrgWriteModel extends WriteModel {
  state: OrgState = OrgState.UNSPECIFIED;
  name?: string;
  primaryDomain?: string;
  domains: DomainInfo[] = [];
  
  constructor() {
    super('org');
  }
  
  reduce(event: Event): void {
    switch (event.eventType) {
      case 'org.added':
        this.state = OrgState.ACTIVE;
        this.name = event.payload?.name;
        break;
        
      case 'org.changed':
        if (event.payload?.name !== undefined) {
          this.name = event.payload.name;
        }
        break;
        
      case 'org.deactivated':
        this.state = OrgState.INACTIVE;
        break;
        
      case 'org.reactivated':
        this.state = OrgState.ACTIVE;
        break;
        
      case 'org.domain.added':
        if (event.payload?.domain) {
          this.domains.push({
            domain: event.payload.domain,
            isVerified: false,
            isPrimary: false,
          });
        }
        break;
        
      case 'org.domain.verified':
        if (event.payload?.domain) {
          const domain = this.domains.find(d => d.domain === event.payload?.domain);
          if (domain) {
            domain.isVerified = true;
          }
        }
        break;
        
      case 'org.domain.primary.set':
        // Unset previous primary
        this.domains.forEach(d => d.isPrimary = false);
        // Set new primary
        if (event.payload?.domain) {
          const domain = this.domains.find(d => d.domain === event.payload?.domain);
          if (domain) {
            domain.isPrimary = true;
            this.primaryDomain = domain.domain;
          }
        }
        break;
        
      case 'org.domain.removed':
        if (event.payload?.domain) {
          this.domains = this.domains.filter(d => d.domain !== event.payload?.domain);
        }
        break;
    }
  }
  
  /**
   * Check if domain exists in organization
   */
  hasDomain(domain: string): boolean {
    return this.domains.some(d => d.domain === domain);
  }
  
  /**
   * Check if domain is verified
   */
  isDomainVerified(domain: string): boolean {
    const d = this.domains.find(d => d.domain === domain);
    return d ? d.isVerified : false;
  }
}

/**
 * Helper functions for org state
 * These mirror Go's command helpers
 */

export function isOrgStateExists(state: OrgState): boolean {
  return orgExists(state);
}

export { isOrgActive as isOrgStateActive, isOrgStateInactive };
