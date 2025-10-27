/**
 * Login Name projection for Zitadel query layer
 * Projects user, org, and instance events into projections.login_names table
 * 
 * This is a denormalized table for fast login name lookups.
 * Login names are generated from: username/email + org/instance domain
 */

import { Projection } from '../projection/projection';
import { ProjectionConfig } from '../projection/projection-config';
import { Event } from '../../eventstore/types';

export class LoginNameProjection extends Projection {
  readonly name = 'login_name_projection';
  readonly tables = ['projections.login_names'];

  async init(): Promise<void> {
    // Tables created by migration, nothing to do
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      // User events
      case 'user.added':
      case 'user.registered':
        await this.handleUserAdded(event);
        break;
      
      case 'user.username.changed':
        await this.handleUsernameChanged(event);
        break;
      
      case 'user.email.changed':
        await this.handleEmailChanged(event);
        break;
      
      case 'user.removed':
        await this.handleUserRemoved(event);
        break;
      
      // Org domain events
      case 'org.domain.added':
        await this.handleOrgDomainAdded(event);
        break;
      
      case 'org.domain.verified':
        await this.handleOrgDomainVerified(event);
        break;
      
      case 'org.domain.primary.set':
        await this.handleOrgDomainPrimarySet(event);
        break;
      
      case 'org.domain.removed':
        await this.handleOrgDomainRemoved(event);
        break;
      
      // Instance domain events
      case 'instance.domain.added':
        await this.handleInstanceDomainAdded(event);
        break;
      
      case 'instance.domain.primary.set':
        await this.handleInstanceDomainPrimarySet(event);
        break;
    }
  }

  /**
   * Handle user.added event - generate initial login names
   * Note: This is a simplified version that waits for org domains to be set up
   */
  private async handleUserAdded(event: Event): Promise<void> {
    try {
      const payload = event.payload || {};
      const userId = event.aggregateID;
      const instanceId = event.instanceID;
      const resourceOwner = event.owner;
      
      const username = payload.userName || payload.username;
      const email = payload.email;
      
      if (!username) {
        return;
      }

      // Try to get org domains (may be empty if org domains not yet created)
      const orgDomains = await this.getOrgDomains(resourceOwner, instanceId);
      
      // Only proceed if we have domains
      if (orgDomains.length === 0) {
        // No domains yet, login names will be created when domain is added
        return;
      }
      
      // Create login names: username@domain
      const loginNames: Array<{name: string, domain: string, isPrimary: boolean}> = [];
      
      // Add org domain login names
      for (const domain of orgDomains) {
        loginNames.push({
          name: `${username}@${domain.name}`,
          domain: domain.name,
          isPrimary: domain.isPrimary,
        });
      }
      
      // If email exists and differs from username, add email login names
      if (email && email !== username) {
        for (const domain of orgDomains) {
          loginNames.push({
            name: `${email}@${domain.name}`,
            domain: domain.name,
            isPrimary: domain.isPrimary,
          });
        }
      }
      
      // Insert all login names
      for (const ln of loginNames) {
        await this.insertLoginName(
          userId,
          instanceId,
          resourceOwner,
          ln.name,
          ln.domain,
          ln.isPrimary,
          event.createdAt
        );
      }
    } catch (error) {
      // Silently skip - projection timing issue
      // Login names will be created when org domain is added/verified
      return;
    }
  }

  /**
   * Handle user.username.changed event
   */
  private async handleUsernameChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const userId = event.aggregateID;
    const instanceId = event.instanceID;
    const resourceOwner = event.owner;
    const newUsername = payload.userName || payload.username;
    
    if (!newUsername) {
      return;
    }

    // Get user's email from projections.users (may not exist yet)
    let email: string | undefined;
    try {
      const userResults = await this.database.queryMany(
        `SELECT email FROM projections.users WHERE id = $1 AND instance_id = $2`,
        [userId, instanceId]
      );
      email = userResults[0]?.email;
    } catch (e) {
      // Ignore
    }

    // Get org domains 
    const orgDomains = await this.getOrgDomains(resourceOwner, instanceId);
    
    if (orgDomains.length === 0) {
      // No domains available yet - keep old login names until domains are ready
      // This prevents users from being locked out mid-update
      return;
    }
    
    // Remove old login names
    await this.database.query(
      `DELETE FROM projections.login_names 
       WHERE user_id = $1 AND instance_id = $2`,
      [userId, instanceId]
    );
    
    // Regenerate login names with new username
    for (const domain of orgDomains) {
      await this.insertLoginName(
        userId,
        instanceId,
        resourceOwner,
        `${newUsername}@${domain.name}`,
        domain.name,
        domain.isPrimary,
        event.createdAt
      );
      
      if (email && email !== newUsername) {
        await this.insertLoginName(
          userId,
          instanceId,
          resourceOwner,
          `${email}@${domain.name}`,
          domain.name,
          domain.isPrimary,
          event.createdAt
        );
      }
    }
  }

  /**
   * Handle user.email.changed event
   */
  private async handleEmailChanged(event: Event): Promise<void> {
    // Similar to username change - regenerate all login names
    await this.handleUsernameChanged(event);
  }

  /**
   * Handle user.removed event
   */
  private async handleUserRemoved(event: Event): Promise<void> {
    const userId = event.aggregateID;
    const instanceId = event.instanceID;
    
    await this.database.query(
      `DELETE FROM projections.login_names 
       WHERE user_id = $1 AND instance_id = $2`,
      [userId, instanceId]
    );
  }

  /**
   * Handle org.domain.added event
   */
  private async handleOrgDomainAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    const orgId = event.aggregateID;
    const instanceId = event.instanceID;
    const domainName = payload.domain || payload.name;
    const isPrimary = payload.isPrimary || false;
    
    if (!domainName) {
      return;
    }

    // Only generate login names if domain is verified
    if (!payload.isVerified && !payload.verified) {
      return;
    }

    // Get all users in this org (may be empty if users not projected yet)
    const users = await this.getOrgUsers(orgId, instanceId);
    
    if (users.length === 0) {
      // No users yet, login names will be created when user is added
      return;
    }
    
    // Generate login names for each user with this domain
    for (const user of users) {
      if (user.username) {
        await this.insertLoginName(
          user.id,
          instanceId,
          orgId,
          `${user.username}@${domainName}`,
          domainName,
          isPrimary,
          event.createdAt
        );
      }
      
      if (user.email && user.email !== user.username) {
        await this.insertLoginName(
          user.id,
          instanceId,
          orgId,
          `${user.email}@${domainName}`,
          domainName,
          isPrimary,
          event.createdAt
        );
      }
    }
  }

  /**
   * Handle org.domain.verified event
   */
  private async handleOrgDomainVerified(event: Event): Promise<void> {
    // When domain is verified, generate login names
    await this.handleOrgDomainAdded(event);
  }

  /**
   * Handle org.domain.primary.set event
   */
  private async handleOrgDomainPrimarySet(event: Event): Promise<void> {
    const payload = event.payload || {};
    const orgId = event.aggregateID;
    const instanceId = event.instanceID;
    const domainName = payload.domain || payload.name;
    
    if (!domainName) return;

    // Mark all login names with this domain as primary
    await this.database.query(
      `UPDATE projections.login_names 
       SET is_primary = TRUE, updated_at = $1
       WHERE resource_owner = $2 AND instance_id = $3 AND domain_name = $4`,
      [event.createdAt, orgId, instanceId, domainName]
    );
    
    // Mark all other org domain login names as non-primary
    await this.database.query(
      `UPDATE projections.login_names 
       SET is_primary = FALSE, updated_at = $1
       WHERE resource_owner = $2 AND instance_id = $3 AND domain_name != $4`,
      [event.createdAt, orgId, instanceId, domainName]
    );
  }

  /**
   * Handle org.domain.removed event
   */
  private async handleOrgDomainRemoved(event: Event): Promise<void> {
    const payload = event.payload || {};
    const orgId = event.aggregateID;
    const instanceId = event.instanceID;
    const domainName = payload.domain || payload.name;
    
    if (!domainName) return;

    // Remove all login names with this domain
    await this.database.query(
      `DELETE FROM projections.login_names 
       WHERE resource_owner = $1 AND instance_id = $2 AND domain_name = $3`,
      [orgId, instanceId, domainName]
    );
  }

  /**
   * Handle instance.domain.added event
   */
  private async handleInstanceDomainAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    const instanceId = event.instanceID;
    const domainName = payload.domain || payload.name;
    
    if (!domainName) return;

    // Get all users in this instance
    const users = await this.getAllInstanceUsers(instanceId);
    
    // Generate login names for each user with this domain
    for (const user of users) {
      if (user.username) {
        await this.insertLoginName(
          user.id,
          instanceId,
          user.resourceOwner,
          `${user.username}@${domainName}`,
          domainName,
          false,
          event.createdAt
        );
      }
      
      if (user.email && user.email !== user.username) {
        await this.insertLoginName(
          user.id,
          instanceId,
          user.resourceOwner,
          `${user.email}@${domainName}`,
          domainName,
          false,
          event.createdAt
        );
      }
    }
  }

  /**
   * Handle instance.domain.primary.set event
   */
  private async handleInstanceDomainPrimarySet(event: Event): Promise<void> {
    const payload = event.payload || {};
    const instanceId = event.instanceID;
    const domainName = payload.domain || payload.name;
    
    if (!domainName) return;

    // Mark all login names with this instance domain as primary
    await this.database.query(
      `UPDATE projections.login_names 
       SET is_primary = TRUE, updated_at = $1
       WHERE instance_id = $2 AND domain_name = $3`,
      [event.createdAt, instanceId, domainName]
    );
  }

  /**
   * Helper: Get org domains
   */
  private async getOrgDomains(orgId: string, _instanceId: string): Promise<Array<{name: string, isPrimary: boolean}>> {
    try {
      const result = await this.database.queryMany(
        `SELECT domain, is_primary 
         FROM projections.org_domains 
         WHERE org_id = $1 AND is_verified = TRUE`,
        [orgId]
      );
      
      return result.map(r => ({
        name: r.domain,
        isPrimary: r.is_primary,
      }));
    } catch (error) {
      // If projections.org_domains doesn't have the domain yet, return empty array
      // This can happen due to projection timing or database closing
      return [];
    }
  }

  /**
   * Helper: Get instance domains
   * @internal - Reserved for future instance domain support
   */
  private async getInstanceDomains(instanceId: string): Promise<Array<{name: string, isPrimary: boolean}>> {
    const result = await this.database.queryMany(
      `SELECT domain 
       FROM projections.instance_domains 
       WHERE instance_id = $1`,
      [instanceId]
    );
    
    return result.map(r => ({
      name: r.domain,
      isPrimary: r.is_primary || false,
    }));
  }

  /**
   * Helper: Get org users
   */
  private async getOrgUsers(orgId: string, instanceId: string): Promise<Array<{id: string, username: string, email: string}>> {
    try {
      const result = await this.database.queryMany(
        `SELECT id, username, email 
         FROM projections.users 
         WHERE resource_owner = $1 AND instance_id = $2 AND state != 'deleted'`,
        [orgId, instanceId]
      );
      
      return result.map(r => ({
        id: r.id,
        username: r.username,
        email: r.email,
      }));
    } catch (error) {
      // Users projection might not have caught up yet
      return [];
    }
  }

  /**
   * Helper: Get all instance users
   */
  private async getAllInstanceUsers(instanceId: string): Promise<Array<{id: string, username: string, email: string, resourceOwner: string}>> {
    try {
      const result = await this.database.queryMany(
        `SELECT id, username, email, resource_owner 
         FROM projections.users 
         WHERE instance_id = $1 AND state != 'deleted'`,
        [instanceId]
      );
      
      return result.map(r => ({
        id: r.id,
        username: r.username,
        email: r.email,
        resourceOwner: r.resource_owner,
      }));
    } catch (error) {
      // Users projection might not have caught up yet
      return [];
    }
  }

  /**
   * Helper: Insert login name
   */
  private async insertLoginName(
    userId: string,
    instanceId: string,
    resourceOwner: string,
    loginName: string,
    domainName: string,
    isPrimary: boolean,
    createdAt: Date,
    changeDate?: Date,
    sequence?: number
  ): Promise<void> {
    // Phase 2: Include audit columns with defaults
    const changeDateValue = changeDate || createdAt;
    const sequenceValue = sequence || 0;
    
    await this.database.query(
      `INSERT INTO projections.login_names (
        user_id, instance_id, resource_owner, login_name, domain_name,
        is_primary, created_at, updated_at, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (instance_id, login_name) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        resource_owner = EXCLUDED.resource_owner,
        domain_name = EXCLUDED.domain_name,
        is_primary = EXCLUDED.is_primary,
        updated_at = EXCLUDED.updated_at,
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence`,
      [
        userId,
        instanceId,
        resourceOwner,
        loginName,
        domainName,
        isPrimary,
        createdAt,
        createdAt,
        changeDateValue,
        sequenceValue,
      ]
    );
  }
}

/**
 * Factory function to create login name projection config
 */
export function createLoginNameProjectionConfig(): ProjectionConfig {
  return {
    name: 'login_name_projection',
    tables: ['projections.login_names'],
    eventTypes: [
      // User events
      'user.added',
      'user.registered',
      'user.username.changed',
      'user.email.changed',
      'user.removed',
      // Org domain events
      'org.domain.added',
      'org.domain.verified',
      'org.domain.primary.set',
      'org.domain.removed',
      // Instance domain events
      'instance.domain.added',
      'instance.domain.primary.set',
    ],
  };
}
