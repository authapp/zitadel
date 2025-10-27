/**
 * User Authentication Method Projection Integration Tests
 * 
 * Tests the full flow: events -> projection -> database
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabaseMigrator } from '../../../../src/lib/database/migrator';
import { PostgresEventstore } from '../../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { UserAuthMethodProjection } from '../../../../src/lib/query/projections/user-auth-method-projection';
import { generateId as generateSnowflakeId } from '../../../../src/lib/id/snowflake';

describe('User Auth Method Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;

  // Helper to create a test user
  async function createTestUser(userID: string, instanceID: string = 'test-instance'): Promise<void> {
    await pool.query(
      `INSERT INTO projections.users (id, instance_id, username, resource_owner, state, created_at, updated_at, change_date, sequence)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW(), 1)
       ON CONFLICT (instance_id, id) DO NOTHING`,
      [userID, instanceID, `user_${userID}`, instanceID, 'active']
    );
  }

  beforeAll(async () => {
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
    });
    
    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register user auth method projection
    const projection = new UserAuthMethodProjection(eventstore, pool);
    registry.register({
      name: 'user_auth_method_projection',
      tables: ['projections.user_auth_methods'],
      eventTypes: [
        'user.human.otp.added',
        'user.human.otp.removed',
        'user.human.u2f.token.added',
        'user.human.u2f.token.removed',
        'user.human.passwordless.added',
        'user.human.passwordless.removed',
      ],
      aggregateTypes: ['user'],
      batchSize: 100,
      interval: 50,
      enableLocking: false,
    }, projection);
    
    await registry.start('user_auth_method_projection');
  });

  afterAll(async () => {
    const names = registry.getNames();
    for (const name of names) {
      try {
        await registry.stop(name);
      } catch (e) {
        // Ignore if already stopped
      }
    }
    
    await closeTestDatabase();
  });

  describe('OTP Events', () => {
    it('should process user.human.otp.added event', async () => {
      const userID = generateSnowflakeId();
      const otpID = `otp_${generateSnowflakeId()}`;
      
      await createTestUser(userID);
      
      await eventstore.push({
        eventType: 'user.human.otp.added',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          id: otpID,
          tokenId: 'token_123',
          name: 'My OTP App',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = await pool.queryOne<{
        id: string;
        user_id: string;
        method_type: string;
        state: string;
        token_id: string;
        name: string;
      }>(
        `SELECT id, user_id, method_type, state, token_id, name 
         FROM projections.user_auth_methods 
         WHERE instance_id = $1 AND user_id = $2 AND method_type = 'otp'`,
        ['test-instance', userID]
      );
      
      expect(result).toBeDefined();
      expect(result!.user_id).toBe(userID);
      expect(result!.method_type).toBe('otp');
      expect(result!.state).toBe('active');
      expect(result!.token_id).toBe('token_123');
      expect(result!.name).toBe('My OTP App');
    }, 5000);

    it('should process user.human.otp.removed event', async () => {
      const userID = generateSnowflakeId();
      const otpID = `otp_${generateSnowflakeId()}`;
      
      await createTestUser(userID);
      
      // Add OTP first
      await eventstore.push({
        eventType: 'user.human.otp.added',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          id: otpID,
          tokenId: 'token_456',
          name: 'Remove Test OTP',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify it was added
      let result = await pool.queryOne<{ state: string }>(
        `SELECT state FROM projections.user_auth_methods 
         WHERE instance_id = $1 AND user_id = $2 AND method_type = 'otp'`,
        ['test-instance', userID]
      );
      expect(result!.state).toBe('active');
      
      // Remove OTP
      await eventstore.push({
        eventType: 'user.human.otp.removed',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          tokenId: 'token_456',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify it's now inactive
      result = await pool.queryOne<{ state: string }>(
        `SELECT state FROM projections.user_auth_methods 
         WHERE instance_id = $1 AND user_id = $2 AND method_type = 'otp'`,
        ['test-instance', userID]
      );
      expect(result!.state).toBe('inactive');
    }, 5000);
  });

  describe('U2F Events', () => {
    it('should process user.human.u2f.token.added event', async () => {
      const userID = generateSnowflakeId();
      const tokenID = `u2f_${generateSnowflakeId()}`;
      const publicKey = Buffer.from('mock_public_key_data');
      
      await createTestUser(userID);
      
      await eventstore.push({
        eventType: 'user.human.u2f.token.added',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          id: tokenID,
          tokenId: tokenID,
          publicKey: publicKey,
          name: 'YubiKey 5',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = await pool.queryOne<{
        id: string;
        method_type: string;
        token_id: string;
        name: string;
        public_key: Buffer;
      }>(
        `SELECT id, method_type, token_id, name, public_key 
         FROM projections.user_auth_methods 
         WHERE instance_id = $1 AND user_id = $2 AND method_type = 'u2f'`,
        ['test-instance', userID]
      );
      
      expect(result).toBeDefined();
      expect(result!.method_type).toBe('u2f');
      expect(result!.token_id).toBe(tokenID);
      expect(result!.name).toBe('YubiKey 5');
      expect(result!.public_key).toBeDefined();
    }, 5000);

    it('should process user.human.u2f.token.removed event', async () => {
      const userID = generateSnowflakeId();
      const tokenID = `u2f_${generateSnowflakeId()}`;
      
      await createTestUser(userID);
      
      // Add U2F token first
      await eventstore.push({
        eventType: 'user.human.u2f.token.added',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          id: tokenID,
          tokenId: tokenID,
          publicKey: Buffer.from('test_key'),
          name: 'Security Key',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Remove U2F token
      await eventstore.push({
        eventType: 'user.human.u2f.token.removed',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          tokenId: tokenID,
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify it's inactive
      const result = await pool.queryOne<{ state: string }>(
        `SELECT state FROM projections.user_auth_methods 
         WHERE instance_id = $1 AND user_id = $2 AND token_id = $3`,
        ['test-instance', userID, tokenID]
      );
      expect(result!.state).toBe('inactive');
    }, 5000);
  });

  describe('Passwordless Events', () => {
    it('should process user.human.passwordless.added event', async () => {
      const userID = generateSnowflakeId();
      const tokenID = `pwdless_${generateSnowflakeId()}`;
      const publicKey = Buffer.from('passwordless_public_key');
      
      await createTestUser(userID);
      
      await eventstore.push({
        eventType: 'user.human.passwordless.added',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          id: tokenID,
          tokenId: tokenID,
          publicKey: publicKey,
          name: 'Face ID',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = await pool.queryOne<{
        method_type: string;
        name: string;
        state: string;
      }>(
        `SELECT method_type, name, state 
         FROM projections.user_auth_methods 
         WHERE instance_id = $1 AND user_id = $2 AND method_type = 'passwordless'`,
        ['test-instance', userID]
      );
      
      expect(result).toBeDefined();
      expect(result!.method_type).toBe('passwordless');
      expect(result!.name).toBe('Face ID');
      expect(result!.state).toBe('active');
    }, 5000);

    it('should process user.human.passwordless.removed event', async () => {
      const userID = generateSnowflakeId();
      const tokenID = `pwdless_${generateSnowflakeId()}`;
      
      await createTestUser(userID);
      
      // Add passwordless first
      await eventstore.push({
        eventType: 'user.human.passwordless.added',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          id: tokenID,
          tokenId: tokenID,
          publicKey: Buffer.from('test'),
          name: 'Touch ID',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Remove passwordless
      await eventstore.push({
        eventType: 'user.human.passwordless.removed',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          tokenId: tokenID,
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify it's inactive
      const result = await pool.queryOne<{ state: string }>(
        `SELECT state FROM projections.user_auth_methods 
         WHERE instance_id = $1 AND user_id = $2 AND token_id = $3`,
        ['test-instance', userID, tokenID]
      );
      expect(result!.state).toBe('inactive');
    }, 5000);
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate auth methods by instance', async () => {
      const userID = generateSnowflakeId();
      
      await createTestUser(userID, 'test-instance');
      await createTestUser(userID, 'instance-2');
      
      // Add OTP for instance 1
      await eventstore.push({
        eventType: 'user.human.otp.added',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          id: `otp_${generateSnowflakeId()}`,
          tokenId: 'token_instance1',
          name: 'Instance 1 OTP',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      // Add OTP for instance 2 (different instance)
      await eventstore.push({
        eventType: 'user.human.otp.added',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          id: `otp_${generateSnowflakeId()}`,
          tokenId: 'token_instance2',
          name: 'Instance 2 OTP',
        },
        creator: 'system',
        owner: 'instance-2',
        instanceID: 'instance-2',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Query instance 1 - should only see its auth method
      const instance1Methods = await pool.queryMany(
        `SELECT * FROM projections.user_auth_methods 
         WHERE instance_id = $1 AND user_id = $2`,
        ['test-instance', userID]
      );
      
      // Query instance 2 - should only see its auth method
      const instance2Methods = await pool.queryMany(
        `SELECT * FROM projections.user_auth_methods 
         WHERE instance_id = $1 AND user_id = $2`,
        ['instance-2', userID]
      );
      
      expect(instance1Methods).toHaveLength(1);
      expect(instance2Methods).toHaveLength(1);
      expect(instance1Methods[0].token_id).toBe('token_instance1');
      expect(instance2Methods[0].token_id).toBe('token_instance2');
    }, 5000);
  });
});
