/**
 * Organization Aggregate
 * 
 * Aggregate root for organization with event handling
 */

import { Event } from '@/eventstore/types';
import { Organization, OrgState, OrgDomain } from '../entities/organization';
import { throwNotFound } from '@/zerrors/errors';

/**
 * Organization aggregate
 * Handles all organization state changes through events
 */
export class OrganizationAggregate {
  private org: Organization | null = null;

  constructor(private readonly orgID: string) {}

  /**
   * Get current organization state
   */
  getOrganization(): Organization {
    if (!this.org) {
      throwNotFound('Organization not found', 'ORG-AGG-001');
    }
    return this.org;
  }

  /**
   * Check if organization exists
   */
  exists(): boolean {
    return this.org !== null && this.org.exists();
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
      case 'org.added':
        this.applyOrgAdded(event);
        break;
      case 'org.changed':
        this.applyOrgChanged(event);
        break;
      case 'org.deactivated':
        this.applyOrgDeactivated(event);
        break;
      case 'org.reactivated':
        this.applyOrgReactivated(event);
        break;
      case 'org.removed':
        this.applyOrgRemoved(event);
        break;
      case 'org.domain.added':
        this.applyDomainAdded(event);
        break;
      case 'org.domain.verified':
        this.applyDomainVerified(event);
        break;
      case 'org.domain.primary.set':
        this.applyDomainPrimarySet(event);
        break;
      case 'org.domain.removed':
        this.applyDomainRemoved(event);
        break;
      case 'org.member.added':
        this.applyMemberAdded(event);
        break;
      case 'org.member.changed':
        this.applyMemberChanged(event);
        break;
      case 'org.member.removed':
        this.applyMemberRemoved(event);
        break;
      default:
        // Ignore unknown events
        break;
    }
  }

  /**
   * Apply organization added event
   */
  private applyOrgAdded(event: Event): void {
    const data = event.payload as any;
    this.org = new Organization(
      event.aggregateID,
      event.owner,
      data.name,
      OrgState.ACTIVE,
      undefined,
      [],
      event.createdAt,
      event.createdAt,
      BigInt(event.position.position)
    );
  }

  /**
   * Apply organization changed event
   */
  private applyOrgChanged(event: Event): void {
    if (!this.org) return;
    
    const data = event.payload as any;
    if (data.name) {
      this.org.name = data.name;
    }
    this.org.changeDate = event.createdAt;
    this.org.sequence = BigInt(event.position.position);
  }

  /**
   * Apply organization deactivated event
   */
  private applyOrgDeactivated(event: Event): void {
    if (!this.org) return;
    
    this.org.state = OrgState.INACTIVE;
    this.org.changeDate = event.createdAt;
    this.org.sequence = BigInt(event.position.position);
  }

  /**
   * Apply organization reactivated event
   */
  private applyOrgReactivated(event: Event): void {
    if (!this.org) return;
    
    this.org.state = OrgState.ACTIVE;
    this.org.changeDate = event.createdAt;
    this.org.sequence = BigInt(event.position.position);
  }

  /**
   * Apply organization removed event
   */
  private applyOrgRemoved(event: Event): void {
    if (!this.org) return;
    
    this.org.state = OrgState.REMOVED;
    this.org.changeDate = event.createdAt;
    this.org.sequence = BigInt(event.position.position);
  }

  /**
   * Apply domain added event
   */
  private applyDomainAdded(event: Event): void {
    if (!this.org) return;
    
    const data = event.payload as any;
    const domain = new OrgDomain(
      this.org.aggregateID,
      data.domain,
      data.isPrimary || false,
      data.isVerified || false,
      data.validationType
    );
    domain.validationCode = data.validationCode;
    domain.creationDate = event.createdAt;
    
    this.org.domains.push(domain);
    
    if (domain.isPrimary) {
      this.org.primaryDomain = domain.domain;
    }
    
    this.org.changeDate = event.createdAt;
    this.org.sequence = BigInt(event.position.position);
  }

  /**
   * Apply domain verified event
   */
  private applyDomainVerified(event: Event): void {
    if (!this.org) return;
    
    const data = event.payload as any;
    const domain = this.org.domains.find(d => d.domain === data.domain);
    if (domain) {
      domain.isVerified = true;
      domain.changeDate = event.createdAt;
    }
    
    this.org.changeDate = event.createdAt;
    this.org.sequence = BigInt(event.position.position);
  }

  /**
   * Apply domain primary set event
   */
  private applyDomainPrimarySet(event: Event): void {
    if (!this.org) return;
    
    const data = event.payload as any;
    
    // Remove primary from all domains
    this.org.domains.forEach(d => {
      d.isPrimary = false;
    });
    
    // Set new primary
    const domain = this.org.domains.find(d => d.domain === data.domain);
    if (domain) {
      domain.isPrimary = true;
      this.org.primaryDomain = domain.domain;
    }
    
    this.org.changeDate = event.createdAt;
    this.org.sequence = BigInt(event.position.position);
  }

  /**
   * Apply domain removed event
   */
  private applyDomainRemoved(event: Event): void {
    if (!this.org) return;
    
    const data = event.payload as any;
    this.org.domains = this.org.domains.filter(d => d.domain !== data.domain);
    
    if (this.org.primaryDomain === data.domain) {
      this.org.primaryDomain = undefined;
    }
    
    this.org.changeDate = event.createdAt;
    this.org.sequence = BigInt(event.position.position);
  }

  /**
   * Apply member added event
   */
  private applyMemberAdded(event: Event): void {
    if (!this.org) return;
    
    this.org.changeDate = event.createdAt;
    this.org.sequence = BigInt(event.position.position);
  }

  /**
   * Apply member changed event
   */
  private applyMemberChanged(event: Event): void {
    if (!this.org) return;
    
    this.org.changeDate = event.createdAt;
    this.org.sequence = BigInt(event.position.position);
  }

  /**
   * Apply member removed event
   */
  private applyMemberRemoved(event: Event): void {
    if (!this.org) return;
    
    this.org.changeDate = event.createdAt;
    this.org.sequence = BigInt(event.position.position);
  }

  /**
   * Get aggregate ID
   */
  getAggregateID(): string {
    return this.orgID;
  }

  /**
   * Get aggregate type
   */
  getAggregateType(): string {
    return 'org';
  }
}
