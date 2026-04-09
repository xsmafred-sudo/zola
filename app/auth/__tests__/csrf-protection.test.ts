import { generateCsrfToken, validateCsrfToken } from '@/lib/csrf';
import { jest } from '@jest/globals';

// Mock the cookies function
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

describe('CSRF Protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate valid CSRF token', () => {
    const token = generateCsrfToken();

    expect(token).toMatch(/^[a-f0-9]{64}:[a-f0-9]{64}$/);
    expect(token.length).toBe(129); // 64 chars + colon + 64 chars
  });

  it('should validate correct CSRF token', () => {
    const token = generateCsrfToken();
    const isValid = validateCsrfToken(token);

    expect(isValid).toBe(true);
  });

  it('should reject invalid CSRF token', () => {
    const token = 'invalid:token';
    const isValid = validateCsrfToken(token);

    expect(isValid).toBe(false);
  });

  it('should rotate CSRF token on successful auth', async () => {
    const { cookies } = await import('next/headers');
    const mockSet = jest.fn();
    const mockCookieStore = {
      set: mockSet,
    };

    (cookies as jest.Mock).mockResolvedValue(mockCookieStore);

    const { rotateCsrfToken } = await import('@/lib/auth/csrf-server');

    const initialToken = generateCsrfToken();
    const result = await rotateCsrfToken();

    expect(result.full).not.toBe(initialToken);
    expect(result.full).toMatch(/^[a-f0-9]{64}:[a-f0-9]{64}$/);
    expect(mockSet).toHaveBeenCalledWith('csrf_token', result.full, expect.objectContaining({
      httpOnly: true, // Updated to match implementation
      secure: true,
      path: '/',
      sameSite: 'strict', // Updated to match implementation
    }));
  });
});
