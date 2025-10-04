/**
 * Actions module for Zitadel
 * 
 * Provides:
 * - Custom webhooks
 * - Action flows and triggers
 * - Pre/post event hooks
 * - Script execution
 */

export * from './types';
export * from './action-executor';
export * from './action-manager';

// Re-export commonly used types
export type {
  Action,
  ActionContext,
  ActionResult,
  ActionExecutor,
  ActionManager,
} from './types';

export {
  ActionTrigger,
  ActionStatus,
  ActionError,
  ActionTimeoutError,
  ActionNotFoundError,
} from './types';

export {
  DefaultActionExecutor,
  InMemoryActionExecutor,
  createActionExecutor,
  createInMemoryActionExecutor,
} from './action-executor';

export {
  InMemoryActionManager,
  createActionManager,
} from './action-manager';
