// Mock ioredis at the module level
jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockResolvedValue('OK'),
    })),
  };
});

import { RateLimiter } from '@/lib/auth/rate-limiter';
import { Redis } from 'ioredis';

describe('RateLimiter', () => {
  let mockRedisInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mocked instance
    mockRedisInstance = new Redis();
  });

  it('should block requests after exceeding limit', async () => {
    mockRedisInstance.incr.mockResolvedValue(6); // Exceeds limit of 5
    mockRedisInstance.get.mockResolvedValue(null);

    const limiter = new RateLimiter(mockRedisInstance);
    const result = await limiter.checkLimit('user@example.com', 'login');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should allow requests within limit', async () => {
    mockRedisInstance.incr.mockResolvedValue(3); // Within limit of 5

    const limiter = new RateLimiter(mockRedisInstance);
    const result = await limiter.checkLimit('user@example.com', 'login');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should set expiration on first request', async () => {
    mockRedisInstance.incr.mockResolvedValue(1);

    const limiter = new RateLimiter(mockRedisInstance);
    await limiter.checkLimit('user@example.com', 'login');

    expect(mockRedisInstance.expire).toHaveBeenCalledWith(
      'ratelimit:login:user@example.com',
      900
    );
  });
});
