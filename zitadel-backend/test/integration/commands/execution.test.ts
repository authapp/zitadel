/**
 * Execution Commands Integration Tests - Fully Isolated
 * Each test creates its own organization and test data
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder } from '../../helpers/test-data-builders';
import { ExecutionTargetType } from '../../../src/lib/domain/execution';
import { TargetType } from '../../../src/lib/domain/target';

describe('Execution Commands Integration Tests (Isolated)', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  /**
   * Helper: Create isolated test organization with targets
   */
  async function createTestOrgWithTargets() {
    const orgData = new OrganizationBuilder()
      .withName(`Execution Test Org ${Date.now()}-${Math.random()}`)
      .build();
    
    const result = await ctx.commands.addOrg(ctx.createContext(), orgData);
    const orgID = result.orgID;

    const target1 = await ctx.commands.addTarget(
      ctx.createContext(),
      orgID,
      {
        name: 'Test Target 1',
        targetType: TargetType.WEBHOOK,
        endpoint: 'https://example.com/target1',
        timeout: 10000,
        interruptOnError: false,
      }
    );

    const target2 = await ctx.commands.addTarget(
      ctx.createContext(),
      orgID,
      {
        name: 'Test Target 2',
        targetType: TargetType.WEBHOOK,
        endpoint: 'https://example.com/target2',
        timeout: 10000,
        interruptOnError: false,
      }
    );

    return { orgID, target1: target1.id, target2: target2.id };
  }

  describe('setExecutionEvent', () => {
    describe('Success Cases', () => {
      it('should set execution for specific event', async () => {
        const { orgID, target1 } = await createTestOrgWithTargets();
        
        const result = await ctx.commands.setExecutionEvent(
          ctx.createContext(),
          orgID,
          { event: 'user.added' },
          [
            { type: ExecutionTargetType.TARGET, target: target1 },
          ]
        );

        expect(result).toBeDefined();
      });

      it('should set execution for event group', async () => {
        const { orgID, target1, target2 } = await createTestOrgWithTargets();
        
        const result = await ctx.commands.setExecutionEvent(
          ctx.createContext(),
          orgID,
          { eventGroup: 'user' },
          [
            { type: ExecutionTargetType.TARGET, target: target1 },
            { type: ExecutionTargetType.TARGET, target: target2 },
          ]
        );

        expect(result).toBeDefined();
      });

      it('should set execution for all events', async () => {
        const { orgID, target1 } = await createTestOrgWithTargets();
        
        const result = await ctx.commands.setExecutionEvent(
          ctx.createContext(),
          orgID,
          { all: true },
          [
            { type: ExecutionTargetType.TARGET, target: target1 },
          ]
        );

        expect(result).toBeDefined();
      });

      it('should update existing execution with new targets', async () => {
        const { orgID, target1, target2 } = await createTestOrgWithTargets();
        
        await ctx.commands.setExecutionEvent(
          ctx.createContext(),
          orgID,
          { event: 'user.removed' },
          [
            { type: ExecutionTargetType.TARGET, target: target1 },
          ]
        );

        const result = await ctx.commands.setExecutionEvent(
          ctx.createContext(),
          orgID,
          { event: 'user.removed' },
          [
            { type: ExecutionTargetType.TARGET, target: target2 },
          ]
        );

        expect(result).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail with invalid condition (multiple fields set)', async () => {
        const { orgID, target1 } = await createTestOrgWithTargets();
        
        await expect(
          ctx.commands.setExecutionEvent(
            ctx.createContext(),
            orgID,
            { event: 'user.added', eventGroup: 'user' },
            [
              { type: ExecutionTargetType.TARGET, target: target1 },
            ]
          )
        ).rejects.toThrow(/exactly one field must be set/);
      });

      it('should fail with invalid condition (no fields set)', async () => {
        const { orgID, target1 } = await createTestOrgWithTargets();
        
        await expect(
          ctx.commands.setExecutionEvent(
            ctx.createContext(),
            orgID,
            {},
            [
              { type: ExecutionTargetType.TARGET, target: target1 },
            ]
          )
        ).rejects.toThrow(/exactly one field must be set/);
      });

      it('should fail with non-existent target', async () => {
        const { orgID } = await createTestOrgWithTargets();
        
        await expect(
          ctx.commands.setExecutionEvent(
            ctx.createContext(),
            orgID,
            { event: 'user.added' },
            [
              { type: ExecutionTargetType.TARGET, target: 'non-existent-target' },
            ]
          )
        ).rejects.toThrow(/target not found/);
      });

      it('should fail with unspecified target type', async () => {
        const { orgID, target1 } = await createTestOrgWithTargets();
        
        await expect(
          ctx.commands.setExecutionEvent(
            ctx.createContext(),
            orgID,
            { event: 'user.added' },
            [
              { type: ExecutionTargetType.UNSPECIFIED, target: target1 },
            ]
          )
        ).rejects.toThrow(/target type must be specified/);
      });

      it('should fail with empty target ID', async () => {
        const { orgID } = await createTestOrgWithTargets();
        
        await expect(
          ctx.commands.setExecutionEvent(
            ctx.createContext(),
            orgID,
            { event: 'user.added' },
            [
              { type: ExecutionTargetType.TARGET, target: '' },
            ]
          )
        ).rejects.toThrow(/target ID must be specified/);
      });
    });
  });

  describe('setExecutionRequest', () => {
    it('should set execution for gRPC method', async () => {
      const { orgID, target1 } = await createTestOrgWithTargets();
      
      const result = await ctx.commands.setExecutionRequest(
        ctx.createContext(),
        orgID,
        { method: '/zitadel.user.v2.UserService/AddUser' },
        [
          { type: ExecutionTargetType.TARGET, target: target1 },
        ]
      );

      expect(result).toBeDefined();
    });

    it('should set execution for gRPC service', async () => {
      const { orgID, target1 } = await createTestOrgWithTargets();
      
      const result = await ctx.commands.setExecutionRequest(
        ctx.createContext(),
        orgID,
        { service: '/zitadel.user.v2.UserService' },
        [
          { type: ExecutionTargetType.TARGET, target: target1 },
        ]
      );

      expect(result).toBeDefined();
    });

    it('should set execution for all requests', async () => {
      const { orgID, target1 } = await createTestOrgWithTargets();
      
      const result = await ctx.commands.setExecutionRequest(
        ctx.createContext(),
        orgID,
        { all: true },
        [
          { type: ExecutionTargetType.TARGET, target: target1 },
        ]
      );

      expect(result).toBeDefined();
    });
  });

  describe('setExecutionResponse', () => {
    it('should set execution for gRPC response', async () => {
      const { orgID, target1 } = await createTestOrgWithTargets();
      
      const result = await ctx.commands.setExecutionResponse(
        ctx.createContext(),
        orgID,
        { method: '/zitadel.user.v2.UserService/GetUser' },
        [
          { type: ExecutionTargetType.TARGET, target: target1 },
        ]
      );

      expect(result).toBeDefined();
    });
  });

  describe('setExecutionFunction', () => {
    it('should set execution for function', async () => {
      const { orgID, target1 } = await createTestOrgWithTargets();
      
      const result = await ctx.commands.setExecutionFunction(
        ctx.createContext(),
        orgID,
        'validateUser',
        [
          { type: ExecutionTargetType.TARGET, target: target1 },
        ]
      );

      expect(result).toBeDefined();
    });

    it('should fail with empty function name', async () => {
      const { orgID, target1 } = await createTestOrgWithTargets();
      
      await expect(
        ctx.commands.setExecutionFunction(
          ctx.createContext(),
          orgID,
          '',
          [
            { type: ExecutionTargetType.TARGET, target: target1 },
          ]
        )
      ).rejects.toThrow();
    });
  });

  describe('Circular Include Detection', () => {
    it('should detect direct circular include (A includes A)', async () => {
      const { orgID, target1 } = await createTestOrgWithTargets();
      
      await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'exec.a' },
        [
          { type: ExecutionTargetType.TARGET, target: target1 },
        ]
      );

      await expect(
        ctx.commands.setExecutionEvent(
          ctx.createContext(),
          orgID,
          { event: 'exec.a' },
          [
            { type: ExecutionTargetType.INCLUDE, target: 'event-event-exec.a' },
          ]
        )
      ).rejects.toThrow(/circular include detected/);
    });

    it('should detect indirect circular include (A → B → A)', async () => {
      const { orgID, target1 } = await createTestOrgWithTargets();
      
      await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'exec.b' },
        [
          { type: ExecutionTargetType.TARGET, target: target1 },
        ]
      );

      await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'exec.a' },
        [
          { type: ExecutionTargetType.INCLUDE, target: 'event-event-exec.b' },
        ]
      );

      await expect(
        ctx.commands.setExecutionEvent(
          ctx.createContext(),
          orgID,
          { event: 'exec.b' },
          [
            { type: ExecutionTargetType.INCLUDE, target: 'event-event-exec.a' },
          ]
        )
      ).rejects.toThrow(/circular include detected/);
    });

    it('should detect deep circular include (A → B → C → A)', async () => {
      const { orgID, target1 } = await createTestOrgWithTargets();
      
      await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'exec.c' },
        [
          { type: ExecutionTargetType.TARGET, target: target1 },
        ]
      );

      await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'exec.b' },
        [
          { type: ExecutionTargetType.INCLUDE, target: 'event-event-exec.c' },
        ]
      );

      await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'exec.a' },
        [
          { type: ExecutionTargetType.INCLUDE, target: 'event-event-exec.b' },
        ]
      );

      await expect(
        ctx.commands.setExecutionEvent(
          ctx.createContext(),
          orgID,
          { event: 'exec.c' },
          [
            { type: ExecutionTargetType.INCLUDE, target: 'event-event-exec.a' },
          ]
        )
      ).rejects.toThrow(/circular include detected/);
    });

    it('should allow valid include chain without cycle', async () => {
      const { orgID, target1 } = await createTestOrgWithTargets();
      
      await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'exec.a' },
        [
          { type: ExecutionTargetType.TARGET, target: target1 },
        ]
      );

      await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'exec.b' },
        [
          { type: ExecutionTargetType.INCLUDE, target: 'event-event-exec.a' },
        ]
      );

      await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'exec.c' },
        [
          { type: ExecutionTargetType.INCLUDE, target: 'event-event-exec.b' },
        ]
      );

      const result = await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'exec.d' },
        [
          { type: ExecutionTargetType.INCLUDE, target: 'event-event-exec.c' },
        ]
      );

      expect(result).toBeDefined();
    });

    it('should fail with non-existent include', async () => {
      const { orgID } = await createTestOrgWithTargets();
      
      await expect(
        ctx.commands.setExecutionEvent(
          ctx.createContext(),
          orgID,
          { event: 'exec.test' },
          [
            { type: ExecutionTargetType.INCLUDE, target: 'non-existent-execution' },
          ]
        )
      ).rejects.toThrow(/included execution not found/);
    });
  });

  describe('removeExecution', () => {
    it('should remove execution successfully', async () => {
      const { orgID, target1 } = await createTestOrgWithTargets();
      
      await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'test.remove' },
        [
          { type: ExecutionTargetType.TARGET, target: target1 },
        ]
      );
      const executionID = 'event-event-test.remove';
      
      const result = await ctx.commands.removeExecution(
        ctx.createContext(),
        orgID,
        executionID
      );

      expect(result).toBeDefined();
    });

    it('should fail with non-existent execution', async () => {
      const { orgID } = await createTestOrgWithTargets();
      
      await expect(
        ctx.commands.removeExecution(
          ctx.createContext(),
          orgID,
          'non-existent-execution'
        )
      ).rejects.toThrow(/execution not found/);
    });
  });

  describe('Lifecycle Tests', () => {
    it('complete execution lifecycle: set → update → remove', async () => {
      const { orgID, target1, target2 } = await createTestOrgWithTargets();
      
      await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'lifecycle.test' },
        [
          { type: ExecutionTargetType.TARGET, target: target1 },
        ]
      );

      await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'lifecycle.test' },
        [
          { type: ExecutionTargetType.TARGET, target: target1 },
          { type: ExecutionTargetType.TARGET, target: target2 },
        ]
      );

      await ctx.commands.removeExecution(
        ctx.createContext(),
        orgID,
        'event-event-lifecycle.test'
      );
    });

    it('complex execution tree with includes', async () => {
      const { orgID, target1, target2 } = await createTestOrgWithTargets();
      
      await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'leaf.1' },
        [
          { type: ExecutionTargetType.TARGET, target: target1 },
        ]
      );

      await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'leaf.2' },
        [
          { type: ExecutionTargetType.TARGET, target: target2 },
        ]
      );

      await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'branch' },
        [
          { type: ExecutionTargetType.INCLUDE, target: 'event-event-leaf.1' },
          { type: ExecutionTargetType.INCLUDE, target: 'event-event-leaf.2' },
        ]
      );

      const result = await ctx.commands.setExecutionEvent(
        ctx.createContext(),
        orgID,
        { event: 'root' },
        [
          { type: ExecutionTargetType.INCLUDE, target: 'event-event-branch' },
          { type: ExecutionTargetType.TARGET, target: target1 },
        ]
      );

      expect(result).toBeDefined();
    });
  });
});
