# E2E Testing Strategy for Zitadel TypeScript Backend

## 📋 Overview

Based on the **original Zitadel Go backend's E2E testing approach**, this document outlines the testing strategy for our TypeScript implementation.

---

## 🔍 How Zitadel (Go) Does E2E Testing

### **Testing Architecture**

Zitadel uses a **3-tier testing approach**:

1. **Unit Tests** (✅ We have this - 458 tests)
   - Test individual functions/methods in isolation
   - Mock external dependencies
   - Fast execution (~3.8s for 458 tests)

2. **Integration Tests** (❌ Missing)
   - Test gRPC API against running server
   - Real database (PostgreSQL)
   - Test multiple API calls together
   - Verify permissions and authorization
   - Test eventual consistency
   - Test notification triggers

3. **E2E Tests** (❌ Missing)
   - Test complete user journeys
   - Test UI + Backend + Database together
   - Use **Cypress** for browser automation
   - Real Docker containers
   - Test full authentication flows

---

## 🏗️ Zitadel's E2E Infrastructure

### **Docker Compose Setup**

```yaml
services:
  zitadel:
    image: 'ghcr.io/zitadel/zitadel:latest'
    command: 'start-from-init --masterkey "..." --tlsMode disabled'
    depends_on:
      db:
        condition: 'service_healthy'
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "/app/zitadel", "ready"]
      interval: '10s'
      
  db:
    image: 'postgres:17-alpine'
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
      interval: '10s'
```

### **Technology Stack**
- **Cypress**: Browser automation and E2E testing
- **Docker Compose**: Environment orchestration
- **PostgreSQL**: Real database for integration tests
- **pnpm**: Package manager
- **TypeScript**: Test code

### **Test Organization**

```
e2e/
├── cypress/
│   ├── e2e/              # Test files organized by feature
│   │   ├── humans/       # User management tests
│   │   ├── organizations/
│   │   ├── projects/
│   │   ├── applications/
│   │   ├── permissions/
│   │   └── settings/
│   ├── support/          # Helper functions
│   │   ├── api/          # API interaction helpers
│   │   ├── login/        # Authentication helpers
│   │   └── commands.ts   # Custom Cypress commands
│   └── fixtures/         # Test data
├── docker-compose.yaml
└── package.json
```

---

## 🎯 Recommended E2E Strategy for TypeScript Backend

### **Phase 1: Integration Tests** (Priority: HIGH)

#### **Goal**: Test services with real dependencies

#### **Setup**:
```typescript
// Test environment with real components
- PostgreSQL database (test container)
- In-memory eventstore (or test DB)
- Real command/query handlers
- Real auth/authz components
- Mock external services (email, SMS)
```

#### **Test Structure**:
```typescript
describe('Integration: User Service', () => {
  let db: DatabasePool;
  let userService: UserService;
  let authService: AuthService;
  
  beforeAll(async () => {
    // Setup test database
    db = await createTestDatabase();
    await db.migrate();
    
    // Initialize services with real dependencies
    userService = createUserService(db, ...);
    authService = createAuthService(db, ...);
  });
  
  afterAll(async () => {
    await db.destroy();
  });
  
  describe('User Registration Flow', () => {
    it('should register user, create session, and send welcome email', async () => {
      // 1. Register user
      const user = await userService.create(adminContext, {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!',
      });
      
      // 2. Verify user created in database
      const dbUser = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
      expect(dbUser).toBeDefined();
      
      // 3. Authenticate
      const authResult = await authService.authenticate({
        username: 'testuser',
        password: 'SecurePass123!',
      });
      
      expect(authResult.success).toBe(true);
      expect(authResult.tokens).toBeDefined();
      
      // 4. Verify session in database
      const session = await db.query('SELECT * FROM sessions WHERE user_id = $1', [user.id]);
      expect(session).toBeDefined();
      
      // 5. Verify events were stored
      const events = await db.query(
        'SELECT * FROM events WHERE aggregate_id = $1 ORDER BY sequence',
        [user.id]
      );
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].event_type).toBe('user.created');
    });
  });
});
```

