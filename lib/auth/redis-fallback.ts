/**
 * Interface for Redis-compatible objects to enable proper type safety
 * Allows both real Redis clients and fallback implementations
 * Using partial interface to be flexible with different Redis client implementations
 */
export interface RedisCompatible {
  get?(key: string): Promise<any>;
  set?(key: string, value: string): Promise<any>;
  incr?(key: string): Promise<any>;
  expire?(key: string, ttl: number): Promise<any>;
  del?(key: string): Promise<any>;
  setex?(key: string, ttl: number, value: string): Promise<any>;
  ping?(): Promise<any>;
  quit?(): Promise<any>;
  disconnect?(): any;
}

/**
 * Redis key prefixes
 * Consistent prefixes for Redis keys to avoid collisions
 */
export const REDIS_KEY_PREFIXES = {
  USER_ACTIVITY: 'user_activity:',
  OAUTH_STATE: 'oauth:state:',
  RATE_LIMIT: 'ratelimit:',
  LOCKOUT_EMAIL: 'lockout:email:',
  LOCKOUT_IP: 'lockout:ip:',
  RATE_LIMIT_BLOCKED: 'ratelimit:blocked:',
} as const;

/**
 * Default Redis TTL
 * Default time-to-live for Redis keys when not specified
 */
const DEFAULT_REDIS_TTL_SECONDS = 3600; // 1 hour

/**
 * In-memory fallback store for when Redis is unavailable
 * Provides graceful degradation for auth security features
 */

interface StoredValue {
  value: string;
  expiresAt: number;
}

class InMemoryStore {
  private store: Map<string, StoredValue> = new Map();

  async set(key: string, value: string, ttl: number): Promise<void> {
    const expiresAt = Date.now() + (ttl * 1000);
    this.store.set(key, { value, expiresAt });
    this.cleanup();
  }

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  async incr(key: string): Promise<number> {
    const item = this.store.get(key);
    const current = item ? parseInt(item.value) : 0;
    const newValue = current + 1;

    // Default TTL of 1 hour for increments
    const ttl = item ? 3600 : DEFAULT_REDIS_TTL_SECONDS;
    await this.set(key, newValue.toString(), ttl);

    return newValue;
  }

  async expire(key: string, ttl: number): Promise<void> {
    const item = this.store.get(key);
    if (item) {
      const expiresAt = Date.now() + (ttl * 1000);
      this.store.set(key, { ...item, expiresAt });
    }
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.set(key, value, ttl);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (now > item.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Redis client wrapper with in-memory fallback
 * Provides high availability by gracefully degrading when Redis is unavailable
 */
export class RedisWithFallback {
  private redis: RedisCompatible | null;
  private fallback: InMemoryStore;
  private isRedisAvailable: boolean = true;
  private redisUrl?: string;

  constructor(redisUrl?: string) {
    this.redisUrl = redisUrl || process.env.REDIS_URL;
    this.fallback = new InMemoryStore();
    this.redis = null; // Initialize to null

    if (this.redisUrl) {
      this.initializeRedis();
    } else {
      console.warn('Redis URL not configured, using in-memory fallback');
      this.isRedisAvailable = false;
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      // Dynamically import Redis to avoid errors when not installed
      const { default: Redis } = await import('ioredis');
      this.redis = new Redis(this.redisUrl!);
      await this.testRedisConnection();
    } catch (error) {
      console.warn('Redis package not available, using in-memory fallback:', error instanceof Error ? error.message : String(error));
      this.isRedisAvailable = false;
    }
  }

  private async testRedisConnection(): Promise<void> {
    if (!this.redis || !this.redis.ping) return;

    try {
      await this.redis.ping();
      this.isRedisAvailable = true;
      console.log('Redis connection established successfully');
    } catch (error) {
      console.warn('Redis connection failed, switching to in-memory fallback:', error instanceof Error ? error.message : String(error));
      this.isRedisAvailable = false;
    }
  }

  /**
   * Get value from Redis or fallback
   */
  async get(key: string): Promise<string | null> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const result = await this.redis.get!(key);
        return result;
      } catch (error) {
        console.warn('Redis get failed, using fallback:', error instanceof Error ? error.message : String(error));
        this.isRedisAvailable = false;
        // Continue to fallback
      }
    }
    return this.fallback.get(key);
  }

  /**
   * Set value in Redis or fallback
   */
  async set(key: string, value: string): Promise<void> {
    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.set!(key, value);
        return;
      } catch (error) {
        console.warn('Redis set failed, using fallback:', error instanceof Error ? error.message : String(error));
        this.isRedisAvailable = false;
        // Continue to fallback
      }
    }
    await this.fallback.set(key, value, 3600); // Default 1 hour TTL
  }

  /**
   * Increment counter in Redis or fallback
   */
  async incr(key: string): Promise<number> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const result = await this.redis.incr!(key);
        return result;
      } catch (error) {
        console.warn('Redis incr failed, using fallback:', error instanceof Error ? error.message : String(error));
        this.isRedisAvailable = false;
        // Continue to fallback
      }
    }
    return this.fallback.incr(key);
  }

  /**
   * Set expiration on key in Redis or fallback
   */
  async expire(key: string, ttl: number): Promise<void> {
    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.expire!(key, ttl);
        return;
      } catch (error) {
        console.warn('Redis expire failed, using fallback:', error instanceof Error ? error.message : String(error));
        this.isRedisAvailable = false;
        // Continue to fallback
      }
    }
    await this.fallback.expire(key, ttl);
  }

  /**
   * Delete key from Redis or fallback
   */
  async del(key: string): Promise<void> {
    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.del!(key);
        return;
      } catch (error) {
        console.warn('Redis del failed, using fallback:', error instanceof Error ? error.message : String(error));
        this.isRedisAvailable = false;
        // Continue to fallback
      }
    }
    await this.fallback.del(key);
  }

  /**
   * Set key with expiration in Redis or fallback
   */
  async setex(key: string, ttl: number, value: string): Promise<void> {
    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.setex!(key, ttl, value);
        return;
      } catch (error) {
        console.warn('Redis setex failed, using fallback:', error instanceof Error ? error.message : String(error));
        this.isRedisAvailable = false;
        // Continue to fallback
      }
    }
    await this.fallback.setex(key, ttl, value);
  }

  /**
   * Check Redis health status
   */
  isAvailable(): boolean {
    return this.isRedisAvailable;
  }

  /**
   * Manually trigger Redis reconnection attempt
   */
  async reconnect(): Promise<void> {
    if (this.redisUrl && this.redis) {
      await this.testRedisConnection();
    }
  }

  /**
   * Clean shutdown using quit (waits for pending commands)
   */
  async quit(): Promise<void> {
    if (this.redis && this.isRedisAvailable && this.redis.quit) {
      try {
        await this.redis.quit();
      } catch (error) {
        console.error('Error quitting Redis:', error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Clean shutdown using disconnect (immediate)
   */
  async disconnect(): Promise<void> {
    if (this.redis && this.isRedisAvailable && this.redis.disconnect) {
      try {
        await this.redis.disconnect();
      } catch (error) {
        console.error('Error disconnecting Redis:', error instanceof Error ? error.message : String(error));
      }
    }
  }
}

/**
 * Create a Redis client with fallback for auth security components
 */
export function createAuthRedis(redisUrl?: string): RedisWithFallback {
  return new RedisWithFallback(redisUrl);
}