# Phase 1: Foundation & Setup
**Infrastructure, Tooling, and Shared Components**

**Duration:** 2 weeks (80 work hours/week)  
**Total Effort:** 157 hours  
**Team:** 2 frontend developers  
**Prerequisites:** Backend APIs operational

**Status:** 🟡 **IN PROGRESS**  
**Progress:** 48/157 hours (31%)  
**Completed:** 1.1 Initialize Project Structure, 1.2 Development Tooling, 2.1 Package Setup, 2.2 Group A Forms  
**Skipped:** 1.3 Docker Configuration (deferred)

---

## 🎯 PHASE OBJECTIVES

1. **Establish development infrastructure** with industry-standard tooling
2. **Create shared UI component library** with 20 base components
3. **Build unified API client** for backend communication
4. **Setup monorepo** with Turborepo for optimal build performance
5. **Configure development environment** with Docker Compose

---

## 📋 DELIVERABLES

### 1. MONOREPO SETUP (24 hours)

#### 1.1 Initialize Project Structure
```bash
zitadel-backend/authapp-frontend/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
├── .gitignore
├── .env.example
└── README.md
```

**Tasks:**
- [x] Create authapp-frontend directory
- [x] Initialize pnpm workspace
- [x] Configure Turborepo
- [x] Setup root TypeScript config
- [x] Create workspace package.json
- [x] Configure Git ignore rules

**Effort:** 8 hours ✅ **COMPLETE**

#### 1.2 Development Tooling
**Tasks:**
- [x] Setup ESLint configuration
- [x] Setup Prettier configuration
- [x] Configure Husky for Git hooks
- [x] Setup lint-staged
- [x] Configure VS Code workspace settings
- [x] Create .editorconfig

**Effort:** 8 hours ✅ **COMPLETE**

#### 1.3 Docker Configuration
```yaml
services:
  postgres: port 5432
  redis: port 6379
  backend: port 8080 9090
  console: port 3000
  portal: port 3001
```

**Tasks:**
- [ ] Create docker-compose.yml
- [ ] Create docker-compose.dev.yml
- [ ] Write Dockerfile.console
- [ ] Write Dockerfile.portal
- [ ] Configure service networking
- [ ] Setup volume mounts

**Effort:** 8 hours ⏭️ **SKIPPED** (deferred to later)

---

### 2. SHARED UI PACKAGE (80 hours)

#### 2.1 Package Setup
**Tasks:**
- [x] Create packages ui directory
- [x] Setup package.json with dependencies
- [x] Configure TailwindCSS
- [x] Setup component index exports
- [x] Configure build tooling

**Effort:** 8 hours ✅ **COMPLETE**

#### 2.2 Base Components

**Group A: Forms (24 hours)** ✅ **COMPLETE**
- [x] Button component
- [x] Input component
- [x] Textarea component
- [x] Select component
- [x] Checkbox component
- [x] Radio component
- [x] Switch component
- [x] Label component

**Group B: Layout (20 hours)**
- [ ] Card component
- [ ] Dialog Modal component
- [ ] Sheet component
- [ ] Accordion component
- [ ] Tabs component

**Group C: Feedback (16 hours)**
- [ ] Alert component
- [ ] Toast component
- [ ] Badge component
- [ ] Progress component
- [ ] Skeleton component

**Group D: Navigation Display (12 hours)**
- [ ] Dropdown Menu component
- [ ] Popover component
- [ ] Tooltip component
- [ ] Avatar component
- [ ] Loading Spinner component

**Total Components:** 20  
**Effort:** 72 hours

---

### 3. API CLIENT PACKAGE (32 hours)

#### 3.1 Package Structure
```
packages/client/
├── src/
│   ├── grpc/
│   ├── rest/
│   ├── auth/
│   ├── admin/
│   ├── management/
│   └── index.ts
└── package.json
```

**Tasks:**
- [ ] Create packages client directory
- [ ] Setup package.json
- [ ] Configure TypeScript
- [ ] Setup build configuration

**Effort:** 4 hours

#### 3.2 gRPC Client
**Tasks:**
- [ ] Create gRPC client wrapper
- [ ] Implement connection pooling
- [ ] Add request interceptors
- [ ] Add response interceptors
- [ ] Implement retry logic
- [ ] Add error handling

**Effort:** 12 hours

#### 3.3 REST Client
**Tasks:**
- [ ] Create REST client wrapper
- [ ] Configure Axios instance
- [ ] Add request interceptors
- [ ] Add response interceptors
- [ ] Implement error handling
- [ ] Add retry logic

**Effort:** 8 hours

#### 3.4 API Methods
**Tasks:**
- [ ] Auth API methods
- [ ] Admin API methods
- [ ] Management API methods
- [ ] User API methods
- [ ] Organization API methods
- [ ] Project API methods

**Effort:** 8 hours

---

### 4. TYPES PACKAGE (12 hours)

