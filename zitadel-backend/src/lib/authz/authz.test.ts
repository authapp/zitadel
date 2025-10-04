import {
  PermissionBuilder,
  SystemRoleDefinitions,
  matchesPermission,
} from './permissions';
import {
  DefaultPermissionChecker,
  createPermissionChecker,
} from './permission-checker';
import {
  InMemoryRoleManager,
  createInMemoryRoleManager,
} from './role-manager';
import {
  AuthContextBuilder,
  buildContextFromToken,
  buildSystemContext,
} from './context-builder';
import {
  Permission,
  AuthContext,
  Subject,
  SystemRole,
  ResourceType,
  ActionType,
  RoleScope,
  PermissionDeniedError,
} from './types';
import { requirePermission, requireRole } from './middleware';

describe('PermissionBuilder', () => {
  it('should create basic permission', () => {
    const permission = PermissionBuilder.create('user', 'read');
    
    expect(permission.resource).toBe('user');
    expect(permission.action).toBe('read');
  });

  it('should create user permission', () => {
    const permission = PermissionBuilder.user(ActionType.CREATE, 'user123', 'org123');
    
    expect(permission.resource).toBe(ResourceType.USER);
    expect(permission.action).toBe(ActionType.CREATE);
    expect(permission.resourceId).toBe('user123');
    expect(permission.orgId).toBe('org123');
  });

  it('should create org permission', () => {
    const permission = PermissionBuilder.org(ActionType.UPDATE, 'org123');
    
    expect(permission.resource).toBe(ResourceType.ORG);
    expect(permission.action).toBe(ActionType.UPDATE);
    expect(permission.orgId).toBe('org123');
  });

  it('should create project permission', () => {
    const permission = PermissionBuilder.project(ActionType.DELETE, 'proj123', 'org123');
    
    expect(permission.resource).toBe(ResourceType.PROJECT);
    expect(permission.action).toBe(ActionType.DELETE);
    expect(permission.resourceId).toBe('proj123');
    expect(permission.orgId).toBe('org123');
  });
});

describe('matchesPermission', () => {
  it('should match exact permission', () => {
    const required: Permission = {
      resource: 'user',
      action: 'read',
    };
    
    const granted: Permission = {
      resource: 'user',
      action: 'read',
    };
    
    expect(matchesPermission(required, granted)).toBe(true);
  });

  it('should match wildcard resource', () => {
    const required: Permission = {
      resource: 'user',
      action: 'read',
    };
    
    const granted: Permission = {
      resource: '*',
      action: 'read',
    };
    
    expect(matchesPermission(required, granted)).toBe(true);
  });

  it('should match wildcard action', () => {
    const required: Permission = {
      resource: 'user',
      action: 'read',
    };
    
    const granted: Permission = {
      resource: 'user',
      action: '*',
    };
    
    expect(matchesPermission(required, granted)).toBe(true);
  });

  it('should match full wildcard', () => {
    const required: Permission = {
      resource: 'user',
      action: 'read',
    };
    
    const granted: Permission = {
      resource: '*',
      action: '*',
    };
    
    expect(matchesPermission(required, granted)).toBe(true);
  });

  it('should not match different resource', () => {
    const required: Permission = {
      resource: 'user',
      action: 'read',
    };
    
    const granted: Permission = {
      resource: 'org',
      action: 'read',
    };
    
    expect(matchesPermission(required, granted)).toBe(false);
  });

  it('should match specific resource ID', () => {
    const required: Permission = {
      resource: 'user',
      action: 'read',
      resourceId: 'user123',
    };
    
    const granted: Permission = {
      resource: 'user',
      action: 'read',
      resourceId: 'user123',
    };
    
    expect(matchesPermission(required, granted)).toBe(true);
  });

  it('should not match different resource ID', () => {
    const required: Permission = {
      resource: 'user',
      action: 'read',
      resourceId: 'user123',
    };
    
    const granted: Permission = {
      resource: 'user',
      action: 'read',
      resourceId: 'user456',
    };
    
    expect(matchesPermission(required, granted)).toBe(false);
  });

  it('should match org scope', () => {
    const required: Permission = {
      resource: 'user',
      action: 'read',
      orgId: 'org123',
    };
    
    const granted: Permission = {
      resource: 'user',
      action: 'read',
      orgId: 'org123',
    };
    
    expect(matchesPermission(required, granted)).toBe(true);
  });
});

