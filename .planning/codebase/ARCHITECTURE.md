# Architecture

**Analysis Date:** 2026-04-08

## Pattern Overview

**Overall:** Next.js 16 App Router with React 19, organized as a modular monolith with clear separation of concerns

**Key Characteristics:**

- Server-first architecture with Server Components by default
- Clear separation between UI components, business logic, and data layers
- Hybrid rendering (SSR/SSG/CSR) based on route requirements
- State management via Zustand stores and TanStack Query
- Extensive use of React Context for provider patterns
- API routes as serverless functions in `app/api/`

## Layers

**[Presentation Layer]:**

- Purpose: UI rendering and user interaction handling
- Location: `app/` (routes), `components/` (shared UI)
- Contains: Page components, reusable UI components, form elements
- Depends on: Business logic layer, shadcn/ui primitives, Tailwind CSS
- Used by: Application routes and components

**[Business Logic Layer]:**

- Purpose: Core application functionality and state management
- Location: `lib/` (stores, services, utilities)
- Contains: Zustand stores (chat, user, preferences), service functions, utilities
- Depends on: Data access layer, external APIs (Supabase, AI providers)
- Used by: Presentation layer components and API routes

**[Data Access Layer]:**

- Purpose: Data persistence and external service integration
- Location: `lib/supabase/` (database clients), `lib/auth/` (auth services)
- Contains: Supabase clients, authentication handlers, data access functions
- Depends on: External services (Supabase, AI APIs)
- Used by: Business logic layer

**[API Layer]:**

- Purpose: Server-side endpoints for client-server communication
- Location: `app/api/` (route handlers)
- Contains: REST-like API endpoints for chat, auth, models, user management
- Depends on: Business logic layer
- Used by: Presentation layer (client-side), external integrations

## Data Flow

**[User Authentication Flow]:**

1. User visits `/auth/login` page (Server Component)
2. Form submission triggers client action to `/app/auth/login/actions.ts`
3. Action validates credentials via Supabase auth service (`lib/auth/`)
4. On success, sets HTTP-only cookie and redirects to dashboard
5. Layout reads user profile via `getUserProfile()` and initializes providers
6. User context flows through Provider components to all child components

**[Chat Message Flow]:**

1. User submits message via `ChatInput` component
2. Message added to local chat state via Zustand store (`lib/chat-store/`)
3. Optimistic UI update shows message immediately
4. Request sent to AI provider via `ai` SDK with model selection
5. Response streamed back and added to chat state
6. Persisted to Supabase via chat store synchronization
7. UI updates with assistant response

**State Management:**

- Global state: Zustand stores in `lib/*/store/` (chat, user, preferences)
- Server state: TanStack Query for data fetching and caching
- UI state: React useState/useReducer in components
- Session state: HTTP-only cookies + Supabase auth

## Key Abstractions

**[Store Abstraction]:**

- Purpose: Encapsulate state logic and persistence
- Examples: `lib/chat-store/`, `lib/user-store/`, `lib/user-preference-store/`
- Pattern: Each store contains:
  - `store.ts`: Zustand store definition with actions
  - `provider.tsx`: React Context provider component
  - `types.ts`: TypeScript types and interfaces
  - `*/`: Subdirectories for specific concerns (e.g., `/api/`, `/utils/`)

**[Provider Pattern]:**

- Purpose: Share state and functionality via React Context
- Examples: `UserProvider`, `ModelProvider`, `ChatsProvider` in `layout.tsx`
- Pattern:
  - Provider component wraps children
  - Initializes store with data from server
  - Exposes store methods via context
  - Automatically re-renders consumers on state change

**[AI Provider Abstraction]:**

- Purpose: Unified interface for multiple AI services
- Examples: `lib/openproviders/` directory
- Pattern:
  - Provider interface definition (`types.ts`)
  - Environment-based provider selection (`env.ts`)
  - Provider mapping (`provider-map.ts`)
  - Unified API access through `ai` SDK

## Entry Points

**[Root Layout]:**

- Location: `app/layout.tsx`
- Triggers: Every page request in the application
- Responsibilities:
  - Initialize all provider contexts
  - Set up global styles and fonts
  - Handle server-side user profile loading
  - Provide theme, tooltip, sidebar, and toast providers
  - Render child pages within provider hierarchy

**[API Routes]:**

- Location: `app/api/[route]/route.ts`
- Triggers: HTTP requests to `/api/[route]`
- Responsibilities:
  - Handle specific API endpoints (auth, chat, models, etc.)
  - Validate and sanitize input data
  - Delegate to business logic layer
  - Return appropriate HTTP responses
  - Handle errors consistently

**[Page Components]:**

- Location: `app/[route]/page.tsx` or `app/[segment]/[id]/page.tsx`
- Triggers: Navigation to specific routes
- Responsibilities:
  - Fetch initial data (if needed)
  - Compose UI from components
  - Handle route-specific logic
  - Manage loading and error states

## Error Handling

**Strategy:** Centralized error handling with graceful degradation and user feedback

**Patterns:**

- **Server Errors:** Try/catch in API routes with standardized error responses (`lib/utils.ts` has error formatting utilities)
- **Client Errors:** Error boundaries implicitly handled by Next.js; user-facing errors shown via sonner toast notifications
- **Validation Errors:** Schema validation with Zod in API routes; form validation in components
- **Authentication Errors:** Redirect to login page with preserved return URL
- **Database Errors:** Specific error types caught and converted to user-friendly messages
- **AI Service Errors:** Fallback mechanisms and retry logic where appropriate

## Cross-Cutting Concerns

**Logging:** Console-based logging in development; structured logging planned for production via Supabase audit tables (`lib/auth/audit-logger.ts`)

**Validation:**

- Input validation using custom validators in `lib/auth/input-validator.ts`
- Zod schemas for API request validation (where implemented)
- Client-side validation in form components

**Authentication:**

- Supabase-based authentication with custom session management
- JWT handling via `lib/auth/session-manager.ts`
- CSRF protection via `lib/auth/csrf-validation.ts` and middleware
- Role-based access control in admin routes

**Security:**

- Environment variable validation at startup
- SQL injection prevention via Supabase parameterized queries
- XSS protection via DOMPurify in content rendering
- Secure cookie settings for session management
- Rate limiting via `lib/auth/rate-limiter.ts`
