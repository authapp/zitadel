# Frontend Migration Roadmap
**Complete Zitadel Frontend Modernization Plan**

**Created:** November 4, 2025  
**Status:** Planning Complete, Ready for Implementation  
**Goal:** Achieve 100% feature parity with Zitadel Go frontend

---

## 📋 EXECUTIVE SUMMARY

### Mission
Rebuild Zitadel's frontend applications using modern React stack to achieve complete feature parity with the existing Angular Console and Next.js Portal applications.

### Scope
- **Console:** Admin interface for managing organizations, projects, users, and instance settings
- **Portal:** User-facing authentication flows (28 pages)
- **Shared:** Reusable UI components, API client, types, and utilities

### Timeline
- **Total Duration:** 16 weeks (4 months)
- **Team Size:** 2-3 frontend developers
- **Total Effort:** 2,127 hours

### Repository Structure
```
zitadel-backend/
└── authapp-frontend/                    # Frontend monorepo
    ├── apps/
    │   ├── console/                     # Admin Console (React/Next.js)
    │   └── portal/                      # Authentication UI (React/Next.js)
    └── packages/
        ├── ui/                          # Shared UI components
        ├── client/                      # API client
        ├── types/                       # TypeScript types
        └── utils/                       # Utilities
```

---

## 🎯 CURRENT STATE ANALYSIS

### Existing Applications

#### **1. Console (Angular 16)**
- **Location:** `/console/`
- **Type:** Single Page Application (SPA)
- **Files:** ~2,750 files
- **Purpose:** Admin interface
- **Status:** ⚠️ Needs complete rebuild

**Key Modules:**
- Home & Dashboard
- Organizations management
- Projects & Applications
- Users & Grants
- Instance settings
- Policies & Actions
- Identity Providers

#### **2. Portal (Next.js 15)**
- **Location:** `/apps/login/`
- **Type:** Server-Side Rendered (SSR)
- **Files:** ~150 files
- **Purpose:** Authentication flows
- **Status:** ⚠️ Needs migration to new stack

**Key Pages:**
- Username & Password authentication
- Multi-factor authentication (MFA)
- Passkey & U2F authentication
- Registration & Verification
- Account selection
- External IdP flows

#### **3. Shared Packages**
- **@zitadel/client:** API client (~40 files)
- **@zitadel/proto:** Protocol buffers (~10 files)
- **Status:** ⚠️ Need consolidation

---

## 🏗️ TARGET ARCHITECTURE

### Technology Stack

**Selection Criteria:**
1. Industry Standard - Widely adopted by enterprises
2. Active Maintenance - Regular updates and security patches
3. Large Community - Easy to find help and developers
4. TypeScript First - Full type safety
5. Performance - Fast load times and interactions
6. Developer Experience - Good DX, tooling, and docs
7. Enterprise Ready - Battle-tested in production

**Framework & Runtime:**
- **Next.js 15** with App Router (SSR/SSG, file-based routing, built-in optimization)
- **React 19** with Server Components
- **TypeScript 5.6** for type safety
- **Node.js 20 LTS** runtime

**Styling:**
- **TailwindCSS 4.0** for utility-first styling (JIT compilation, dark mode)
- **shadcn/ui** for accessible components (built on Radix UI, WCAG 2.1 AA)
- **class-variance-authority** for component variants
- **Framer Motion** for animations

**State Management:**
- **Zustand** for client state (minimal boilerplate, no providers)
- **TanStack Query v5** for server state (automatic caching, background refetching)
- **React Hook Form** for form state (best performance)
- **Zod** for validation schemas (type-safe)

**Data & Tables:**
- **TanStack Table v8** for data tables (headless, fully customizable)
- **Recharts** for visualizations (declarative React components)

**Icons & Assets:**
- **Lucide React** for icons (tree-shakeable, 1000+ icons)
- **Next.js Image** for image optimization

**Development:**
- **Turborepo** for monorepo management (fast builds, excellent caching)
- **pnpm** for package management (fastest, disk efficient)
- **Vitest** for unit testing (fast, Vite-powered)
- **Playwright** for E2E testing (cross-browser support)
- **ESLint & Prettier** for code quality
- **Husky + lint-staged** for Git hooks

