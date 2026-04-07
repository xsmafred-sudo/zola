export const SECURITY_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_LOCKED: 'Account temporarily locked. Please try again later.',
  RATE_LIMITED: 'Too many attempts. Please try again later.',
  WEAK_PASSWORD: 'Password does not meet security requirements',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_STATE: 'Authentication error. Please try again.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  CSRF_INVALID: 'Security validation failed. Please refresh and try again.',
  GENERIC_ERROR: 'An error occurred. Please try again.'
} as const;

export function getAuthErrorMessage(error: Error): string {
  const message = error.message.toLowerCase();

  // Generic error messages to prevent information leakage
  if (message.includes('invalid login credentials') ||
      message.includes('email not confirmed') ||
      message.includes('user not found') ||
      message.includes('invalid password')) {
    return SECURITY_ERRORS.INVALID_CREDENTIALS;
  }

  if (message.includes('password should be')) {
    return SECURITY_ERRORS.WEAK_PASSWORD;
  }

  if (message.includes('too many requests') ||
      message.includes('rate limit') ||
      message.includes('too many attempts') ||
      message.includes('account locked') ||
      message.includes('account temporarily locked')) {
    return SECURITY_ERRORS.RATE_LIMITED;
  }

  if (message.includes('email already registered')) {
    return 'An account with this email already exists';
  }

  if (message.includes('weak password') ||
      message.includes('password complexity')) {
    return SECURITY_ERRORS.WEAK_PASSWORD;
  }

  if (message.includes('invalid email') ||
      message.includes('invalid email address') ||
      message.includes('email format')) {
    return SECURITY_ERRORS.INVALID_EMAIL;
  }

  if (message.includes('invalid state') ||
      message.includes('state parameter') ||
      message.includes('oauth error') ||
      message.includes('csrf')) {
    return SECURITY_ERRORS.INVALID_STATE;
  }

  if (message.includes('session expired') ||
      message.includes('session timeout') ||
      message.includes('expired session')) {
    return SECURITY_ERRORS.SESSION_EXPIRED;
  }

  // Generic error for all other cases to prevent information leakage
  return SECURITY_ERRORS.GENERIC_ERROR;
}

export function logDetailedError(error: Error, context: Record<string, any>): void {
  // Log detailed error for debugging
  console.error('Authentication error:', {
    type: error.name,
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  });
}
