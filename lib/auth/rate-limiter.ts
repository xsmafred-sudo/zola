import { Redis } from 'ioredis';
import { SECURITY_CONFIG } from '@/lib/config';
import { RedisWithFallback, createAuthRedis, RedisCompatible, REDIS_KEY_PREFIXES } from './redis-fallback';

interface RateLimitConfig {
  points: number;
  duration: number;
  blockDuration: number;
}

export class RateLimiter {
  private redis: any;

  constructor(redisOrUrl?: Redis | string) {
    if (redisOrUrl && typeof redisOrUrl === 'object' && 'incr' in redisOrUrl) {
      // Duck typing check - if it has an incr method, it's a Redis client (or mock)
      this.redis = redisOrUrl;
    } else {
      // Use Redis with fallback for high availability
      this.redis = createAuthRedis(typeof redisOrUrl === 'string' ? redisOrUrl : undefined);
    }
  }

  async checkLimit(
    identifier: string,
    type: 'login' | 'signup' | 'passwordReset' | 'oauth'
  ): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    const config = SECURITY_CONFIG.rateLimiting[type];
    const key = `${REDIS_KEY_PREFIXES.RATE_LIMIT}${type}:${identifier}`;

    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, config.duration);
    }

    if (current > config.points) {
      const blockedKey = `${REDIS_KEY_PREFIXES.RATE_LIMIT_BLOCKED}${type}:${identifier}`;
      const blocked = await this.redis.get(blockedKey);

      if (!blocked) {
        await this.redis.setex(blockedKey, config.blockDuration, '1');
      }

      const resetTime = new Date(Date.now() + config.blockDuration * 1000);
      return {
        allowed: false,
        remaining: 0,
        resetTime
      };
    }

    return {
      allowed: true,
      remaining: config.points - current,
      resetTime: new Date(Date.now() + config.duration * 1000)
    };
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
