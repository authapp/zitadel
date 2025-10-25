import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';

describe('Week 15 Commands Verification', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  it('should have PAT commands registered', () => {
    expect(ctx.commands.addPersonalAccessToken).toBeDefined();
    expect(typeof ctx.commands.addPersonalAccessToken).toBe('function');
    expect(ctx.commands.removePersonalAccessToken).toBeDefined();
    expect(ctx.commands.updatePersonalAccessTokenUsage).toBeDefined();
  });

  it('should have machine key commands registered', () => {
    expect(ctx.commands.addMachineKey).toBeDefined();
    expect(typeof ctx.commands.addMachineKey).toBe('function');
    expect(ctx.commands.removeMachineKey).toBeDefined();
    expect(ctx.commands.getMachineKeyPublicKey).toBeDefined();
  });

  it('should have encryption key commands registered', () => {
    expect(ctx.commands.addEncryptionKey).toBeDefined();
    expect(typeof ctx.commands.addEncryptionKey).toBe('function');
    expect(ctx.commands.getEncryptionKey).toBeDefined();
    expect(ctx.commands.listEncryptionKeys).toBeDefined();
    expect(ctx.commands.removeEncryptionKey).toBeDefined();
  });

  it('should add a PAT', async () => {
    const userID = await ctx.commands.nextID();
    const orgID = await ctx.commands.nextID();

    const result = await ctx.commands.addPersonalAccessToken(
      ctx.createContext(),
      userID,
      orgID,
      {}
    );

    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    console.log('✓ PAT created successfully');
  });

  it('should add an encryption key', async () => {
    const keyData = Buffer.from('test-key-material');

    const result = await ctx.commands.addEncryptionKey(
      ctx.createContext(),
      {
        algorithm: 'aes256' as any,
        identifier: 'test-key',
        keyData,
      }
    );

    expect(result.id).toBeDefined();
    console.log('✓ Encryption key created successfully');
  });
});