#### **What to Test**:
- ✅ Complete service workflows
- ✅ Database transactions and consistency
- ✅ Event sourcing (command → event → projection)
- ✅ Permission checks with real role manager
- ✅ Session lifecycle
- ✅ Token generation and validation
- ✅ Multi-tenant isolation
- ✅ Concurrent operations
- ✅ Error handling and rollbacks

---

### **Phase 2: API E2E Tests** (Priority: MEDIUM)

#### **Goal**: Test REST/gRPC API endpoints

#### **Setup**:
```typescript
// Test against running server
- Docker container with TypeScript backend
- PostgreSQL database
- Test HTTP client (supertest)
```

#### **Test Structure**:
```typescript
import request from 'supertest';

describe('API E2E: User Management', () => {
  let app: Express;
  let adminToken: string;
  
  beforeAll(async () => {
    app = await startTestServer();
    adminToken = await getAdminToken(app);
  });
  
  afterAll(async () => {
    await stopTestServer(app);
  });
  
  it('should create user via API', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'apiuser',
        email: 'api@example.com',
        password: 'SecurePass123!',
      });
    
    expect(response.status).toBe(201);
    expect(response.body.data.id).toBeDefined();
  });
  
  it('should authenticate and access protected endpoint', async () => {
    // Login
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'apiuser',
        password: 'SecurePass123!',
      });
    
    expect(loginResponse.status).toBe(200);
    const { accessToken } = loginResponse.body.data;
    
    // Access protected resource
    const profileResponse = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.data.username).toBe('apiuser');
  });
});
```

#### **What to Test**:
- ✅ API endpoint functionality
- ✅ Request/response validation
- ✅ Authentication flows
- ✅ Authorization (permissions)
- ✅ Error responses
- ✅ Rate limiting
- ✅ CORS
- ✅ API versioning

---

### **Phase 3: Full E2E Tests with Cypress** (Priority: LOW - Future)

#### **Goal**: Test complete user journeys through UI

#### **Setup**:
```bash
# Similar to Zitadel's approach
docker-compose.yaml:
  - TypeScript backend container
  - PostgreSQL
  - (Optional) Frontend UI
```

#### **Test Structure** (Cypress):
```typescript
describe('E2E: User Registration Journey', () => {
  it('should complete user registration flow', () => {
    // 1. Visit registration page
    cy.visit('/register');
    
    // 2. Fill registration form
    cy.get('[data-test="username"]').type('e2euser');
    cy.get('[data-test="email"]').type('e2e@example.com');
    cy.get('[data-test="password"]').type('SecurePass123!');
    cy.get('[data-test="submit"]').click();
    
    // 3. Verify success message
    cy.contains('Registration successful').should('be.visible');
    
    // 4. Check email was sent (via API)
    cy.request('GET', '/api/test/emails')
      .then((response) => {
        expect(response.body).to.have.length(1);
        expect(response.body[0].to).to.equal('e2e@example.com');
        expect(response.body[0].subject).to.contain('Welcome');
      });
    
    // 5. Login with new credentials
    cy.visit('/login');
    cy.get('[data-test="username"]').type('e2euser');
    cy.get('[data-test="password"]').type('SecurePass123!');
    cy.get('[data-test="login"]').click();
    
    // 6. Verify dashboard access
    cy.url().should('include', '/dashboard');
    cy.contains('Welcome, e2euser').should('be.visible');
  });
});
```

---

## 📦 Implementation Plan

### **Step 1: Add Integration Test Infrastructure**

```typescript
// zitadel-backend/test/integration/setup.ts

import { Pool } from 'pg';

export async function createTestDatabase(): Promise<Pool> {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'zitadel_test',
    user: 'postgres',
    password: 'postgres',
  });
  
  // Run migrations
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      state INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      aggregate_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_data JSONB NOT NULL,
      sequence INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  
  return pool;
}

export async function cleanDatabase(pool: Pool): Promise<void> {
  await pool.query('TRUNCATE TABLE users, events CASCADE');
}
```

### **Step 2: Create Integration Tests**