describe('SystemRoleDefinitions', () => {
  it('should have system admin role', () => {
    const role = SystemRoleDefinitions[SystemRole.SYSTEM_ADMIN];
    
    expect(role.id).toBe(SystemRole.SYSTEM_ADMIN);
    expect(role.scope).toBe(RoleScope.SYSTEM);
    expect(role.permissions.length).toBeGreaterThan(0);
  });

  it('should have org owner role', () => {
    const role = SystemRoleDefinitions[SystemRole.ORG_OWNER];
    
    expect(role.id).toBe(SystemRole.ORG_OWNER);
    expect(role.scope).toBe(RoleScope.ORG);
    expect(role.permissions.length).toBeGreaterThan(0);
  });

  it('should have project owner role', () => {
    const role = SystemRoleDefinitions[SystemRole.PROJECT_OWNER];
    
    expect(role.id).toBe(SystemRole.PROJECT_OWNER);
    expect(role.scope).toBe(RoleScope.PROJECT);
  });
});

describe('InMemoryRoleManager', () => {
  let roleManager: InMemoryRoleManager;

  beforeEach(() => {
    roleManager = createInMemoryRoleManager();
  });

  it('should get system role', async () => {
    const role = await roleManager.getRole(SystemRole.SYSTEM_ADMIN);
    
    expect(role).not.toBeNull();
    expect(role!.id).toBe(SystemRole.SYSTEM_ADMIN);
  });

  it('should return null for non-existent role', async () => {
    const role = await roleManager.getRole('non_existent');
    
    expect(role).toBeNull();
  });

  it('should assign role to user', async () => {
    await roleManager.assignRole('user123', SystemRole.USER);
    
    const roles = roleManager.getUserRoles('user123');
    expect(roles).toContain(SystemRole.USER);
  });

  it('should remove role from user', async () => {
    await roleManager.assignRole('user123', SystemRole.USER);
    await roleManager.removeRole('user123', SystemRole.USER);
    
    const roles = roleManager.getUserRoles('user123');
    expect(roles).not.toContain(SystemRole.USER);
  });

  it('should get roles for subject', async () => {
    const subject: Subject = {
      userId: 'user123',
      roles: [SystemRole.USER, SystemRole.ORG_ADMIN],
      orgId: 'org123',
    };

    const roles = await roleManager.getRolesForSubject(subject);
    
    expect(roles.length).toBe(2);
    expect(roles[0].id).toBe(SystemRole.USER);
    expect(roles[1].id).toBe(SystemRole.ORG_ADMIN);
  });
});

