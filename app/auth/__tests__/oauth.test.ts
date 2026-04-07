// Mock ioredis at the module level
jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
    })),
  };
});

import { OAuthSecurity } from '@/lib/auth/oauth-security';
import { Redis } from 'ioredis';
import { mockRedis } from './helpers/mocks';

describe('OAuthSecurity', () => {
  let mockRedisInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mocked instance
    mockRedisInstance = new Redis();
  });

  it('should generate cryptographically secure state', () => {
    const oauth = new OAuthSecurity(mockRedisInstance);
    const state = oauth.generateOAuthState();

    expect(state.state).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(state.state.length).toBe(43);
    expect(state.verifier).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(state.verifier.length).toBe(43);
    expect(state.timestamp).toBeGreaterThan(0);
    expect(state.userAgent).toBe('');
  });

  it('should validate correct state', async () => {
    const oauth = new OAuthSecurity(mockRedisInstance);
    const state = oauth.generateOAuthState();
    state.userAgent = 'test-agent';

    const storedState = JSON.stringify(state);
    mockRedisInstance.get.mockResolvedValue(storedState);

    const isValid = await oauth.validateState(state.state, 'test-agent');

    expect(isValid).toBe(true);
    expect(mockRedisInstance.get).toHaveBeenCalledWith(`oauth:state:${state.state}`);
    expect(mockRedisInstance.del).toHaveBeenCalledWith(`oauth:state:${state.state}`);
  });

  it('should reject invalid state', async () => {
    const oauth = new OAuthSecurity(mockRedisInstance);
    mockRedisInstance.get.mockResolvedValue(null);

    const isValid = await oauth.validateState('invalid-state', 'test-agent');

    expect(isValid).toBe(false);
  });

  it('should reject expired state', async () => {
    const oauth = new OAuthSecurity(mockRedisInstance);
    const state = oauth.generateOAuthState();
    state.userAgent = 'test-agent';
    state.timestamp = Date.now() - 700000; // More than 10 minutes ago

    const storedState = JSON.stringify(state);
    mockRedisInstance.get.mockResolvedValue(storedState);

    const isValid = await oauth.validateState(state.state, 'test-agent');

    expect(isValid).toBe(false);
    expect(mockRedisInstance.del).toHaveBeenCalledWith(`oauth:state:${state.state}`);
  });

  it('should reject state with different user agent', async () => {
    const oauth = new OAuthSecurity(mockRedisInstance);
    const state = oauth.generateOAuthState();
    state.userAgent = 'original-agent';

    const storedState = JSON.stringify(state);
    mockRedisInstance.get.mockResolvedValue(storedState);

    const isValid = await oauth.validateState(state.state, 'different-agent');

    expect(isValid).toBe(false);
    expect(mockRedisInstance.del).toHaveBeenCalledWith(`oauth:state:${state.state}`);
  });

  it('should store state with expiration', async () => {
    const oauth = new OAuthSecurity(mockRedisInstance);
    const state = oauth.generateOAuthState();

    await oauth.storeState(state, 600);

    expect(mockRedisInstance.setex).toHaveBeenCalledWith(
      `oauth:state:${state.state}`,
      600,
      JSON.stringify(state)
    );
  });

  it('should generate PKCE challenge', () => {
    const oauth = new OAuthSecurity(mockRedisInstance);
    const pkce = oauth.generatePKCE();

    expect(pkce.verifier).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(pkce.verifier.length).toBe(43);
    expect(pkce.challenge).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(pkce.challenge.length).toBe(43);
    expect(pkce.challenge).not.toBe(pkce.verifier);
  });

  it('should work without Redis instance (fallback to default)', () => {
    const oauth = new OAuthSecurity();
    const state = oauth.generateOAuthState();

    expect(state.state).toBeDefined();
    expect(state.verifier).toBeDefined();
  });

  it('should disconnect Redis instance', async () => {
    const oauth = new OAuthSecurity(mockRedisInstance);

    await oauth.disconnect();

    expect(mockRedisInstance.quit).toHaveBeenCalled();
  });
});
