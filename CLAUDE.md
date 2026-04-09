# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development server with Turbopack (recommended)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Linting
npm run lint

# Type checking
npm run type-check
```

## High-Level Architecture

Zola is a Next.js 16 application built with the App Router, providing a multi-model AI chat interface. The architecture is organized around several key layers:

### Core Tech Stack
- **Next.js 16** with App Router and Turbopack
- **Vercel AI SDK** (`ai` package) for streaming responses and chat management
- **Supabase** for authentication, database (PostgreSQL), and file storage
- **Zustand** for client-side state management
- **TanStack Query** for server state management
- **Tailwind CSS** with shadcn/ui and prompt-kit components

### Data Flow Architecture

The application uses a multi-layered data storage approach:

1. **Server-side**: Supabase PostgreSQL database stores permanent data (users, chats, messages, attachments)
2. **Client-side caching**: IndexedDB for local persistence and offline capability
3. **Optimistic UI updates**: State updates happen immediately before server confirmation
4. **Streaming responses**: Real-time AI responses via Vercel AI SDK's `streamText` with data streams

Key data flows:
- Messages flow from client → `/api/chat` → AI providers → back to client via streaming
- User actions update local state first, then sync to Supabase
- Guest users use Supabase anonymous auth with localStorage for session persistence

### Multi-Model Architecture

The model system supports multiple AI providers through a unified interface:

**Model Providers** (`lib/models/`):
- **Static models**: Pre-configured models for OpenAI, Mistral, Claude, Gemini, etc.
- **Dynamic Ollama models**: Automatically detected from local Ollama instance via API
- **Provider mapping**: Each model routes to the appropriate provider's AI SDK

**Model Configuration** (`lib/models/types.ts`):
```typescript
type ModelConfig = {
  id: string
  name: string
  providerId: string
  apiSdk: (apiKey?: string, options?: any) => LanguageModelV1
  // ... other metadata
}
```

**BYOK (Bring Your Own Key)**:
- Users can store encrypted API keys for providers
- Encryption handled server-side with user-specific encryption keys
- Keys stored in `user_keys` table with IV for AES encryption
- Provider selection happens dynamically based on user's available keys

### Authentication Flow

Zola supports both authenticated and guest users:

1. **Guest users**:
   - Created via Supabase anonymous auth (`signInAnonymously`)
   - Limited message quotas (5/day)
   - Session persisted in localStorage
   - Can upgrade to full account later

2. **Authenticated users**:
   - Email/password or OAuth (Google, GitHub)
   - Higher quotas (1000/day default)
   - Persistent profile and preferences
   - BYOK functionality enabled

**Auth flow**:
- Client-side auth handled by Supabase client SDK
- Server-side auth validated via Supabase server client
- User profiles synchronized on auth callback
- Rate limiting enforced per user based on auth status

### Database Schema Organization

**Core tables** (in order of dependency):
- `users`: User profiles, quotas, preferences reference
- `projects`: User-created project containers
- `chats`: Individual conversations (linked to users and projects)
- `messages`: Chat messages with support for attachments and parts
- `chat_attachments`: File metadata and storage references
- `user_keys`: Encrypted API keys for BYOK
- `user_preferences`: Layout, appearance, and feature toggles
- `feedback`: User feedback submissions

**Key relationships**:
- Users → Projects (one-to-many)
- Users → Chats (one-to-many)
- Projects → Chats (one-to-many)
- Chats → Messages (one-to-many)
- Chats → Chat Attachments (one-to-many)

### Message Streaming Architecture

The chat API (`/api/chat`) implements streaming responses:

1. **Request validation**: Rate limits, model availability, user permissions
2. **Message logging**: User messages stored before AI response
3. **AI streaming**: Vercel AI SDK's `streamText` with provider-specific models
4. **Response handling**: Assistant messages stored on stream completion
5. **Error handling**: Graceful degradation with user-friendly error messages

**Stream format**:
- Uses AI SDK's `toDataStreamResponse()`
- Supports reasoning, sources, and tool invocations
- Client-side components render streamed content progressively

### Component Architecture

**Layout hierarchy**:
```
RootLayout
├── TanstackQueryProvider
├── UserProvider (user state)
├── ModelProvider (available models)
├── ChatsProvider (chat list)
├── ChatSessionProvider (active chat)
├── MessagesProvider (message state)
└── UserPreferencesProvider (user settings)
```

**Key component patterns**:
- **Compound components**: Complex features split into manageable parts (e.g., `Chat` uses `useChatCore`, `useChatOperations`, `useFileUpload`)
- **Custom hooks**: Encapsulate logic (e.g., `useModel`, `useChatDraft`, `useMobile`)
- **Dynamic imports**: Code splitting for heavy components (e.g., `FeedbackWidget`, `DialogAuth`)
- **Context providers**: Global state for user, chats, messages, models, preferences

### File Handling

File upload supports multiple types with validation:

**Supported types** (via `file-type` library):
- Images: JPEG, PNG, GIF
- Documents: PDF, Markdown, Plain text, JSON, CSV
- Spreadsheets: Excel formats (.xls, .xlsx)

**Upload flow**:
1. Client-side validation (size, type, file signature)
2. Upload to Supabase Storage (`chat-attachments` bucket)
3. Database record creation in `chat_attachments` table
4. Optimistic UI update with object URL
5. Daily quota enforcement (5 files/day default)

**Security**:
- File type detection via magic bytes, not just extension
- Size limits enforced (10MB default)
- CSRF protection on upload endpoints

### Routing Structure

**App Router pages**:
- `/` - Main chat interface
- `/c/[chatId]` - Specific chat conversation
- `/p/[projectId]` - Project view with associated chats
- `/share/[chatId]` - Public shared chat
- `/auth/*` - Authentication pages (login, callback, error)
- `/admin/*` - Admin interface (users, settings, audit)

**API routes** (`app/api/`):
- `/api/chat` - Main chat endpoint with streaming
- `/api/create-guest` - Guest user creation
- `/api/rate-limits` - Usage quota checking
- `/api/user-keys` - BYOK key management
- `/api/models` - Available models listing
- `/api/providers` - Provider configuration
- Provider-specific routes for dynamic features

### State Management Patterns

**Zustand stores** (lib/*-store/):
- `user-store`: User profile and authentication state
- `chat-store/chats`: Chat list and management
- `chat-store/messages`: Message state with IndexedDB sync
- `chat-store/session`: Active chat session management
- `model-store`: Available models and provider configuration
- `user-preference-store`: User settings and UI preferences

**TanStack Query**: Used for server state that benefits from caching and refetching, particularly for API calls that need automatic revalidation.

**LocalStorage**: Used for:
- Guest chat IDs persistence
- Draft messages (`use-chat-draft` hook)
- Guest profile creation flags
- User preferences when Supabase is unavailable

### Important Configuration

**Environment variables** (see `INSTALL.md` for full setup):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`: Supabase connection
- `ENCRYPTION_KEY`: Required for BYOK feature (32-byte base64 key)
- `CSRF_SECRET`: Protection against CSRF attacks
- `OLLAMA_BASE_URL`: Local Ollama instance (default: `http://localhost:11434`)
- Provider API keys: `OPENAI_API_KEY`, `MISTRAL_API_KEY`, etc.

**App configuration** (`lib/config.ts`):
- `MODEL_DEFAULT`: Default model for new chats
- `FREE_MODELS_IDS`: Models available without authentication
- `NON_AUTH_ALLOWED_MODELS`: Models for guest users
- Daily limits: `AUTH_DAILY_MESSAGE_LIMIT`, `NON_AUTH_DAILY_MESSAGE_LIMIT`
- `SYSTEM_PROMPT_DEFAULT`: Default AI behavior

**Next.js configuration** (`next.config.ts`):
- Output mode: `standalone` for Docker deployment
- Turbopack enabled for development
- Bundle analyzer for production optimization
- Supabase storage image patterns configured

### Development Patterns

**Creating new model providers**:
1. Add provider data to `lib/models/data/[provider].ts`
2. Add provider to `PROVIDERS` array in `lib/providers/index.ts`
3. Update provider mapping in `lib/openproviders/provider-map.ts`
4. Add environment variable for API key
5. Update BYOK validation if needed

**Adding new chat features**:
1. Update database schema via Supabase SQL
2. Add API route in `app/api/`
3. Update state management in relevant stores
4. Add UI components in `app/components/chat/` or `app/components/chat-input/`
5. Update types in `app/types/database.types.ts`

**File upload extensions**:
1. Add file type to `ALLOWED_FILE_TYPES` in `lib/file-handling.ts`
2. Ensure Supabase Storage bucket has proper policies
3. Update validation logic if needed
4. Add UI support in chat components

**Rate limiting extensions**:
1. Update quota constants in `lib/config.ts`
2. Modify `/api/rate-limits` endpoint logic
3. Update usage tracking in relevant API routes
4. Consider adding new limits for different features

### Deployment Considerations

**Docker deployment**:
- Uses `standalone` Next.js output
- Requires all environment variables
- Supabase connection required for full functionality
- Ollama can be disabled in production (`DISABLE_OLLAMA=true`)

**Vercel deployment**:
- Environment variables set via Vercel dashboard
- Supabase integration recommended for auth
- Storage buckets must be configured in Supabase

**Ollama integration**:
- Automatically enabled in development
- Disabled in production by default
- Can be configured via `OLLAMA_BASE_URL`
- Models are dynamically detected via Ollama API

## Key File Locations

- **Configuration**: `lib/config.ts`, `next.config.ts`, `tsconfig.json`
- **Models & providers**: `lib/models/`, `lib/providers/`, `lib/openproviders/`
- **API routes**: `app/api/`
- **Chat components**: `app/components/chat/`
- **Layout components**: `app/components/layout/`
- **State management**: `lib/*-store/`
- **Database types**: `app/types/database.types.ts`
- **Utilities**: `lib/utils.ts`, `lib/fetch.ts`, `lib/sanitize.ts`
- **File handling**: `lib/file-handling.ts`
- **Auth & API**: `lib/api.ts`, `lib/user/api.ts`
