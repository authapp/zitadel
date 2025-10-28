/**
 * Organization Users Write Model
 * 
 * Tracks all usernames in an organization for uniqueness validation.
 * Used in event sourcing to validate username uniqueness before creating user events.
 * 
 * This follows Option 3 from the architectural decision:
 * - Validates in aggregate before creating event
 * - Loads all users in org into write model
 * - Ensures proper event sourcing (no query before command)
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';
import { UserState } from '../../domain/user';

/**
 * Tracks a single user in the organization
 */
interface OrgUser {
  userID: string;
  username: string;
  state: UserState;
}

/**
 * Organization Users Write Model
 * 
 * Loads all user events for an organization and tracks:
 * - Active usernames
 * - Deleted/removed users (to allow username reuse)
 */
export class OrgUsersWriteModel extends WriteModel {
  users: Map<string, OrgUser> = new Map();
  usernames: Map<string, string> = new Map(); // username -> userID
  
  constructor(orgID: string) {
    super('org');
    this.aggregateID = orgID;
    this.resourceOwner = orgID;
  }
  
  /**
   * Load all user events for this organization
   */
  async load(eventstore: any, orgID: string): Promise<void> {
    // Load all user events for this organization
    // The eventstore will filter by resource_owner = orgID
    const events = await eventstore.query({
      aggregateTypes: ['user'],
      resourceOwner: orgID,
    });
    
    for (const event of events) {
      this.reduce(event);
    }
  }
  
  reduce(event: Event): void {
    const userID = event.aggregateID;
    
    switch (event.eventType) {
      case 'user.human.added':
      case 'user.v2.added':
      case 'user.machine.added': {
        const username = event.payload?.username;
        if (!username) break;
        
        const user: OrgUser = {
          userID,
          username,
          state: UserState.ACTIVE,
        };
        
        this.users.set(userID, user);
        this.usernames.set(username.toLowerCase(), userID);
        break;
      }
      
      case 'user.username.changed': {
        const user = this.users.get(userID);
        if (!user) break;
        
        const newUsername = event.payload?.username;
        if (!newUsername) break;
        
        // Remove old username mapping
        this.usernames.delete(user.username.toLowerCase());
        
        // Add new username mapping
        user.username = newUsername;
        this.usernames.set(newUsername.toLowerCase(), userID);
        break;
      }
      
      case 'user.removed':
      case 'user.deleted': {
        const user = this.users.get(userID);
        if (!user) break;
        
        // Mark as deleted (allows username reuse)
        user.state = UserState.DELETED;
        
        // Remove username mapping (username can be reused)
        this.usernames.delete(user.username.toLowerCase());
        break;
      }
      
      case 'user.deactivated': {
        const user = this.users.get(userID);
        if (user) {
          user.state = UserState.INACTIVE;
          // Note: Deactivated users keep their username reserved
        }
        break;
      }
      
      case 'user.reactivated': {
        const user = this.users.get(userID);
        if (user) {
          user.state = UserState.ACTIVE;
        }
        break;
      }
      
      case 'user.locked': {
        const user = this.users.get(userID);
        if (user) {
          user.state = UserState.LOCKED;
          // Note: Locked users keep their username reserved
        }
        break;
      }
      
      case 'user.unlocked': {
        const user = this.users.get(userID);
        if (user) {
          user.state = UserState.ACTIVE;
        }
        break;
      }
    }
  }
  
  /**
   * Check if username is already taken in this organization
   * 
   * @param username - Username to check (case-insensitive)
   * @returns true if username is taken, false if available
   */
  isUsernameTaken(username: string): boolean {
    return this.usernames.has(username.toLowerCase());
  }
  
  /**
   * Get the userID that has this username
   * 
   * @param username - Username to look up (case-insensitive)
   * @returns userID if found, undefined if available
   */
  getUserIDByUsername(username: string): string | undefined {
    return this.usernames.get(username.toLowerCase());
  }
  
  /**
   * Get count of active users in organization
   */
  getActiveUserCount(): number {
    let count = 0;
    for (const user of this.users.values()) {
      if (user.state === UserState.ACTIVE) {
        count++;
      }
    }
    return count;
  }
}
