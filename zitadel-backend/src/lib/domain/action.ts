/**
 * Action Domain Types
 * 
 * Custom actions/scripts that can be executed at trigger points
 * Based on Go: internal/domain/action.go
 */

/**
 * Action State enumeration
 */
export enum ActionState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  REMOVED = 3,
}

/**
 * Action model
 */
export interface Action {
  id?: string;
  name: string;
  script: string;
  timeout: number; // milliseconds
  allowedToFail: boolean;
  state?: ActionState;
}

/**
 * Check if action state exists (not unspecified or removed)
 */
export function actionStateExists(state: ActionState): boolean {
  return state !== ActionState.UNSPECIFIED && state !== ActionState.REMOVED;
}

/**
 * Check if action is valid
 */
export function isActionValid(action: Action): boolean {
  return !!action.name && action.name.length > 0 && 
         !!action.script && action.script.length > 0;
}

/**
 * Actions Allowed limits
 */
export enum ActionsAllowed {
  NOT_ALLOWED = 0,
  MAX_ALLOWED = 1,
  UNLIMITED = 2,
}