describe('DefaultPermissionChecker', () => {
  let roleManager: InMemoryRoleManager;
  let permissionChecker: DefaultPermissionChecker;

  beforeEach(() => {
    roleManager = createInMemoryRoleManager();
    permissionChecker = createPermissionChecker(roleManager) as DefaultPermissionChecker;
  });

  describe('check', () => {
    it('should allow system admin all permissions', async () => {
      const context: AuthContext = {
        subject: {
          userId: 'admin',
          roles: [SystemRole.SYSTEM_ADMIN],
        },
        instanceId: 'test',
      };

      const permission = PermissionBuilder.user(ActionType.DELETE, 'user123');
      const result = await permissionChecker.check(context, permission);
      
      expect(result.allowed).toBe(true);
      expect(result.matchedRole).toBe(SystemRole.SYSTEM_ADMIN);
    });

    it('should allow org owner to manage users in org', async () => {
      const context: AuthContext = {
        subject: {
          userId: 'owner',
          roles: [SystemRole.ORG_OWNER],
          orgId: 'org123',
        },
        instanceId: 'test',
        orgId: 'org123',
      };

      const permission = PermissionBuilder.user(ActionType.CREATE);
      const result = await permissionChecker.check(context, permission);
      
      expect(result.allowed).toBe(true);
    });

    it('should deny permission without matching role', async () => {
      const context: AuthContext = {
        subject: {
          userId: 'user',
          roles: [SystemRole.USER],
        },
        instanceId: 'test',
      };

      const permission = PermissionBuilder.org(ActionType.DELETE);
      const result = await permissionChecker.check(context, permission);
      
      expect(result.allowed).toBe(false);
    });

    it('should allow direct permissions', async () => {
      const context: AuthContext = {
        subject: {
          userId: 'user',
          roles: [],
          permissions: [
            PermissionBuilder.user(ActionType.READ, 'user123'),
          ],
        },
        instanceId: 'test',
      };

      const permission = PermissionBuilder.user(ActionType.READ, 'user123');
      const result = await permissionChecker.check(context, permission);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Direct permission');
    });
  });

  describe('checkAny', () => {
    it('should allow if any permission matches', async () => {
      const context: AuthContext = {
        subject: {
          userId: 'admin',
          roles: [SystemRole.SYSTEM_ADMIN],
        },
        instanceId: 'test',
      };

      const permissions = [
        PermissionBuilder.user(ActionType.DELETE),
        PermissionBuilder.org(ActionType.DELETE),
      ];
      
      const result = await permissionChecker.checkAny(context, permissions);
      
      expect(result.allowed).toBe(true);
    });

    it('should deny if no permissions match', async () => {
      const context: AuthContext = {
        subject: {
          userId: 'user',
          roles: [SystemRole.USER],
        },
        instanceId: 'test',
      };

      const permissions = [
        PermissionBuilder.org(ActionType.DELETE),
        PermissionBuilder.project(ActionType.DELETE),
      ];
      
      const result = await permissionChecker.checkAny(context, permissions);
      
      expect(result.allowed).toBe(false);
    });
  });

  describe('checkAll', () => {
    it('should allow if all permissions match', async () => {
      const context: AuthContext = {
        subject: {
          userId: 'admin',
          roles: [SystemRole.SYSTEM_ADMIN],
        },
        instanceId: 'test',
      };

      const permissions = [
        PermissionBuilder.user(ActionType.READ),
        PermissionBuilder.user(ActionType.UPDATE),
      ];
      
      const result = await permissionChecker.checkAll(context, permissions);
      
      expect(result.allowed).toBe(true);
    });

    it('should deny if any permission missing', async () => {
      const context: AuthContext = {
        subject: {
          userId: 'user',
          roles: [SystemRole.USER],
        },
        instanceId: 'test',
      };

      const permissions = [
        PermissionBuilder.user(ActionType.READ),
        PermissionBuilder.org(ActionType.DELETE),
      ];
      
      const result = await permissionChecker.checkAll(context, permissions);
      
      expect(result.allowed).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true if subject has role', () => {
      const context: AuthContext = {
        subject: {
          userId: 'user',
          roles: [SystemRole.USER, SystemRole.ORG_ADMIN],
        },
        instanceId: 'test',
      };

      expect(permissionChecker.hasRole(context, SystemRole.USER)).toBe(true);
      expect(permissionChecker.hasRole(context, SystemRole.ORG_ADMIN)).toBe(true);
    });

    it('should return false if subject does not have role', () => {
      const context: AuthContext = {
        subject: {
          userId: 'user',
          roles: [SystemRole.USER],
        },
        instanceId: 'test',
      };

      expect(permissionChecker.hasRole(context, SystemRole.SYSTEM_ADMIN)).toBe(false);
    });
  });
});

