/**
 * Execution Commands
 * 
 * Commands for managing executions (condition-based routing to targets)
 * Based on Zitadel Go: internal/command/action_v2_execution.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { ExecutionWriteModel, ExecutionsExistWriteModel } from './execution-write-model';
import { TargetWriteModel } from './target-write-model';
import {
  ExecutionType,
  ExecutionTarget,
  ExecutionTargetType,
  isConditionValid,
  generateExecutionID,
  getTargetIDs,
  getIncludeIDs,
} from '../../domain/execution';

/**
 * Maximum nesting level for includes (prevent infinite recursion)
 */
const MAX_INCLUDE_LEVELS = 3;

/**
 * Check if targets exist
 */
async function checkTargetsExist(
  commands: Commands,
  targetIDs: string[],
  orgID: string
): Promise<boolean> {
  if (targetIDs.length === 0) return true;

  // Check each target exists
  for (const targetID of targetIDs) {
    const wm = new TargetWriteModel(targetID, orgID);
    await wm.load(commands.getEventstore(), targetID, orgID);
    if (!wm.exists()) {
      return false;
    }
  }

  return true;
}

/**
 * Check if executions exist (for includes)
 */
async function checkExecutionsExist(
  commands: Commands,
  executionIDs: string[],
  orgID: string
): Promise<boolean> {
  if (executionIDs.length === 0) return true;

  const wm = new ExecutionsExistWriteModel(executionIDs, orgID);
  
  // Query for all execution IDs
  const events = await commands.getEventstore().query({
    aggregateTypes: ['execution'],
    aggregateIDs: executionIDs,
  });
  
  // Reduce all events to check which executions exist
  for (const event of events) {
    wm.reduce(event);
  }

  return wm.allExist();
}

/**
 * Check for circular includes (A → B → A)
 * Go: checkForIncludeCircular (action_v2_execution.go:297)
 */
async function checkCircularIncludes(
  commands: Commands,
  executionID: string,
  includes: string[],
  orgID: string,
  visited: string[] = [],
  level: number = 0
): Promise<void> {
  if (includes.length === 0) return;

  // Check max depth
  if (level >= MAX_INCLUDE_LEVELS) {
    throwPreconditionFailed('max include levels exceeded', 'EXEC-010');
  }

  // Check each include
  for (const includeID of includes) {
    // Direct circular reference
    if (executionID === includeID) {
      throwPreconditionFailed('circular include detected', 'EXEC-011');
    }

    // Indirect circular reference
    if (visited.includes(includeID)) {
      throwPreconditionFailed('circular include detected', 'EXEC-012');
    }

    // Load the included execution and check its includes recursively
    const wm = new ExecutionWriteModel(includeID, orgID);
    await wm.load(commands.getEventstore(), includeID, orgID);

    if (wm.exists()) {
      const nestedIncludes = wm.getIncludes();
      await checkCircularIncludes(
        commands,
        executionID,
        nestedIncludes,
        orgID,
        [...visited, includeID],
        level + 1
      );
    }
  }
}

/**
 * Validate and set execution
 */
async function setExecution(
  commands: Commands,
  ctx: Context,
  orgID: string,
  executionID: string,
  executionType: ExecutionType,
  targets: ExecutionTarget[]
): Promise<ObjectDetails> {
  // Validate targets
  for (const target of targets) {
    if (target.type === ExecutionTargetType.UNSPECIFIED) {
      throwInvalidArgument('target type must be specified', 'EXEC-001');
    }
    if (!target.target || target.target.trim() === '') {
      throwInvalidArgument('target ID must be specified', 'EXEC-002');
    }
  }

  // Check permissions
  await commands.checkPermission(ctx, 'org.execution', 'write', orgID);

  // Load existing execution
  const wm = new ExecutionWriteModel(executionID, orgID);
  await wm.load(commands.getEventstore(), executionID, orgID);

  // Check if targets are the same (idempotency)
  if (wm.exists() && wm.targetsEqual(targets)) {
    return writeModelToObjectDetails(wm);
  }

  // Extract target and include IDs
  const targetIDs = getTargetIDs(targets);
  const includeIDs = getIncludeIDs(targets);

  // Validate targets exist
  if (targetIDs.length > 0) {
    const targetsExist = await checkTargetsExist(commands, targetIDs, orgID);
    if (!targetsExist) {
      throwNotFound('target not found', 'EXEC-003');
    }
  }

  // Validate includes exist
  if (includeIDs.length > 0) {
    const includesExist = await checkExecutionsExist(commands, includeIDs, orgID);
    if (!includesExist) {
      throwNotFound('included execution not found', 'EXEC-004');
    }
  }

  // Check for circular includes
  if (includeIDs.length > 0) {
    await checkCircularIncludes(commands, executionID, includeIDs, orgID);
  }

  // Create event
  const command: Command = {
    eventType: 'execution.set',
    aggregateType: 'execution',
    aggregateID: executionID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      executionType,
      targets,
    },
  };

  const event = await commands.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Set execution for gRPC request interception
 * Go: SetExecutionRequest (action_v2_execution.go:59)
 */
