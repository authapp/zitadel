/**
 * Unique Constraint system for enforcing business rules at event level
 * Matching Go implementation: internal/eventstore/unique_constraint.go
 */

/**
 * Action to perform on unique constraint
 */
export enum UniqueConstraintAction {
  Add = 0,
  Remove = 1,
  InstanceRemove = 2,
}

/**
 * Unique constraint definition
 * Used to enforce uniqueness of business-level values (e.g., usernames, emails)
 */
export interface UniqueConstraint {
  /** Table/type name for the unique constraint */
  uniqueType: string;
  
  /** Unique key/field value */
  uniqueField: string;
  
  /** Action to perform (add, remove, or instance remove) */
  action: UniqueConstraintAction;
  
  /** Error message key for translation */
  errorMessage?: string;
  
  /** Whether constraint is globally unique or instance-scoped */
  isGlobal?: boolean;
}

/**
 * Create a unique constraint to be added
 */
export function newAddEventUniqueConstraint(
  uniqueType: string,
  uniqueField: string,
  errorMessage: string
): UniqueConstraint {
  return {
    uniqueType,
    uniqueField,
    errorMessage,
    action: UniqueConstraintAction.Add,
    isGlobal: false,
  };
}

/**
 * Create a unique constraint to be removed
 */
export function newRemoveUniqueConstraint(
  uniqueType: string,
  uniqueField: string
): UniqueConstraint {
  return {
    uniqueType,
    uniqueField,
    action: UniqueConstraintAction.Remove,
    isGlobal: false,
  };
}

/**
 * Create a global unique constraint to be added
 */
export function newAddGlobalUniqueConstraint(
  uniqueType: string,
  uniqueField: string,
  errorMessage: string
): UniqueConstraint {
  return {
    uniqueType,
    uniqueField,
    errorMessage,
    action: UniqueConstraintAction.Add,
    isGlobal: true,
  };
}

/**
 * Create a global unique constraint to be removed
 */
export function newRemoveGlobalUniqueConstraint(
  uniqueType: string,
  uniqueField: string
): UniqueConstraint {
  return {
    uniqueType,
    uniqueField,
    action: UniqueConstraintAction.Remove,
    isGlobal: true,
  };
}

/**
 * Remove all unique constraints for an instance
 */
export function newRemoveInstanceUniqueConstraints(): UniqueConstraint {
  return {
    uniqueType: '',
    uniqueField: '',
    action: UniqueConstraintAction.InstanceRemove,
    isGlobal: false,
  };
}

/**
 * Error thrown when unique constraint is violated
 */
export class UniqueConstraintViolationError extends Error {
  constructor(
    message: string,
    public uniqueType: string,
    public uniqueField: string
  ) {
    super(message);
    this.name = 'UniqueConstraintViolationError';
  }
}