#### 4.1 Package Structure
```
packages/types/
├── src/
│   ├── api/
│   ├── entities/
│   ├── enums/
│   └── index.ts
└── package.json
```

**Tasks:**
- [ ] Create packages types directory
- [ ] Define User types
- [ ] Define Organization types
- [ ] Define Project types
- [ ] Define Application types
- [ ] Define Policy types
- [ ] Define API request response types
- [ ] Export all types

**Effort:** 12 hours

---

### 5. UTILS PACKAGE (9 hours)

#### 5.1 Package Structure
```
packages/utils/
├── src/
│   ├── date.ts
│   ├── format.ts
│   ├── validation.ts
│   └── index.ts
└── package.json
```

**Tasks:**
- [ ] Create packages utils directory
- [ ] Date formatting utilities
- [ ] String formatting utilities
- [ ] Validation utilities
- [ ] Array utilities
- [ ] Object utilities

**Effort:** 9 hours

---

## 📦 COMPLETE TECHNOLOGY STACK & DEPENDENCIES

### Core Dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "zustand": "^5.0.0",
    "@tanstack/react-query": "^5.60.0",
    "@tanstack/react-table": "^8.20.0",
    "react-hook-form": "^7.54.0",
    "zod": "^3.23.0",
    "@hookform/resolvers": "^3.9.0",
    "lucide-react": "^0.462.0",
    "framer-motion": "^11.12.0",
    "recharts": "^2.14.0",
    "next-auth": "^5.0.0-beta.25",
    "axios": "^1.7.0",
    "date-fns": "^4.1.0"
  }
}
```

### Radix UI Components (shadcn/ui)

```bash
pnpm add @radix-ui/react-dialog@^1.1.0
pnpm add @radix-ui/react-dropdown-menu@^2.1.0
pnpm add @radix-ui/react-popover@^1.1.0
pnpm add @radix-ui/react-tooltip@^1.1.0
pnpm add @radix-ui/react-tabs@^1.1.0
pnpm add @radix-ui/react-accordion@^1.1.0
pnpm add @radix-ui/react-select@^2.1.0
pnpm add @radix-ui/react-checkbox@^1.1.0
pnpm add @radix-ui/react-radio-group@^1.2.0
pnpm add @radix-ui/react-switch@^1.1.0
```

### Styling Utilities

```bash
pnpm add -D tailwindcss@next
pnpm add -D @tailwindcss/forms @tailwindcss/typography
pnpm add tailwindcss-animate
pnpm add class-variance-authority clsx tailwind-merge
```

### Development Tools

```json
{
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "turbo": "^2.2.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0",
    "prettier": "^3.3.0",
    "prettier-plugin-tailwindcss": "^0.6.0",
    "husky": "^9.1.0",
    "lint-staged": "^15.2.0",
    "vitest": "^2.1.0",
    "@vitest/ui": "^2.1.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@playwright/test": "^1.48.0",
    "@tanstack/react-query-devtools": "^5.60.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

### Key Configuration Files

**next.config.ts:**
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@authapp/ui', 'lucide-react'],
  },
}