**Authentication:**
- **NextAuth.js v5** for auth management

### Prerequisites

**Required Software:**
- Node.js v20 LTS or later
- pnpm v9 or later
- Docker & Docker Compose (v24.0.0+)
- Git

**Development Environment:**
- Docker Compose for backend services (PostgreSQL, Redis)
- Backend API on ports 8080 (REST) and 9090 (gRPC)
- Console on port 3000
- Portal on port 3001

### Quick Start

```bash
# Navigate to frontend directory
cd zitadel-backend/authapp-frontend

# Install dependencies
pnpm install

# Start all services (one command)
pnpm setup:dev
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Backend API (ports 8080, 9090)
- Console app (port 3000)
- Portal app (port 3001)

### Environment Variables

Create `.env.local` file:
```bash
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_GRPC_URL=http://localhost:9090

# Apps
NEXT_PUBLIC_CONSOLE_URL=http://localhost:3000
NEXT_PUBLIC_PORTAL_URL=http://localhost:3001

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Database & Cache
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/zitadel
REDIS_URL=redis://localhost:6379
```

### Essential Scripts

```bash
# Development
pnpm run dev                    # Start all apps
pnpm run dev:console           # Console only
pnpm run dev:portal            # Portal only

# Building
pnpm run build                  # Build all
pnpm run build:console         # Build console
pnpm run build:portal          # Build portal

# Testing
pnpm run test                   # All tests
pnpm run test:unit             # Unit tests
pnpm run test:e2e              # E2E tests

# Docker
pnpm run docker:up             # Start services
pnpm run docker:down           # Stop services

