# Codebase Structure

**Analysis Date:** 2026-04-08

## Directory Layout

```
/home/xsma/Documents/opsear dev/zola/
├── app/                  # Next.js App Router - routes and page components
├── components/           # Shared UI components (shadcn/ui based)
├── lib/                  # Business logic - stores, services, utilities
├── public/               # Static assets (images, icons, etc.)
├── supabase/             # Supabase migration and edge function files
├── utils/                # Utility helpers and TypeScript configurations
├── .github/              # GitHub Actions workflows and issue templates
├── .next/                # Next.js build output (generated)
├── node_modules/         # Dependencies (installed)
├── .planning/            # GSD planning documents (generated)
├── .env.local            # Environment variables (gitignored)
├── .env.example          # Example environment variables
├── package.json          # Project dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── middleware.ts         # Next.js middleware for auth/CSRF
├── next.config.ts        # Next.js configuration
├── README.md             # Project documentation
├── LICENSE               # MIT license
└── opsear-vision.md      # Project vision document
```

## Directory Purposes

**[app/]:**

- Purpose: Next.js App Router containing all application routes and page components
- Contains: Route segments (page.tsx, layout.tsx, loading.tsx, error.tsx), API routes
- Key files:
  - `app/layout.tsx`: Root layout with all providers
  - `app/page.tsx`: Home page (chat interface)
  - `app/auth/`: Authentication routes (login, reset password, etc.)
  - `app/api/`: API route handlers (chat, auth, models, etc.)
  - `app/components/`: Route-specific UI components

**[components/]:**

- Purpose: Reusable UI components built with shadcn/ui primitives
- Contains: Atomic components, compound components, UI patterns
- Key files:
  - `components/ui/`: shadcn/ui primitives (button, input, dialog, etc.)
  - `components/chat/`: Chat-specific components (message, input, container)
  - `components/layout/`: Layout components (sidebar, header, settings)
  - `components/motion-primitives/`: Framer Motion animation primitives
  - `components/prompt-kit/`: Prompt enhancement UI components
  - `components/history/`: Chat history and search components

**[lib/]:**

- Purpose: Business logic layer - state management, services, and utilities
- Contains: Zustand stores, service functions, external API integrations
- Key files:
  - `lib/chat-store/`: Chat state management (messages, sessions)
  - `lib/user-store/`: User authentication and profile management
  - `lib/user-preference-store/`: User settings and preferences
  - `lib/model-store/`: Available AI models management
  - `lib/supabase/`: Supabase client initialization and helpers
  - `lib/auth/`: Authentication services (session, CSRF, rate limiting, OAuth)
  - `lib/openproviders/`: Unified AI provider abstraction layer
  - `lib/utils.ts`: General utility functions
  - `lib/tanstack-query/`: TanStack Query provider configuration

**[public/]:**

- Purpose: Static assets served directly by Next.js
- Contains: Images, icons, favicons, robots.txt
- Key files:
  - `public/logo.svg`: Application logo
  - `public/favicon.ico`: Browser favicon

**[supabase/]:**

- Purpose: Supabase database configuration and edge functions
- Contains: Migration SQL files, seed data, edge function definitions
- Key files:
  - `supabase/migrations/`: Database schema migrations
  - `supabase/seed/`: Initial data seeding scripts
  - `supabase/functions/`: Edge functions for serverless logic

**[utils/]:**

- Purpose: TypeScript configurations and utility scripts
- Contains: Type definitions, helper scripts
- Key files:
  - `utils/supabase/`: Supabase-specific TypeScript helpers
  - `check-tables.js`: Database table verification script
  - `test-supabase.js`: Supabase connection test script

## Key File Locations

**Entry Points:**

- `app/layout.tsx`: Root application layout with all providers
- `app/page.tsx`: Main chat interface (home page)
- `app/auth/page.tsx`: Authentication entry point
- `middleware.ts`: Next.js middleware for authentication and CSRF protection

**Configuration:**

- `next.config.ts`: Next.js framework configuration
- `tsconfig.json`: TypeScript compiler options
- `package.json`: Project dependencies and npm scripts
- `.env.example`: Template for required environment variables
- `middleware.ts`: Authentication and CSRF middleware
- `eslint.config.mjs`: ESLint configuration
- `.prettierrc.json`: Prettier formatting configuration

**Core Logic:**

- `lib/chat-store/`: Complete chat state management system
- `lib/user-store/`: User authentication and session handling
- `lib/supabase/`: Database connectivity and query helpers
- `lib/auth/`: Authentication, authorization, and security services
- `lib/openproviders/`: Multi-provider AI abstraction layer

**Testing:**

- `app/auth/__tests__/`: Authentication-related unit tests
- `jest.config.js`: Jest testing configuration
- `jest.setup.js`: Jest test environment setup
- Note: Testing is currently limited to auth module; no comprehensive test suite exists

## Naming Conventions

**Files:**

- `kebab-case`: Route files and directories (`app/auth/login-page.tsx`)
- `PascalCase`: React components (`components/chat/ChatInput.tsx`)
- `camelCase`: Utility functions and variables (`useChatStore.ts`)
- `UPPER_CASE`: Environment variables and constants (`CSRF_SECRET`)
- `.tsx`: Files containing JSX/TSX syntax
- `.ts`: Pure TypeScript files (no JSX)

**Directories:**

- `kebab-case`: All directory names (`components/ui/`, `lib/auth/`)
- Feature-based grouping: Related functionality in same directory
- `index.ts`/`index.tsx`: Export barrels for directory modules

## Where to Add New Code

**New Feature:**

- Primary code: `lib/[feature-name]/` (store, service, utils)
- Tests: `lib/[feature-name]/__tests__/` (when testing is implemented)
- UI components: `components/[feature-name]/`
- Routes: `app/[feature-name]/page.tsx` + supporting files
- API endpoints: `app/api/[feature-name]/route.ts`

**New Component/Module:**

- Implementation: `components/[module-name]/`
- Styles: Tailwind classes in component or `app/globals.css`
- Export: Add to `components/index.ts` if broadly used
- Documentation: JSDoc comments in component file

**Utilities:**

- Shared helpers: `lib/utils.ts` (general) or `lib/[domain]/utils.ts` (domain-specific)
- Hooks: `lib/hooks/` for custom React hooks
- Constants: `lib/constants.ts` or domain-specific constant files

**Configuration:**

- Environment variables: Add to `.env.example` and document in README
- Next.js config: `next.config.ts` or route-specific configs
- TypeScript: Update `tsconfig.json` for new path aliases or compiler options

## Special Directories

**[.next/]:**

- Purpose: Next.js build output and cache
- Generated: Yes (by `next build` and `next dev`)
- Committed: No (listed in .gitignore)

**[node_modules/]:**

- Purpose: Installed npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No (listed in .gitignore)

**[coverage/]:**

- Purpose: Jest test coverage reports
- Generated: Yes (by `npm run test:coverage`)
- Committed: No (listed in .gitignore)

**[.planning/]:**

- Purpose: GSD-generated planning documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (by this analysis process)
- Committed: Yes (intentionally not in .gitignore to preserve analysis)

**[.github/]:**

- Purpose: GitHub workflows, issue templates, and repository settings
- Generated: No (manually maintained)
- Committed: Yes
- Contents: CI/CD workflows (`workflows/`), issue templates (`ISSUE_TEMPLATE/`)

**[hooks/]:**

- Purpose: Git hook scripts (pre-commit, etc.)
- Generated: No (manually maintained)
- Committed: Yes
- Contents: `hooks/commit-msg.jsx`: Commit message validation
