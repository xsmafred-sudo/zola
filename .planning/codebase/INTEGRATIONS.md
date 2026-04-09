# External Integrations

**Analysis Date:** 2026-04-08

## APIs & External Services

**AI Model Providers:**

- OpenAI - GPT series models for text generation
  - SDK/Client: ai SDK (@ai-sdk/openai)
  - Auth: OPENAI_API_KEY environment variable
- Anthropic - Claude series models
  - SDK/Client: ai SDK (@ai-sdk/anthropic)
  - Auth: ANTHROPIC_API_KEY environment variable
- Google - Gemini models
  - SDK/Client: ai SDK (@ai-sdk/google)
  - Auth: GOOGLE_GENERATIVE_AI_API_KEY environment variable
- Mistral - Mistral series models
  - SDK/Client: ai SDK (@ai-sdk/mistral)
  - Auth: MISTRAL_API_KEY environment variable
- XAI - Grok models
  - SDK/Client: ai SDK (@ai-sdk/xai)
  - Auth: XAI_API_KEY environment variable
- Perplexity - Perplexity models
  - SDK/Client: ai SDK (@ai-sdk/perplexity)
  - Auth: PERPLEXITY_API_KEY environment variable
- OpenRouter - Aggregator for various open-source and proprietary models
  - SDK/Client: ai SDK (@openrouter/ai-sdk-provider)
  - Auth: OPENROUTER_API_KEY environment variable
- Ollama - Local AI model serving
  - SDK/Client: Custom implementation via OpenAI-compatible API
  - Auth: None required for local instances
  - Config: OLLAMA_BASE_URL environment variable (defaults to http://localhost:11434)

**Developer Tools & APIs:**

- Exa - Web search and content retrieval
  - SDK/Client: exa-js
  - Auth: EXA_API_KEY environment variable
- GitHub - Developer authentication and repository access
  - SDK/Client: Custom implementation
  - Auth: GITHUB_TOKEN environment variable

## Data Storage

**Databases:**

- Supabase PostgreSQL
  - Connection: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (client), SUPABASE_SERVICE_ROLE (server)
  - Client: @supabase/supabase-js with custom wrappers in lib/supabase/
  - ORM: Direct Supabase JS client usage

**File Storage:**

- Supabase Storage - Used for file uploads (avatars, documents, etc.)
  - Configured through Supabase client

**Caching:**

- Redis - Used for session storage, rate limiting, and caching
  - Connection: REDIS_URL environment variable
  - Client: ioredis with fallback mechanism
  - Implementation: Custom RedisWithFallback wrapper in lib/auth/redis-fallback.ts

## Authentication & Identity

**Auth Provider:**

- Supabase Auth - Handles user authentication, sessions, and security
  - Implementation: Custom wrappers around @supabase/supabase-js auth methods
  - Features: Email/password, OAuth (Google, GitHub), magic links, anonymous sessions
  - Session Management: Custom session manager with Redis fallback
  - Security: CSRF protection, rate limiting, account lockout, audit logging

## Monitoring & Observability

**Error Tracking:**

- Console.error - Basic error logging to browser console and server logs
- No dedicated error tracking service detected

**Logs:**

- Winston-style logging - Custom logger implementation in lib/auth/audit-logger.ts
- Supabase audit logs - Database tables for tracking authentication and security events
- Console logging - Strategic use of console.log/warn/error for debugging

## CI/CD & Deployment

**Hosting:**

- Vercel - Primary deployment target (inferred from Next.js usage and Vercel-specific env vars)
- Docker - Containerization support via Dockerfile and docker-compose.yml

**CI Pipeline:**

- GitHub Actions - Workflows defined in .github/workflows/
  - ci-cd.yml: Main CI pipeline (lint → type-check → build → Docker push)
  - codacy.yml: Code quality analysis
  - codeql.yml: Security analysis

## Environment Configuration

**Required env vars:**

- NEXT_PUBLIC_SUPABASE_URL - Supabase project URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY - Supabase anon key for client access
- SUPABASE_SERVICE_ROLE - Supabase service role key for server access
- CSRF_SECRET - 32-character random string for CSRF protection

**Secrets location:**

- .env.local file - Environment variables (not committed to git)
- .env.example - Template showing required variables
- Process.env accessed directly throughout codebase

## Webhooks & Callbacks

**Incoming:**

- Supabase Auth webhooks - Handle authentication events (sign-in, sign-out, etc.)
- GitHub OAuth callbacks - Handle GitHub authentication flows
- Google OAuth callbacks - Handle Google authentication flows

**Outgoing:**

- None detected - Application primarily consumes APIs rather than exposing webhooks for external consumption

---

_Integration audit: 2026-04-08_
