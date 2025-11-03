/**
 * Action Service Implementation
 * Zitadel v3alpha Action API
 */

import { Context } from '../../../../lib/command/context';
import { Commands } from '../../../../lib/command/commands';
import { ActionQueries } from '../../../../lib/query/action/action-queries';
import { ActionState as DomainActionState } from '../../../../lib/domain/action';
import { ActionState as QueryActionState } from '../../../../lib/query/action/action-types';
import * as proto from '../../proto/action/v3alpha/action_service';

export class ActionService {
  constructor(
    private commands: Commands,
    private queries: ActionQueries
  ) {}

  /**
   * List all actions with optional filtering
   */
  async listActions(
    ctx: Context,
    request: proto.ListActionsRequest
  ): Promise<proto.ListActionsResponse> {
    try {
      // Query actions from database
      const actions = await this.queries.searchActions(
        ctx.instanceID,
        ctx.orgID
      );

      // Map to proto format
      const result = actions.map(action => ({
        id: action.id,
        details: {
          sequence: action.sequence,
          creationDate: action.creationDate.toISOString(),
          changeDate: action.changeDate.toISOString(),
          resourceOwner: action.resourceOwner,
        },
        state: this.mapActionState(action.state),
        name: action.name,
        script: action.script,
        timeout: `${Math.floor(action.timeout / 1000)}s`,
        allowedToFail: action.allowedToFail,
      }));

      return {
        details: {
          totalResult: result.length,
          processedSequence: result.length > 0 ? Math.max(...result.map(r => r.details.sequence)) : 0,
          viewTimestamp: new Date().toISOString(),
        },
        sortingColumn: request.sortingColumn,
        result,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get a single action by ID
   */
  async getAction(
    ctx: Context,
    request: proto.GetActionRequest
  ): Promise<proto.GetActionResponse> {
    try {
      if (!request.id) {
        throw new Error('Action ID is required');
      }

      // Query action from database
      const action = await this.queries.getActionByID(ctx.instanceID, request.id);
      
      if (!action) {
        throw new Error('Action not found');
      }

      return {
        action: {
          id: action.id,
          details: {
            sequence: action.sequence,
            creationDate: action.creationDate.toISOString(),
            changeDate: action.changeDate.toISOString(),
            resourceOwner: action.resourceOwner,
          },
          state: this.mapActionState(action.state),
          name: action.name,
          script: action.script,
          timeout: `${Math.floor(action.timeout / 1000)}s`,
          allowedToFail: action.allowedToFail,
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a new action
   */
  async createAction(
    ctx: Context,
    request: proto.CreateActionRequest
  ): Promise<proto.CreateActionResponse> {
    try {
      // Validate required fields
      if (!request.name) {
        throw new Error('Action name is required');
      }
      if (!request.script) {
        throw new Error('Action script is required');
      }
      if (!ctx.orgID) {
        throw new Error('Organization ID is required');
      }

      // Parse timeout (convert from string like "10s" to milliseconds)
      const timeoutMs = request.timeout ? this.parseTimeout(request.timeout) : 10000;

      // Create action via command
      const result = await this.commands.addAction(ctx, ctx.orgID, {
        name: request.name,
        script: request.script,
        timeout: timeoutMs,
        allowedToFail: request.allowedToFail ?? false,
        state: DomainActionState.ACTIVE,
      });

      return {
        id: result.id,
        details: {
          sequence: Number(result.details.sequence),
          creationDate: result.details.eventDate.toISOString(),
          changeDate: result.details.eventDate.toISOString(),
          resourceOwner: result.details.resourceOwner,
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update an existing action
   */
  async updateAction(
    ctx: Context,
    request: proto.UpdateActionRequest
  ): Promise<proto.UpdateActionResponse> {
    try {
      if (!request.id) {
        throw new Error('Action ID is required');
      }
      if (!ctx.orgID) {
        throw new Error('Organization ID is required');
      }

      // Parse timeout if provided
      const timeoutMs = request.timeout ? this.parseTimeout(request.timeout) : undefined;

      // Build update data
      const updates: any = {
        name: request.name || '',
        script: request.script || '',
        timeout: timeoutMs || 10000,
        allowedToFail: request.allowedToFail ?? false,
        state: DomainActionState.ACTIVE,
      };

      // Update action via command
      const result = await this.commands.changeAction(ctx, ctx.orgID, request.id, updates);

      return {
        details: {
          sequence: Number(result.sequence),
          creationDate: result.eventDate.toISOString(),
          changeDate: result.eventDate.toISOString(),
          resourceOwner: result.resourceOwner,
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Deactivate an action
   */
  async deactivateAction(
    ctx: Context,
    request: proto.DeactivateActionRequest
  ): Promise<proto.DeactivateActionResponse> {
    try {
      if (!request.id) {
        throw new Error('Action ID is required');
      }
      if (!ctx.orgID) {
        throw new Error('Organization ID is required');
      }

      // Deactivate action via command
      const result = await this.commands.deactivateAction(ctx, ctx.orgID, request.id);

      return {
        details: {
          sequence: Number(result.sequence),
          creationDate: result.eventDate.toISOString(),
          changeDate: result.eventDate.toISOString(),
          resourceOwner: result.resourceOwner,
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Reactivate an action
   */
  async reactivateAction(
    ctx: Context,
    request: proto.ReactivateActionRequest
  ): Promise<proto.ReactivateActionResponse> {
    try {
      if (!request.id) {
        throw new Error('Action ID is required');
      }
      if (!ctx.orgID) {
        throw new Error('Organization ID is required');
      }

      // Reactivate action via command
      const result = await this.commands.reactivateAction(ctx, ctx.orgID, request.id);

      return {
        details: {
          sequence: Number(result.sequence),
          creationDate: result.eventDate.toISOString(),
          changeDate: result.eventDate.toISOString(),
          resourceOwner: result.resourceOwner,
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete an action
   */
  async deleteAction(
    ctx: Context,
    request: proto.DeleteActionRequest
  ): Promise<proto.DeleteActionResponse> {
    try {
      if (!request.id) {
        throw new Error('Action ID is required');
      }
      if (!ctx.orgID) {
        throw new Error('Organization ID is required');
      }

      // Delete action via command
      const result = await this.commands.deleteAction(ctx, ctx.orgID, request.id);

      return {
        details: {
          sequence: Number(result.sequence),
          creationDate: result.eventDate.toISOString(),
          changeDate: result.eventDate.toISOString(),
          resourceOwner: result.resourceOwner,
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * List executions (action targets and includes)
   */
  async listExecutions(
    ctx: Context,
    _request: proto.ListExecutionsRequest
  ): Promise<proto.ListExecutionsResponse> {
    try {
      // Query executions from database
      const executions = await this.queries.searchExecutions(
        ctx.instanceID,
        ctx.orgID
      );

      // Map to proto format
      const result: proto.Execution[] = executions.map(execution => ({
        id: execution.id,
        details: {
          sequence: execution.sequence,
          creationDate: execution.creationDate.toISOString(),
          changeDate: execution.changeDate.toISOString(),
          resourceOwner: execution.resourceOwner,
        },
        targets: execution.targets || [],
        includes: [],
      }));

      return {
        details: {
          totalResult: executions.length,
          processedSequence: 0,
          viewTimestamp: new Date().toISOString(),
        },
        result,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get a single execution by ID
   */
  async getExecution(
    ctx: Context,
    request: proto.GetExecutionRequest
  ): Promise<proto.GetExecutionResponse> {
    try {
      if (!request.id) {
        throw new Error('Execution ID is required');
      }

      // Query execution from database
      const execution = await this.queries.getExecutionByID(
        ctx.instanceID,
        request.id
      );

      if (!execution) {
        throw new Error('Execution not found');
      }
      
      return {
        execution: {
          id: execution.id,
          details: {
            sequence: execution.sequence,
            creationDate: execution.creationDate.toISOString(),
            changeDate: execution.changeDate.toISOString(),
            resourceOwner: execution.resourceOwner,
          },
          targets: execution.targets || [],
          includes: [],
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Parse timeout string (e.g., "10s", "1m") to milliseconds
   */
  private parseTimeout(timeout: string): number {
    const match = timeout.match(/^(\d+)(s|m|h)?$/);
    if (!match) {
      return 10000; // Default 10s
    }

    const value = parseInt(match[1]);
    const unit = match[2] || 's';

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return value * 1000;
    }
  }

  /**
   * Map ActionState enum to proto state
   */
  private mapActionState(state: QueryActionState): number {
    switch (state) {
      case QueryActionState.ACTIVE: return 2;  // Query has ACTIVE = 2
      case QueryActionState.INACTIVE: return 1;  // Query has INACTIVE = 1
      default: return 0;
    }
  }

  /**
   * Handle and convert errors to gRPC format
   */
  private handleError(error: any): Error {
    if (error.message) {
      return new Error(error.message);
    }
    return new Error('Internal server error');
  }
}
