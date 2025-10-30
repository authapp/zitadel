/**
 * Authorization Enhancement Integration Tests
 * Tests for Sprint 1 Week 1 enhancements:
 * - Token type detection (user, service, system)
 * - Instance metadata loading
 * - Instance-level authorization
 * - Feature flag checking
 * - Quota enforcement
 * - IAM member validation
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { 
  AuthContextBuilder, 
  buildContextFromToken, 
  buildSystemContext,
  buildServiceAccountContext,
  TokenPayload 
} from '../../../src/lib/authz/context-builder';
import { TokenType } from '../../../src/lib/authz/types';
import {
  checkInstanceFeature,
  requireInstanceFeature,
  checkInstanceQuota,
  requireInstanceQuota,
  isIAMMember,
  requireIAMMember,
  hasInstancePermission,
  requireInstancePermission,
  validateInstanceContext,
  checkInstanceOperation,
} from '../../../src/lib/authz/instance-authz';
import { ZitadelError, ErrorCode } from '../../../src/lib/zerrors';

describe('Authorization Enhancement Integration Tests', () => {
  
  // ============================================================================
  // CONTEXT BUILDER TESTS
  // ============================================================================
  
  describe('AuthContextBuilder', () => {
    describe('Token Type Detection', () => {
      it('should create user context with USER token type', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withOrgId('org-1')
          .build();

        expect(context.subject.userId).toBe('user-123');
        expect(context.tokenType).toBe(TokenType.USER);
        expect(context.isSystemToken).toBe(false);
        expect(context.subject.serviceAccount).toBe(false);
      });

      it('should create service account context', () => {
        const context = AuthContextBuilder.create()
          .withUserId('service-123')
          .withInstanceId('inst-1')
          .asServiceAccount()
          .build();

        expect(context.subject.userId).toBe('service-123');
        expect(context.tokenType).toBe(TokenType.SERVICE_ACCOUNT);
        expect(context.isSystemToken).toBe(false);
        expect(context.subject.serviceAccount).toBe(true);
      });

      it('should create system context without user', () => {
        const context = AuthContextBuilder.create()
          .withInstanceId('inst-1')
          .asSystemToken()
          .build();

        expect(context.subject.userId).toBe('system');
        expect(context.tokenType).toBe(TokenType.SYSTEM);
        expect(context.isSystemToken).toBe(true);
      });

      it('should fail without user ID for non-system tokens', () => {
        expect(() => {
          AuthContextBuilder.create()
            .withInstanceId('inst-1')
            .build();
        }).toThrow('User ID is required');
      });
    });

    describe('Metadata Loading', () => {
      it('should load instance metadata', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withInstanceMetadata({
            id: 'inst-1',
            name: 'Test Instance',
            features: { loginV2: true, actions: false },
            quotas: { users: 1000, orgs: 10 },
          })
          .build();

        expect(context.instanceMetadata).toBeDefined();
        expect(context.instanceMetadata?.name).toBe('Test Instance');
        expect(context.instanceMetadata?.features?.loginV2).toBe(true);
        expect(context.instanceMetadata?.quotas?.users).toBe(1000);
      });

      it('should load org metadata', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withOrgId('org-1')
          .withOrgMetadata({
            id: 'org-1',
            name: 'Test Org',
            domain: 'test.com',
            state: 1,
          })
          .build();

        expect(context.orgMetadata).toBeDefined();
        expect(context.orgMetadata?.name).toBe('Test Org');
        expect(context.orgMetadata?.domain).toBe('test.com');
      });

      it('should load project metadata', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withProjectId('proj-1')
          .withProjectMetadata({
            id: 'proj-1',
            name: 'Test Project',
            orgId: 'org-1',
            state: 1,
          })
          .build();

        expect(context.projectMetadata).toBeDefined();
        expect(context.projectMetadata?.name).toBe('Test Project');
        expect(context.projectMetadata?.orgId).toBe('org-1');
      });

      it('should load all metadata types together', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withOrgId('org-1')
          .withProjectId('proj-1')
          .withInstanceMetadata({ id: 'inst-1', name: 'Instance' })
          .withOrgMetadata({ id: 'org-1', name: 'Org' })
          .withProjectMetadata({ id: 'proj-1', name: 'Project', orgId: 'org-1' })
          .build();

        expect(context.instanceMetadata).toBeDefined();
        expect(context.orgMetadata).toBeDefined();
        expect(context.projectMetadata).toBeDefined();
      });
    });

    describe('Token Payload Parsing', () => {
      it('should build context from user token payload', () => {
        const payload: TokenPayload = {
          sub: 'user-123',
          instance_id: 'inst-1',
          org_id: 'org-1',
          project_id: 'proj-1',
          roles: ['user', 'viewer'],
          token_type: 'user',
        };

        const context = buildContextFromToken(payload);

        expect(context.subject.userId).toBe('user-123');
        expect(context.instanceId).toBe('inst-1');
        expect(context.orgId).toBe('org-1');
        expect(context.projectId).toBe('proj-1');
        expect(context.subject.roles).toEqual(['user', 'viewer']);
        expect(context.tokenType).toBe(TokenType.USER);
      });

      it('should detect service account from payload', () => {
        const payload: TokenPayload = {
          sub: 'service-123',
          instance_id: 'inst-1',
          token_type: 'service',
          service_account: true,
        };

        const context = buildContextFromToken(payload);

        expect(context.tokenType).toBe(TokenType.SERVICE_ACCOUNT);
        expect(context.subject.serviceAccount).toBe(true);
      });

      it('should detect system token from payload', () => {
        const payload: TokenPayload = {
          sub: 'system',
          instance_id: 'inst-1',
          token_type: 'system',
          roles: ['system_admin'],
        };

        const context = buildContextFromToken(payload);

        expect(context.tokenType).toBe(TokenType.SYSTEM);
        expect(context.isSystemToken).toBe(true);
      });
    });

    describe('Helper Functions', () => {
      it('should build system context', () => {
        const context = buildSystemContext('inst-1');

        expect(context.instanceId).toBe('inst-1');
        expect(context.isSystemToken).toBe(true);
        expect(context.subject.userId).toBe('system');
        expect(context.subject.roles).toContain('system_admin');
        expect(context.subject.roles).toContain('iam_owner');
      });

      it('should build service account context', () => {
        const context = buildServiceAccountContext(
          'service-123',
          'inst-1',
          'org-1',
          ['api_reader']
        );

        expect(context.subject.userId).toBe('service-123');
        expect(context.instanceId).toBe('inst-1');
        expect(context.orgId).toBe('org-1');
        expect(context.subject.roles).toContain('api_reader');
        expect(context.tokenType).toBe(TokenType.SERVICE_ACCOUNT);
      });
    });
  });

  // ============================================================================
  // INSTANCE AUTHORIZATION TESTS
  // ============================================================================

  describe('Instance Authorization', () => {
    describe('Feature Flag Checking', () => {
      it('should allow feature when enabled', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withInstanceMetadata({
            id: 'inst-1',
            features: { loginV2: true, actions: true },
          })
          .build();

        expect(checkInstanceFeature(context, 'loginV2')).toBe(true);
        expect(checkInstanceFeature(context, 'actions')).toBe(true);
      });

      it('should deny feature when disabled', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withInstanceMetadata({
            id: 'inst-1',
            features: { loginV2: true, actions: false },
          })
          .build();

        expect(checkInstanceFeature(context, 'actions')).toBe(false);
      });

      it('should allow feature when no metadata (backward compatibility)', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .build();

        expect(checkInstanceFeature(context, 'anyFeature')).toBe(true);
      });

      it('should bypass feature checks for system tokens', () => {
        const context = buildSystemContext('inst-1');

        // Even with features disabled, system token bypasses
        context.instanceMetadata = {
          id: 'inst-1',
          features: { actions: false },
        };

        expect(checkInstanceFeature(context, 'actions')).toBe(true);
      });

      it('should throw when requiring disabled feature', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withInstanceMetadata({
            id: 'inst-1',
            features: { actions: false },
          })
          .build();

        expect(() => {
          requireInstanceFeature(context, 'actions');
        }).toThrow(ZitadelError);

        try {
          requireInstanceFeature(context, 'actions');
        } catch (error) {
          expect(error).toBeInstanceOf(ZitadelError);
          expect((error as ZitadelError).code).toBe(ErrorCode.FEATURE_DISABLED);
        }
      });
    });

    describe('Quota Enforcement', () => {
      it('should allow operation within quota', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withInstanceMetadata({
            id: 'inst-1',
            quotas: { users: 1000, orgs: 10 },
          })
          .build();

        expect(checkInstanceQuota(context, 'users', 500)).toBe(true);
        expect(checkInstanceQuota(context, 'orgs', 5)).toBe(true);
      });

      it('should deny operation when quota exceeded', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withInstanceMetadata({
            id: 'inst-1',
            quotas: { users: 1000, orgs: 10 },
          })
          .build();

        expect(checkInstanceQuota(context, 'users', 1500)).toBe(false);
        expect(checkInstanceQuota(context, 'orgs', 15)).toBe(false);
      });

      it('should allow operation when no quota defined (unlimited)', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .build();

        expect(checkInstanceQuota(context, 'users', 99999)).toBe(true);
      });

      it('should bypass quota for system tokens', () => {
        const context = buildSystemContext('inst-1');
        context.instanceMetadata = {
          id: 'inst-1',
          quotas: { users: 10 },
        };

        expect(checkInstanceQuota(context, 'users', 1000)).toBe(true);
      });

      it('should throw when quota exceeded', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withInstanceMetadata({
            id: 'inst-1',
            quotas: { users: 100 },
          })
          .build();

        expect(() => {
          requireInstanceQuota(context, 'users', 150);
        }).toThrow(ZitadelError);

        try {
          requireInstanceQuota(context, 'users', 150);
        } catch (error) {
          expect(error).toBeInstanceOf(ZitadelError);
          expect((error as ZitadelError).code).toBe(ErrorCode.QUOTA_EXCEEDED);
        }
      });
    });

    describe('IAM Member Validation', () => {
      it('should identify IAM_OWNER as IAM member', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withRoles(['IAM_OWNER'])
          .build();

        expect(isIAMMember(context)).toBe(true);
      });

      it('should identify IAM_ADMIN as IAM member', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withRoles(['IAM_ADMIN'])
          .build();

        expect(isIAMMember(context)).toBe(true);
      });

      it('should identify system_admin as IAM member', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withRoles(['system_admin'])
          .build();

        expect(isIAMMember(context)).toBe(true);
      });

      it('should recognize lowercase IAM roles', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withRoles(['iam_owner', 'iam_admin'])
          .build();

        expect(isIAMMember(context)).toBe(true);
      });

      it('should not identify regular users as IAM members', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withRoles(['ORG_OWNER', 'PROJECT_OWNER'])
          .build();

        expect(isIAMMember(context)).toBe(false);
      });

      it('should always consider system tokens as IAM members', () => {
        const context = buildSystemContext('inst-1');

        expect(isIAMMember(context)).toBe(true);
      });

      it('should throw when requiring IAM member', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withRoles(['user'])
          .build();

        expect(() => {
          requireIAMMember(context);
        }).toThrow(ZitadelError);

        try {
          requireIAMMember(context);
        } catch (error) {
          expect(error).toBeInstanceOf(ZitadelError);
          expect((error as ZitadelError).code).toBe(ErrorCode.PERMISSION_DENIED);
        }
      });
    });

    describe('Instance Permission Checks', () => {
      it('should grant permission to system tokens', () => {
        const context = buildSystemContext('inst-1');

        const result = hasInstancePermission(context, {
          resource: 'instance',
          action: 'manage',
        });

        expect(result).toBe(true);
      });

      it('should grant permission to IAM members', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withRoles(['IAM_OWNER'])
          .build();

        const result = hasInstancePermission(context, {
          resource: 'instance',
          action: 'manage',
        });

        expect(result).toBe(true);
      });

      it('should check explicit permissions', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .build();

        context.subject.permissions = [
          { resource: 'user', action: 'read' },
          { resource: 'org', action: 'create' },
        ];

        expect(hasInstancePermission(context, { resource: 'user', action: 'read' })).toBe(true);
        expect(hasInstancePermission(context, { resource: 'org', action: 'create' })).toBe(true);
        expect(hasInstancePermission(context, { resource: 'user', action: 'delete' })).toBe(false);
      });

      it('should throw when permission denied', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withRoles(['user'])
          .build();

        expect(() => {
          requireInstancePermission(context, {
            resource: 'instance',
            action: 'manage',
          });
        }).toThrow(ZitadelError);
      });
    });

    describe('Instance Context Validation', () => {
      it('should validate valid instance context', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .build();

        expect(() => {
          validateInstanceContext(context);
        }).not.toThrow();
      });

      it('should throw for empty instance ID', () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('')
          .build();

        expect(() => {
          validateInstanceContext(context);
        }).toThrow(ZitadelError);
      });
    });

    describe('Combined Operation Checks', () => {
      it('should allow operation with all checks passing', async () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withRoles(['IAM_OWNER'])
          .withInstanceMetadata({
            id: 'inst-1',
            features: { actions: true },
            quotas: { executions: 1000 },
          })
          .build();

        const result = await checkInstanceOperation(context, {
          requireIAM: true,
          feature: 'actions',
          quota: { name: 'executions', currentUsage: 500 },
          permission: { resource: 'action', action: 'execute' },
        });

        expect(result).toBe(true);
      });

      it('should deny operation when IAM check fails', async () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withRoles(['user'])
          .build();

        const result = await checkInstanceOperation(context, {
          requireIAM: true,
        });

        expect(result).toBe(false);
      });

      it('should deny operation when feature disabled', async () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withInstanceMetadata({
            id: 'inst-1',
            features: { actions: false },
          })
          .build();

        const result = await checkInstanceOperation(context, {
          feature: 'actions',
        });

        expect(result).toBe(false);
      });

      it('should deny operation when quota exceeded', async () => {
        const context = AuthContextBuilder.create()
          .withUserId('user-123')
          .withInstanceId('inst-1')
          .withInstanceMetadata({
            id: 'inst-1',
            quotas: { executions: 100 },
          })
          .build();

        const result = await checkInstanceOperation(context, {
          quota: { name: 'executions', currentUsage: 150 },
        });

        expect(result).toBe(false);
      });
    });
  });
});
