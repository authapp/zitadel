/**
 * Action & Flow Queries
 * Handles actions, flows, executions, targets, and metadata queries
 * Based on Zitadel Go internal/query/action.go, flow.go, execution.go, metadata.go
 */

import { DatabasePool } from '../../database';
import { 
  Action, 
  ActionState, 
  Flow, 
  FlowType, 
  TriggerType, 
  Execution, 
  Target,
  UserMetadata,
  UserSchema 
} from './action-types';

export class ActionQueries {
  constructor(private readonly database: DatabasePool) {}

  // ===== Action Methods =====

  /**
   * Get action by ID
   * @param instanceID - Instance ID
   * @param actionID - Action ID
   * @returns Action or null
   */
  async getActionByID(instanceID: string, actionID: string): Promise<Action | null> {
    const query = `
      SELECT 
        id, instance_id, resource_owner, creation_date, change_date, sequence,
        name, script, 
        EXTRACT(epoch FROM timeout) * 1000 as timeout_ms,
        allowed_to_fail, state
      FROM projections.actions
      WHERE instance_id = $1 AND id = $2
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, actionID]);
    return result ? this.mapToAction(result) : null;
  }

  /**
   * Search actions
   * @param instanceID - Instance ID
   * @param resourceOwner - Resource owner (optional)
   * @returns Array of actions
   */
  async searchActions(instanceID: string, resourceOwner?: string): Promise<Action[]> {
    let query = `
      SELECT 
        id, instance_id, resource_owner, creation_date, change_date, sequence,
        name, script, 
        EXTRACT(epoch FROM timeout) * 1000 as timeout_ms,
        allowed_to_fail, state
      FROM projections.actions
      WHERE instance_id = $1
    `;

    const params: any[] = [instanceID];

    if (resourceOwner) {
      query += ` AND resource_owner = $2`;
      params.push(resourceOwner);
    }

    query += ` ORDER BY name`;

    const result = await this.database.query(query, params);
    return result.rows.map(row => this.mapToAction(row));
  }

  // ===== Flow Methods =====

  /**
   * Get flow by type
   * @param instanceID - Instance ID
   * @param flowType - Flow type
   * @returns Flow or null
   */
  async getFlow(instanceID: string, flowType: FlowType): Promise<Flow | null> {
    const query = `
      SELECT 
        flow_type, trigger_type, action_ids
      FROM projections.flows
      WHERE instance_id = $1 AND flow_type = $2
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, flowType]);
    return result ? this.mapToFlow(result) : null;
  }

  /**
   * Get active actions by flow and trigger type
   * @param instanceID - Instance ID
   * @param flowType - Flow type
   * @param triggerType - Trigger type
   * @returns Array of action IDs
   */
  async getActiveActionsByFlowAndTriggerType(
    instanceID: string,
    flowType: FlowType,
    triggerType: TriggerType
  ): Promise<string[]> {
    const query = `
      SELECT action_ids
      FROM projections.flows
      WHERE instance_id = $1 AND flow_type = $2 AND trigger_type = $3
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, flowType, triggerType]);
    return result?.action_ids || [];
  }

  /**
   * Get flow types of action ID
   * Returns which flows use this action
   * @param instanceID - Instance ID
   * @param actionID - Action ID
   * @returns Array of flow types
   */
  async getFlowTypesOfActionID(instanceID: string, actionID: string): Promise<FlowType[]> {
    const query = `
      SELECT flow_type
      FROM projections.flows
      WHERE instance_id = $1 AND $2 = ANY(action_ids)
    `;

    const result = await this.database.query(query, [instanceID, actionID]);
    return result.rows.map(row => row.flow_type);
  }

  // ===== Execution Methods =====

  /**
   * Search executions
   * @param instanceID - Instance ID
   * @returns Array of executions
   */
  async searchExecutions(instanceID: string): Promise<Execution[]> {
    const query = `
      SELECT 
        id, instance_id, creation_date, change_date, sequence,
        targets, includes, excludes
      FROM projections.executions
      WHERE instance_id = $1
      ORDER BY creation_date DESC
    `;

    const result = await this.database.query(query, [instanceID]);
    return result.rows.map(row => this.mapToExecution(row));
  }

  /**
   * Get execution by ID
   * @param instanceID - Instance ID
   * @param executionID - Execution ID
   * @returns Execution or null
   */
  async getExecutionByID(instanceID: string, executionID: string): Promise<Execution | null> {
    const query = `
      SELECT 
        id, instance_id, creation_date, change_date, sequence,
        targets, includes, excludes
      FROM projections.executions
      WHERE instance_id = $1 AND id = $2
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, executionID]);
    return result ? this.mapToExecution(result) : null;
  }

  // ===== Target Methods =====

  /**
   * Search targets
   * @param instanceID - Instance ID
   * @returns Array of targets
   */
  async searchTargets(instanceID: string): Promise<Target[]> {
    const query = `
      SELECT 
        id, instance_id, resource_owner, creation_date, change_date, sequence,
        name, target_type, endpoint, timeout
      FROM projections.targets
      WHERE instance_id = $1
      ORDER BY name
    `;

    const result = await this.database.query(query, [instanceID]);
    return result.rows.map(row => this.mapToTarget(row));
  }

  /**
   * Get target by ID
   * @param instanceID - Instance ID
   * @param targetID - Target ID
   * @returns Target or null
   */
  async getTargetByID(instanceID: string, targetID: string): Promise<Target | null> {
    const query = `
      SELECT 
        id, instance_id, resource_owner, creation_date, change_date, sequence,
        name, target_type, endpoint, timeout
      FROM projections.targets
      WHERE instance_id = $1 AND id = $2
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, targetID]);
    return result ? this.mapToTarget(result) : null;
  }

  // ===== User Metadata Methods =====

  /**
   * Get user metadata
   * @param userID - User ID
   * @param key - Metadata key
   * @returns User metadata or null
   */
  async getUserMetadata(userID: string, key: string): Promise<UserMetadata | null> {
    const query = `
      SELECT 
        user_id, key, value, creation_date, change_date
      FROM projections.user_metadata
      WHERE user_id = $1 AND key = $2
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [userID, key]);
    return result ? this.mapToUserMetadata(result) : null;
  }

  /**
   * Search user metadata
   * @param userID - User ID
   * @returns Array of user metadata
   */
  async searchUserMetadata(userID: string): Promise<UserMetadata[]> {
    const query = `
      SELECT 
        user_id, key, value, creation_date, change_date
      FROM projections.user_metadata
      WHERE user_id = $1
      ORDER BY key
    `;

    const result = await this.database.query(query, [userID]);
    return result.rows.map(row => this.mapToUserMetadata(row));
  }

  // ===== User Schema Methods =====

  /**
   * Get user schema
   * @param instanceID - Instance ID
   * @param schemaID - Schema ID
   * @returns User schema or null
   */
  async getUserSchema(instanceID: string, schemaID: string): Promise<UserSchema | null> {
    const query = `
      SELECT 
        id, instance_id, creation_date, change_date,
        type, schema, possible_authenticators
      FROM projections.user_schemas
      WHERE instance_id = $1 AND id = $2
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, schemaID]);
    return result ? this.mapToUserSchema(result) : null;
  }

  /**
   * Search user schemas
   * @param instanceID - Instance ID
   * @returns Array of user schemas
   */
  async searchUserSchemas(instanceID: string): Promise<UserSchema[]> {
    const query = `
      SELECT 
        id, instance_id, creation_date, change_date,
        type, schema, possible_authenticators
      FROM projections.user_schemas
      WHERE instance_id = $1
      ORDER BY type
    `;

    const result = await this.database.query(query, [instanceID]);
    return result.rows.map(row => this.mapToUserSchema(row));
  }

  // ===== Private Mapping Methods =====

  private mapToAction(row: any): Action {
    // Use timeout_ms if available (from EXTRACT), otherwise try to parse timeout interval
    let timeoutMs = 10000; // default
    if (row.timeout_ms !== undefined && row.timeout_ms !== null) {
      timeoutMs = Math.floor(Number(row.timeout_ms));
    } else if (row.timeout) {
      // Fallback: Parse PostgreSQL interval if timeout_ms not available
      if (typeof row.timeout === 'object' && row.timeout.milliseconds !== undefined) {
        timeoutMs = row.timeout.milliseconds;
      } else if (typeof row.timeout === 'string') {
        const match = row.timeout.match(/(\d+):(\d+):(\d+)\.?(\d+)?/);
        if (match) {
          const hours = parseInt(match[1]) || 0;
          const minutes = parseInt(match[2]) || 0;
          const seconds = parseInt(match[3]) || 0;
          const ms = parseInt(match[4]) || 0;
          timeoutMs = (hours * 3600 + minutes * 60 + seconds) * 1000 + ms;
        }
      }
    }
    
    return {
      id: row.id,
      instanceID: row.instance_id,
      resourceOwner: row.resource_owner,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
      name: row.name || '',
      script: row.script || '',
      timeout: timeoutMs,
      allowedToFail: row.allowed_to_fail || false,
      state: row.state || ActionState.INACTIVE,
    };
  }

  private mapToFlow(row: any): Flow {
    return {
      flowType: row.flow_type,
      triggerType: row.trigger_type,
      actionIDs: row.action_ids || [],
    };
  }

  private mapToExecution(row: any): Execution {
    return {
      id: row.id,
      instanceID: row.instance_id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
      targets: row.targets || [],
      includes: row.includes || [],
      excludes: row.excludes || [],
    };
  }

  private mapToTarget(row: any): Target {
    return {
      id: row.id,
      instanceID: row.instance_id,
      resourceOwner: row.resource_owner,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
      name: row.name || '',
      targetType: row.target_type || 'webhook',
      endpoint: row.endpoint || '',
      timeout: Number(row.timeout) || 10000,
    };
  }

  private mapToUserMetadata(row: any): UserMetadata {
    return {
      userID: row.user_id,
      key: row.key,
      value: row.value,
      creationDate: row.creation_date,
      changeDate: row.change_date,
    };
  }

  private mapToUserSchema(row: any): UserSchema {
    return {
      id: row.id,
      instanceID: row.instance_id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      type: row.type || '',
      schema: row.schema || {},
      possibleAuthenticators: row.possible_authenticators || [],
    };
  }
}