describe('AuthContextBuilder', () => {
  it('should build basic context', () => {
    const context = AuthContextBuilder.create()
      .withUserId('user123')
      .withInstanceId('instance1')
      .build();
    
    expect(context.subject.userId).toBe('user123');
    expect(context.instanceId).toBe('instance1');
  });

  it('should throw error without user ID', () => {
    expect(() => {
      AuthContextBuilder.create().build();
    }).toThrow('User ID is required');
  });

  it('should build with roles', () => {
    const context = AuthContextBuilder.create()
      .withUserId('user123')
      .withRoles([SystemRole.USER, SystemRole.ORG_ADMIN])
      .build();
    
    expect(context.subject.roles).toContain(SystemRole.USER);
    expect(context.subject.roles).toContain(SystemRole.ORG_ADMIN);
  });

  it('should add single role', () => {
    const context = AuthContextBuilder.create()
      .withUserId('user123')
      .addRole(SystemRole.USER)
      .addRole(SystemRole.ORG_ADMIN)
      .build();
    
    expect(context.subject.roles.length).toBe(2);
  });

  it('should build with org and project', () => {
    const context = AuthContextBuilder.create()
      .withUserId('user123')
      .withOrgId('org123')
      .withProjectId('proj123')
      .build();
    
    expect(context.orgId).toBe('org123');
    expect(context.projectId).toBe('proj123');
    expect(context.subject.orgId).toBe('org123');
  });

  it('should build with metadata', () => {
    const context = AuthContextBuilder.create()
      .withUserId('user123')
      .withMetadata({ key1: 'value1' })
      .addMetadata('key2', 'value2')
      .build();
    
    expect(context.metadata?.key1).toBe('value1');
    expect(context.metadata?.key2).toBe('value2');
  });
});

describe('buildContextFromToken', () => {
  it('should build context from token payload', () => {
    const payload = {
      sub: 'user123',
      org_id: 'org123',
      project_id: 'proj123',
      instance_id: 'instance1',
      roles: [SystemRole.USER],
    };
    
    const context = buildContextFromToken(payload);
    
    expect(context.subject.userId).toBe('user123');
    expect(context.orgId).toBe('org123');
    expect(context.projectId).toBe('proj123');
    expect(context.instanceId).toBe('instance1');
    expect(context.subject.roles).toContain(SystemRole.USER);
  });

  it('should handle minimal token payload', () => {
    const payload = {
      sub: 'user123',
    };
    
    const context = buildContextFromToken(payload);
    
    expect(context.subject.userId).toBe('user123');
    expect(context.instanceId).toBe('default');
  });
});

describe('buildSystemContext', () => {
  it('should build system context', () => {
    const context = buildSystemContext('instance1');
    
    expect(context.subject.userId).toBe('system');
    expect(context.instanceId).toBe('instance1');
    expect(context.subject.roles).toContain('system_admin');
  });

  it('should use default instance', () => {
    const context = buildSystemContext();
    
    expect(context.instanceId).toBe('default');
  });
});

describe('middleware', () => {
  let roleManager: InMemoryRoleManager;
  let permissionChecker: DefaultPermissionChecker;

  beforeEach(() => {
    roleManager = createInMemoryRoleManager();
    permissionChecker = createPermissionChecker(roleManager) as DefaultPermissionChecker;
  });

  describe('requirePermission', () => {
    it('should allow with valid permission', async () => {
      const context: AuthContext = {
        subject: {
          userId: 'admin',
          roles: [SystemRole.SYSTEM_ADMIN],
        },
        instanceId: 'test',
      };

      const middleware = requirePermission(
        permissionChecker,
        PermissionBuilder.user(ActionType.DELETE)
      );

      const next = jest.fn().mockResolvedValue('success');
      const result = await middleware(context, next);
      
      expect(next).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('should throw error without permission', async () => {
      const context: AuthContext = {
        subject: {
          userId: 'user',
          roles: [SystemRole.USER],
        },
        instanceId: 'test',
      };

      const middleware = requirePermission(
        permissionChecker,
        PermissionBuilder.org(ActionType.DELETE)
      );

      const next = jest.fn();
      
      await expect(middleware(context, next)).rejects.toThrow(PermissionDeniedError);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should allow with valid role', async () => {
      const context: AuthContext = {
        subject: {
          userId: 'admin',
          roles: [SystemRole.SYSTEM_ADMIN],
        },
        instanceId: 'test',
      };

      const middleware = requireRole(permissionChecker, SystemRole.SYSTEM_ADMIN);
      const next = jest.fn().mockResolvedValue('success');
      const result = await middleware(context, next);
      
      expect(next).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('should throw error without role', async () => {
      const context: AuthContext = {
        subject: {
          userId: 'user',
          roles: [SystemRole.USER],
        },
        instanceId: 'test',
      };

      const middleware = requireRole(permissionChecker, SystemRole.SYSTEM_ADMIN);
      const next = jest.fn();
      
      await expect(middleware(context, next)).rejects.toThrow(PermissionDeniedError);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