export default nextConfig
```

**tailwind.config.ts:**
```typescript
import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf2f8',
          100: '#fce7f3',
          // Add custom brand colors
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
} satisfies Config
```

**turbo.json:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

### Why These Technologies?

**Next.js 15:** Industry leader, SSR/SSG, built-in optimization  
**React 19:** Latest with server components, best ecosystem  
**TailwindCSS 4.0:** Most popular utility-first CSS, JIT compilation  
**shadcn/ui:** Accessible (WCAG 2.1 AA), customizable, copy-paste components  
**Zustand:** Simple client state, minimal boilerplate  
**TanStack Query:** Best data fetching, automatic caching  
**React Hook Form + Zod:** Best form performance, type-safe validation  
**TanStack Table:** Most powerful headless table library  
**Lucide React:** Tree-shakeable icons, 1000+ options  
**Vitest:** Fastest unit testing, Vite-powered  
**Playwright:** Best E2E testing, cross-browser  
**Turborepo:** Fastest monorepo builds, excellent caching  

---

## ✅ ACCEPTANCE CRITERIA

### Infrastructure
- [ ] Monorepo builds successfully with turbo build
- [ ] All packages compile without TypeScript errors
- [ ] ESLint passes with no errors
- [ ] Prettier formats all files correctly
- [ ] Git hooks prevent bad commits
- [ ] Docker Compose starts all services
- [ ] Hot reload works in development

### UI Components
- [ ] All 20 components render without errors
- [ ] Components follow shadcn ui patterns
- [ ] Components are fully typed
- [ ] Components are accessible WCAG 2.1 AA
- [ ] Components have consistent styling
- [ ] Dark mode works for all components
- [ ] Components are responsive
- [ ] Storybook documentation exists

### API Client
- [ ] Client connects to backend API
- [ ] gRPC calls work correctly
- [ ] REST calls work correctly
- [ ] Error handling catches all errors
- [ ] Retry logic works as expected
- [ ] Request interceptors work
- [ ] Response interceptors work
- [ ] TypeScript types are correct

### Types Package
- [ ] All entity types defined
- [ ] All API types defined
- [ ] Types are exported correctly
- [ ] No TypeScript errors
- [ ] Types match backend schemas

### Utils Package
- [ ] All utilities work correctly
- [ ] Functions are pure
- [ ] Functions are tested
- [ ] TypeScript types are correct

---

## 🧪 TESTING REQUIREMENTS

### Unit Tests
- [ ] UI components have unit tests
- [ ] API client has unit tests
- [ ] Utils have unit tests
- [ ] Test coverage above 80 percent

### Integration Tests
- [ ] API client integration tests
- [ ] Component integration tests

### Manual Testing
- [ ] All components render in Storybook
- [ ] Docker Compose starts successfully
- [ ] Development server starts
- [ ] API calls work end-to-end

---

## 📚 DOCUMENTATION REQUIREMENTS

### Code Documentation
- [ ] All components have JSDoc comments
- [ ] All functions have JSDoc comments
- [ ] Complex logic is commented
- [ ] Type definitions are documented

### User Documentation
- [ ] README.md in root
- [ ] README.md in each package
- [ ] Storybook stories for components
- [ ] Development setup guide
- [ ] Architecture documentation

---

## 🚀 SPRINT BREAKDOWN

### Sprint 1 Week 1 First Half
**Focus:** Infrastructure Setup

**Day 1-2:**
- [ ] Initialize monorepo
- [ ] Configure Turborepo
- [ ] Setup TypeScript

**Day 3-4:**
- [ ] Configure ESLint Prettier
- [ ] Setup Docker Compose
- [ ] Create package structures

**Effort:** 40 hours

### Sprint 2 Week 1 Second Half
**Focus:** UI Components Group A B

**Day 5-7:**
- [ ] Build Form components Button Input Textarea
- [ ] Build Form components Select Checkbox Radio
- [ ] Build Layout components Card Dialog

**Day 8-9:**
- [ ] Build Layout components Sheet Accordion Tabs
- [ ] Test all components

**Effort:** 40 hours

### Sprint 3 Week 2 First Half
**Focus:** UI Components Group C D

**Day 10-11:**
- [ ] Build Feedback components Alert Toast Badge
- [ ] Build Feedback components Progress Skeleton

**Day 12-13:**
- [ ] Build Navigation components Dropdown Popover
- [ ] Build Display components Tooltip Avatar Loading

**Effort:** 40 hours

### Sprint 4 Week 2 Second Half
**Focus:** API Client Types Utils

**Day 14-15:**
- [ ] Build gRPC client
- [ ] Build REST client
- [ ] Implement API methods

**Day 16-17:**
- [ ] Create Types package
- [ ] Create Utils package
- [ ] Integration testing

**Effort:** 40 hours

---

## 🔗 DEPENDENCIES

### External Dependencies
```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",
    "lucide-react": "^0.462.0",
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "turbo": "^2.2.0",
    "eslint": "^9.0.0",
    "prettier": "^3.3.0",
    "vitest": "^2.1.0"
  }
}
```

### Internal Dependencies
- Backend API must be running
- PostgreSQL database accessible
- Redis cache accessible

---

## ⚠️ RISKS AND MITIGATION

### Risk 1: Component Library Complexity
**Risk:** Building 20 components takes longer than estimated  
**Mitigation:** Use shadcn ui copy-paste approach, prioritize essential components  
**Contingency:** Defer non-critical components to Phase 2

### Risk 2: API Integration Issues
**Risk:** Backend API changes during development  
**Mitigation:** Establish API contract, use mocks for development  
**Contingency:** Create adapter layer for API changes

### Risk 3: Docker Configuration
**Risk:** Docker environment issues on different OS  
**Mitigation:** Test on Mac Linux Windows, document known issues  
**Contingency:** Provide alternative local dev setup without Docker

---

## 📊 PROGRESS TRACKING

### Daily Standup Questions
1. What did you complete yesterday?
2. What will you work on today?
3. Any blockers?

### Weekly Review
- [ ] Review completed tasks
- [ ] Demo working features
- [ ] Adjust estimates if needed
- [ ] Plan next sprint

---

## 🎯 PHASE EXIT CRITERIA

**Must Have:**
- [ ] Monorepo builds and runs
- [ ] All 20 UI components working
- [ ] API client connects to backend
- [ ] Types and utils packages complete
- [ ] Docker environment functional
- [ ] Documentation complete

**Nice to Have:**
- [ ] Storybook deployed
- [ ] CI CD pipeline configured
- [ ] Performance benchmarks established

**Blockers for Next Phase:**
- API client must work
- Core UI components must be ready
- Development environment must be stable

---

**Next Phase:** [PHASE_2_PORTAL.md](./PHASE_2_PORTAL.md)

**Document Version:** 1.0  
**Last Updated:** November 4, 2025
