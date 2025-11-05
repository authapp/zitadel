# Shared Packages

This directory contains shared packages used across applications.

## Packages

- **ui/** - Shared UI component library
  - 20+ base components (buttons, inputs, cards, etc.)
  - Built with shadcn/ui and Radix UI
  - TailwindCSS styling
  - TypeScript types included

- **client/** - API client library
  - REST API client
  - gRPC client wrapper
  - Authentication helpers
  - Type-safe requests

- **types/** - Shared TypeScript types
  - API response types
  - Domain models
  - Common interfaces
  - Enums and constants

- **utils/** - Shared utility functions
  - Date/time helpers
  - Validation functions
  - Formatting utilities
  - Common hooks

## Usage

Import from any app:

```typescript
// UI components
import { Button, Input, Card } from '@authapp/ui';

// API client
import { apiClient } from '@authapp/client';

// Types
import type { User, Organization } from '@authapp/types';

// Utils
import { formatDate, validateEmail } from '@authapp/utils';
```

## Status

- [ ] ui package (Phase 1)
- [ ] client package (Phase 1)
- [ ] types package (Phase 1)
- [ ] utils package (Phase 1)
