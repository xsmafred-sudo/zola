# Phase 1: Foundation - Context

Based on the product vision and roadmap, Phase 1 focuses on establishing the core platform capabilities for Opsear.

## Key Decisions from Vision:

- Chat interface as primary interaction method (not chat-only, but conversation-first)
- Multi-source scraping for discovery (LinkedIn, Crunchbase, Google)
- Email validation & enrichment capabilities
- Lead library with bulk operations
- Supabase as the database/auth solution
- Hermes agent framework for orchestration

## Current State:

- Next.js 16 App Router with React 19 and TypeScript strict mode
- shadcn/ui components available
- No existing chat interface, Supabase setup, or agent framework
- Basic project structure in place

## Immediate Needs:

1. Chat interface where users can converse with agents
2. Supabase database schema for storing leads, conversations, agent states
3. Authentication system for users
4. Hermes agent framework integration
5. Discovery agents that can scrape LinkedIn and Crunchbase
6. Lead library to store and manage discovered prospects

## Technical Constraints:

- Must use Next.js 16 App Router conventions
- Must use Supabase for database/auth
- Must follow existing code patterns in lib/, components/, app/
- No test framework configured yet - focus on implementation first
- CSRF protection required for all mutating operations

## Success Criteria for Phase 1:

- Working chat interface where users can send/receive messages
- Ability to discover leads via natural language commands
- Leads stored in Supabase with validation status
- Basic lead library interface showing discovered prospects
- Foundation ready for Phase 2 outreach features
