# Technology Stack

**Analysis Date:** 2026-04-08

## Languages

**Primary:**

- TypeScript 5 - Used throughout the codebase for all source files (.ts, .tsx)
- JavaScript ES2017 - Target compiled output

**Secondary:**

- CSS - Styling via Tailwind CSS
- JSON - Configuration files

## Runtime

**Environment:**

- Node.js 20.x - Based on @types/node version in devDependencies
- Browser - Client-side execution for React application

**Package Manager:**

- npm (version unspecified) - Based on package-lock.json presence
- Lockfile: present

## Frameworks

**Core:**

- Next.js 16.0.9 - React framework for server-rendered and hybrid applications
- React 19.2.2 - UI library for building user interfaces

**Testing:**

- Jest 29.7.0 - JavaScript testing framework
- ts-jest 29.1.1 - TypeScript preprocessor for Jest
- @testing-library/react 16.2.0 - React component testing utilities

**Build/Dev:**

- Turbopack - Next.js 16's incremental bundler (used in dev script)
- PostCSS 8.5.3 - CSS processing pipeline
- Tailwind CSS 4.1.5 - Utility-first CSS framework
- ESLint 9.x - Linting utility
- Prettier 3.5.1 - Code formatter

## Key Dependencies

**Critical:**

- ai SDK 4.3.13 - Unified interface for AI providers
- @supabase/ssr 0.5.2 - Supabase server-side rendering utilities
- zustand 5.0.5 - State management library
- @tanstack/react-query 5.80.6 - Data fetching and state synchronization
- framer-motion 12.38.0 - Animation library for React
- sonner 2.0.1 - Toast notification system
- marked 15.0.11 - Markdown parser
- react-markdown 10.1.0 - Markdown component for React
- shiki 3.4.0 - Syntax highlighter
- ioredis 5.3.2 - Redis client
- exa-js 1.6.13 - Exa search API client
- dompurify 3.2.5 - HTML sanitizer

**Infrastructure:**

- next-themes 0.4.6 - Theme management for Next.js
- clsx 2.1.1 - Utility for constructing className strings
- class-variance-authority 0.7.1 - Variants for CVA
- tailwind-merge 3.5.0 - Utility for merging Tailwind classes
- tailwind-variants 3.2.2 - Utility for Tailwind variants
- tailwindcss-animate 1.0.7 - Tailwind CSS plugin for animations
- uuid - Implicitly used for ID generation
- slugify 1.6.6 - String slugification utility

## Configuration

**Environment:**

- Configured via .env.local file (based on .env.example)
- Required variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE, CSRF_SECRET
- Optional AI provider keys: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, etc.
- Optional services: EXA_API_KEY, GITHUB_TOKEN, OLLAMA_BASE_URL

**Build:**

- next.config.ts - Next.js configuration
- tsconfig.json - TypeScript configuration
- eslint.config.mjs - ESLint configuration
- .prettierrc.json - Prettier configuration
- postcss.config.mjs - PostCSS configuration
- jest.config.js - Jest configuration

## Platform Requirements

**Development:**

- Node.js 20.x or later
- npm package manager
- Git version control system
- Supabase project for database and authentication
- Optional: Ollama for local AI model testing

**Production:**

- Node.js runtime environment
- Vercel or similar platform optimized for Next.js deployment
- Supabase for production database and auth
- Redis instance for caching and session storage (based on ioredis usage)

---

_Stack analysis: 2026-04-08_
