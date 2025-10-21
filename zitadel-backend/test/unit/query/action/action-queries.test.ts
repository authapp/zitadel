/**
 * Unit tests for Action Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionQueries } from '../../../../src/lib/query/action/action-queries';
import { ActionState, FlowType, TriggerType } from '../../../../src/lib/query/action/action-types';
import { DatabasePool } from '../../../../src/lib/database';

describe('ActionQueries', () => {
  let queries: ActionQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_INSTANCE_ID = 'test-instance-123';
  const TEST_ACTION_ID = 'action-456';
  const TEST_USER_ID = 'user-789';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new ActionQueries(mockDatabase);
  });

  describe('Actions', () => {
    describe('getActionByID', () => {
      it('should return action by ID', async () => {
        const mockAction = {
          id: TEST_ACTION_ID,
          instance_id: TEST_INSTANCE_ID,
          resource_owner: 'org-123',
          creation_date: new Date(),
          change_date: new Date(),
          sequence: 1,
          name: 'Email Notification',
          script: 'function notify() { /* code */ }',
          timeout: 5000,
          allowed_to_fail: true,
          state: ActionState.ACTIVE,
        };

        mockDatabase.queryOne.mockResolvedValue(mockAction);

        const action = await queries.getActionByID(TEST_INSTANCE_ID, TEST_ACTION_ID);

        expect(action).toBeTruthy();
        expect(action!.id).toBe(TEST_ACTION_ID);
        expect(action!.name).toBe('Email Notification');
        expect(action!.state).toBe(ActionState.ACTIVE);
      });

      it('should return null when action not found', async () => {
        mockDatabase.queryOne.mockResolvedValue(null);

        const action = await queries.getActionByID(TEST_INSTANCE_ID, 'nonexistent');

        expect(action).toBeNull();
      });
    });

    describe('searchActions', () => {
      it('should return all actions for instance', async () => {
        const mockActions = [
          {
            id: 'action-1',
            instance_id: TEST_INSTANCE_ID,
            resource_owner: 'org-123',
            creation_date: new Date(),
            change_date: new Date(),
            sequence: 1,
            name: 'Action 1',
            script: 'code1',
            timeout: 5000,
            allowed_to_fail: false,
            state: ActionState.ACTIVE,
          },
          {
            id: 'action-2',
            instance_id: TEST_INSTANCE_ID,
            resource_owner: 'org-123',
            creation_date: new Date(),
            change_date: new Date(),
            sequence: 2,
            name: 'Action 2',
            script: 'code2',
            timeout: 3000,
            allowed_to_fail: true,
            state: ActionState.INACTIVE,
          },
        ];

        mockDatabase.query.mockResolvedValue({ rows: mockActions } as any);

        const actions = await queries.searchActions(TEST_INSTANCE_ID);

        expect(actions).toHaveLength(2);
        expect(actions[0].name).toBe('Action 1');
        expect(actions[1].name).toBe('Action 2');
      });
    });
  });

  describe('Flows', () => {
    describe('getFlow', () => {
      it('should return flow by type', async () => {
        const mockFlow = {
          flow_type: FlowType.EXTERNAL_AUTHENTICATION,
          trigger_type: TriggerType.POST_AUTHENTICATION,
          action_ids: ['action-1', 'action-2'],
        };

        mockDatabase.queryOne.mockResolvedValue(mockFlow);

        const flow = await queries.getFlow(TEST_INSTANCE_ID, FlowType.EXTERNAL_AUTHENTICATION);

        expect(flow).toBeTruthy();
        expect(flow!.flowType).toBe(FlowType.EXTERNAL_AUTHENTICATION);
        expect(flow!.actionIDs).toHaveLength(2);
      });
    });

    describe('getActiveActionsByFlowAndTriggerType', () => {
      it('should return action IDs for flow and trigger', async () => {
        const mockResult = {
          action_ids: ['action-1', 'action-2', 'action-3'],
        };

        mockDatabase.queryOne.mockResolvedValue(mockResult);

        const actionIDs = await queries.getActiveActionsByFlowAndTriggerType(
          TEST_INSTANCE_ID,
          FlowType.CUSTOMISE_TOKEN,
          TriggerType.PRE_ACCESS_TOKEN_CREATION
        );

        expect(actionIDs).toHaveLength(3);
        expect(actionIDs).toContain('action-1');
      });

      it('should return empty array when no actions found', async () => {
        mockDatabase.queryOne.mockResolvedValue(null);

        const actionIDs = await queries.getActiveActionsByFlowAndTriggerType(
          TEST_INSTANCE_ID,
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.POST_AUTHENTICATION
        );

        expect(actionIDs).toEqual([]);
      });
    });

    describe('getFlowTypesOfActionID', () => {
      it('should return flow types using the action', async () => {
        const mockRows = [
          { flow_type: FlowType.EXTERNAL_AUTHENTICATION },
          { flow_type: FlowType.CUSTOMISE_TOKEN },
        ];

        mockDatabase.query.mockResolvedValue({ rows: mockRows } as any);

        const flowTypes = await queries.getFlowTypesOfActionID(TEST_INSTANCE_ID, TEST_ACTION_ID);

        expect(flowTypes).toHaveLength(2);
        expect(flowTypes).toContain(FlowType.EXTERNAL_AUTHENTICATION);
        expect(flowTypes).toContain(FlowType.CUSTOMISE_TOKEN);
      });
    });
  });

  describe('Executions', () => {
    describe('searchExecutions', () => {
      it('should return all executions', async () => {
        const mockExecutions = [
          {
            id: 'exec-1',
            instance_id: TEST_INSTANCE_ID,
            creation_date: new Date(),
            change_date: new Date(),
            sequence: 1,
            targets: ['target-1'],
            includes: ['condition-1'],
            excludes: ['condition-2'],
          },
        ];

        mockDatabase.query.mockResolvedValue({ rows: mockExecutions } as any);

        const executions = await queries.searchExecutions(TEST_INSTANCE_ID);

        expect(executions).toHaveLength(1);
        expect(executions[0].targets).toContain('target-1');
      });
    });

    describe('getExecutionByID', () => {
      it('should return execution by ID', async () => {
        const mockExecution = {
          id: 'exec-1',
          instance_id: TEST_INSTANCE_ID,
          creation_date: new Date(),
          change_date: new Date(),
          sequence: 1,
          targets: ['target-1', 'target-2'],
          includes: [],
          excludes: [],
        };

        mockDatabase.queryOne.mockResolvedValue(mockExecution);

        const execution = await queries.getExecutionByID(TEST_INSTANCE_ID, 'exec-1');

        expect(execution).toBeTruthy();
        expect(execution!.targets).toHaveLength(2);
      });
    });
  });

  describe('Targets', () => {
    describe('searchTargets', () => {
      it('should return all targets', async () => {
        const mockTargets = [
          {
            id: 'target-1',
            instance_id: TEST_INSTANCE_ID,
            resource_owner: 'org-123',
            creation_date: new Date(),
            change_date: new Date(),
            sequence: 1,
            name: 'Webhook Target',
            target_type: 'webhook',
            endpoint: 'https://example.com/webhook',
            timeout: 5000,
          },
        ];

        mockDatabase.query.mockResolvedValue({ rows: mockTargets } as any);

        const targets = await queries.searchTargets(TEST_INSTANCE_ID);

        expect(targets).toHaveLength(1);
        expect(targets[0].name).toBe('Webhook Target');
        expect(targets[0].targetType).toBe('webhook');
      });
    });

    describe('getTargetByID', () => {
      it('should return target by ID', async () => {
        const mockTarget = {
          id: 'target-1',
          instance_id: TEST_INSTANCE_ID,
          resource_owner: 'org-123',
          creation_date: new Date(),
          change_date: new Date(),
          sequence: 1,
          name: 'API Target',
          target_type: 'requestResponse',
          endpoint: 'https://api.example.com',
          timeout: 3000,
        };

        mockDatabase.queryOne.mockResolvedValue(mockTarget);

        const target = await queries.getTargetByID(TEST_INSTANCE_ID, 'target-1');

        expect(target).toBeTruthy();
        expect(target!.targetType).toBe('requestResponse');
        expect(target!.endpoint).toBe('https://api.example.com');
      });
    });
  });

  describe('User Metadata', () => {
    describe('getUserMetadata', () => {
      it('should return user metadata by key', async () => {
        const mockMetadata = {
          user_id: TEST_USER_ID,
          key: 'preferences',
          value: { theme: 'dark', language: 'en' },
          creation_date: new Date(),
          change_date: new Date(),
        };

        mockDatabase.queryOne.mockResolvedValue(mockMetadata);

        const metadata = await queries.getUserMetadata(TEST_USER_ID, 'preferences');

        expect(metadata).toBeTruthy();
        expect(metadata!.key).toBe('preferences');
        expect(metadata!.value).toHaveProperty('theme');
      });
    });

    describe('searchUserMetadata', () => {
      it('should return all user metadata', async () => {
        const mockMetadata = [
          {
            user_id: TEST_USER_ID,
            key: 'key1',
            value: 'value1',
            creation_date: new Date(),
            change_date: new Date(),
          },
          {
            user_id: TEST_USER_ID,
            key: 'key2',
            value: 'value2',
            creation_date: new Date(),
            change_date: new Date(),
          },
        ];

        mockDatabase.query.mockResolvedValue({ rows: mockMetadata } as any);

        const metadata = await queries.searchUserMetadata(TEST_USER_ID);

        expect(metadata).toHaveLength(2);
        expect(metadata[0].key).toBe('key1');
      });
    });
  });

  describe('User Schema', () => {
    describe('getUserSchema', () => {
      it('should return user schema by ID', async () => {
        const mockSchema = {
          id: 'schema-1',
          instance_id: TEST_INSTANCE_ID,
          creation_date: new Date(),
          change_date: new Date(),
          type: 'custom',
          schema: { properties: { name: { type: 'string' } } },
          possible_authenticators: ['password', 'webauthn'],
        };

        mockDatabase.queryOne.mockResolvedValue(mockSchema);

        const schema = await queries.getUserSchema(TEST_INSTANCE_ID, 'schema-1');

        expect(schema).toBeTruthy();
        expect(schema!.type).toBe('custom');
        expect(schema!.possibleAuthenticators).toContain('password');
      });
    });

    describe('searchUserSchemas', () => {
      it('should return all user schemas', async () => {
        const mockSchemas = [
          {
            id: 'schema-1',
            instance_id: TEST_INSTANCE_ID,
            creation_date: new Date(),
            change_date: new Date(),
            type: 'type1',
            schema: {},
            possible_authenticators: [],
          },
        ];

        mockDatabase.query.mockResolvedValue({ rows: mockSchemas } as any);

        const schemas = await queries.searchUserSchemas(TEST_INSTANCE_ID);

        expect(schemas).toHaveLength(1);
        expect(schemas[0].type).toBe('type1');
      });
    });
  });
});
