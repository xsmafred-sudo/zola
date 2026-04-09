/**
 * Authentication security constants
 * Centralized magic numbers for better maintainability and code clarity
 */

/**
 * OAuth state expiration time
 * OAuth states should expire after 10 minutes to prevent replay attacks
 */
export const OAUTH_STATE_EXPIRY_SECONDS = 600; // 10 minutes
export const OAUTH_STATE_EXPIRY_MS = OAUTH_STATE_EXPIRY_SECONDS * 1000; // 600000ms

/**
 * Supabase update interval
 * Update Supabase user metadata every 5 minutes to reduce load
 */
export const SUPABASE_UPDATE_INTERVAL_MS = 300000; // 5 minutes

/**
 * Redis TTL defaults
 * Default time-to-live for Redis keys when not specified
 */
export const DEFAULT_REDIS_TTL_SECONDS = 3600; // 1 hour
export const DEFAULT_REDIS_TTL_MS = DEFAULT_REDIS_TTL_SECONDS * 1000;

/**
 * Email validation limits
 * RFC 5321 specifies 254 characters maximum for email addresses
 */
export const MAX_EMAIL_LENGTH = 254;

/**
 * Session management timeouts
 * Default session timeout values from security config
 */
export const DEFAULT_SESSION_TIMEOUT_SECONDS = 1800; // 30 minutes
export const DEFAULT_SESSION_TIMEOUT_MS = DEFAULT_SESSION_TIMEOUT_SECONDS * 1000;

export const SESSION_WARNING_THRESHOLD_SECONDS = 300; // 5 minutes
export const SESSION_WARNING_THRESHOLD_MS = SESSION_WARNING_THRESHOLD_SECONDS * 1000;

/**
 * Account lockout thresholds
 * Progressive lockout durations
 */
export const LOCKOUT_THRESHOLDS = {
  FIRST_ATTEMPT: 300,    // 5 minutes
  SECOND_ATTEMPT: 900,   // 15 minutes
  THIRD_ATTEMPT: 3600,    // 1 hour
  FOURTH_ATTEMPT: 86400    // 24 hours
} as const;