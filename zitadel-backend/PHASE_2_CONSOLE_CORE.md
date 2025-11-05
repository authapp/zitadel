# Phase 2: Console Core Migration
**Building the Admin Interface - Core Modules**

**Duration:** 6 weeks (814 hours)  
**Status:** Planned  
**Dependencies:** Phase 1 (Foundation)

---

## OVERVIEW

### Goal
Build the core administration interface with organization, project, application, and user management modules.

### Why This Phase
This phase delivers the primary value proposition - a modern admin interface for managing Zitadel instances. These are the most frequently used features by administrators. **This phase can be done immediately after Phase 1, independent of Portal migration.**

---

## OBJECTIVES

Build core admin interface with Organizations, Projects, Applications, and Users management - achieving feature parity with existing Angular Console.

---

## DELIVERABLES

### 1. Console App Setup (24 hours)
- Create `apps/console/` Next.js app
- Setup layout with header, sidebar, footer
- Configure role-based access control
- Setup navigation and routing

### 2. Layout & Navigation (88 hours)

**Global Layout (40h)**
- Header with user menu and organization context
- Collapsible sidebar navigation
- Breadcrumb navigation
- Footer with version info
- Responsive mobile menu

**Theme & Context (24h)**
- Dark/Light theme switcher
- Language selector (i18n)
- Organization context switcher
- Project context switcher

**Navigation Structure (24h)**
- Dashboard/Home
- Organizations
- Projects
- Applications
- Users
- Grants
- Instance Settings
- Personal Settings

### 3. Organizations Module (180 hours)

**Organization List (32h)**
- Data table with sort/filter/pagination
- Search by name
- Create organization button
- Quick actions per row
- Organization stats cards

**Organization Detail (40h)**
- Overview dashboard
- Organization info card
- Member count
- Project count
- Activity timeline

**Organization Settings (36h)**
- General settings form
- Domain configuration
- Branding settings
- Default policies

**Organization Members (36h)**
- Member list table
- Add member dialog
- Role assignment
- Remove member
- Invite via email

**Organization Grants (36h)**
- Grants list table
- Create grant dialog
- Grant detail view
- Remove grant
- Grant permissions matrix

### 4. Projects Module (160 hours)

**Project List (24h)**
- Projects table with filters
- Create project button
- Project cards view
- Search functionality
- Favorite projects

**Project Detail (28h)**
- Project overview
- Application count
- User grant count
- Recent activity
- Quick actions

**Project Settings (32h)**
- General settings
- Project info
- Project roles management
- Private/Public toggle

**Project Roles (40h)**
- Roles list table
- Create role dialog
- Edit role permissions
- Delete role
- Role assignment view

**Project Grants (36h)**
- User grants table
- Create grant
- Grant detail
- Bulk grant operations
- Export grants

### 5. Applications Module (180 hours)

**Application List (32h)**
- Applications table
- Filter by type (Web, Native, API)
- Create application wizard
- Application cards
- Status indicators

**Application Detail (40h)**
- Application overview
- Client credentials
- Redirect URIs list
- Grant types
- Token settings

**OIDC Configuration (48h)**
- Authorization settings
- Token configuration
- Allowed scopes
- Response types
- Grant types
- Refresh token settings

**Application Keys (28h)**
- API keys list
- Generate new key
- Revoke key
- Key details
- Usage statistics

**Redirect URIs (32h)**
- URI list management
- Add URI with validation
- Remove URI
- Development/Production toggle
- URI testing tool

### 6. Users Module (182 hours)

**User List (36h)**
- Users data table
- Advanced filters
- Search by name/email
- Bulk actions
- Export users
- User status indicators

**User Detail (40h)**
- User profile overview
- Contact information
- Account status
- Authentication methods
- Session history
- Activity log

**User Profile Editor (32h)**
- Edit profile form
- Upload avatar
- Change email (with verification)
- Change phone
- Update metadata
- Custom attributes

**User Authentication Methods (36h)**
- Password management
- MFA methods list
- Passkeys list
- U2F tokens
- Enable/disable methods
- Force password change

**User Grants & Roles (38h)**
- User grants table
- Project roles view
- Organization roles
- Add grant dialog
- Remove grant
- Role details

---

## ✅ ACCEPTANCE CRITERIA

### Organizations Module
- [ ] List all organizations with pagination
- [ ] Create new organization
- [ ] Edit organization settings
- [ ] Manage organization members
- [ ] Configure organization grants
- [ ] Organization domain management
- [ ] Search and filter working
- [ ] Bulk operations functional

### Projects Module
- [ ] List all projects with filters
- [ ] Create new project
- [ ] Edit project settings
- [ ] Manage project roles
- [ ] Handle project grants
- [ ] Role-based access working
- [ ] Favorite projects feature

### Applications Module
- [ ] List applications by type
- [ ] Create application via wizard
- [ ] Configure OIDC settings
- [ ] Manage API keys
- [ ] Configure redirect URIs
- [ ] Token settings working
- [ ] Copy client credentials

