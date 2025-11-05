# Applications

This directory contains the Next.js applications.

## Apps

- **console/** - Admin interface (port 3000)
  - Organization management
  - Project management
  - Application configuration
  - User administration
  - Instance settings

- **portal/** - Authentication flows (port 3001)
  - Login/Registration
  - Password management
  - Multi-factor authentication
  - External IdP flows
  - SAML authentication

## Development

```bash
# Run all apps
pnpm dev

# Run specific app
pnpm --filter console dev
pnpm --filter portal dev
```

## Status

- [ ] Console app (Phase 2)
- [ ] Portal app (Phase 3)
