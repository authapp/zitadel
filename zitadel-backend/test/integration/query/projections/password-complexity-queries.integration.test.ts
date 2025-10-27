/**
 * Integration tests for Password Complexity Queries
 * Tests password policy queries and validation business logic with real database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PasswordComplexityQueries } from '../../../../src/lib/query/policy/password-complexity-queries';
import { DatabasePool } from '../../../../src/lib/database';
import { DatabaseMigrator } from '../../../../src/lib/database/migrator';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { generateId as generateSnowflakeId } from '../../../../src/lib/id/snowflake';
import { PostgresEventstore } from '../../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { PasswordPolicyProjection } from '../../../../src/lib/query/projections/password-policy-projection';

describe('Password Complexity Queries Integration Tests', () => {
  let pool: DatabasePool;
  let queries: PasswordComplexityQueries;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;

  beforeAll(async () => {
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
    });
    
    queries = new PasswordComplexityQueries(pool);
    
    // Set up projection for event processing
    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register password policy projection
    const projection = new PasswordPolicyProjection(eventstore, pool);
    registry.register({
      name: 'password_policy_projection',
      tables: ['password_complexity_policies'],
      eventTypes: [
        'instance.password.complexity.policy.added',
        'instance.password.complexity.policy.changed',
        'instance.password.complexity.policy.removed',
        'org.password.complexity.policy.added',
        'org.password.complexity.policy.changed',
        'org.password.complexity.policy.removed',
      ],
      aggregateTypes: ['instance', 'org'],
      batchSize: 100,
      interval: 50,
      enableLocking: false,
    }, projection);
    
    await registry.start('password_policy_projection');
    
    // Wait for projections to be ready
    await new Promise(resolve => setTimeout(resolve, 300));
  });

  afterAll(async () => {
    if (registry) {
      const names = registry.getNames();
      for (const name of names) {
        try {
          await registry.stop(name);
        } catch (e) {
          // Ignore if already stopped
        }
      }
    }
    
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clean up test data between tests to prevent interference
    await pool.query('DELETE FROM projections.password_complexity_policies WHERE instance_id = $1', ['test-instance']);
    // Wait a bit for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Policy Inheritance', () => {
    it('should return built-in default when no policy exists', async () => {
      const instanceID = `unused-instance-${generateSnowflakeId()}`; // Use different instance to test default
      
      const policy = await queries.getPasswordComplexityPolicy(instanceID);
      
      expect(policy).toBeDefined();
      expect(policy.id).toBe('built-in-default');
      expect(policy.instanceID).toBe(instanceID);
      expect(policy.minLength).toBe(8);
      expect(policy.hasUppercase).toBe(true);
      expect(policy.hasLowercase).toBe(true);
      expect(policy.hasNumber).toBe(true);
      expect(policy.hasSymbol).toBe(false);
      expect(policy.isDefault).toBe(true);
    }, 5000);

    it('should return instance policy when available', async () => {
      const instanceID = 'test-instance';
      const policyID = `policy_${generateSnowflakeId()}`;
      
      // Create instance-level policy via event
      await eventstore.push({
        eventType: 'instance.password.complexity.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          minLength: 12,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: true,
          hasSymbol: true,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const policy = await queries.getPasswordComplexityPolicy(instanceID);
      
      expect(policy).toBeDefined();
      expect(policy.id).toBe(policyID);
      expect(policy.instanceID).toBe(instanceID);
      expect(policy.minLength).toBe(12);
      expect(policy.hasSymbol).toBe(true);
      expect(policy.isDefault).toBe(true);
    }, 5000);

    it('should return org-specific policy over instance policy', async () => {
      const instanceID = 'test-instance';
      const orgID = `org_${generateSnowflakeId()}`;
      const instancePolicyID = `policy_inst_${generateSnowflakeId()}`;
      const orgPolicyID = `policy_org_${generateSnowflakeId()}`;
      
      // Create instance policy
      await eventstore.push({
        eventType: 'instance.password.complexity.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: instancePolicyID,
          minLength: 10,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: true,
          hasSymbol: false,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      // Create org-specific policy
      await eventstore.push({
        eventType: 'org.password.complexity.policy.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: {
          id: orgPolicyID,
          minLength: 16,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: true,
          hasSymbol: true,
        },
        creator: 'system',
        owner: orgID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Query without orgID should return instance policy
      const instancePolicy = await queries.getPasswordComplexityPolicy(instanceID);
      expect(instancePolicy.id).toBe(instancePolicyID);
      expect(instancePolicy.minLength).toBe(10);
      
      // Query with orgID should return org policy
      const orgPolicy = await queries.getPasswordComplexityPolicy(instanceID, orgID);
      expect(orgPolicy.id).toBe(orgPolicyID);
      expect(orgPolicy.minLength).toBe(16);
      expect(orgPolicy.hasSymbol).toBe(true);
    }, 5000);
  });

  describe('Password Validation', () => {
    it('should validate password against default policy', async () => {
      const instanceID = 'unused-instance-val'; // Use different instance for default test
      const policy = await queries.getPasswordComplexityPolicy(instanceID);
      
      // Test valid password
      const validResult = await queries.validatePassword('MyPass123', policy);
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toEqual([]);
      
      // Test too short
      const shortResult = await queries.validatePassword('MyP1', policy);
      expect(shortResult.isValid).toBe(false);
      expect(shortResult.errors).toContain('Password must be at least 8 characters long');
      
      // Test missing uppercase
      const noUpperResult = await queries.validatePassword('mypass123', policy);
      expect(noUpperResult.isValid).toBe(false);
      expect(noUpperResult.errors).toContain('Password must contain at least one uppercase letter');
      
      // Test missing lowercase
      const noLowerResult = await queries.validatePassword('MYPASS123', policy);
      expect(noLowerResult.isValid).toBe(false);
      expect(noLowerResult.errors).toContain('Password must contain at least one lowercase letter');
      
      // Test missing number
      const noNumberResult = await queries.validatePassword('MyPassword', policy);
      expect(noNumberResult.isValid).toBe(false);
      expect(noNumberResult.errors).toContain('Password must contain at least one number');
    }, 5000);

    it('should validate password with symbol requirement', async () => {
      const instanceID = 'test-instance';
      const policyID = `policy_${generateSnowflakeId()}`;
      
      // Create policy with symbol requirement
      await eventstore.push({
        eventType: 'instance.password.complexity.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          minLength: 10,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: true,
          hasSymbol: true,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const policy = await queries.getPasswordComplexityPolicy(instanceID);
      
      // Test without symbol
      const noSymbolResult = await queries.validatePassword('MyPassword123', policy);
      expect(noSymbolResult.isValid).toBe(false);
      expect(noSymbolResult.errors).toContain('Password must contain at least one symbol');
      
      // Test with symbol
      const withSymbolResult = await queries.validatePassword('MyPass123!', policy);
      expect(withSymbolResult.isValid).toBe(true);
      expect(withSymbolResult.errors).toEqual([]);
    }, 5000);

    it('should handle policy changes', async () => {
      const instanceID = 'test-instance';
      const policyID = `policy_${generateSnowflakeId()}`;
      
      // Create initial policy
      await eventstore.push({
        eventType: 'instance.password.complexity.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          minLength: 8,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: false,
          hasSymbol: false,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      let policy = await queries.getPasswordComplexityPolicy(instanceID);
      expect(policy.minLength).toBe(8);
      expect(policy.hasNumber).toBe(false);
      
      // Password without number should be valid
      let result = await queries.validatePassword('MyPassword', policy);
      expect(result.isValid).toBe(true);
      
      // Change policy to require numbers
      await eventstore.push({
        eventType: 'instance.password.complexity.policy.changed',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          minLength: 8,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: true,
          hasSymbol: false,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      policy = await queries.getPasswordComplexityPolicy(instanceID);
      expect(policy.hasNumber).toBe(true);
      
      // Now password without number should be invalid
      result = await queries.validatePassword('MyPassword', policy);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    }, 5000);
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate policies by instance', async () => {
      const instance1ID = 'test-instance';
      const instance2ID = `other-instance-${generateSnowflakeId()}`;
      const policy1ID = `policy1_${generateSnowflakeId()}`;
      
      // Create policy for instance 1 (lenient)
      await eventstore.push({
        eventType: 'instance.password.complexity.policy.added',
        aggregateType: 'instance',
        aggregateID: instance1ID,
        payload: {
          id: policy1ID,
          minLength: 6,
          hasUppercase: false,
          hasLowercase: true,
          hasNumber: false,
          hasSymbol: false,
        },
        creator: 'system',
        owner: instance1ID,
        instanceID: instance1ID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Get policies for each instance
      const policy1 = await queries.getPasswordComplexityPolicy(instance1ID);
      const policy2 = await queries.getPasswordComplexityPolicy(instance2ID);
      
      // Instance 1 should have configured policy
      expect(policy1.id).toBe(policy1ID);
      expect(policy1.minLength).toBe(6);
      expect(policy1.hasUppercase).toBe(false);
      
      // Instance 2 should get built-in default (isolation verified)
      expect(policy2.id).toBe('built-in-default');
      expect(policy2.minLength).toBe(8);
      expect(policy2.hasUppercase).toBe(true);
      
      // Test password validation across instances
      const password = 'simple';
      
      const result1 = await queries.validatePassword(password, policy1);
      expect(result1.isValid).toBe(true); // Valid for lenient policy
      
      const result2 = await queries.validatePassword(password, policy2);
      expect(result2.isValid).toBe(false); // Invalid for default (needs uppercase and number)
      expect(result2.errors.length).toBeGreaterThan(0);
    }, 5000);
  });

  describe('Query Methods', () => {
    it('should get default policy correctly', async () => {
      const instanceID = 'test-instance';
      const policyID = `policy_${generateSnowflakeId()}`;
      
      // Create default policy
      await eventstore.push({
        eventType: 'instance.password.complexity.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          minLength: 10,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: true,
          hasSymbol: false,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const policy = await queries.getDefaultPasswordComplexityPolicy(instanceID);
      
      expect(policy).toBeDefined();
      expect(policy.id).toBe(policyID);
      expect(policy.isDefault).toBe(true);
      expect(policy.minLength).toBe(10);
    }, 5000);

    it('should get complexity requirements', async () => {
      const instanceID = 'unused-instance-req'; // Use different instance for default test
      
      const policy = await queries.getPasswordComplexityPolicy(instanceID);
      const requirements = queries.getPasswordRequirements(policy);
      
      expect(requirements).toBeDefined();
      expect(requirements.minLength).toBe(8);
      expect(requirements.requireUppercase).toBe(true);
      expect(requirements.requireLowercase).toBe(true);
      expect(requirements.requireNumber).toBe(true);
      expect(requirements.requireSymbol).toBe(false);
      
      // Test description generation
      const description = queries.getPasswordRequirementsDescription(policy);
      expect(description).toContain('at least 8 characters');
      expect(description).toContain('uppercase');
      expect(description).toContain('lowercase');
      expect(description).toContain('number');
    }, 5000);
  });

  describe('Edge Cases', () => {
    it('should handle policy removal gracefully', async () => {
      const instanceID = 'test-instance';
      const policyID = `policy_${generateSnowflakeId()}`;
      
      // Add policy
      await eventstore.push({
        eventType: 'instance.password.complexity.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          minLength: 12,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: true,
          hasSymbol: true,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      let policy = await queries.getPasswordComplexityPolicy(instanceID);
      expect(policy.id).toBe(policyID);
      
      // Remove policy
      await eventstore.push({
        eventType: 'instance.password.complexity.policy.removed',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Should fall back to built-in default
      policy = await queries.getPasswordComplexityPolicy(instanceID);
      expect(policy.id).toBe('built-in-default');
      expect(policy.minLength).toBe(8);
    }, 5000);

    it('should handle empty/null passwords', async () => {
      const instanceID = 'unused-instance-empty'; // Use different instance for default test
      const policy = await queries.getPasswordComplexityPolicy(instanceID);
      
      const emptyResult = await queries.validatePassword('', policy);
      expect(emptyResult.isValid).toBe(false);
      expect(emptyResult.errors.length).toBeGreaterThan(0);
    }, 5000);
  });
});
