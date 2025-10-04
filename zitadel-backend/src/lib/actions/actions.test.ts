import {
  InMemoryActionManager,
  createActionManager,
} from './action-manager';
import {
  InMemoryActionExecutor,
  createInMemoryActionExecutor,
} from './action-executor';
import {
  Action,
  ActionTrigger,
  ActionStatus,
  ActionNotFoundError,
} from './types';

describe('InMemoryActionManager', () => {
  let manager: InMemoryActionManager;

  beforeEach(() => {
    manager = createActionManager() as InMemoryActionManager;
  });

  describe('register', () => {
    it('should register new action', async () => {
      const action: Action = {
        id: 'action1',
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        webhookUrl: 'https://example.com/webhook',
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.register(action);

      const retrieved = await manager.get('action1');
      expect(retrieved).toEqual(action);
    });

    it('should generate ID if not provided', async () => {
      const action: Partial<Action> = {
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
      };

      await manager.register(action as Action);

      const all = manager.getAll();
      expect(all.length).toBe(1);
      expect(all[0].id).toBeDefined();
    });

    it('should set timestamps', async () => {
      const action: Partial<Action> = {
        id: 'action1',
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
      };

      await manager.register(action as Action);

      const retrieved = await manager.get('action1');
      expect(retrieved?.createdAt).toBeInstanceOf(Date);
      expect(retrieved?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('get', () => {
    it('should get action by ID', async () => {
      const action: Action = {
        id: 'action1',
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.register(action);

      const retrieved = await manager.get('action1');
      expect(retrieved?.id).toBe('action1');
      expect(retrieved?.name).toBe('Test Action');
    });

    it('should return null for non-existent action', async () => {
      const action = await manager.get('non-existent');
      expect(action).toBeNull();
    });
  });

  describe('getByTrigger', () => {
    it('should get actions by trigger', async () => {
      const action1: Action = {
        id: 'action1',
        name: 'Action 1',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const action2: Action = {
        id: 'action2',
        name: 'Action 2',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.register(action1);
      await manager.register(action2);

      const actions = await manager.getByTrigger(ActionTrigger.POST_USER_CREATE);
      expect(actions.length).toBe(2);
    });

    it('should return empty array for trigger with no actions', async () => {
      const actions = await manager.getByTrigger(ActionTrigger.PRE_AUTH);
      expect(actions).toEqual([]);
    });

    it('should sort actions by creation date', async () => {
      const action1: Action = {
        id: 'action1',
        name: 'Action 1',
        trigger: ActionTrigger.POST_AUTH,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      };

      const action2: Action = {
        id: 'action2',
        name: 'Action 2',
        trigger: ActionTrigger.POST_AUTH,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date(),
      };

      await manager.register(action2);
      await manager.register(action1);

      const actions = await manager.getByTrigger(ActionTrigger.POST_AUTH);
      expect(actions[0].id).toBe('action1'); // Older first
      expect(actions[1].id).toBe('action2');
    });
  });

  describe('update', () => {
    it('should update action', async () => {
      const action: Action = {
        id: 'action1',
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.register(action);
      await manager.update('action1', { name: 'Updated Action', enabled: false });

      const updated = await manager.get('action1');
      expect(updated?.name).toBe('Updated Action');
      expect(updated?.enabled).toBe(false);
    });

    it('should update trigger index when trigger changes', async () => {
      const action: Action = {
        id: 'action1',
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.register(action);
      await manager.update('action1', { trigger: ActionTrigger.PRE_AUTH });

      const oldTriggerActions = await manager.getByTrigger(ActionTrigger.POST_USER_CREATE);
      const newTriggerActions = await manager.getByTrigger(ActionTrigger.PRE_AUTH);

      expect(oldTriggerActions.length).toBe(0);
      expect(newTriggerActions.length).toBe(1);
    });

    it('should throw error for non-existent action', async () => {
      await expect(
        manager.update('non-existent', { name: 'Updated' })
      ).rejects.toThrow(ActionNotFoundError);
    });

    it('should update updatedAt timestamp', async () => {
      const action: Action = {
        id: 'action1',
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      await manager.register(action);
      await manager.update('action1', { name: 'Updated' });

      const updated = await manager.get('action1');
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(action.updatedAt.getTime());
    });
  });

  describe('delete', () => {
    it('should delete action', async () => {
      const action: Action = {
        id: 'action1',
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.register(action);
      await manager.delete('action1');

      const retrieved = await manager.get('action1');
      expect(retrieved).toBeNull();
    });

    it('should not throw error for non-existent action', async () => {
      await expect(manager.delete('non-existent')).resolves.not.toThrow();
    });

    it('should remove from trigger index', async () => {
      const action: Action = {
        id: 'action1',
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.register(action);
      await manager.delete('action1');

      const actions = await manager.getByTrigger(ActionTrigger.POST_USER_CREATE);
      expect(actions.length).toBe(0);
    });
  });

  describe('setEnabled', () => {
    it('should enable action', async () => {
      const action: Action = {
        id: 'action1',
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: false,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.register(action);
      await manager.setEnabled('action1', true);

      const updated = await manager.get('action1');
      expect(updated?.enabled).toBe(true);
    });

    it('should disable action', async () => {
      const action: Action = {
        id: 'action1',
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.register(action);
      await manager.setEnabled('action1', false);

      const updated = await manager.get('action1');
      expect(updated?.enabled).toBe(false);
    });
  });
});

describe('InMemoryActionExecutor', () => {
  let manager: InMemoryActionManager;
  let executor: InMemoryActionExecutor;

  beforeEach(() => {
    manager = createActionManager() as InMemoryActionManager;
    executor = createInMemoryActionExecutor(manager);
  });

  describe('execute', () => {
    it('should execute enabled action', async () => {
      const action: Action = {
        id: 'action1',
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.register(action);

      const result = await executor.execute(action, {
        trigger: ActionTrigger.POST_USER_CREATE,
        event: { type: 'user.created', data: {} },
        metadata: {},
      });

      expect(result.actionId).toBe('action1');
      expect(result.status).toBe(ActionStatus.SUCCESS);
      expect(result.output).toEqual({ executed: true, context: expect.any(Object) });
    });

    it('should skip disabled action', async () => {
      const action: Action = {
        id: 'action1',
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: false,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.register(action);

      const result = await executor.execute(action, {
        trigger: ActionTrigger.POST_USER_CREATE,
        event: {},
        metadata: {},
      });

      expect(result.status).toBe(ActionStatus.SUCCESS);
      expect(result.output).toEqual({ skipped: true });
    });

    it('should record execution in log', async () => {
      const action: Action = {
        id: 'action1',
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.register(action);
      await executor.execute(action, {
        trigger: ActionTrigger.POST_USER_CREATE,
        event: {},
        metadata: {},
      });

      const log = executor.getExecutionLog();
      expect(log.length).toBe(1);
      expect(log[0].actionId).toBe('action1');
    });
  });

  describe('executeForTrigger', () => {
    it('should execute all actions for trigger', async () => {
      const action1: Action = {
        id: 'action1',
        name: 'Action 1',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const action2: Action = {
        id: 'action2',
        name: 'Action 2',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.register(action1);
      await manager.register(action2);

      const results = await executor.executeForTrigger(
        ActionTrigger.POST_USER_CREATE,
        {
          trigger: ActionTrigger.POST_USER_CREATE,
          event: {},
          metadata: {},
        }
      );

      expect(results.length).toBe(2);
      expect(results[0].actionId).toBe('action1');
      expect(results[1].actionId).toBe('action2');
    });

    it('should return empty array for trigger with no actions', async () => {
      const results = await executor.executeForTrigger(
        ActionTrigger.PRE_AUTH,
        {
          trigger: ActionTrigger.PRE_AUTH,
          event: {},
          metadata: {},
        }
      );

      expect(results).toEqual([]);
    });
  });

  describe('getExecutionLog', () => {
    it('should return execution history', async () => {
      const action: Action = {
        id: 'action1',
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.register(action);
      await executor.execute(action, {
        trigger: ActionTrigger.POST_USER_CREATE,
        event: {},
        metadata: {},
      });

      const log = executor.getExecutionLog();
      expect(log.length).toBe(1);
      expect(log[0].duration).toBeGreaterThanOrEqual(0);
      expect(log[0].executedAt).toBeInstanceOf(Date);
    });
  });

  describe('clearLog', () => {
    it('should clear execution log', async () => {
      const action: Action = {
        id: 'action1',
        name: 'Test Action',
        trigger: ActionTrigger.POST_USER_CREATE,
        enabled: true,
        timeout: 5000,
        retries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.register(action);
      await executor.execute(action, {
        trigger: ActionTrigger.POST_USER_CREATE,
        event: {},
        metadata: {},
      });

      executor.clearLog();

      const log = executor.getExecutionLog();
      expect(log).toEqual([]);
    });
  });
});
