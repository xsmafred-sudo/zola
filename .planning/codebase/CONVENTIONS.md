# Coding Conventions

**Analysis Date:** 2026-04-08

## Naming Patterns

**Files:**

- PascalCase for React components: `components/ui/button.tsx`
- camelCase for utility files: `lib/utils.ts`
- kebab-case for directories: `components/motion-primitives/`
- Test files: `{name}.test.ts` in `__tests__` directories

**Functions:**

- camelCase: `getUserProfile()`, `checkSessionTimeout()`
- Descriptive names indicating purpose and return type

**Variables:**

- camelCase: `userProfile`, `isDev`, `mockClient`
- Constants: UPPER_SNAKE_CASE (not prominently used, but follows standard)
- Boolean prefixes: `is`, `has`, `should` (e.g., `isExpired`)

**Types:**

- PascalCase for TypeScript interfaces and types: `Metadata`, `Readonly<{}>`
- Use of utility types: `Readonly<{}>` for props

## Code Style

**Formatting:**

- Prettier v3.5.1 with plugins:
  - @ianvs/prettier-plugin-sort-imports (import sorting)
  - prettier-plugin-tailwindcss (Tailwind class sorting)
- Settings: no semicolons, double quotes, 2-space tabs, trailing comma es5

**Linting:**

- ESLint v9 with Next.js presets:
  - `next/core-web-vitals` for performance rules
  - `next/typescript` for TypeScript-specific rules
- Configured via `eslint.config.mjs` using FlatCompat
- No custom rules beyond Next.js presets

## Import Organization

**Order:**

1. External libraries and frameworks (React, Next.js, etc.)
2. Internal aliases using `@/*` prefix
3. Local relative paths

**Path Aliases:**

- `@/*` → project root (configured in `tsconfig.json` and `jest.config.js`)
- Example: `import { checkSessionTimeout } from '@/lib/auth/session-manager'`

## Error Handling

**Patterns:**

- Try/catch for async operations in service functions
- Error boundaries not prominently used (relying on React error handling in development)
- API routes return structured error responses with appropriate HTTP status codes
- Validation using Zod or similar schemas (evidence in auth modules)
- Centralized error handling in middleware for cross-cutting concerns

**Specific Examples:**

- Auth service functions catch and re-throw errors with context
- Supabase operations check for error objects in responses
- Form validation uses Zod schemas in route handlers

## Logging

**Framework:** console-based with Jest mocking in tests

**Patterns:**

- Limited direct console.log usage (replaced by sonner toast for user feedback)
- Error logging in test environment via mocked console.error
- Audit logging to database for security events (see AuditLogger)
- No centralized logging service configured in codebase

## Comments

**When to Comment:**

- Complex logic explanations (evident in session management tests)
- TODO comments for future work (tracked in issues)
- JSDoc for public APIs (not consistently applied)

**JSDoc/TSDoc:**

- Minimal usage; preferring descriptive function and variable names
- Some components have JSDoc for props (evident in shadcn/ui components)
- Not enforced as a strict convention

## Function Design

**Size:** Functions tend to be small and focused (evident in test file helpers)

- Helper functions under 20 lines
- Main logic functions 20-50 lines
- Preference for pure functions where possible

**Parameters:**

- Limited parameters (typically 1-3)
- Options objects for configurable behavior
- Proper typing for all parameters

**Return Values:**

- Explicit return types for functions
- Consistent use of Promise<T> for async functions
- Early returns for error conditions

## Module Design

**Exports:**

- Named exports for functions and classes
- Default exports for React components
- Barrel files not prominently used (direct imports preferred)

**File Organization:**

- Feature-based grouping in lib/ directory (chat-store, model-store, user-store)
- Separation of concerns: API clients, stores, utilities
- Re-export patterns in index.js files for cleaner imports

## React Specific

**Server vs Client Components:**

- Server Components by default (app/layout.tsx, route files)
- "use client" directive for interactive components
- Client providers wrapped in Server Component layout
- Clear separation: data fetching/server logic in Server Components, UI state in Client Components

**Hooks Usage:**

- Custom hooks for reusable logic (evident in motion-primitives)
- Built-in hooks: useState, useEffect, useContext
- React Query hooks for data fetching: useQueries, useMutation

**Styling:**

- Tailwind CSS v4 via @import in globals.css
- Class merging with tailwind-merge
- Variants with tailwind-variants and class-variance-authority
- CSS variables for theme customization
