# Zitadel Frontend - React/Next.js Migration

Modern frontend migration from Angular Console and Next.js Login to a unified React/Next.js monorepo.

## 🏗️ Architecture

This is a **monorepo** built with:
- **[Turborepo](https://turbo.build)** - High-performance build system
- **[pnpm](https://pnpm.io)** - Fast, disk space efficient package manager
- **[Next.js 15](https://nextjs.org)** - React framework with App Router
- **[React 19](https://react.dev)** - Latest React with Server Components
- **[TailwindCSS 4.0](https://tailwindcss.com)** - Utility-first CSS
- **[TypeScript 5.3](https://www.typescriptlang.org)** - Type safety

## 📦 Workspace Structure

```
authapp-frontend/
├── apps/
│   ├── console/          # Admin interface (port 3000)
│   └── portal/           # Authentication flows (port 3001)
├── packages/
│   ├── ui/              # Shared UI components
│   ├── client/          # API client library
│   ├── types/           # Shared TypeScript types
│   └── utils/           # Shared utilities
├── package.json         # Root workspace config
├── pnpm-workspace.yaml  # pnpm workspace config
├── turbo.json          # Turborepo pipeline config
└── tsconfig.json       # Root TypeScript config
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Backend API** running on port 8080

### Installation

```bash
# Install pnpm globally (if not installed)
npm install -g pnpm@9.1.0

# Install dependencies
pnpm install
```

### Development

```bash
# Run all apps in development mode
pnpm dev

# Run specific app
pnpm console  # Console on port 3000
pnpm portal   # Portal on port 3001

# Run with Docker Compose (backend + frontend)
docker-compose up
```

### Building

```bash
# Build all apps and packages
pnpm build

# Build specific app
pnpm --filter console build
pnpm --filter portal build
```

### Testing

```bash
# Run all tests
pnpm test

# Unit tests only
pnpm test:unit

# E2E tests
pnpm test:e2e
```

### Code Quality

```bash
# Lint all packages
pnpm lint

# Type checking
pnpm type-check

# Format code
pnpm format
```

## 🔧 Configuration

Copy `.env.example` to `.env.local` in each app directory and configure:

```bash
# Console app
cp .env.example apps/console/.env.local

# Portal app
cp .env.example apps/portal/.env.local
```

## 📚 Documentation

- [Frontend Migration Roadmap](../FRONTEND_MIGRATION_ROADMAP.md)
- [Phase 1: Foundation](../PHASE_1_FOUNDATION.md)
- [Phase 2: Console Core](../PHASE_2_CONSOLE_CORE.md)
- [Phase 3: Portal](../PHASE_3_PORTAL.md)

## 🛠️ Tech Stack

### Core
- Next.js 15 with App Router
- React 19 with Server Components
- TypeScript 5.3
- TailwindCSS 4.0

### UI & Components
- shadcn/ui components
- Radix UI primitives
- Lucide icons
- Framer Motion animations

### State & Data
- Zustand (client state)
- TanStack Query v5 (server state)
- React Hook Form (forms)
- Zod (validation)

### Testing
- Vitest (unit tests)
- Playwright (E2E tests)
- Testing Library (component tests)

### Development
- Turborepo (build system)
- ESLint + Prettier (linting)
- Husky (git hooks)

## 🎯 Project Status

**Current Phase:** Phase 1 - Foundation & Setup ✅
- [x] Monorepo structure created
- [ ] Shared UI components
- [ ] API client library
- [ ] Development environment

**Next Phase:** Phase 2 - Console Core
- [ ] Layout & navigation
- [ ] Organizations module
- [ ] Projects module
- [ ] Applications module
- [ ] Users module

## 📝 Scripts Reference

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all apps for production |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run all tests |
| `pnpm type-check` | Check TypeScript types |
| `pnpm format` | Format code with Prettier |
| `pnpm clean` | Clean all build artifacts |
| `pnpm console` | Run console app only |
| `pnpm portal` | Run portal app only |

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## 📄 License

Private - Zitadel Enterprise

---

**Questions?** Check the [documentation](../FRONTEND_MIGRATION_ROADMAP.md) or contact the frontend team.
