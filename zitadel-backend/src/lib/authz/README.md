# Authorization Module (authz)

The authorization module provides comprehensive permission checking and role-based access control (RBAC) for the Zitadel backend.

## Features

### ✅ Permission System
- **Fine-grained permissions** with resource and action combinations
- **Wildcard support** for flexible permission patterns
- **MANAGE action** that implies all CRUD operations (create, read, update, delete, list, execute)
- **Scope-aware permissions** (system, org, project levels)
- **Direct permissions** and role-based permissions

### ✅ Role-Based Access Control (RBAC)
- **System roles**: SYSTEM_ADMIN, ORG_OWNER, ORG_ADMIN, PROJECT_OWNER, PROJECT_ADMIN, USER
- **Custom role support** with query-based role manager
- **Role hierarchies** with scope management
- **In-memory role manager** for testing

### ✅ Authorization Context
- **Context builder** for creating auth contexts from requests
- **Token payload support** for JWT-based authentication
- **System context** for internal operations
- **Metadata support** for additional context

### ✅ Middleware & Decorators
- `requirePermission` - Require specific permission
- `requireAnyPermission` - Require at least one permission
- `requireAllPermissions` - Require all permissions
- `requireRole` - Require specific role
- `@Authorize` - Method decorator for authorization

## Quick Start

```typescript
import {
  createInMemoryAuthzComponents,
  PermissionBuilder,
  AuthContextBuilder,
  ActionType,
} from './authz';

// Create authorization components
const { permissionChecker, roleManager } = createInMemoryAuthzComponents();

// Build auth context
const context = AuthContextBuilder.create()
  .withUserId('user123')
  .withOrgId('org123')
  .withRoles(['org_admin'])
  .build();

// Check permission
const permission = PermissionBuilder.user(ActionType.CREATE);
const result = await permissionChecker.check(context, permission);

if (result.allowed) {
  // User has permission
}
```

## Permission Matching Rules

1. **Exact match**: Resource and action must match exactly
2. **Wildcard resource**: `*` matches any resource
3. **Wildcard action**: `*` matches any action
4. **MANAGE action**: Grants all CRUD operations on the resource
5. **Resource ID**: Optional resource-specific permissions
6. **Org scope**: Optional organization-specific permissions

## System Roles

### SYSTEM_ADMIN
- Full system access with wildcard permissions
- Scope: System-wide

### ORG_OWNER
- Full organization management
- User, project, application, role, and grant management
- Scope: Organization

### ORG_ADMIN
- Organization read/update (no delete)
- User and project management
- Read-only access to applications and roles
- Scope: Organization

### PROJECT_OWNER
- Full project management
- Application, role, and grant management
- Scope: Project

### PROJECT_ADMIN
- Project read/update (no delete)
- Application management
- Read-only grant access
- Scope: Project

### USER
- Self-management only
- Read and update own profile
- Scope: System

## Usage Examples

### Check Multiple Permissions

```typescript
// Check if user has any of these permissions
const permissions = [
  PermissionBuilder.user(ActionType.CREATE),
  PermissionBuilder.user(ActionType.UPDATE),
];

const result = await permissionChecker.checkAny(context, permissions);
```

### Check All Permissions

```typescript
// Check if user has all these permissions
const permissions = [
  PermissionBuilder.org(ActionType.READ),
  PermissionBuilder.org(ActionType.UPDATE),
];

const result = await permissionChecker.checkAll(context, permissions);
```

### Use Middleware

```typescript
const middleware = requirePermission(
  permissionChecker,
  PermissionBuilder.user(ActionType.DELETE)
);

await middleware(context, async () => {
  // This code only runs if permission is granted
  return 'success';
});
```

### Build Context from Token

```typescript
const tokenPayload = {
  sub: 'user123',
  org_id: 'org123',
  roles: ['org_admin'],
};

const context = buildContextFromToken(tokenPayload);
```

## Testing

The module includes 44+ comprehensive tests covering:
- Permission builder functionality
- Permission matching with wildcards and MANAGE action
- System role definitions
- Role manager operations
- Permission checker with various scenarios
- Context builder and token parsing
- Middleware functions

Run tests:
```bash
npm test src/lib/authz/authz.test.ts
```

## Architecture

```
authz/
├── types.ts              # Core interfaces and types
├── permissions.ts        # Permission definitions and matching
├── permission-checker.ts # Permission checking logic
├── role-manager.ts       # Role management (query & in-memory)
├── context-builder.ts    # Authorization context creation
├── middleware.ts         # Authorization middleware
├── factory.ts            # Component factories
└── index.ts             # Public API
```

## Integration

The authz module integrates with:
- **query**: For loading roles and permissions from database
- **command**: For role assignment/removal operations
- **domain**: For user and organization context

## Future Enhancements

- [ ] Attribute-based access control (ABAC)
- [ ] Time-based permissions
- [ ] IP-based restrictions
- [ ] Permission caching
- [ ] Audit logging for permission checks
- [ ] Custom permission evaluators
