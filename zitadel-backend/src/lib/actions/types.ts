/**
 * Actions module types for Zitadel
 * Handles custom webhooks and action flows
 */

/**
 * Action trigger types
 */
export enum ActionTrigger {
  PRE_USER_CREATE = 'pre.user.create',
  POST_USER_CREATE = 'post.user.create',
  PRE_AUTH = 'pre.authentication',
  POST_AUTH = 'post.authentication',
  PRE_TOKEN_ISSUE = 'pre.token.issue',
  POST_TOKEN_ISSUE = 'post.token.issue',
  PRE_USER_UPDATE = 'pre.user.update',
  POST_USER_UPDATE = 'post.user.update',
}

/**
 * Action execution status
 */
export enum ActionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
}

/**
 * Action configuration
 */
export interface Action {
  id: string;
  name: string;
  trigger: ActionTrigger;
  enabled: boolean;
  script?: string;
  webhookUrl?: string;
  timeout: number; // milliseconds
  retries: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Action execution context
 */
export interface ActionContext {
  trigger: ActionTrigger;
  event: any;
  user?: any;
  org?: any;
  metadata: Record<string, any>;
}

/**
 * Action execution result
 */
export interface ActionResult {
  actionId: string;
  status: ActionStatus;
  output?: any;
  error?: string;
  duration: number; // milliseconds
  executedAt: Date;
}

/**
 * Action executor interface
 */
export interface ActionExecutor {
  /**
   * Execute action
   */
  execute(action: Action, context: ActionContext): Promise<ActionResult>;

  /**
   * Execute all actions for trigger
   */
  executeForTrigger(trigger: ActionTrigger, context: ActionContext): Promise<ActionResult[]>;
}

/**
 * Action manager interface
 */
export interface ActionManager {
  /**
   * Register action
   */
  register(action: Action): Promise<void>;

  /**
   * Get action by ID
   */
  get(actionId: string): Promise<Action | null>;

  /**
   * Get actions for trigger
   */
  getByTrigger(trigger: ActionTrigger): Promise<Action[]>;

  /**
   * Update action
   */
  update(actionId: string, updates: Partial<Action>): Promise<void>;

  /**
   * Delete action
   */
  delete(actionId: string): Promise<void>;

  /**
   * Enable/disable action
   */
  setEnabled(actionId: string, enabled: boolean): Promise<void>;
}

/**
 * Action errors
 */
export class ActionError extends Error {
  constructor(message: string, public code: string = 'ACTION_ERROR') {
    super(message);
    this.name = 'ActionError';
  }
}

export class ActionTimeoutError extends ActionError {
  constructor(actionId: string) {
    super(`Action ${actionId} timed out`, 'ACTION_TIMEOUT');
    this.name = 'ActionTimeoutError';
  }
}

export class ActionNotFoundError extends ActionError {
  constructor(actionId: string) {
    super(`Action ${actionId} not found`, 'ACTION_NOT_FOUND');
    this.name = 'ActionNotFoundError';
  }
}
