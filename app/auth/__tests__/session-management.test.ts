import { CheckSessionTimeout } from '@/lib/auth/session-manager';
import { mockSupabaseClient } from './helpers/mocks';

describe('Session Management', () => {
  let mockActivityTracker: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockActivityTracker = {
      isSessionValid: jest.fn(),
      getTimeUntilExpiry: jest.fn(),
      handleExpiredSession: jest.fn(),
      clearActivity: jest.fn(),
    };
  });

  it('should detect expired sessions', async () => {
    const mockClient = {
      ...mockSupabaseClient,
      auth: {
        ...mockSupabaseClient.auth,
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: 'test-user',
                last_sign_in_at: new Date(Date.now() - 2000000).toISOString()
              }
            }
          },
          error: null
        }),
        signOut: jest.fn().mockResolvedValue({ error: null })
      }
    };

    mockActivityTracker.isSessionValid.mockResolvedValue(false);

    const sessionManager = new CheckSessionTimeout(mockClient as any, mockActivityTracker);
    const result = await sessionManager.checkSessionTimeout(mockClient as any);

    expect(result.expired).toBe(true);
    expect(result.warning).toBeNull();
  });

  it('should return timeout warning for expiring sessions', async () => {
    const mockClient = {
      ...mockSupabaseClient,
      auth: {
        ...mockSupabaseClient.auth,
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: 'test-user',
                // 25 minutes ago - within warning threshold (30 min timeout, 5 min warning)
                last_sign_in_at: new Date(Date.now() - 1500000).toISOString()
              }
            }
          },
          error: null
        }),
        signOut: jest.fn().mockResolvedValue({ error: null })
      }
    };

    mockActivityTracker.isSessionValid.mockResolvedValue(true);
    mockActivityTracker.getTimeUntilExpiry.mockResolvedValue(300000); // 5 minutes in ms

    const sessionManager = new CheckSessionTimeout(mockClient as any, mockActivityTracker);
    const result = await sessionManager.checkSessionTimeout(mockClient as any);

    expect(result.expired).toBe(false);
    expect(result.warning).not.toBeNull();
    expect(result.warning).toBeGreaterThan(0);
    expect(result.warning).toBeLessThanOrEqual(300); // Should be within 5 minutes (300 seconds)
  });

  it('should reset expired sessions and sign out user', async () => {
    const mockClient = {
      ...mockSupabaseClient,
      auth: {
        ...mockSupabaseClient.auth,
        signOut: jest.fn().mockResolvedValue({ error: null }),
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: 'test-user',
              last_sign_in_at: new Date(Date.now() - 2000000).toISOString()
            }
          },
          error: null
        }),
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: 'test-user',
                last_sign_in_at: new Date(Date.now() - 2000000).toISOString()
              }
            }
          },
          error: null
        })
      }
    };

    mockActivityTracker.clearActivity.mockResolvedValue(undefined);

    const sessionManager = new CheckSessionTimeout(mockClient as any, mockActivityTracker);
    await sessionManager.handleExpiredSession(mockClient as any);

    expect(mockClient.auth.signOut).toHaveBeenCalledTimes(1);
    expect(mockActivityTracker.clearActivity).toHaveBeenCalledWith('test-user');
  });

  it('should handle sessions that are not expired', async () => {
    const mockClient = {
      ...mockSupabaseClient,
      auth: {
        ...mockSupabaseClient.auth,
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: 'test-user',
                last_sign_in_at: new Date(Date.now() - 100000).toISOString()
              }
            }
          },
          error: null
        }),
        signOut: jest.fn().mockResolvedValue({ error: null })
      }
    };

    mockActivityTracker.isSessionValid.mockResolvedValue(true);
    mockActivityTracker.getTimeUntilExpiry.mockResolvedValue(1000000); // Plenty of time

    const sessionManager = new CheckSessionTimeout(mockClient as any, mockActivityTracker);
    const result = await sessionManager.checkSessionTimeout(mockClient as any);

    expect(result.expired).toBe(false);
    expect(result.warning).toBeNull();
  });

  it('should handle sessions that are exactly at warning threshold', async () => {
    const mockClient = {
      ...mockSupabaseClient,
      auth: {
        ...mockSupabaseClient.auth,
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: 'test-user',
                // Exactly at warning threshold (25 minutes ago = 5 minutes until expiration)
                last_sign_in_at: new Date(Date.now() - 1500000).toISOString()
              }
            }
          },
          error: null
        }),
        signOut: jest.fn().mockResolvedValue({ error: null })
      }
    };

    mockActivityTracker.isSessionValid.mockResolvedValue(true);
    mockActivityTracker.getTimeUntilExpiry.mockResolvedValue(300000); // Exactly 5 minutes (300000 ms)

    const sessionManager = new CheckSessionTimeout(mockClient as any, mockActivityTracker);
    const result = await sessionManager.checkSessionTimeout(mockClient as any);

    expect(result.expired).toBe(false);
    expect(result.warning).not.toBeNull();
    expect(result.warning).toBeLessThanOrEqual(300); // Should be exactly 300 seconds or less
  });

  it('should handle sessions that are exactly at timeout threshold', async () => {
    const mockClient = {
      ...mockSupabaseClient,
      auth: {
        ...mockSupabaseClient.auth,
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: 'test-user',
                // Exactly at timeout threshold (30 minutes)
                last_sign_in_at: new Date(Date.now() - 1800000).toISOString()
              }
            }
          },
          error: null
        }),
        signOut: jest.fn().mockResolvedValue({ error: null })
      }
    };

    mockActivityTracker.isSessionValid.mockResolvedValue(false);

    const sessionManager = new CheckSessionTimeout(mockClient as any, mockActivityTracker);
    const result = await sessionManager.checkSessionTimeout(mockClient as any);

    expect(result.expired).toBe(true);
    expect(result.warning).toBeNull();
  });
});
