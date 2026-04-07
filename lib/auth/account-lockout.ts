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
    email: string
  ): Promise<{
    locked: boolean;
    remainingAttempts: number;
    lockoutEndTime: Date | null;
  }> {
    const emailKey = `lockout:email:${email}`;

    const emailState = await this.getLockoutState(emailKey);

    const now = new Date();

    // Check if currently locked
    if (emailState?.lockedUntil) {
      const lockedUntil = new Date(emailState.lockedUntil);
      if (lockedUntil > now) {
        return {
          locked: true,
          remainingAttempts: 0,
          lockoutEndTime: lockedUntil,
        };
      }
    }

    // Not locked, return remaining attempts
    const currentAttempts = (emailState?.attempts || 0);
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

  async recordFailedAttempt(email: string): Promise<void> {
    const emailKey = `lockout:email:${email}`;
    await this.incrementAttempts(emailKey);
  }

  async resetLockout(email: string): Promise<void> {
    const emailKey = `lockout:email:${email}`;
    await this.redis.del(emailKey);
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
