import { SECURITY_CONFIG } from '@/lib/config';
import { RedisWithFallback, createAuthRedis, RedisCompatible, REDIS_KEY_PREFIXES } from './redis-fallback';

interface LockoutState {
  attempts: number;
  lockedUntil: string | null;
  lastAttempt: string;
}

export class AccountLockout {
  private redis: any;

  constructor(redisUrlOrInstance?: string | RedisCompatible) {
    if (redisUrlOrInstance) {
      if (typeof redisUrlOrInstance === 'object' && 'incr' in redisUrlOrInstance) {
        // It's a Redis client (or mock) - wrap it with proper interface
        this.redis = redisUrlOrInstance;
      } else {
        // It's a URL string - use Redis with fallback
        this.redis = createAuthRedis(typeof redisUrlOrInstance === 'string' ? redisUrlOrInstance : undefined);
      }
    } else {
      // Use Redis with fallback for high availability
      this.redis = createAuthRedis();
    }
  }

  async checkLockout(
    email: string,
    ipAddress?: string
  ): Promise<{
    locked: boolean;
    remainingAttempts: number;
    lockoutEndTime: Date | null;
  }> {
    const emailKey = `${REDIS_KEY_PREFIXES.LOCKOUT_EMAIL}${email}`;
    const ipKey = ipAddress ? `${REDIS_KEY_PREFIXES.LOCKOUT_IP}${ipAddress}` : null;

    const emailState = await this.getLockoutState(emailKey);
    const ipState = ipKey ? await this.getLockoutState(ipKey) : null;

    const now = new Date();

    // Check if currently locked (either by email or IP)
    let lockedUntil: Date | null = null;

    if (emailState?.lockedUntil) {
      const emailLockedUntil = new Date(emailState.lockedUntil);
      if (emailLockedUntil > now) {
        lockedUntil = emailLockedUntil;
      }
    }

    if (ipState?.lockedUntil && !lockedUntil) {
      const ipLockedUntil = new Date(ipState.lockedUntil);
      if (ipLockedUntil > now) {
        lockedUntil = ipLockedUntil;
      }
    }

    // If locked, return lockout info
    if (lockedUntil) {
      return {
        locked: true,
        remainingAttempts: 0,
        lockoutEndTime: lockedUntil,
      };
    }

    // Not locked, return remaining attempts (use the maximum attempts between email and IP)
    const emailAttempts = emailState?.attempts || 0;
    const ipAttempts = ipState?.attempts || 0;
    const currentAttempts = Math.max(emailAttempts, ipAttempts);

    const nextThreshold = SECURITY_CONFIG.lockout.thresholds.find(t =>
      t.attempts > currentAttempts
    );

    if (nextThreshold) {
      return {
        locked: false,
        remainingAttempts: nextThreshold.attempts - currentAttempts,
        lockoutEndTime: null,
      };
    }

    return {
      locked: false,
      remainingAttempts: SECURITY_CONFIG.lockout.thresholds[0].attempts - currentAttempts,
      lockoutEndTime: null,
    };
  }

  async recordFailedAttempt(email: string, ipAddress?: string): Promise<void> {
    const emailKey = `${REDIS_KEY_PREFIXES.LOCKOUT_EMAIL}${email}`;
    const ipKey = ipAddress ? `${REDIS_KEY_PREFIXES.LOCKOUT_IP}${ipAddress}` : null;

    await this.incrementAttempts(emailKey);
    if (ipKey) {
      await this.incrementAttempts(ipKey);
    }
  }

  async resetLockout(email: string, ipAddress?: string): Promise<void> {
    const emailKey = `${REDIS_KEY_PREFIXES.LOCKOUT_EMAIL}${email}`;
    const ipKey = ipAddress ? `${REDIS_KEY_PREFIXES.LOCKOUT_IP}${ipAddress}` : null;

    await this.redis.del(emailKey);
    if (ipKey) {
      await this.redis.del(ipKey);
    }
  }

  private async getLockoutState(key: string): Promise<LockoutState | null> {
    const data = await this.redis.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async incrementAttempts(key: string): Promise<void> {
    const current = await this.redis.incr(key);

    const threshold = SECURITY_CONFIG.lockout.thresholds.find(t =>
      t.attempts === current
    );

    if (threshold) {
      const lockedUntil = new Date(Date.now() + threshold.duration * 1000);
      const state: LockoutState = {
        attempts: current,
        lockedUntil: lockedUntil.toISOString(),
        lastAttempt: new Date().toISOString(),
      };

      await this.redis.setex(key, threshold.duration + 60, JSON.stringify(state));
    } else {
      const state: LockoutState = {
        attempts: current,
        lockedUntil: null,
        lastAttempt: new Date().toISOString(),
      };

      await this.redis.setex(key, 86400, JSON.stringify(state));
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
