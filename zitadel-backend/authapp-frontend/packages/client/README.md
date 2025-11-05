# @authapp/client

Type-safe API client for Zitadel Backend services.

## Features

- ✅ **Type-safe** - Full TypeScript support with generated types
- ✅ **Service-oriented** - Organized by backend services (User, Org, Project, App)
- ✅ **Error handling** - Comprehensive error handling with typed errors
- ✅ **Authentication** - Built-in token management
- ✅ **Interceptors** - Request/response interceptors for auth and error handling
- ✅ **Modern** - Uses axios for HTTP requests with full async/await support

## Installation

```bash
pnpm add @authapp/client
```

## Usage

### Initialize the client

```typescript
import { createApiClient } from '@authapp/client';

const client = createApiClient({
  baseURL: 'http://localhost:8080',
  timeout: 30000,
  headers: {
    'X-Custom-Header': 'value',
  },
  withCredentials: true,
});
```

### Authentication

```typescript
// Set auth token
client.setAuthToken('your-jwt-token');

// Clear auth token
client.clearAuthToken();
```

### User Service

```typescript
// Get user by ID
const { user } = await client.users.getUserById('user-id');

// List users
const { result, details } = await client.users.listUsers({
  query: { limit: 10, offset: 0 },
});

// Add human user
const { userId } = await client.users.addHumanUser({
  username: 'john.doe',
  organization: { orgId: 'org-id' },
  profile: {
    firstName: 'John',
    lastName: 'Doe',
    displayName: 'John Doe',
  },
  email: {
    email: 'john@example.com',
    isEmailVerified: false,
  },
});

// Update username
await client.users.updateUserName({
  userId: 'user-id',
  username: 'new.username',
});

// Deactivate/Reactivate user
await client.users.deactivateUser('user-id');
await client.users.reactivateUser('user-id');

// Lock/Unlock user
await client.users.lockUser('user-id');
await client.users.unlockUser('user-id');

// Remove user
await client.users.removeUser('user-id');
```

### Organization Service

```typescript
// Get organization by ID
const { organization } = await client.organizations.getOrganizationById('org-id');

// List organizations
const { result } = await client.organizations.listOrganizations({
  query: { limit: 10 },
});

// Add organization
const { organizationId } = await client.organizations.addOrganization({
  name: 'Acme Corp',
  admins: [{ userId: 'user-id', roles: ['ORG_OWNER'] }],
});

// Add organization domain
await client.organizations.addOrganizationDomain({
  organizationId: 'org-id',
  domain: 'acme.com',
});

// Verify organization domain
await client.organizations.verifyOrganizationDomain(
  'org-id',
  'acme.com',
  'validation-code'
);

// Add organization member
await client.organizations.addOrganizationMember({
  organizationId: 'org-id',
  userId: 'user-id',
  roles: ['ORG_USER_MANAGER'],
});
```

### Project Service

```typescript
// Get project by ID
const { project } = await client.projects.getProjectById('project-id');

// List projects
const { result } = await client.projects.listProjects({
  query: { limit: 10 },
});

// Add project
const { projectId } = await client.projects.addProject({
  name: 'My Project',
  projectRoleAssertion: true,
  projectRoleCheck: true,
});

// Add project role
await client.projects.addProjectRole({
  projectId: 'project-id',
  roleKey: 'admin',
  displayName: 'Administrator',
  group: 'management',
});

// Add project member
await client.projects.addProjectMember({
  projectId: 'project-id',
  userId: 'user-id',
  roles: ['admin'],
});
```

### Application Service

```typescript
// Get application by ID
const { app } = await client.applications.getAppById('project-id', 'app-id');

// List applications
const { result } = await client.applications.listApps('project-id', {
  limit: 10,
});

// Add OIDC application
const { appId, clientId, clientSecret } = await client.applications.addOIDCApp({
  projectId: 'project-id',
  name: 'My OIDC App',
  redirectUris: ['https://app.example.com/callback'],
  responseTypes: [OIDCResponseType.OIDC_RESPONSE_TYPE_CODE],
  grantTypes: [OIDCGrantType.OIDC_GRANT_TYPE_AUTHORIZATION_CODE],
  appType: OIDCAppType.OIDC_APP_TYPE_WEB,
  authMethodType: OIDCAuthMethodType.OIDC_AUTH_METHOD_TYPE_BASIC,
});

// Add API application
const { appId, clientId } = await client.applications.addAPIApp({
  projectId: 'project-id',
  name: 'My API',
  authMethodType: OIDCAuthMethodType.OIDC_AUTH_METHOD_TYPE_PRIVATE_KEY_JWT,
});

// Regenerate client secret
const { clientSecret } = await client.applications.regenerateOIDCClientSecret(
  'project-id',
  'app-id'
);
```

## Error Handling

```typescript
import { ApiError } from '@authapp/client';

try {
  const user = await client.users.getUserById('invalid-id');
} catch (error) {
  const apiError = error as ApiError;
  console.error(`Error ${apiError.code}: ${apiError.message}`);
  console.error(`Status: ${apiError.status}`);
  console.error(`Details:`, apiError.details);
}
```

## Type Imports

```typescript
import {
  User,
  Organization,
  Project,
  Application,
  UserState,
  OrgState,
  ProjectState,
  AppState,
  AppType,
  OIDCAppType,
  OIDCAuthMethodType,
  OIDCGrantType,
  OIDCResponseType,
  Gender,
} from '@authapp/client';
```

## Backend Integration

This client is designed to work with the Zitadel TypeScript backend API endpoints:

- **User Service**: `/zitadel.user.v2.UserService/*`
- **Organization Service**: `/zitadel.org.v2.OrganizationService/*`
- **Project Service**: `/zitadel.project.v2.ProjectService/*`
- **Application Service**: `/zitadel.app.v2.AppService/*`

The backend should be running and accessible at the configured `baseURL`.

## Development

```bash
# Build the package
pnpm build

# Watch mode for development
pnpm dev

# Type check
pnpm type-check

# Lint
pnpm lint
```

## License

MIT
