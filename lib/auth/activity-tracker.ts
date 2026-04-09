import { SupabaseClient } from '@supabase/supabase-js';
import { SECURITY_CONFIG } from '@/lib/config';
import { RedisWithFallback, createAuthRedis, REDIS_KEY_PREFIXES } from './redis-fallback';
import {
  DEFAULT_REDIS_TTL_SECONDS,
  SUPABASE_UPDATE_INTERVAL_MS,
  DEFAULT_SESSION_TIMEOUT_SECONDS,
  DEFAULT_SESSION_TIMEOUT_MS
} from './constants';

interface UserActivity {
  userId: string;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
}

export class ActivityTracker {
  private redis: RedisWithFallback;
  private activityKeyPrefix = 'user_activity:';
  private sessionTimeout: number;

  constructor(redisInstance?: RedisWithFallback) {
    this.redis = redisInstance || createAuthRedis();
    this.sessionTimeout = DEFAULT_SESSION_TIMEOUT_MS;
  }

  /**
   * Record user activity for session management
   * Updates the last activity timestamp for a user
   */
  async recordActivity(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const activity: UserActivity = {
      userId,
      lastActivity: Date.now(),
      ipAddress,
      userAgent
    };

    const key = `${this.activityKeyPrefix}${userId}`;

    // Store activity with session timeout as TTL
    await this.redis.setex(key, this.sessionTimeout / 1000, JSON.stringify(activity));

    // Also update Supabase user metadata periodically (not every request)
    // This provides a backup and analytics
    try {
      // Only update Supabase every 5 minutes to reduce load
      const stored = await this.redis.get(key);
      if (stored) {
        const parsed = JSON.parse(stored) as UserActivity;
        const timeSinceUpdate = Date.now() - parsed.lastActivity;

        if (timeSinceUpdate > SUPABASE_UPDATE_INTERVAL_MS) {
          // Note: This would need to be called from a context where we can update user metadata
          // For now, we'll rely on Redis for session management
        }
      }
    } catch (error) {
      console.error('Error updating Supabase activity:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Get the last activity timestamp for a user
   */
  async getLastActivity(userId: string): Promise<number | null> {
    const key = `${this.activityKeyPrefix}${userId}`;
    const stored = await this.redis.get(key);

    if (!stored) {
      return null;
    }

    try {
      const activity = JSON.parse(stored) as UserActivity;
      return activity.lastActivity;
    } catch {
      return null;
    }
  }

  /**
   * Check if user session is still valid based on activity
   */
  async isSessionValid(userId: string): Promise<boolean> {
    const lastActivity = await this.getLastActivity(userId);

    if (!lastActivity) {
      return false; // No activity record means session is invalid
    }

    const timeSinceActivity = Date.now() - lastActivity;
    return timeSinceActivity < this.sessionTimeout;
  }

  /**
   * Get session expiry time for a user
   */
  async getSessionExpiry(userId: string): Promise<number | null> {
    const lastActivity = await this.getLastActivity(userId);

    if (!lastActivity) {
      return null;
    }

    return lastActivity + this.sessionTimeout;
  }

  /**
   * Clear user activity record (on logout)
   */
  async clearActivity(userId: string): Promise<void> {
    const key = `${this.activityKeyPrefix}${userId}`;
    await this.redis.del(key);
  }

  /**
   * Get time until session expires
   */
  async getTimeUntilExpiry(userId: string): Promise<number | null> {
    const expiryTime = await this.getSessionExpiry(userId);

    if (!expiryTime) {
      return null;
    }

    const timeUntilExpiry = expiryTime - Date.now();
    return Math.max(0, timeUntilExpiry);
  }
}

// Singleton instance
let activityTracker: ActivityTracker | null = null;

export function getActivityTracker(): ActivityTracker {
  if (!activityTracker) {
    activityTracker = new ActivityTracker();
  }
  return activityTracker;
}