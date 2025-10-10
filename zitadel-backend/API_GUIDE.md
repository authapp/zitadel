# Zitadel TypeScript API Guide

## Organization Management API (v2)

Complete REST/gRPC API implementation for organization management, matching Zitadel's proto definitions.

## Architecture

```
┌─────────────────────────────────────┐
│     REST API (Express)              │
│  POST /v2/organizations             │
│  GET  /v2/organizations/:id         │
│  PUT  /v2/organizations/:id         │
│  DELETE /v2/organizations/:id       │
└─────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│     Organization Service            │
│  - addOrganization()                │
│  - getOrganization()                │
│  - updateOrganization()             │
│  - deactivateOrganization()         │
│  - reactivateOrganization()         │
│  - removeOrganization()             │
└─────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│     Command Layer                   │
│  - setupOrg()                       │
│  - addOrg()                         │
│  - changeOrg()                      │
│  - deactivateOrg()                  │
│  - reactivateOrg()                  │
│  - removeOrg()                      │
└─────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│     Eventstore                      │
│  Event-sourced persistence          │
└─────────────────────────────────────┘
```

## Quick Start

### 1. Start the Server

```typescript
import { Pool } from 'pg';
import { Commands } from './lib/command/commands';
import { EventstorePg } from './lib/eventstore/eventstore-pg';
import { startServer } from './api/server';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'zitadel',
  user: 'postgres',
  password: 'postgres',
});

const eventstore = new EventstorePg(pool);
const commands = new Commands(eventstore);

await startServer(commands, {
  port: 8080,
  host: '0.0.0.0',
  cors: { origin: '*', credentials: true },
});
```

Or use the example server:

```bash
npm run dev  # Runs example-server.ts
```

### 2. Environment Variables

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=zitadel
DB_USER=postgres
DB_PASSWORD=postgres