export async function setExecutionRequest(
  this: Commands,
  ctx: Context,
  orgID: string,
  condition: {
    method?: string;
    service?: string;
    all?: boolean;
  },
  targets: ExecutionTarget[]
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Validate condition
  if (!isConditionValid(condition)) {
    throwInvalidArgument('invalid condition: exactly one field must be set', 'EXEC-005');
  }

  // Generate execution ID from condition
  const executionID = generateExecutionID(ExecutionType.REQUEST, condition);

  return await setExecution(this, ctx, orgID, executionID, ExecutionType.REQUEST, targets);
}

/**
 * Set execution for gRPC response interception
 * Go: SetExecutionResponse (action_v2_execution.go:77)
 */
export async function setExecutionResponse(
  this: Commands,
  ctx: Context,
  orgID: string,
  condition: {
    method?: string;
    service?: string;
    all?: boolean;
  },
  targets: ExecutionTarget[]
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Validate condition
  if (!isConditionValid(condition)) {
    throwInvalidArgument('invalid condition: exactly one field must be set', 'EXEC-006');
  }

  // Generate execution ID from condition
  const executionID = generateExecutionID(ExecutionType.RESPONSE, condition);

  return await setExecution(this, ctx, orgID, executionID, ExecutionType.RESPONSE, targets);
}

/**
 * Set execution for domain event trigger
 * Go: SetExecutionEvent (action_v2_execution.go:184)
 */
export async function setExecutionEvent(
  this: Commands,
  ctx: Context,
  orgID: string,
  condition: {
    event?: string;
    eventGroup?: string;
    all?: boolean;
  },
  targets: ExecutionTarget[]
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');

  // Validate condition
  if (!isConditionValid(condition)) {
    throwInvalidArgument('invalid condition: exactly one field must be set', 'EXEC-007');
  }

  // Generate execution ID from condition
  const executionID = generateExecutionID(ExecutionType.EVENT, condition);

  return await setExecution(this, ctx, orgID, executionID, ExecutionType.EVENT, targets);
}

/**
 * Set execution for function invocation
 * Go: SetExecutionFunction (action_v2_execution.go:115)
 */
export async function setExecutionFunction(
  this: Commands,
  ctx: Context,
  orgID: string,
  functionName: string,
  targets: ExecutionTarget[]
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');
  validateRequired(functionName, 'functionName');

  const condition = { function: functionName };

  // Generate execution ID from condition
  const executionID = generateExecutionID(ExecutionType.FUNCTION, condition);

  return await setExecution(this, ctx, orgID, executionID, ExecutionType.FUNCTION, targets);
}

/**
 * Remove execution
 * Based on Go pattern (not explicit in file but implied)
 */
export async function removeExecution(
  this: Commands,
  ctx: Context,
  orgID: string,
  executionID: string
): Promise<ObjectDetails> {
  validateRequired(orgID, 'orgID');
  validateRequired(executionID, 'executionID');

  // Check permissions
  await this.checkPermission(ctx, 'org.execution', 'delete', orgID);

  // Load existing execution
  const wm = new ExecutionWriteModel(executionID, orgID);
  await wm.load(this.getEventstore(), executionID, orgID);

  if (!wm.exists()) {
    throwNotFound('execution not found', 'EXEC-008');
  }

  // Create event
  const command: Command = {
    eventType: 'execution.removed',
    aggregateType: 'execution',
    aggregateID: executionID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}
