import { getAuthErrorMessage, logDetailedError } from '@/lib/auth/error-handler';

describe('ErrorHandler', () => {
  it('should return generic error for credential errors', () => {
    const error = new Error('Invalid login credentials');
    const message = getAuthErrorMessage(error);

    expect(message).toBe('Invalid email or password');
  });

  it('should return generic error for unexpected errors', () => {
    const error = new Error('Unexpected database error');
    const message = getAuthErrorMessage(error);

    expect(message).toBe('An error occurred. Please try again.');
  });

  it('should return weak password error for password policy violations', () => {
    const error = new Error('Password should be at least 12 characters long');
    const message = getAuthErrorMessage(error);

    expect(message).toBe('Password does not meet security requirements');
  });

  it('should return rate limited error for too many attempts', () => {
    const error = new Error('Too many requests. Please try again later.');
    const message = getAuthErrorMessage(error);

    expect(message).toBe('Too many attempts. Please try again later.');
  });

  it('should return invalid email error for email format issues', () => {
    const error = new Error('Invalid email address');
    const message = getAuthErrorMessage(error);

    expect(message).toBe('Please enter a valid email address');
  });

  it('should return invalid state error for OAuth issues', () => {
    const error = new Error('Invalid state parameter');
    const message = getAuthErrorMessage(error);

    expect(message).toBe('Authentication error. Please try again.');
  });

  it('should return session expired error for timeout issues', () => {
    const error = new Error('Session expired');
    const message = getAuthErrorMessage(error);

    expect(message).toBe('Your session has expired. Please sign in again.');
  });

  it('should return generic error for CSRF issues', () => {
    const error = new Error('CSRF token validation failed');
    const message = getAuthErrorMessage(error);

    expect(message).toBe('Authentication error. Please try again.');
  });

  it('should return email already registered error', () => {
    const error = new Error('Email already registered');
    const message = getAuthErrorMessage(error);

    expect(message).toBe('An account with this email already exists');
  });

  it('should return generic error for account locked issues', () => {
    const error = new Error('Account temporarily locked due to too many failed attempts');
    const message = getAuthErrorMessage(error);

    expect(message).toBe('Too many attempts. Please try again later.');
  });

  it('should log detailed error information', () => {
    const error = new Error('Test error');
    const context = { mode: 'signin', email: true };
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    logDetailedError(error, context);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Authentication error:', {
      type: 'Error',
      message: 'Test error',
      stack: expect.any(String),
      context: { mode: 'signin', email: true },
      timestamp: expect.any(String)
    });

    consoleErrorSpy.mockRestore();
  });

  it('should return generic error for unknown error types', () => {
    const error = new Error('Some completely unexpected error');
    const message = getAuthErrorMessage(error);

    expect(message).toBe('An error occurred. Please try again.');
  });

  it('should be case-insensitive when matching error messages', () => {
    const error = new Error('INVALID LOGIN CREDENTIALS');
    const message = getAuthErrorMessage(error);

    expect(message).toBe('Invalid email or password');
  });
});
