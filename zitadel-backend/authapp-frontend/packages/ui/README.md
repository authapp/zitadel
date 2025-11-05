# @authapp/ui

Shared UI component library for Zitadel frontend applications.

## Overview

This package contains reusable React components built with:
- **Radix UI** - Accessible component primitives
- **TailwindCSS** - Utility-first styling
- **shadcn/ui** - Component patterns
- **TypeScript** - Type safety

## Usage

```typescript
import { Button, Input, Card } from '@authapp/ui';
import { cn } from '@authapp/ui';

function MyComponent() {
  return (
    <Card>
      <Input placeholder="Enter text" />
      <Button className={cn('mt-4', 'bg-primary')}>Submit</Button>
    </Card>
  );
}
```

## Components

### Group A: Forms
- Button
- Input
- Textarea
- Select
- Checkbox
- Radio

### Group B: Layout
- Card
- Dialog
- Dropdown
- Sheet

### Group C: Data Display
- Table
- Tabs
- Accordion

### Group D: Feedback
- Alert
- Toast
- Badge

### Group E: UI Elements
- Avatar
- Skeleton
- Loading

### Group F: Overlays
- Tooltip
- Popover

## Development

```bash
# Run type checking
pnpm type-check

# Run linter
pnpm lint
```

## Structure

```
packages/ui/
├── src/
│   ├── components/     # React components
│   ├── lib/           # Utility functions
│   └── index.ts       # Main exports
├── tailwind.config.ts # Tailwind configuration
├── tsconfig.json      # TypeScript config
└── package.json       # Package metadata
```

## Status

🟡 **In Development** - Components being added progressively

**Progress:** Setup complete, components pending
