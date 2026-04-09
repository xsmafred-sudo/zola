// Mock ioredis at the module level
jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({
      get: jest.fn().mockReturnValue(Promise.resolve(null)),
      setex: jest.fn().mockReturnValue(Promise.resolve('OK')),
      del: jest.fn().mockReturnValue(Promise.resolve(1)),
      quit: jest.fn().mockReturnValue(Promise.resolve('OK')),
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
    state.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124';

    // Use storeState to ensure correct format including fingerprint
    await oauth.storeState(state);

    // Get what was stored to mock the get call
    const storedData = mockRedisInstance.setex.mock.calls[0][2];
    mockRedisInstance.get.mockReturnValue(Promise.resolve(storedData));

    const isValid = await oauth.validateState(state.state, state.userAgent);

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
    state.userAgent = 'Mozilla/5.0';
    state.timestamp = Date.now() - 700000; // More than 10 minutes ago

    await oauth.storeState(state);
    const storedData = JSON.parse(mockRedisInstance.setex.mock.calls[0][2]);
    storedData.timestamp = state.timestamp; // Manually age it
    mockRedisInstance.get.mockReturnValue(Promise.resolve(JSON.stringify(storedData)));

    const isValid = await oauth.validateState(state.state, 'Mozilla/5.0');

    expect(isValid).toBe(false);
    expect(mockRedisInstance.del).toHaveBeenCalledWith(`oauth:state:${state.state}`);
  });

  it('should reject state with different user agent', async () => {
    const oauth = new OAuthSecurity(mockRedisInstance);
    const state = oauth.generateOAuthState();
    state.userAgent = 'Mozilla/5.0 Firefox/89.0'; // Original agent

    await oauth.storeState(state);
    const storedData = mockRedisInstance.setex.mock.calls[0][2];
    mockRedisInstance.get.mockReturnValue(Promise.resolve(storedData));

    // Current agent is different enough to change fingerprint
    const isValid = await oauth.validateState(state.state, 'Mozilla/5.0 Chrome/91.0');

    expect(isValid).toBe(false);
    expect(mockRedisInstance.del).toHaveBeenCalledWith(`oauth:state:${state.state}`);
  });

  it('should store state with expiration', async () => {
    const oauth = new OAuthSecurity(mockRedisInstance);
    const state = oauth.generateOAuthState();
    state.userAgent = 'test-agent';

    await oauth.storeState(state, 600);

    expect(mockRedisInstance.setex).toHaveBeenCalledWith(
      `oauth:state:${state.state}`,
      600,
      expect.stringContaining(`"state":"${state.state}"`)
    );
    expect(mockRedisInstance.setex).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number),
      expect.stringContaining('"browserFingerprint"')
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
