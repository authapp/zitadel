/**
 * Action manager implementation
 */

import { generateId } from '../id/snowflake';
import {
  Action,
  ActionTrigger,
  ActionManager,
  ActionNotFoundError,
} from './types';

/**
 * In-memory action manager
 */
export class InMemoryActionManager implements ActionManager {
  private actions = new Map<string, Action>();
  private triggerIndex = new Map<ActionTrigger, Set<string>>();

  /**
   * Register action
   */
  async register(action: Action): Promise<void> {
    // Generate ID if not provided
    if (!action.id) {
      action.id = generateId();
    }

    // Store action
    this.actions.set(action.id, {
      ...action,
      createdAt: action.createdAt || new Date(),
      updatedAt: new Date(),
    });

    // Update trigger index
    if (!this.triggerIndex.has(action.trigger)) {
      this.triggerIndex.set(action.trigger, new Set());
    }
    this.triggerIndex.get(action.trigger)!.add(action.id);
  }

  /**
   * Get action by ID
   */
  async get(actionId: string): Promise<Action | null> {
    return this.actions.get(actionId) || null;
  }

  /**
   * Get actions for trigger
   */
  async getByTrigger(trigger: ActionTrigger): Promise<Action[]> {
    const actionIds = this.triggerIndex.get(trigger);
    if (!actionIds) {
      return [];
    }

    const actions: Action[] = [];
    for (const id of actionIds) {
      const action = this.actions.get(id);
      if (action) {
        actions.push(action);
      }
    }

    // Sort by creation date (oldest first)
    return actions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Update action
   */
  async update(actionId: string, updates: Partial<Action>): Promise<void> {
    const action = this.actions.get(actionId);
    if (!action) {
      throw new ActionNotFoundError(actionId);
    }

    // If trigger is changing, update index
    if (updates.trigger && updates.trigger !== action.trigger) {
      this.triggerIndex.get(action.trigger)?.delete(actionId);
      if (!this.triggerIndex.has(updates.trigger)) {
        this.triggerIndex.set(updates.trigger, new Set());
      }
      this.triggerIndex.get(updates.trigger)!.add(actionId);
    }

    // Update action
    this.actions.set(actionId, {
      ...action,
      ...updates,
      id: actionId, // Preserve ID
      updatedAt: new Date(),
    });
  }

  /**
   * Delete action
   */
  async delete(actionId: string): Promise<void> {
    const action = this.actions.get(actionId);
    if (action) {
      this.actions.delete(actionId);
      this.triggerIndex.get(action.trigger)?.delete(actionId);
    }
  }

  /**
   * Enable/disable action
   */
  async setEnabled(actionId: string, enabled: boolean): Promise<void> {
    await this.update(actionId, { enabled });
  }

  /**
   * Get all actions (for testing)
   */
  getAll(): Action[] {
    return Array.from(this.actions.values());
  }
}

/**
 * Create action manager
 */
export function createActionManager(): ActionManager {
  return new InMemoryActionManager();
}
