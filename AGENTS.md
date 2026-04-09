# AGENTS.md — Zola

## Commands

| Task         | Command                                                         |
| ------------ | --------------------------------------------------------------- |
| Dev server   | `npm run dev` (Next 16 with Turbopack)                          |
| Build        | `npm run build` (output: standalone)                            |
| Lint         | `npm run lint` (ESLint: next/core-web-vitals + next/typescript) |
| Type check   | `npm run type-check`                                            |
| Verify order | `npm run lint && npm run type-check && npm run build`           |

No test suite exists yet (CI has a TODO).

## Architecture

- **Next.js 16** App Router, React 19, TypeScript strict mode
- **Path alias**: `@/*` → project root
- **`app/`** — routes and page components. Entry: `app/page.tsx` (chat UI). Layout: `app/layout.tsx` wraps providers.
- **`app/api/`** — API route handlers (chat, auth, models, user keys, preferences, CSRF, health)
- **`lib/`** — business logic: chat-store, model-store, user-store, user-preference-store, Supabase client/server, CSRF, encryption, MCP (wip)
- **`components/`** — UI: shadcn/ui in `components/ui/`, prompt-kit in `components/prompt-kit/`, motion-primitives in `components/motion-primitives/`
- **State**: Zustand stores (chat, user, user-preference), TanStack Query for data fetching, React context providers in layout
- **shadcn/ui**: "new-york" style, RSC enabled, Tailwind CSS v4
- **Tailwind v4**: Config lives in `app/globals.css` via `@import "tailwindcss"` — no `tailwind.config.js`

## Environment

- Copy `.env.example` → `.env.local`; set at minimum `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`, `CSRF_SECRET`, and one AI provider key
- **`CSRF_SECRET` is required** — generates 403 on all POST/PUT/DELETE if missing or invalid (see `middleware.ts`)
- **Ollama**: auto-enabled in development, auto-disabled in production. Override with `DISABLE_OLLAMA=true`
- **`ANALYZE=true`** enables bundle analyzer: `ANALYZE=true npm run build`

## CI/CD

- GitHub Actions: lint → type-check → build → Docker push to `ghcr.io`
- Branches: `main`, `develop`. Tags: `v*`
- Deploy job is commented out

## Conventions

- **Prettier**: no semicolons, double quotes, 2-space tabs, import sorting + tailwind class sorting
- **No test framework configured** — do not invent one; ask before adding tests
- **Server vs Client**: `app/layout.tsx` is a Server Component; client providers are wrapped inside it. Route pages default to server unless `"use client"` is declared
- **Supabase**: `utils/supabase/` has middleware helpers; `lib/supabase/` has client/server/guest clients
