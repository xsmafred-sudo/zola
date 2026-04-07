import { jest } from '@jest/globals';

// Mock Redis client
export const mockRedis = {
  incr: jest.fn<() => Promise<number>>().mockResolvedValue(1),
  expire: jest.fn<() => Promise<'OK'>>().mockResolvedValue('OK'),
  get: jest.fn<() => Promise<null>>().mockResolvedValue(null),
  setex: jest.fn<() => Promise<'OK'>>().mockResolvedValue('OK'),
  del: jest.fn<() => Promise<number>>().mockResolvedValue(1),
};

// Mock Supabase client
export const mockSupabaseClient = {
  auth: {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signInWithOAuth: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    updateUser: jest.fn(),
    exchangeCodeForSession: jest.fn(),
    getUser: jest.fn(),
  },
  from: jest.fn().mockReturnValue({
    insert: jest.fn<() => Promise<{ error: null }>>().mockResolvedValue({ error: null }),
    select: jest.fn<() => Promise<{ data: unknown[]; error: null }>>().mockResolvedValue({ data: [], error: null }),
  }),
};

export const createMockRequest = (overrides: Record<string, unknown> = {}) => ({
  headers: new Map([
    ['user-agent', 'test-agent'],
    ['x-forwarded-for', '127.0.0.1'],
  ]),
  ...overrides,
});