```bash
zitadel-backend/test/integration/
├── user-service.integration.test.ts
├── org-service.integration.test.ts
├── auth-flow.integration.test.ts
├── permission.integration.test.ts
└── setup.ts
```

### **Step 3: Add Docker Compose for Tests**

```yaml
# zitadel-backend/docker-compose.test.yml
version: '3.8'

services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: zitadel_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
  
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/zitadel_test
      NODE_ENV: test
    ports:
      - "8080:8080"
```

### **Step 4: Update package.json**

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathIgnorePatterns=integration",
    "test:integration": "jest --testPathPattern=integration",
    "test:integration:docker": "docker-compose -f docker-compose.test.yml up -d && npm run test:integration && docker-compose -f docker-compose.test.yml down",
    "test:all": "npm run test:unit && npm run test:integration"
  }
}
```

---

## 🎯 Testing Priorities

### **Phase 1: Integration Tests** (Start Now)
**Effort**: Medium | **Value**: High | **Timeline**: 1-2 weeks

Tests to add:
1. ✅ User service with real database
2. ✅ Organization service with multi-tenancy
3. ✅ Auth flow (login → session → token → access)
4. ✅ Permission checks with role hierarchy
5. ✅ Event sourcing (command → event → projection)
6. ✅ Notification triggers

### **Phase 2: API E2E Tests** (After Integration)
**Effort**: Medium | **Value**: High | **Timeline**: 1 week

Tests to add:
1. ✅ REST API endpoints
2. ✅ Authentication APIs
3. ✅ CRUD operations
4. ✅ Error handling

### **Phase 3: UI E2E Tests** (Future - When UI exists)
**Effort**: High | **Value**: Medium | **Timeline**: 2-3 weeks

Tests to add:
1. ✅ Complete user journeys
2. ✅ UI workflows
3. ✅ Browser compatibility

---

## 📊 Expected Coverage

### **Current State**:
- ✅ Unit Tests: 458 tests (100% of modules)
- ❌ Integration Tests: 0 tests
- ❌ E2E Tests: 0 tests

### **Target State**:
- ✅ Unit Tests: 458+ tests
- ✅ Integration Tests: 50-100 tests (critical flows)
- ✅ E2E Tests: 20-30 tests (key user journeys)

### **Total**: ~530-590 tests across all layers

---

## 🚀 Next Steps

### **Immediate Actions**:

1. **Setup Test Database** (1 day)
   ```bash
   docker run -d \
     -p 5433:5432 \
     -e POSTGRES_DB=zitadel_test \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres \
     postgres:17-alpine
   ```

2. **Create Integration Test Infrastructure** (2 days)
   - Database setup utilities
   - Test data factories
   - Service initialization helpers

3. **Write First Integration Test** (1 day)
   - Start with user registration flow
   - Verify database changes
   - Check event storage

4. **Expand Coverage** (1-2 weeks)
   - Add tests for all services
   - Test multi-tenant scenarios
   - Test permission hierarchies

---

## 💡 Key Learnings from Zitadel

1. **Separate Test Types**: Unit → Integration → E2E
2. **Real Dependencies for Integration**: Use real DB, not mocks
3. **Docker for Consistency**: Reproducible test environment
4. **API-First Testing**: Test API before UI
5. **Helper Functions**: Reusable test utilities
6. **Health Checks**: Wait for services to be ready
7. **Test Data Management**: Ensure/cleanup patterns
8. **Parallel Execution**: Run tests in isolation

---

## 🎊 Conclusion

Following Zitadel's proven E2E testing strategy:
- ✅ **Start with Integration Tests** (highest ROI)
- ✅ **Use Real Dependencies** (PostgreSQL, services)
- ✅ **Test Critical Flows** (auth, multi-tenancy, permissions)
- ✅ **Add API E2E Tests** (REST endpoints)
- ✅ **Consider UI E2E** (when UI exists)

**Current Status**: Unit tests complete (458 tests)  
**Next Priority**: Integration tests with real database  
**Timeline**: 1-2 weeks for comprehensive integration tests

---

**Would you like me to start implementing the integration test infrastructure?**
