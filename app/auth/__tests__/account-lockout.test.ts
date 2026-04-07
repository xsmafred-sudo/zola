// Mock ioredis at the module level
jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
    })),
  };
});

import { AccountLockout } from '@/lib/auth/account-lockout';
import { Redis } from 'ioredis';
import { SECURITY_CONFIG } from '@/lib/config';

describe('AccountLockout', () => {
  let mockRedisInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mocked instance
    mockRedisInstance = new Redis();
  });

  it('should lock account after threshold attempts', async () => {
    const lockedUntil = new Date(Date.now() + 900000).toISOString();
    mockRedisInstance.get.mockResolvedValue(JSON.stringify({
      attempts: 5,
      lockedUntil: lockedUntil,
      lastAttempt: new Date().toISOString()
    }));

    const lockout = new AccountLockout(mockRedisInstance);
    const result = await lockout.checkLockout('user@example.com');

    expect(result.locked).toBe(true);
    expect(result.remainingAttempts).toBe(0);
    expect(result.lockoutEndTime).not.toBeNull();
  });

  it('should not lock account below threshold', async () => {
    mockRedisInstance.get.mockResolvedValue(JSON.stringify({
      attempts: 2,
      lockedUntil: null,
      lastAttempt: new Date().toISOString()
    }));

    const lockout = new AccountLockout(mockRedisInstance);
    const result = await lockout.checkLockout('user@example.com');

    expect(result.locked).toBe(false);
    expect(result.remainingAttempts).toBeGreaterThan(0);
    expect(result.lockoutEndTime).toBeNull();
  });

  it('should reset lockout on successful login', async () => {
    const lockout = new AccountLockout(mockRedisInstance);

    await lockout.resetLockout('user@example.com');

    expect(mockRedisInstance.del).toHaveBeenCalledTimes(1);
    expect(mockRedisInstance.del).toHaveBeenCalledWith('lockout:email:user@example.com');
  });

  it('should record failed attempts', async () => {
    mockRedisInstance.incr.mockResolvedValue(3);

    const lockout = new AccountLockout(mockRedisInstance);
    await lockout.recordFailedAttempt('user@example.com');

    expect(mockRedisInstance.incr).toHaveBeenCalledTimes(1);
    expect(mockRedisInstance.incr).toHaveBeenCalledWith('lockout:email:user@example.com');
  });

  it('should handle expired lockouts', async () => {
    const expiredDate = new Date(Date.now() - 100000).toISOString();
    mockRedisInstance.get.mockResolvedValue(JSON.stringify({
      attempts: 5,
      lockedUntil: expiredDate,
      lastAttempt: new Date().toISOString()
    }));

    const lockout = new AccountLockout(mockRedisInstance);
    const result = await lockout.checkLockout('user@example.com');

    expect(result.locked).toBe(false);
  });

  it('should handle no existing lockout state', async () => {
    mockRedisInstance.get.mockResolvedValue(null);

    const lockout = new AccountLockout(mockRedisInstance);
    const result = await lockout.checkLockout('user@example.com');

    expect(result.locked).toBe(false);
    expect(result.remainingAttempts).toBe(SECURITY_CONFIG.lockout.thresholds[0].attempts);
  });
});
