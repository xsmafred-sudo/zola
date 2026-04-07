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
    const result = await lockout.checkLockout('user@example.com', '192.168.1.1');

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
    const result = await lockout.checkLockout('user@example.com', '192.168.1.1');

    expect(result.locked).toBe(false);
    expect(result.remainingAttempts).toBeGreaterThan(0);
    expect(result.lockoutEndTime).toBeNull();
  });

  it('should reset lockout on successful login', async () => {
    const lockout = new AccountLockout(mockRedisInstance);

    await lockout.resetLockout('user@example.com', '192.168.1.1');

    expect(mockRedisInstance.del).toHaveBeenCalledTimes(2);
    expect(mockRedisInstance.del).toHaveBeenCalledWith('lockout:email:user@example.com');
    expect(mockRedisInstance.del).toHaveBeenCalledWith('lockout:ip:192.168.1.1');
  });

  it('should record failed attempts', async () => {
    mockRedisInstance.incr.mockResolvedValue(3);

    const lockout = new AccountLockout(mockRedisInstance);
    await lockout.recordFailedAttempt('user@example.com', '192.168.1.1');

    expect(mockRedisInstance.incr).toHaveBeenCalledTimes(2);
    expect(mockRedisInstance.incr).toHaveBeenCalledWith('lockout:email:user@example.com');
    expect(mockRedisInstance.incr).toHaveBeenCalledWith('lockout:ip:192.168.1.1');
  });

  it('should handle expired lockouts', async () => {
    const expiredDate = new Date(Date.now() - 100000).toISOString();
    mockRedisInstance.get.mockResolvedValue(JSON.stringify({
      attempts: 5,
      lockedUntil: expiredDate,
      lastAttempt: new Date().toISOString()
    }));

    const lockout = new AccountLockout(mockRedisInstance);
    const result = await lockout.checkLockout('user@example.com', '192.168.1.1');

    expect(result.locked).toBe(false);
  });

  it('should handle no existing lockout state', async () => {
    mockRedisInstance.get.mockResolvedValue(null);

    const lockout = new AccountLockout(mockRedisInstance);
    const result = await lockout.checkLockout('user@example.com', '192.168.1.1');

    expect(result.locked).toBe(false);
    expect(result.remainingAttempts).toBe(SECURITY_CONFIG.lockout.thresholds[0].attempts);
  });

  it('should handle IP-based lockout', async () => {
    const lockedUntil = new Date(Date.now() + 900000).toISOString();
    mockRedisInstance.get.mockImplementation((key: string) => {
      if (key.includes('email')) {
        return Promise.resolve(JSON.stringify({
          attempts: 2,
          lockedUntil: null,
          lastAttempt: new Date().toISOString()
        }));
      } else if (key.includes('ip')) {
        return Promise.resolve(JSON.stringify({
          attempts: 5,
          lockedUntil: lockedUntil,
          lastAttempt: new Date().toISOString()
        }));
      }
      return Promise.resolve(null);
    });

    const lockout = new AccountLockout(mockRedisInstance);
    const result = await lockout.checkLockout('user@example.com', '192.168.1.1');

    expect(result.locked).toBe(true);
    expect(result.remainingAttempts).toBe(0);
    expect(result.lockoutEndTime).not.toBeNull();
  });

  it('should work without IP address', async () => {
    mockRedisInstance.get.mockResolvedValue(null);

    const lockout = new AccountLockout(mockRedisInstance);
    const result = await lockout.checkLockout('user@example.com');

    expect(result.locked).toBe(false);
    expect(result.remainingAttempts).toBe(SECURITY_CONFIG.lockout.thresholds[0].attempts);
  });

  it('should use maximum attempts from email and IP', async () => {
    mockRedisInstance.get.mockImplementation((key: string) => {
      if (key.includes('email')) {
        return Promise.resolve(JSON.stringify({
          attempts: 4,
          lockedUntil: null,
          lastAttempt: new Date().toISOString()
        }));
      } else if (key.includes('ip')) {
        return Promise.resolve(JSON.stringify({
          attempts: 3,
          lockedUntil: null,
          lastAttempt: new Date().toISOString()
        }));
      }
      return Promise.resolve(null);
    });

    const lockout = new AccountLockout(mockRedisInstance);
    const result = await lockout.checkLockout('user@example.com', '192.168.1.1');

    expect(result.locked).toBe(false);
    expect(result.remainingAttempts).toBeGreaterThan(0);
    // Should use the maximum of email (4) and IP (3) attempts
    // With thresholds [3, 5], the next threshold after 4 is 5, so remaining is 1
    expect(result.remainingAttempts).toBe(1);
  });
});
