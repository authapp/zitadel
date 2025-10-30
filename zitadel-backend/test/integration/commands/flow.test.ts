/**
 * Flow Commands Integration Tests - Fully Isolated
 * Tests trigger flow and action management
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder } from '../../helpers/test-data-builders';
import { FlowType, TriggerType } from '../../../src/lib/domain/flow';

describe('Flow Commands Integration Tests (Isolated)', () => {
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
   * Helper: Create isolated test organization
   */
  async function createTestOrg() {
    const orgData = new OrganizationBuilder()
      .withName(`Flow Test Org ${Date.now()}-${Math.random()}`)
      .build();
    
    const result = await ctx.commands.addOrg(ctx.createContext(), orgData);
    return { id: result.orgID, name: orgData.name };
  }

  describe('setTriggerActions', () => {
    describe('Success Cases', () => {
      it('should set actions for external authentication post-auth trigger', async () => {
        const testOrg = await createTestOrg();
        
        const result = await ctx.commands.setTriggerActions(
          ctx.createContext(),
          testOrg.id,
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.POST_AUTHENTICATION,
          ['action-1', 'action-2']
        );

        expect(result).toBeDefined();
        expect(result.resourceOwner).toBe(testOrg.id);
      });

      it('should set actions for token customization trigger', async () => {
        const testOrg = await createTestOrg();
        
        const result = await ctx.commands.setTriggerActions(
          ctx.createContext(),
          testOrg.id,
          FlowType.CUSTOMISE_TOKEN,
          TriggerType.PRE_ACCESS_TOKEN_CREATION,
          ['token-action-1']
        );

        expect(result).toBeDefined();
      });

      it('should set actions for SAML response customization', async () => {
        const testOrg = await createTestOrg();
        
        const result = await ctx.commands.setTriggerActions(
          ctx.createContext(),
          testOrg.id,
          FlowType.CUSTOMIZE_SAML_RESPONSE,
          TriggerType.PRE_SAML_RESPONSE_CREATION,
          ['saml-action-1']
        );

        expect(result).toBeDefined();
      });

      it('should update existing trigger actions', async () => {
        const testOrg = await createTestOrg();
        
        await ctx.commands.setTriggerActions(
          ctx.createContext(),
          testOrg.id,
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.POST_AUTHENTICATION,
          ['action-1']
        );

        const result = await ctx.commands.setTriggerActions(
          ctx.createContext(),
          testOrg.id,
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.POST_AUTHENTICATION,
          ['action-1', 'action-2', 'action-3']
        );

        expect(result).toBeDefined();
      });

      it('should set different triggers for same flow type', async () => {
        const testOrg = await createTestOrg();
        
        await ctx.commands.setTriggerActions(
          ctx.createContext(),
          testOrg.id,
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.POST_AUTHENTICATION,
          ['action-1']
        );

        const result = await ctx.commands.setTriggerActions(
          ctx.createContext(),
          testOrg.id,
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.PRE_CREATION,
          ['action-2']
        );

        expect(result).toBeDefined();
      });

      it('should set actions for internal authentication', async () => {
        const testOrg = await createTestOrg();
        
        const result = await ctx.commands.setTriggerActions(
          ctx.createContext(),
          testOrg.id,
          FlowType.INTERNAL_AUTHENTICATION,
          TriggerType.POST_AUTHENTICATION,
          ['internal-action-1']
        );

        expect(result).toBeDefined();
      });

      it('should clear actions by setting empty array', async () => {
        const testOrg = await createTestOrg();
        
        await ctx.commands.setTriggerActions(
          ctx.createContext(),
          testOrg.id,
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.POST_AUTHENTICATION,
          ['action-1', 'action-2']
        );

        const result = await ctx.commands.setTriggerActions(
          ctx.createContext(),
          testOrg.id,
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.POST_AUTHENTICATION,
          []
        );

        expect(result).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty orgID', async () => {
        await expect(
          ctx.commands.setTriggerActions(
            ctx.createContext(),
            '',
            FlowType.EXTERNAL_AUTHENTICATION,
            TriggerType.POST_AUTHENTICATION,
            ['action-1']
          )
        ).rejects.toThrow();
      });

      it('should fail with invalid flow type', async () => {
        const testOrg = await createTestOrg();
        
        await expect(
          ctx.commands.setTriggerActions(
            ctx.createContext(),
            testOrg.id,
            FlowType.UNSPECIFIED,
            TriggerType.POST_AUTHENTICATION,
            ['action-1']
          )
        ).rejects.toThrow(/invalid flow type/);
      });

      it('should fail with UNSPECIFIED trigger type (not valid for any flow)', async () => {
        const testOrg = await createTestOrg();
        
        await expect(
          ctx.commands.setTriggerActions(
            ctx.createContext(),
            testOrg.id,
            FlowType.EXTERNAL_AUTHENTICATION,
            TriggerType.UNSPECIFIED,
            ['action-1']
          )
        ).rejects.toThrow(/trigger type not valid for this flow type/);
      });

      it('should fail with incompatible trigger for flow type', async () => {
        const testOrg = await createTestOrg();
        
        await expect(
          ctx.commands.setTriggerActions(
            ctx.createContext(),
            testOrg.id,
            FlowType.CUSTOMIZE_SAML_RESPONSE,
            TriggerType.POST_AUTHENTICATION,
            ['action-1']
          )
        ).rejects.toThrow(/trigger type not valid for this flow type/);
      });

      it('should fail when setting same actions (no changes)', async () => {
        const testOrg = await createTestOrg();
        
        await ctx.commands.setTriggerActions(
          ctx.createContext(),
          testOrg.id,
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.POST_AUTHENTICATION,
          ['action-1', 'action-2']
        );

        await expect(
          ctx.commands.setTriggerActions(
            ctx.createContext(),
            testOrg.id,
            FlowType.EXTERNAL_AUTHENTICATION,
            TriggerType.POST_AUTHENTICATION,
            ['action-1', 'action-2']
          )
        ).rejects.toThrow(/no changes to trigger actions/);
      });
    });
  });

  describe('clearFlow', () => {
    describe('Success Cases', () => {
      it('should clear all triggers from external authentication flow', async () => {
        const testOrg = await createTestOrg();
        
        await ctx.commands.setTriggerActions(
          ctx.createContext(),
          testOrg.id,
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.POST_AUTHENTICATION,
          ['action-1']
        );

        await ctx.commands.setTriggerActions(
          ctx.createContext(),
          testOrg.id,
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.PRE_CREATION,
          ['action-2']
        );

        const result = await ctx.commands.clearFlow(
          ctx.createContext(),
          testOrg.id,
          FlowType.EXTERNAL_AUTHENTICATION
        );

        expect(result).toBeDefined();
        expect(result.resourceOwner).toBe(testOrg.id);
      });

      it('should clear token customization flow', async () => {
        const testOrg = await createTestOrg();
        
        await ctx.commands.setTriggerActions(
          ctx.createContext(),
          testOrg.id,
          FlowType.CUSTOMISE_TOKEN,
          TriggerType.PRE_ACCESS_TOKEN_CREATION,
          ['token-action']
        );

        const result = await ctx.commands.clearFlow(
          ctx.createContext(),
          testOrg.id,
          FlowType.CUSTOMISE_TOKEN
        );

        expect(result).toBeDefined();
      });

      it('should clear internal authentication flow', async () => {
        const testOrg = await createTestOrg();
        
        await ctx.commands.setTriggerActions(
          ctx.createContext(),
          testOrg.id,
          FlowType.INTERNAL_AUTHENTICATION,
          TriggerType.POST_CREATION,
          ['action']
        );

        const result = await ctx.commands.clearFlow(
          ctx.createContext(),
          testOrg.id,
          FlowType.INTERNAL_AUTHENTICATION
        );

        expect(result).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty orgID', async () => {
        await expect(
          ctx.commands.clearFlow(
            ctx.createContext(),
            '',
            FlowType.EXTERNAL_AUTHENTICATION
          )
        ).rejects.toThrow();
      });

      it('should fail with invalid flow type', async () => {
        const testOrg = await createTestOrg();
        
        await expect(
          ctx.commands.clearFlow(
            ctx.createContext(),
            testOrg.id,
            FlowType.UNSPECIFIED
          )
        ).rejects.toThrow(/invalid flow type/);
      });

      it('should fail when flow is already empty', async () => {
        const testOrg = await createTestOrg();
        
        await expect(
          ctx.commands.clearFlow(
            ctx.createContext(),
            testOrg.id,
            FlowType.EXTERNAL_AUTHENTICATION
          )
        ).rejects.toThrow(/flow is already empty/);
      });
    });
  });

  describe('Lifecycle Tests', () => {
    it('complete flow lifecycle: set multiple triggers → clear', async () => {
      const testOrg = await createTestOrg();
      
      await ctx.commands.setTriggerActions(
        ctx.createContext(),
        testOrg.id,
        FlowType.EXTERNAL_AUTHENTICATION,
        TriggerType.POST_AUTHENTICATION,
        ['action-1', 'action-2']
      );

      await ctx.commands.setTriggerActions(
        ctx.createContext(),
        testOrg.id,
        FlowType.EXTERNAL_AUTHENTICATION,
        TriggerType.PRE_CREATION,
        ['action-3']
      );

      await ctx.commands.setTriggerActions(
        ctx.createContext(),
        testOrg.id,
        FlowType.EXTERNAL_AUTHENTICATION,
        TriggerType.POST_CREATION,
        ['action-4', 'action-5']
      );

      await ctx.commands.clearFlow(
        ctx.createContext(),
        testOrg.id,
        FlowType.EXTERNAL_AUTHENTICATION
      );
    });

    it('set → update → clear for token flow', async () => {
      const testOrg = await createTestOrg();
      
      await ctx.commands.setTriggerActions(
        ctx.createContext(),
        testOrg.id,
        FlowType.CUSTOMISE_TOKEN,
        TriggerType.PRE_ACCESS_TOKEN_CREATION,
        ['token-action-1']
      );

      await ctx.commands.setTriggerActions(
        ctx.createContext(),
        testOrg.id,
        FlowType.CUSTOMISE_TOKEN,
        TriggerType.PRE_ACCESS_TOKEN_CREATION,
        ['token-action-1', 'token-action-2']
      );

      await ctx.commands.clearFlow(
        ctx.createContext(),
        testOrg.id,
        FlowType.CUSTOMISE_TOKEN
      );
    });

    it('manage multiple flow types independently', async () => {
      const testOrg = await createTestOrg();
      
      await ctx.commands.setTriggerActions(
        ctx.createContext(),
        testOrg.id,
        FlowType.EXTERNAL_AUTHENTICATION,
        TriggerType.POST_AUTHENTICATION,
        ['ext-action']
      );

      await ctx.commands.setTriggerActions(
        ctx.createContext(),
        testOrg.id,
        FlowType.CUSTOMISE_TOKEN,
        TriggerType.PRE_ACCESS_TOKEN_CREATION,
        ['token-action']
      );

      await ctx.commands.setTriggerActions(
        ctx.createContext(),
        testOrg.id,
        FlowType.INTERNAL_AUTHENTICATION,
        TriggerType.POST_AUTHENTICATION,
        ['int-action']
      );

      await ctx.commands.clearFlow(
        ctx.createContext(),
        testOrg.id,
        FlowType.EXTERNAL_AUTHENTICATION
      );
    });
  });
});
