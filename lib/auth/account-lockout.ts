import { Redis } from 'ioredis';
import { SECURITY_CONFIG } from '@/lib/config';

interface LockoutState {
  attempts: number;
  lockedUntil: string | null;
  lastAttempt: string;
}

export class AccountLockout {
  private redis: Redis;

  constructor(redisUrlOrInstance?: string | Redis) {
    if (redisUrlOrInstance) {
      if (typeof redisUrlOrInstance === 'object' && 'incr' in redisUrlOrInstance) {
        // It's a Redis client (or mock)
        this.redis = redisUrlOrInstance as Redis;
      } else {
        // It's a URL string
        this.redis = new Redis(redisUrlOrInstance as string);
      }
    } else {
      const url = process.env.REDIS_URL;
      if (!url) {
        throw new Error('Redis URL is required');
      }
      this.redis = new Redis(url);
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
    const emailKey = `lockout:email:${email}`;
    const ipKey = ipAddress ? `lockout:ip:${ipAddress}` : null;

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
    const emailKey = `lockout:email:${email}`;
    const ipKey = ipAddress ? `lockout:ip:${ipAddress}` : null;

    await this.incrementAttempts(emailKey);
    if (ipKey) {
      await this.incrementAttempts(ipKey);
    }
  }

  async resetLockout(email: string, ipAddress?: string): Promise<void> {
    const emailKey = `lockout:email:${email}`;
    const ipKey = ipAddress ? `lockout:ip:${ipAddress}` : null;

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
