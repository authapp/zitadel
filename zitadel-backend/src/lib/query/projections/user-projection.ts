/**
 * User Projection - Zitadel-style
 * 
 * Handles user events and materializes them into the users_projection table
 * This runs asynchronously in the background via ProjectionManager
 */

import { Event } from '../../eventstore/types';
import { UserRepository } from '../../repositories/user-repository';
import { DatabasePool } from '../../database';

export interface UserProjectionState {
  id: string;
  instanceId: string;
  resourceOwner: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  passwordHash?: string;
  state: 'active' | 'inactive' | 'locked';
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User projection reducer - maps events to projection state changes
 * 
 * This is a pure function that takes an event and current state,
 * and returns the new projection state
 */
export class UserProjection {
  constructor(
    private repository: UserRepository
  ) {}

  /**
   * Reduce a single event into projection state
   * 
   * @param event - The event to process
   * @param currentState - Current projection state (null if doesn't exist)
   * @returns New projection state, or null to delete
   */
  async reduce(event: Event, currentState: UserProjectionState | null): Promise<UserProjectionState | null> {
    switch (event.eventType) {
      case 'user.created':
        return this.reduceUserCreated(event, currentState);
      
      case 'user.updated':
        return this.reduceUserUpdated(event, currentState);
      
      case 'user.password.changed':
        return this.reducePasswordChanged(event, currentState);
      
      case 'user.deactivated':
        return this.reduceUserDeactivated(event, currentState);
      
      case 'user.reactivated':
        return this.reduceUserReactivated(event, currentState);
      
      case 'user.deleted':
        return null; // Returning null deletes the projection
      
      default:
        // Unknown event type, return current state unchanged
        return currentState;
    }
  }

  /**
   * Reducer: user.created
   */
  private reduceUserCreated(event: Event, _currentState: UserProjectionState | null): UserProjectionState {
    const data = event.eventData as any;
    
    return {
      id: event.aggregateID,
      instanceId: event.instanceID,
      resourceOwner: event.resourceOwner,
      username: data.username,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: data.displayName || `${data.firstName} ${data.lastName}`.trim(),
      phone: data.phone,
      passwordHash: data.passwordHash, // Store hashed password
      state: 'active',
      createdAt: event.creationDate,
      updatedAt: event.creationDate,
    };
  }

  /**
   * Reducer: user.updated
   */
  private reduceUserUpdated(event: Event, currentState: UserProjectionState | null): UserProjectionState | null {
    if (!currentState) {
      // Can't update what doesn't exist
      console.warn(`Cannot update non-existent user: ${event.aggregateID}`);
      return null;
    }

    const data = event.eventData as any;
    
    return {
      ...currentState,
      email: data.email ?? currentState.email,
      firstName: data.firstName ?? currentState.firstName,
      lastName: data.lastName ?? currentState.lastName,
      displayName: data.displayName ?? currentState.displayName,
      phone: data.phone ?? currentState.phone,
      updatedAt: event.creationDate,
    };
  }

  /**
   * Reducer: user.password.changed
   */
  private reducePasswordChanged(event: Event, currentState: UserProjectionState | null): UserProjectionState | null {
    if (!currentState) {
      console.warn(`Cannot change password for non-existent user: ${event.aggregateID}`);
      return null;
    }

    const data = event.eventData as any;
    
    return {
      ...currentState,
      passwordHash: data.passwordHash, // Update password hash
      updatedAt: event.creationDate,
    };
  }

  /**
   * Reducer: user.deactivated
   */
  private reduceUserDeactivated(event: Event, currentState: UserProjectionState | null): UserProjectionState | null {
    if (!currentState) {
      return null;
    }

    return {
      ...currentState,
      state: 'inactive',
      updatedAt: event.creationDate,
    };
  }

  /**
   * Reducer: user.reactivated
   */
  private reduceUserReactivated(event: Event, currentState: UserProjectionState | null): UserProjectionState | null {
    if (!currentState) {
      return null;
    }

    return {
      ...currentState,
      state: 'active',
      updatedAt: event.creationDate,
    };
  }

  /**
   * Apply projection state to database
   * 
   * This is called by the ProjectionManager after reduce()
   */
  async apply(state: UserProjectionState): Promise<void> {
    // Check if user exists
    const existing = await this.repository.findById(state.id);
    
    if (existing) {
      // Update existing user
      await this.repository.update(state.id, {
        email: state.email,
        firstName: state.firstName,
        lastName: state.lastName,
        displayName: state.displayName,
        phone: state.phone,
        state: state.state,
      });
    } else {
      // Create new user
      await this.repository.create({
        id: state.id,
        instanceId: state.instanceId,
        resourceOwner: state.resourceOwner,
        username: state.username,
        email: state.email,
        firstName: state.firstName,
        lastName: state.lastName,
        displayName: state.displayName,
        phone: state.phone,
        state: state.state,
      });
    }
  }

  /**
   * Delete projection from database
   * Note: We use soft delete by marking as inactive
   */
  async delete(userId: string): Promise<void> {
    // Mark as inactive (soft delete)
    await this.repository.update(userId, {
      state: 'inactive',
    });
  }
}

/**
 * Create user projection configuration for ProjectionManager
 */
export function createUserProjectionConfig(pool: DatabasePool) {
  const repository = new UserRepository(pool);
  const projection = new UserProjection(repository);

  return {
    name: 'users',
    table: 'users_projection',
    eventTypes: [
      'user.created',
      'user.updated',
      'user.password.changed',
      'user.deactivated',
      'user.reactivated',
      'user.deleted',
    ],
    handler: async (event: Event, currentState: any) => {
      // Convert database row (snake_case) to projection state (camelCase)
      const currentProjectionState = currentState ? {
        id: currentState.id,
        instanceId: currentState.instance_id,
        resourceOwner: currentState.resource_owner,
        username: currentState.username,
        email: currentState.email,
        firstName: currentState.first_name,
        lastName: currentState.last_name,
        displayName: currentState.display_name,
        phone: currentState.phone,
        state: currentState.state,
        createdAt: currentState.created_at,
        updatedAt: currentState.updated_at,
      } as UserProjectionState : null;
      
      // Reduce event to new state
      const newState = await projection.reduce(event, currentProjectionState);
      
      if (newState === null) {
        // Delete projection
        if (currentProjectionState) {
          await projection.delete(currentProjectionState.id);
        }
        return null;
      }
      
      // Apply projection (writes to database via repository)
      await projection.apply(newState);
      
      // Return null to indicate we handled the database write ourselves
      // ProjectionManager won't try to upsert
      return null;
    },
    batchSize: 100,
    parallelism: 1,
  };
}