### Users Module
- [ ] List users with advanced filters
- [ ] View user details
- [ ] Edit user profile
- [ ] Manage authentication methods
- [ ] View user grants and roles
- [ ] User sessions management
- [ ] Bulk user operations
- [ ] Export user data

### General
- [ ] All CRUD operations working
- [ ] Data tables with sort/filter/pagination
- [ ] Context switching (org/project)
- [ ] Role-based access enforced
- [ ] Responsive on all devices
- [ ] Loading states everywhere
- [ ] Error handling complete
- [ ] Form validation working

---

## 🧪 TESTING REQUIREMENTS

### Unit Tests
- [ ] Component rendering tests
- [ ] Form validation tests
- [ ] Utility function tests
- [ ] API client tests

### Integration Tests
- [ ] Create organization flow
- [ ] Create project flow
- [ ] Create application flow
- [ ] Create user flow
- [ ] Grant assignment flow

### E2E Tests
- [ ] Full organization management
- [ ] Full project management
- [ ] Full application setup
- [ ] Full user management
- [ ] Context switching

---

## 🚀 SPRINT BREAKDOWN

### Week 1: Console Setup + Layout
- Days 1-2: Console app initialization
- Days 3-5: Layout and navigation

### Week 2: Organizations (Start)
- Days 6-7: Organization list
- Days 8-10: Organization detail and settings

### Week 3: Organizations (Complete)
- Days 11-12: Organization members
- Days 13-15: Organization grants

### Week 4: Projects Module
- Days 16-17: Project list and detail
- Days 18-20: Project settings and roles

### Week 5: Applications Module
- Days 21-22: Application list and wizard
- Days 23-25: OIDC config and keys

### Week 6: Users Module
- Days 26-27: User list and detail
- Days 28-30: User profile and auth methods

---

## 📦 KEY COMPONENTS

### Console-Specific Components
```typescript
// Organization Components
<OrganizationList />
<OrganizationCard />
<OrganizationForm />
<MemberList />
<GrantMatrix />

// Project Components
<ProjectList />
<ProjectCard />
<ProjectForm />
<RoleEditor />
<GrantTable />

// Application Components
<ApplicationList />
<ApplicationWizard />
<OIDCConfig />
<RedirectURIManager />
<APIKeyManager />

// User Components
<UserTable />
<UserProfile />
<AuthMethodManager />
<SessionViewer />
<GrantAssigner />

// Layout Components
<ConsoleSidebar />
<ConsoleHeader />
<OrgContextSwitcher />
<ProjectContextSwitcher />
```

### Shared Components
```typescript
// From packages/ui
<DataTable />
<Button />
<Input />
<Select />
<Dialog />
<Card />
<Tabs />
<Badge />
<Avatar />
<Toast />
```

---

## 🔗 DEPENDENCIES

### Prerequisites
- Phase 2 complete (Portal working)
- Shared components from Phase 1
- Backend admin APIs operational

### API Endpoints Required
```
Organizations:
- GET /v2/organizations
- POST /v2/organizations
- GET /v2/organizations/{id}
- PUT /v2/organizations/{id}
- DELETE /v2/organizations/{id}

Projects:
- GET /v2/projects
- POST /v2/projects
- GET /v2/projects/{id}
- PUT /v2/projects/{id}

Applications:
- GET /v2/apps
- POST /v2/apps
- GET /v2/apps/{id}
- PUT /v2/apps/{id}

Users:
- GET /v2/users
- POST /v2/users
- GET /v2/users/{id}
- PUT /v2/users/{id}
- POST /v2/users/{id}/grants
```

---

## 📊 DATA TABLES SPECIFICATION

### Common Table Features
- Sort by column (asc/desc)
- Filter by multiple criteria
- Pagination (10, 25, 50, 100 per page)
- Column visibility toggle
- Export to CSV
- Bulk selection
- Bulk actions
- Responsive design

### Organization Table Columns
- Name
- Domain
- Members count
- Projects count
- Status
- Created date
- Actions

### Project Table Columns
- Name
- Organization
- Applications count
- Members count
- Status
- Created date
- Actions

### Application Table Columns
- Name
- Type (Web/Native/API)
- Project
- Client ID
- Status
- Created date
- Actions

### User Table Columns
- Avatar
- Name
- Email
- Status
- Auth methods
- Last login
- Created date
- Actions

---

## ⚠️ KNOWN CHALLENGES

**Challenge 1: Data Table Performance**
- Large datasets (1000+ rows) can be slow
- **Mitigation:** Use virtual scrolling, server-side pagination

**Challenge 2: Context Switching**
- Managing org/project context across pages
- **Mitigation:** Use Zustand for global context state

**Challenge 3: Form Complexity**
- Many forms with complex validation
- **Mitigation:** Use React Hook Form + Zod schemas

---

**Previous Phase:** [PHASE_2_PORTAL.md](./PHASE_2_PORTAL.md)  
**Next Phase:** [PHASE_4_CONSOLE_ADVANCED.md](./PHASE_4_CONSOLE_ADVANCED.md)  
**Main Roadmap:** [FRONTEND_MIGRATION_ROADMAP.md](./FRONTEND_MIGRATION_ROADMAP.md)
