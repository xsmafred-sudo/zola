import * as crypto from 'crypto';
import { Redis } from 'ioredis';

export interface OAuthState {
  state: string;
  verifier: string;
  timestamp: number;
  userAgent: string;
}

export class OAuthSecurity {
  private redis: Redis;

  constructor(redisInstance?: Redis) {
    // If a Redis instance is provided, use it. Otherwise create a new one.
    // This allows for dependency injection in tests and flexible configuration.
    if (redisInstance) {
      this.redis = redisInstance;
    } else {
      const redisUrl = process.env.REDIS_URL;
      this.redis = new Redis(redisUrl);
    }
  }

  /**
   * Generate a cryptographically secure OAuth state parameter
   */
  generateOAuthState(): OAuthState {
    const state = crypto.randomBytes(32).toString('base64url');
    const verifier = crypto.randomBytes(32).toString('base64url');
    const timestamp = Date.now();

    return {
      state,
      verifier,
      timestamp,
      userAgent: '', // Will be set from request
    };
  }

  /**
   * Store OAuth state in Redis with expiration
   */
  async storeState(state: OAuthState, expiresIn: number = 600): Promise<void> {
    const key = `oauth:state:${state.state}`;
    await this.redis.setex(key, expiresIn, JSON.stringify(state));
  }

  /**
   * Validate OAuth state parameter
   * Checks for:
   * - State existence in Redis
   * - Expiration (10 minutes)
   * - User agent match (prevents session hijacking)
   */
  async validateState(state: string, userAgent: string): Promise<boolean> {
    const key = `oauth:state:${state}`;
    const stored = await this.redis.get(key);

    if (!stored) return false;

    const parsedState: OAuthState = JSON.parse(stored);

    // Check expiration (10 minutes = 600000ms)
    if (Date.now() - parsedState.timestamp > 600000) {
      await this.redis.del(key);
      return false;
    }

    // Check user agent (prevent session hijacking)
    if (parsedState.userAgent !== userAgent) {
      await this.redis.del(key);
      return false;
    }

    // Clean up used state to prevent replay attacks
    await this.redis.del(key);
    return true;
  }

  /**
   * Generate PKCE (Proof Key for Code Exchange) verifier and challenge
   * Uses SHA-256 for the code challenge
   */
  generatePKCE(): { verifier: string; challenge: string } {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');

    return { verifier, challenge };
  }

  /**
   * Disconnect Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
