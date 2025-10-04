/**
 * Action executor implementation
 */

import {
  Action,
  ActionContext,
  ActionResult,
  ActionStatus,
  ActionTrigger,
  ActionExecutor,
  ActionManager,
  ActionTimeoutError,
} from './types';

/**
 * Default action executor
 */
export class DefaultActionExecutor implements ActionExecutor {
  constructor(private actionManager: ActionManager) {}

  /**
   * Execute action
   */
  async execute(action: Action, context: ActionContext): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      // Check if action is enabled
      if (!action.enabled) {
        return {
          actionId: action.id,
          status: ActionStatus.SUCCESS,
          output: { skipped: true, reason: 'Action disabled' },
          duration: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      // Execute with timeout
      const output = await this.executeWithTimeout(action, context);

      return {
        actionId: action.id,
        status: ActionStatus.SUCCESS,
        output,
        duration: Date.now() - startTime,
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        actionId: action.id,
        status: error instanceof ActionTimeoutError ? ActionStatus.TIMEOUT : ActionStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        executedAt: new Date(),
      };
    }
  }

  /**
   * Execute all actions for trigger
   */
  async executeForTrigger(
    trigger: ActionTrigger,
    context: ActionContext
  ): Promise<ActionResult[]> {
    const actions = await this.actionManager.getByTrigger(trigger);
    const results: ActionResult[] = [];

    for (const action of actions) {
      const result = await this.execute(action, context);
      results.push(result);

      // Stop if action failed and is critical
      if (result.status === ActionStatus.FAILED && trigger.startsWith('pre.')) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute action with timeout
   */
  private async executeWithTimeout(action: Action, context: ActionContext): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new ActionTimeoutError(action.id));
      }, action.timeout);

      this.executeAction(action, context)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Execute action logic
   */
  private async executeAction(action: Action, context: ActionContext): Promise<any> {
    // If action has a webhook URL, call it
    if (action.webhookUrl) {
      return this.callWebhook(action.webhookUrl, context);
    }

    // If action has a script, execute it
    if (action.script) {
      return this.executeScript(action.script, context);
    }

    return { success: true };
  }

  /**
   * Call webhook
   */
  private async callWebhook(url: string, context: ActionContext): Promise<any> {
    // Simplified webhook call - in production, use a proper HTTP client
    // For now, just simulate the call
    return {
      webhookCalled: true,
      url,
      trigger: context.trigger,
    };
  }

  /**
   * Execute script
   */
  private async executeScript(_script: string, _context: ActionContext): Promise<any> {
    // Simplified script execution - in production, use a sandboxed environment
    // For now, just simulate execution
    return {
      scriptExecuted: true,
    };
  }
}

/**
 * In-memory action executor for testing
 */
export class InMemoryActionExecutor implements ActionExecutor {
  private executionLog: ActionResult[] = [];

  constructor(private actionManager: ActionManager) {}

  async execute(action: Action, context: ActionContext): Promise<ActionResult> {
    const result: ActionResult = {
      actionId: action.id,
      status: action.enabled ? ActionStatus.SUCCESS : ActionStatus.SUCCESS,
      output: action.enabled ? { executed: true, context } : { skipped: true },
      duration: 10,
      executedAt: new Date(),
    };

    this.executionLog.push(result);
    return result;
  }

  async executeForTrigger(trigger: ActionTrigger, context: ActionContext): Promise<ActionResult[]> {
    const actions = await this.actionManager.getByTrigger(trigger);
    const results: ActionResult[] = [];

    for (const action of actions) {
      const result = await this.execute(action, context);
      results.push(result);
    }

    return results;
  }

  /**
   * Get execution log (for testing)
   */
  getExecutionLog(): ActionResult[] {
    return this.executionLog;
  }

  /**
   * Clear execution log (for testing)
   */
  clearLog(): void {
    this.executionLog = [];
  }
}

/**
 * Create action executor
 */
export function createActionExecutor(actionManager: ActionManager): ActionExecutor {
  return new DefaultActionExecutor(actionManager);
}

/**
 * Create in-memory action executor for testing
 */
export function createInMemoryActionExecutor(actionManager: ActionManager): InMemoryActionExecutor {
  return new InMemoryActionExecutor(actionManager);
}
