/**
 * CSRF Protection - Client-safe Utilities
 * 
 * Note: Functions that manage cookies (next/headers) have been moved to 
 * @/lib/auth/csrf-server.ts to prevent build errors in Client Components.
 */
export * from "./auth/csrf-core"
