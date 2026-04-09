import { ActivityTracker } from '../activity-tracker';
import { RedisWithFallback } from '../redis-fallback';

// Mock the Redis instance
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
} as unknown as RedisWithFallback;

describe('ActivityTracker', () => {
  let tracker: ActivityTracker;
  const userId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    tracker = new ActivityTracker(mockRedis);
  });

  describe('recordActivity', () => {
    it('should store user activity in Redis with correct TTL', async () => {
      await tracker.recordActivity(userId, '127.0.0.1', 'Mozilla/5.0');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `user_activity:${userId}`,
        expect.any(Number),
        expect.stringContaining('"userId":"user-123"')
      );
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.stringContaining('"ipAddress":"127.0.0.1"')
      );
    });
  });

  describe('isSessionValid', () => {
    it('should return true if activity is within timeout', async () => {
      const recentActivity = {
        userId,
        lastActivity: Date.now() - 1000, // 1 second ago
      };
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(recentActivity));

      const isValid = await tracker.isSessionValid(userId);
      expect(isValid).toBe(true);
    });

    it('should return false if activity is beyond timeout', async () => {
      const oldActivity = {
        userId,
        lastActivity: Date.now() - 10000000, // Long ago
      };
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(oldActivity));

      const isValid = await tracker.isSessionValid(userId);
      expect(isValid).toBe(false);
    });

    it('should return false if no activity record exists', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(null);

      const isValid = await tracker.isSessionValid(userId);
      expect(isValid).toBe(false);
    });
  });

  describe('getTimeUntilExpiry', () => {
    it('should return the remaining time in ms', async () => {
      const halfExpired = {
        userId,
        lastActivity: Date.now() - (30 * 60 * 1000) / 2, // Halfway through a 30 min session
      };
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(halfExpired));

      const timeUntil = await tracker.getTimeUntilExpiry(userId);
      expect(timeUntil).toBeGreaterThan(0);
      expect(timeUntil).toBeLessThan(30 * 60 * 1000);
    });

    it('should return 0 if session is fully expired', async () => {
      const expired = {
        userId,
        lastActivity: Date.now() - 40 * 60 * 1000, // 40 min ago
      };
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(expired));

      const timeUntil = await tracker.getTimeUntilExpiry(userId);
      expect(timeUntil).toBe(0);
    });
  });

  describe('clearActivity', () => {
    it('should delete the activity key from Redis', async () => {
      await tracker.clearActivity(userId);
      expect(mockRedis.del).toHaveBeenCalledWith(`user_activity:${userId}`);
    });
  });
});
