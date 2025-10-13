/**
 * State Converter
 * 
 * Utilities for converting between state enums and database values.
 * Based on Zitadel domain state management.
 */

/**
 * Standard Zitadel state enum
 */
export enum State {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  DELETED = 3,
  REMOVED = 4,
}

/**
 * State converter utilities
 */
export class StateConverter {
  /**
   * Convert value to State enum
   */
  static toState(value: any): State {
    if (value === null || value === undefined) {
      return State.UNSPECIFIED;
    }

    if (typeof value === 'number') {
      if (Object.values(State).includes(value)) {
        return value as State;
      }
      return State.UNSPECIFIED;
    }

    if (typeof value === 'string') {
      const upperValue = value.toUpperCase();
      switch (upperValue) {
        case 'ACTIVE':
          return State.ACTIVE;
        case 'INACTIVE':
          return State.INACTIVE;
        case 'DELETED':
          return State.DELETED;
        case 'REMOVED':
          return State.REMOVED;
        case 'UNSPECIFIED':
        default:
          return State.UNSPECIFIED;
      }
    }

    return State.UNSPECIFIED;
  }

  /**
   * Convert State enum to string
   */
  static fromState(state: State): string {
    switch (state) {
      case State.ACTIVE:
        return 'ACTIVE';
      case State.INACTIVE:
        return 'INACTIVE';
      case State.DELETED:
        return 'DELETED';
      case State.REMOVED:
        return 'REMOVED';
      case State.UNSPECIFIED:
      default:
        return 'UNSPECIFIED';
    }
  }

  /**
   * Convert State enum to number
   */
  static toNumber(state: State): number {
    return state as number;
  }

  /**
   * Check if state is active
   */
  static isActive(state: State): boolean {
    return state === State.ACTIVE;
  }

  /**
   * Check if state is inactive
   */
  static isInactive(state: State): boolean {
    return state === State.INACTIVE;
  }

  /**
   * Check if state is deleted
   */
  static isDeleted(state: State): boolean {
    return state === State.DELETED || state === State.REMOVED;
  }

  /**
   * Check if state is removed
   */
  static isRemoved(state: State): boolean {
    return state === State.REMOVED;
  }

  /**
   * Check if state is unspecified
   */
  static isUnspecified(state: State): boolean {
    return state === State.UNSPECIFIED;
  }

  /**
   * Get all active states (for filtering)
   */
  static getActiveStates(): State[] {
    return [State.ACTIVE];
  }

  /**
   * Get all inactive states (for filtering)
   */
  static getInactiveStates(): State[] {
    return [State.INACTIVE];
  }

  /**
   * Get all deleted states (for filtering)
   */
  static getDeletedStates(): State[] {
    return [State.DELETED, State.REMOVED];
  }

  /**
   * Get all non-deleted states (for filtering)
   */
  static getNonDeletedStates(): State[] {
    return [State.UNSPECIFIED, State.ACTIVE, State.INACTIVE];
  }

  /**
   * Validate state transition
   */
  static canTransition(from: State, to: State): boolean {
    // Unspecified can transition to any state
    if (from === State.UNSPECIFIED) {
      return true;
    }

    // Can't transition from deleted/removed
    if (from === State.DELETED || from === State.REMOVED) {
      return false;
    }

    // Active can transition to inactive or deleted
    if (from === State.ACTIVE) {
      return to === State.INACTIVE || to === State.DELETED || to === State.REMOVED;
    }

    // Inactive can transition to active or deleted
    if (from === State.INACTIVE) {
      return to === State.ACTIVE || to === State.DELETED || to === State.REMOVED;
    }

    return false;
  }
}
