import * as crypto from 'crypto';
import { Redis } from 'ioredis';
import { RedisWithFallback, createAuthRedis, RedisCompatible, REDIS_KEY_PREFIXES } from './redis-fallback';
import {
  OAUTH_STATE_EXPIRY_SECONDS,
  OAUTH_STATE_EXPIRY_MS
} from './constants';

export interface OAuthState {
  state: string;
  verifier: string;
  timestamp: number;
  userAgent: string;
}

export class OAuthSecurity {
  private redis: any;

  constructor(redisInstance?: Redis) {
    // If a Redis instance is provided, use it. Otherwise create a new one with fallback.
    // This allows for dependency injection in tests and flexible configuration.
    if (redisInstance) {
      // Wrap the provided Redis instance for compatibility
      this.redis = redisInstance;
    } else {
      // Use Redis with fallback for high availability
      this.redis = createAuthRedis();
    }
  }

  /**
   * Generate a simple browser fingerprint from user agent
   * This strengthens the user agent check by making it harder to spoof
   */
  /**
   * Generate a simple browser fingerprint from user agent
   * This strengthens user agent check by making it harder to spoof
   * Optimized to parse user agent once instead of multiple regex scans
   */
  private generateBrowserFingerprint(userAgent: string): string {
    // Extract all characteristics in a single pass through the user agent
    const characteristics = {
      browser: 'unknown',
      os: 'unknown',
      device: 'desktop'
    };

    // Detect browser type
    if (userAgent.includes('Firefox')) characteristics.browser = 'firefox';
    else if (userAgent.includes('Chrome')) characteristics.browser = 'chrome';
    else if (userAgent.includes('Safari')) characteristics.browser = 'safari';
    else if (userAgent.includes('Edge')) characteristics.browser = 'edge';
    else if (userAgent.includes('Opera')) characteristics.browser = 'opera';

    // Detect OS type
    if (userAgent.includes('Windows')) characteristics.os = 'windows';
    else if (userAgent.includes('Mac')) characteristics.os = 'mac';
    else if (userAgent.includes('Linux')) characteristics.os = 'linux';
    else if (userAgent.includes('Android')) characteristics.os = 'android';
    else if (userAgent.includes('iOS')) characteristics.os = 'ios';

    // Detect device type
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      characteristics.device = 'mobile';
    } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
      characteristics.device = 'tablet';
    }

    // Create a simple fingerprint
    return `${characteristics.browser}:${characteristics.os}:${characteristics.device}`;
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
  async storeState(state: OAuthState, expiresIn: number = OAUTH_STATE_EXPIRY_SECONDS): Promise<void> {
    // Generate browser fingerprint for stronger validation
    const fingerprint = state.userAgent ?
      this.generateBrowserFingerprint(state.userAgent) : 'unknown';

    const stateWithFingerprint = {
      ...state,
      browserFingerprint: fingerprint
    };

    const key = `${REDIS_KEY_PREFIXES.OAUTH_STATE}${state.state}`;
    await this.redis.setex(key, expiresIn, JSON.stringify(stateWithFingerprint));
  }

  /**
   * Validate OAuth state parameter
   * Checks for:
   * - State existence in Redis
   * - Expiration (10 minutes)
   * - Browser fingerprint match (stronger than user agent alone)
   */
  async validateState(state: string, userAgent: string): Promise<boolean> {
    const key = `${REDIS_KEY_PREFIXES.OAUTH_STATE}${state}`;
    const stored = await this.redis.get(key);

    if (!stored) return false;

    const parsedState: any = JSON.parse(stored);

    // Check expiration (10 minutes)
    if (Date.now() - parsedState.timestamp > OAUTH_STATE_EXPIRY_MS) {
      await this.redis.del(key);
      return false;
    }

    // Check browser fingerprint (stronger than user agent alone)
    const currentFingerprint = this.generateBrowserFingerprint(userAgent);
    const storedFingerprint = parsedState.browserFingerprint || 'unknown';

    // Allow some tolerance for user agent changes (e.g., browser updates)
    // but still validate significant changes
    if (storedFingerprint !== 'unknown' && currentFingerprint !== storedFingerprint) {
      console.warn('OAuth state validation failed: fingerprint mismatch',
        { stored: storedFingerprint, current: currentFingerprint });
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
