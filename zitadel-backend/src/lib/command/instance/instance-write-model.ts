/**
 * Instance Write Model (Phase 3)
 * 
 * Manages instance state and configuration
 */

import { WriteModel } from '../write-model';
import { Event } from '../../eventstore/types';

export enum InstanceState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REMOVED = 2,
}

export interface InstanceDomain {
  domain: string;
  isGenerated: boolean;
  addedAt: Date;
}

export interface InstanceMember {
  userID: string;
  roles: string[];
  addedAt: Date;
  changedAt?: Date;
}

export interface InstanceFeatures {
  loginDefaultOrg?: boolean;
  triggerIntrospectionProjections?: boolean;
  legacyIntrospection?: boolean;
  userSchema?: boolean;
  tokenExchange?: boolean;
  actions?: boolean;
  improvedPerformance?: boolean;
}

export class InstanceWriteModel extends WriteModel {
  state: InstanceState = InstanceState.UNSPECIFIED;
  instanceName?: string;
  defaultOrgID?: string;
  defaultOrgName?: string;
  adminUserID?: string;
  customDomain?: string;
  defaultLanguage?: string;
  defaultDomain?: string;
  
  domains: Map<string, InstanceDomain> = new Map();
  members: Map<string, InstanceMember> = new Map();
  features: InstanceFeatures = {};
  
  setupAt?: Date;
  updatedAt?: Date;

  constructor() {
    super('instance');
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'instance.setup':
        this.state = InstanceState.ACTIVE;
        this.instanceName = event.payload?.instanceName;
        this.defaultOrgID = event.payload?.defaultOrgID;
        this.defaultOrgName = event.payload?.defaultOrgName;
        this.adminUserID = event.payload?.adminUserID;
        this.customDomain = event.payload?.customDomain;
        this.defaultLanguage = event.payload?.defaultLanguage || 'en';
        this.setupAt = event.createdAt;
        this.updatedAt = event.createdAt;
        
        // Add custom domain if provided
        if (this.customDomain) {
          this.domains.set(this.customDomain, {
            domain: this.customDomain,
            isGenerated: false,
            addedAt: event.createdAt,
          });
          this.defaultDomain = this.customDomain;
        }
        break;

      case 'instance.domain.added':
        if (event.payload?.domain) {
          this.domains.set(event.payload.domain, {
            domain: event.payload.domain,
            isGenerated: event.payload.isGenerated || false,
            addedAt: event.createdAt,
          });
          
          // Set as default if it's the first domain
          if (!this.defaultDomain) {
            this.defaultDomain = event.payload.domain;
          }
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.domain.default.set':
        if (event.payload?.domain) {
          this.defaultDomain = event.payload.domain;
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.domain.removed':
        if (event.payload?.domain) {
          this.domains.delete(event.payload.domain);
          
          // Clear default domain if it was removed
          if (this.defaultDomain === event.payload.domain) {
            this.defaultDomain = undefined;
            
            // Set first available domain as default
            const firstDomain = this.domains.keys().next().value;
            if (firstDomain) {
              this.defaultDomain = firstDomain;
            }
          }
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.features.set':
        if (event.payload) {
          // Merge features
          this.features = {
            ...this.features,
            ...event.payload,
          };
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.features.reset':
        this.features = {};
        this.updatedAt = event.createdAt;
        break;

      case 'instance.member.added':
        if (event.payload?.userID && event.payload?.roles) {
          this.members.set(event.payload.userID, {
            userID: event.payload.userID,
            roles: event.payload.roles,
            addedAt: event.createdAt,
          });
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.member.changed':
        if (event.payload?.userID && event.payload?.roles) {
          const existing = this.members.get(event.payload.userID);
          if (existing) {
            this.members.set(event.payload.userID, {
              ...existing,
              roles: event.payload.roles,
              changedAt: event.createdAt,
            });
          }
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.member.removed':
        if (event.payload?.userID) {
          this.members.delete(event.payload.userID);
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.defaultLanguage.set':
        if (event.payload?.language) {
          this.defaultLanguage = event.payload.language;
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.default_org.set':
        if (event.payload?.defaultOrgID) {
          this.defaultOrgID = event.payload.defaultOrgID;
        }
        this.updatedAt = event.createdAt;
        break;

      case 'instance.removed':
        this.state = InstanceState.REMOVED;
        this.updatedAt = event.createdAt;
        break;
    }
  }

  /**
   * Check if instance is active
   */
  isActive(): boolean {
    return this.state === InstanceState.ACTIVE;
  }

  /**
   * Check if instance is removed
   */
  isRemoved(): boolean {
    return this.state === InstanceState.REMOVED;
  }

  /**
   * Get all domains as array
   */
  getDomainsArray(): InstanceDomain[] {
    return Array.from(this.domains.values());
  }

  /**
   * Get all members as array
   */
  getMembersArray(): InstanceMember[] {
    return Array.from(this.members.values());
  }

  /**
   * Check if domain exists
   */
  hasDomain(domain: string): boolean {
    return this.domains.has(domain);
  }

  /**
   * Check if user is member
   */
  hasMember(userID: string): boolean {
    return this.members.has(userID);
  }

  /**
   * Get member roles
   */
  getMemberRoles(userID: string): string[] {
    const member = this.members.get(userID);
    return member ? member.roles : [];
  }

  /**
   * Check if member has role
   */
  memberHasRole(userID: string, role: string): boolean {
    const roles = this.getMemberRoles(userID);
    return roles.includes(role);
  }

  /**
   * Get feature value
   */
  getFeature<T>(key: keyof InstanceFeatures, defaultValue: T): T {
    const value = this.features[key];
    return value !== undefined ? (value as T) : defaultValue;
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(key: keyof InstanceFeatures): boolean {
    return this.getFeature(key, false);
  }

  /**
   * Get instance summary
   */
  toSummary(): {
    instanceID: string;
    state: InstanceState;
    instanceName?: string;
    defaultOrgID?: string;
    defaultDomain?: string;
    domainCount: number;
    memberCount: number;
    setupAt?: Date;
    updatedAt?: Date;
  } {
    return {
      instanceID: this.aggregateID,
      state: this.state,
      instanceName: this.instanceName,
      defaultOrgID: this.defaultOrgID,
      defaultDomain: this.defaultDomain,
      domainCount: this.domains.size,
      memberCount: this.members.size,
      setupAt: this.setupAt,
      updatedAt: this.updatedAt,
    };
  }
}