# Maintenance
pnpm run lint                   # Lint code
pnpm run format                # Format code
pnpm run clean                 # Clean build artifacts
```

---

## 📊 MIGRATION PHASES

### Overview

| Phase | Name | Duration | Effort | Status |
|-------|------|----------|--------|--------|
| **Phase 1** | Foundation & Setup | 2 weeks | 157 hours | 📋 Planned |
| **Phase 2** | Console Core | 6 weeks | 814 hours | 📋 Planned |
| **Phase 3** | Portal Migration | 2 weeks | 288 hours | 📋 Planned |
| **Phase 4** | Console Advanced | 4 weeks | 558 hours | 📋 Planned |
| **Phase 5** | Polish & Deploy | 2 weeks | 310 hours | 📋 Planned |
| **TOTAL** | - | **16 weeks** | **2,127 hours** | - |

**Note:** Phases 2 (Console Core) and 3 (Portal) are independent and can be executed in parallel or in any order after Phase 1 is complete.

---

## 🎯 PHASE 1: FOUNDATION & SETUP

**Duration:** 2 weeks (157 hours)  
**Goal:** Establish development infrastructure and shared components

### Deliverables

#### **1.1 Development Environment (24 hours)**
- [x] Initialize monorepo with Turborepo
- [x] Setup pnpm workspaces
- [x] Configure TypeScript
- [x] Setup ESLint & Prettier
- [x] Configure Docker Compose
- [x] Setup CI/CD pipeline

#### **1.2 Shared UI Package (80 hours)**
- [x] Create `packages/ui/` package
- [x] Implement 20 base components using shadcn/ui:
  - Button, Input, Textarea
  - Select, Checkbox, Radio
  - Card, Dialog, Dropdown
  - Table, Tabs, Accordion
  - Alert, Toast, Badge
  - Avatar, Skeleton, Loading
  - Tooltip, Popover, Sheet

#### **1.3 API Client Package (32 hours)**
- [x] Create `packages/client/` package
- [x] Implement gRPC client wrapper
- [x] Implement REST client wrapper
- [x] Type-safe API methods
- [x] Request/response interceptors
- [x] Error handling utilities

#### **1.4 Types & Utils Packages (21 hours)**
- [x] Create `packages/types/` package
- [x] Define shared TypeScript interfaces
- [x] Create `packages/utils/` package
- [x] Implement common utilities

### Acceptance Criteria
✅ Monorepo builds successfully  
✅ All shared components render correctly  
✅ API client connects to backend  
✅ Types are properly exported  
✅ Development environment runs with `pnpm dev`  
✅ Docker Compose starts all services  

**→ [View Phase 1 Details](./PHASE_1_FOUNDATION.md)**

---

## 🏢 PHASE 2: CONSOLE CORE

**Duration:** 6 weeks (814 hours)  
**Goal:** Build core admin interface functionality

### Deliverables

#### **2.1 Console App Setup (24 hours)**
- [x] Create `apps/console/` Next.js app
- [x] Setup layout & navigation
- [x] Configure authentication
- [x] Setup role-based access control

#### **2.2 Layout & Navigation (88 hours)**
- [x] Header with user menu
- [x] Sidebar navigation
- [x] Breadcrumbs
- [x] Footer
- [x] Theme switcher
- [x] Language switcher
- [x] Organization context switcher

#### **2.3 Organizations Module (180 hours)**
- [x] Organization list page
- [x] Organization detail page
- [x] Create organization flow
- [x] Organization settings
- [x] Organization members
- [x] Organization grants
- [x] Organization domains

#### **2.4 Projects Module (160 hours)**
- [x] Projects list page
- [x] Project detail page
- [x] Create project flow
- [x] Project settings
- [x] Project roles management
- [x] Project grants

#### **2.5 Applications Module (180 hours)**
- [x] Applications list page
- [x] Application detail page
- [x] Create application flow
- [x] OIDC configuration
- [x] API keys management
- [x] Redirect URIs management

#### **2.6 Users Module (182 hours)**
- [x] Users list page
- [x] User detail page
- [x] Create user flow
- [x] User profile editor
- [x] User authentication methods
- [x] User grants & roles
- [x] User sessions management

### Acceptance Criteria
✅ All core modules functional  
✅ CRUD operations working  
✅ Navigation working smoothly  
✅ Context switching working  
✅ Role-based access enforced  
✅ Data tables with sort/filter/pagination  
✅ Forms validated properly  
✅ API integration working  

**→ [View Phase 2 Details](./PHASE_2_CONSOLE_CORE.md)**

---

## 🔐 PHASE 3: PORTAL MIGRATION

**Duration:** 2 weeks (288 hours)  
**Goal:** Migrate all authentication flows to new stack

**Note:** This phase is independent of Phase 2 and can be executed in parallel or sequentially.

### Deliverables

#### **3.1 Portal App Setup (16 hours)**
- [x] Create `apps/portal/` Next.js app
- [x] Configure routing structure
- [x] Setup authentication providers
- [x] Configure session management

#### **3.2 Core Authentication Pages (96 hours)**
- [x] Username entry (`/loginname`)
- [x] Password authentication (`/password`)
- [x] Set password flow
- [x] Change password flow
- [x] Registration flows (`/register`)
- [x] Email verification (`/verify`)
- [x] Account selection (`/accounts`)

#### **3.3 Multi-Factor Authentication (80 hours)**
- [x] MFA setup flows
- [x] OTP authentication (SMS/Email)
- [x] Passkey setup & authentication
- [x] U2F setup & authentication
- [x] MFA method management

#### **3.4 Advanced Flows (64 hours)**
- [x] External IdP flows (`/idp/*`)
- [x] SAML authentication pages
- [x] Device authorization flows
- [x] Logout flows
- [x] Error pages

#### **3.5 SAML Configuration UI (32 hours)**
- [x] SAML IdP list page
- [x] SAML configuration form
- [x] Metadata upload/download
- [x] Certificate management
- [x] Attribute mapping UI

### Acceptance Criteria
✅ All 28 authentication pages implemented  
✅ All MFA methods working  
✅ External IdP flows functional  
✅ SAML authentication working  
✅ SAML configuration UI complete  
✅ Session management working  
✅ Error handling implemented  
✅ Responsive on all devices  

**→ [View Phase 3 Details](./PHASE_3_PORTAL.md)**

---

## ⚙️ PHASE 4: CONSOLE ADVANCED

**Duration:** 4 weeks (558 hours)  
**Goal:** Implement advanced admin features

### Deliverables

#### **4.1 Instance Settings (164 hours)**
- [x] Instance overview
- [x] General settings
- [x] Security settings
- [x] Domain settings
- [x] SMTP configuration
- [x] SMS provider configuration
- [x] Custom branding
- [x] Custom text/translations

#### **4.2 Policies Module (148 hours)**
- [x] Login policy
- [x] Password policy
- [x] Lockout policy
- [x] Privacy policy
- [x] Notification policy
- [x] Label policy
- [x] Domain policy
- [x] OIDC configuration

#### **4.3 Actions Module (96 hours)**
- [x] Actions list (v1 & v2)
- [x] Action detail/editor
- [x] Flow management
- [x] Action keys management
- [x] Execution logs

#### **4.4 Identity Providers (96 hours)**
- [x] IdP list page
- [x] Create IdP flow
- [x] OIDC IdP configuration
- [x] OAuth IdP configuration
- [x] SAML IdP configuration (Admin UI)
- [x] LDAP configuration
- [x] IdP templates

#### **4.5 Advanced Features (54 hours)**
- [x] Grants management
- [x] Audit log viewer
- [x] System notifications
- [x] Feature flags

### Acceptance Criteria
✅ All instance settings functional  
✅ All policies configurable  
✅ Actions working end-to-end  
✅ All IdP types configurable  
✅ SAML IdP admin UI complete  
✅ Grants management working  
✅ Audit logs viewable  

**→ [View Phase 4 Details](./PHASE_4_CONSOLE_ADVANCED.md)**

---

## 🎨 PHASE 5: POLISH & DEPLOY

**Duration:** 2 weeks (310 hours)  
**Goal:** Production-ready applications

### Deliverables

#### **5.1 Testing (120 hours)**
- [x] Unit tests (Vitest)
- [x] Integration tests
- [x] E2E tests (Playwright)
- [x] Performance testing
- [x] Accessibility testing (WCAG 2.1 AA)

#### **5.2 Performance Optimization (80 hours)**
- [x] Code splitting
- [x] Image optimization
- [x] Bundle size optimization
- [x] Caching strategies
- [x] Loading states
- [x] Error boundaries

#### **5.3 Documentation (60 hours)**
- [x] User documentation
- [x] Developer documentation
- [x] API documentation
- [x] Deployment guides
- [x] Troubleshooting guides

#### **5.4 Deployment (50 hours)**
- [x] Production build configuration
- [x] Docker images
- [x] CI/CD pipeline
- [x] Staging deployment
- [x] Production deployment
- [x] Monitoring setup

### Acceptance Criteria
✅ 80%+ test coverage  
✅ All E2E tests passing  
✅ WCAG 2.1 AA compliance  
✅ Lighthouse score > 90  
✅ Bundle size optimized  
✅ Documentation complete  
✅ Successfully deployed to production  
✅ Monitoring active  

**→ [View Phase 5 Details](./PHASE_5_POLISH.md)**

---

## 📦 REPOSITORY STRUCTURE

### Final Directory Structure

```
zitadel-backend/
└── authapp-frontend/
    ├── package.json
    ├── turbo.json
    ├── tsconfig.json
    ├── pnpm-workspace.yaml
    ├── README.md
    │
    ├── apps/
    │   │
    │   ├── console/                     # Admin Console
    │   │   ├── src/
    │   │   │   ├── app/
    │   │   │   │   ├── (auth)/
    │   │   │   │   │   ├── dashboard/
    │   │   │   │   │   ├── organizations/
    │   │   │   │   │   ├── projects/
    │   │   │   │   │   ├── applications/
    │   │   │   │   │   ├── users/
    │   │   │   │   │   ├── grants/
    │   │   │   │   │   ├── instance/
    │   │   │   │   │   └── settings/
    │   │   │   │   └── layout.tsx
    │   │   │   ├── components/
    │   │   │   ├── lib/
    │   │   │   └── styles/
    │   │   ├── public/
    │   │   ├── package.json
    │   │   ├── next.config.ts
    │   │   ├── tailwind.config.ts
    │   │   └── tsconfig.json
    │   │
    │   └── portal/                      # Authentication Portal
    │       ├── src/
    │       │   ├── app/
    │       │   │   ├── (auth)/
    │       │   │   │   ├── loginname/
    │       │   │   │   ├── password/
    │       │   │   │   ├── mfa/
    │       │   │   │   ├── passkey/
    │       │   │   │   ├── register/
    │       │   │   │   ├── verify/
    │       │   │   │   ├── accounts/
    │       │   │   │   ├── idp/
    │       │   │   │   └── device/
    │       │   │   └── layout.tsx
    │       │   ├── components/
    │       │   ├── lib/
    │       │   └── styles/
    │       ├── public/
    │       ├── package.json
    │       ├── next.config.ts
    │       ├── tailwind.config.ts
    │       └── tsconfig.json
    │
    ├── packages/
    │   │
    │   ├── ui/                          # Shared UI Components
    │   │   ├── src/
    │   │   │   ├── components/
    │   │   │   │   ├── button.tsx
    │   │   │   │   ├── input.tsx
    │   │   │   │   ├── card.tsx
    │   │   │   │   ├── dialog.tsx
    │   │   │   │   ├── table.tsx
    │   │   │   │   └── ... (20+ components)
    │   │   │   ├── hooks/
    │   │   │   ├── utils/
    │   │   │   └── index.ts
    │   │   ├── package.json
    │   │   └── tsconfig.json
    │   │
    │   ├── client/                      # API Client
    │   │   ├── src/
    │   │   │   ├── grpc/
    │   │   │   ├── rest/
    │   │   │   ├── auth/
    │   │   │   ├── admin/
    │   │   │   ├── management/
    │   │   │   └── index.ts
    │   │   ├── package.json
    │   │   └── tsconfig.json
    │   │
    │   ├── types/                       # Shared Types
    │   │   ├── src/
    │   │   │   ├── api/
    │   │   │   ├── entities/
    │   │   │   ├── enums/
    │   │   │   └── index.ts
    │   │   ├── package.json
    │   │   └── tsconfig.json
    │   │
    │   └── utils/                       # Utilities
    │       ├── src/
    │       │   ├── date.ts
    │       │   ├── format.ts
    │       │   ├── validation.ts
    │       │   └── index.ts
    │       ├── package.json
    │       └── tsconfig.json
    │
    ├── docker/
    │   ├── docker-compose.yml
    │   ├── docker-compose.dev.yml
    │   ├── Dockerfile.console
    │   └── Dockerfile.portal
    │
    └── scripts/
        ├── setup.sh
        ├── dev.sh
        ├── test.sh
        └── build.sh
```

---

## 🚀 DEVELOPMENT WORKFLOW

### Getting Started

```bash
# Clone repository
cd zitadel-backend

# Navigate to frontend
cd authapp-frontend

# Install dependencies
pnpm install

# Start development environment
pnpm run dev
```

### Available Scripts

```bash
# Development
pnpm run dev                    # Start all apps
pnpm run dev:console           # Start console only
pnpm run dev:portal            # Start portal only

# Building
pnpm run build                 # Build all apps
pnpm run build:console        # Build console only
pnpm run build:portal         # Build portal only

# Testing
pnpm run test                  # Run all tests
pnpm run test:unit            # Unit tests only
pnpm run test:e2e             # E2E tests only
pnpm run test:watch           # Watch mode

# Linting & Formatting
pnpm run lint                  # Lint all code
pnpm run lint:fix             # Fix linting issues
pnpm run format               # Format code

# Docker
pnpm run docker:up            # Start services
pnpm run docker:down          # Stop services
pnpm run docker:logs          # View logs
```

### Development URLs

- **Console:** http://localhost:3000
- **Portal:** http://localhost:3001
- **Backend API:** http://localhost:8080
- **gRPC:** http://localhost:9090

---

## 📊 PROGRESS TRACKING

### Weekly Milestones

#### **Weeks 1-2: Phase 1 - Foundation**
- Week 1: Monorepo setup + Base components (10)
- Week 2: Remaining components (10) + API client

#### **Weeks 3-8: Phase 2 - Console Core**
- Week 3: Layout + Organizations (start)
- Week 4: Organizations (complete)
- Week 5: Projects module
- Week 6: Applications module
- Week 7: Users module (start)
- Week 8: Users module (complete)

#### **Weeks 9-10: Phase 3 - Portal** *(Can run parallel with Phase 2)*
- Week 9: Core auth pages + MFA
- Week 10: Advanced flows + SAML

#### **Weeks 11-14: Phase 4 - Console Advanced**
- Week 11: Instance settings
- Week 12: Policies
- Week 13: Actions + IdPs
- Week 14: Advanced features + SAML admin UI

#### **Weeks 15-16: Phase 5 - Polish**
- Week 15: Testing + Performance
- Week 16: Documentation + Deployment

---

## ✅ DEFINITION OF DONE

### For Each Phase

**Code Quality:**
- [ ] All TypeScript errors resolved
- [ ] ESLint passing with no warnings
- [ ] Code formatted with Prettier
- [ ] No console errors or warnings

**Functionality:**
- [ ] All features working as specified
- [ ] API integration complete
- [ ] Error handling implemented
- [ ] Loading states implemented

**Testing:**
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] E2E tests passing (where applicable)
- [ ] Manual testing complete

**Documentation:**
- [ ] Code documented with comments
- [ ] README updated
- [ ] User-facing docs written

**Review:**
- [ ] Code reviewed by team
- [ ] QA tested
- [ ] Stakeholder approved

---

## 🎯 SUCCESS METRICS

### Technical Metrics
- ✅ 100% feature parity with existing apps
- ✅ 80%+ test coverage
- ✅ Lighthouse score > 90
- ✅ WCAG 2.1 AA compliance
- ✅ < 3s initial load time
- ✅ < 100ms interaction response

### Business Metrics
- ✅ Zero data loss during migration
- ✅ Zero downtime deployment
- ✅ User satisfaction maintained
- ✅ Admin workflows improved

---

## 📚 DOCUMENTATION STRUCTURE

### Phase Documents
1. **[PHASE_1_FOUNDATION.md](./PHASE_1_FOUNDATION.md)** - Setup, shared components & complete tech stack
2. **[PHASE_2_CONSOLE_CORE.md](./PHASE_2_CONSOLE_CORE.md)** - Core admin features (Organizations, Projects, Apps, Users)
3. **[PHASE_3_PORTAL.md](./PHASE_3_PORTAL.md)** - Authentication flows & SAML (can run parallel with Phase 2)
4. **[PHASE_4_CONSOLE_ADVANCED.md](./PHASE_4_CONSOLE_ADVANCED.md)** - Advanced features & SAML admin UI
5. **[PHASE_5_POLISH.md](./PHASE_5_POLISH.md)** - Testing, optimization & deployment

**Note:** Phases 2 and 3 are independent - Console Core can be built before or in parallel with Portal based on team priorities.

---

## 🎉 GETTING STARTED

### Immediate Next Steps

1. **Review & Approve**
   - Review this roadmap
   - Get stakeholder approval
   - Assign team members

2. **Phase 1 Kickoff**
   - Read [PHASE_1_FOUNDATION.md](./PHASE_1_FOUNDATION.md)
   - Setup development environment
   - Create first sprint backlog

3. **Begin Development**
   - Start with monorepo setup
   - Build first 10 components
   - Establish patterns

4. **After Phase 1**
   - **Priority Option A:** Start [Phase 2 - Console Core](./PHASE_2_CONSOLE_CORE.md) for admin interface
   - **Priority Option B:** Start [Phase 3 - Portal](./PHASE_3_PORTAL.md) for authentication flows
   - **Parallel Option:** Split team to work on both simultaneously

---

**Document Version:** 1.0  
**Last Updated:** November 4, 2025  
**Status:** ✅ Ready for Implementation