# Server
PORT=8080
HOST=0.0.0.0
CORS_ORIGIN=*
```

## API Endpoints

### Create Organization

**POST** `/v2/organizations`

Create a new organization with admin users.

**Request:**
```json
{
  "name": "ACME Corporation",
  "orgId": "optional-custom-id",
  "admins": [
    {
      "userType": {
        "human": {
          "username": "admin@acme.com",
          "email": {
            "email": "admin@acme.com",
            "isVerified": false
          },
          "profile": {
            "givenName": "John",
            "familyName": "Doe"
          },
          "password": {
            "password": "SecurePassword123!"
          }
        }
      },
      "roles": ["ORG_OWNER"]
    }
  ]
}
```

**Response (201):**
```json
{
  "details": {
    "sequence": 1,
    "changeDate": "2024-01-15T10:30:00Z",
    "resourceOwner": "123456789"
  },
  "organizationId": "123456789",
  "createdAdmins": [
    {
      "userId": "987654321",
      "emailCode": null,
      "phoneCode": null
    }
  ]
}
```

### List Organizations

**POST** `/v2/organizations/_search`

Search for organizations with pagination.

**Request:**
```json
{
  "query": {
    "offset": 0,
    "limit": 20,
    "asc": true
  },
  "sortingColumn": 1,
  "queries": []
}
```

**Response:**
```json
{
  "details": {
    "totalResult": 50,
    "processedSequence": 20,
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "sortingColumn": 1,
  "result": [
    {
      "id": "123456789",
      "state": 1,
      "name": "ACME Corporation",
      "primaryDomain": "acme.com"
    }
  ]
}
```

### Get Organization

**GET** `/v2/organizations/:id`

Get organization details by ID.

**Response:**
```json
{
  "organization": {
    "id": "123456789",
    "details": {
      "sequence": 5,
      "changeDate": "2024-01-15T10:30:00Z",
      "resourceOwner": "123456789"
    },
    "state": 1,
    "name": "ACME Corporation",
    "primaryDomain": "acme.com"
  }
}
```

### Update Organization

**PUT** `/v2/organizations/:id`

Update organization name.

**Request:**
```json
{
  "name": "ACME Corp Updated"
}
```

**Response:**
```json
{
  "details": {
    "sequence": 6,
    "changeDate": "2024-01-15T10:35:00Z",
    "resourceOwner": "123456789"
  }
}
```

### Deactivate Organization

**POST** `/v2/organizations/:id/_deactivate`

Deactivate an organization.

**Response:**
```json
{
  "details": {
    "sequence": 7,
    "changeDate": "2024-01-15T10:40:00Z",
    "resourceOwner": "123456789"
  }
}
```

### Reactivate Organization

**POST** `/v2/organizations/:id/_reactivate`

Reactivate an organization.

**Response:**
```json
{
  "details": {
    "sequence": 8,
    "changeDate": "2024-01-15T10:45:00Z",
    "resourceOwner": "123456789"
  }
}
```

### Remove Organization

**DELETE** `/v2/organizations/:id`

Permanently remove an organization.

**Response:**
```json
{
  "details": {
    "sequence": 9,
    "changeDate": "2024-01-15T10:50:00Z",
    "resourceOwner": "123456789"
  }
}
```

## Authentication

Add authentication headers to requests:

```bash
curl -X POST http://localhost:8080/v2/organizations \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user-123" \
  -H "X-Instance-ID: instance-456" \
  -H "X-Org-ID: org-789" \
  -d '{"name": "Test Org", "admins": []}'
```

## Error Handling

All errors follow Zitadel's error format:

```json
{
  "error": "InvalidArgument",
  "message": "name is required",
  "code": "ORGv2-001"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Invalid Argument
- `401` - Unauthenticated
- `403` - Permission Denied
- `404` - Not Found
- `409` - Already Exists
- `412` - Precondition Failed
- `500` - Internal Error
- `501` - Unimplemented

### Error Types

| Error Type | HTTP Status | gRPC Code |
|-----------|-------------|-----------|
| InvalidArgument | 400 | 3 |
| NotFound | 404 | 5 |
| AlreadyExists | 409 | 6 |
| PermissionDenied | 403 | 7 |
| PreconditionFailed | 412 | 9 |
| Unimplemented | 501 | 12 |
| Internal | 500 | 13 |
| Unauthenticated | 401 | 16 |

## Proto Types

The API uses TypeScript types that match Zitadel's protobuf definitions:

- `proto/org/v2/org.proto` → `src/api/grpc/proto/org/v2/org.ts`
- `proto/org/v2/org_service.proto` → `src/api/grpc/proto/org/v2/org_service.ts`
- `proto/object/v2/object.proto` → `src/api/grpc/proto/object/v2/object.ts`
- `proto/user/v2/user.proto` → `src/api/grpc/proto/user/v2/user.ts`

## Testing

### cURL Examples

```bash
# Create organization
curl -X POST http://localhost:8080/v2/organizations \
  -H "Content-Type: application/json" \
  -H "X-User-ID: admin" \
  -H "X-Instance-ID: default" \
  -d '{
    "name": "Test Organization",
    "admins": [{
      "userType": {
        "human": {
          "username": "admin@test.com",
          "email": {"email": "admin@test.com"},
          "profile": {"givenName": "Admin", "familyName": "User"},
          "password": {"password": "TestPassword123!"}
        }
      },
      "roles": ["ORG_OWNER"]
    }]
  }'

# Get organization
curl http://localhost:8080/v2/organizations/123456789 \
  -H "X-User-ID: admin" \
  -H "X-Instance-ID: default"

# Update organization
curl -X PUT http://localhost:8080/v2/organizations/123456789 \
  -H "Content-Type: application/json" \
  -H "X-User-ID: admin" \
  -d '{"name": "Updated Name"}'

# Delete organization
curl -X DELETE http://localhost:8080/v2/organizations/123456789 \
  -H "X-User-ID: admin"
```

## File Structure

```
src/api/
├── server.ts                    # Main server setup
├── index.ts                     # API exports
├── grpc/
│   ├── org/v2/
│   │   ├── org_service.ts      # Service implementation
│   │   ├── converters.ts       # Proto <-> Domain converters
│   │   ├── router.ts           # REST routes
│   │   └── index.ts            # Module exports
│   └── proto/
│       ├── org/v2/
│       │   ├── org.ts          # Organization types
│       │   └── org_service.ts  # Service types
│       ├── object/v2/
│       │   └── object.ts       # Common object types
│       └── user/v2/
│           └── user.ts         # User types
└── example-server.ts           # Example implementation
```

## Next Steps

1. **Implement Query Layer** - Add read-side operations (GetOrganization, ListOrganizations)
2. **Add User Management** - Implement user service endpoints
3. **Add Project Management** - Implement project service endpoints
4. **Add Authentication** - Implement proper authentication middleware
5. **Add Authorization** - Implement RBAC permission checking

## Resources

- [Zitadel Proto Definitions](https://github.com/zitadel/zitadel/tree/main/proto)
- [Zitadel Go Implementation](https://github.com/zitadel/zitadel/tree/main/internal/api/grpc)
- [Zitadel Documentation](https://zitadel.com/docs)
