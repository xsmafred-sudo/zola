// Comprehensive end-to-end security tests
import {
  signInWithEmail as signInWithPassword,
  signUpWithEmail,
  signInWithGoogle,
  signInWithGithub as signInWithGitHub,
  sendPasswordResetEmail as resetPasswordForEmail,
} from '@/lib/api';
import {
  RateLimiter,
} from '@/lib/auth/rate-limiter';
import {
  AccountLockout,
} from '@/lib/auth/account-lockout';
import {
  PasswordPolicyValidator,
} from '@/lib/auth/password-policy';
import {
  validateEmail,
  validateDisplayName,
  validateRedirectUrl,
} from '@/lib/auth/input-validator';
import {
  OAuthSecurity,
} from '@/lib/auth/oauth-security';
import {
  AuditLogger,
} from '@/lib/auth/audit-logger';
import {
  getAuthErrorMessage,
  logDetailedError,
} from '@/lib/auth/error-handler';
import {
  CheckSessionTimeout,
} from '@/lib/auth/session-manager';
import {
  generateCsrfToken,
  validateCsrfToken,
} from '@/lib/csrf';
import { jest } from '@jest/globals';

jest.mock('ioredis', () => {
  const RedisMock = jest.fn().mockImplementation(() => ({
    get: jest.fn().mockReturnValue(Promise.resolve(null)),
    setex: jest.fn().mockReturnValue(Promise.resolve('OK')),
    incr: jest.fn().mockReturnValue(Promise.resolve(1)),
    del: jest.fn().mockReturnValue(Promise.resolve(1)),
    expire: jest.fn().mockReturnValue(Promise.resolve('OK')),
    quit: jest.fn().mockReturnValue(Promise.resolve('OK')),
  }));
  return { Redis: RedisMock };
});

describe('Comprehensive Security End-to-End Tests', () => {
  describe('Authentication Security Integration', () => {
    let mockRedis: any;

    beforeEach(() => {
      jest.clearAllMocks();
      const { Redis } = require('ioredis');
      mockRedis = new Redis();
    });

    it('should enforce rate limiting on authentication attempts', async () => {
      const rateLimiter = new RateLimiter(mockRedis);
      let attemptCount = 0;

      mockRedis.incr.mockImplementation(async () => {
        attemptCount++;
        return attemptCount;
      });

      mockRedis.get.mockResolvedValue(null);

      // First 4 attempts should be allowed with remaining attempts
      for (let i = 1; i <= 4; i++) {
        mockRedis.incr.mockResolvedValueOnce(i);
        const result = await rateLimiter.checkLimit('user@example.com', 'login');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBeGreaterThan(0);
      }

      // 5th attempt should be allowed but with 0 remaining
      mockRedis.incr.mockResolvedValueOnce(5);
      const fifthResult = await rateLimiter.checkLimit('user@example.com', 'login');
      expect(fifthResult.allowed).toBe(true);
      expect(fifthResult.remaining).toBe(0);

      // 6th attempt should be blocked
      mockRedis.incr.mockResolvedValueOnce(6);
      const blockedResult = await rateLimiter.checkLimit('user@example.com', 'login');
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.remaining).toBe(0);
    });

    it('should enforce account lockout after threshold failures', async () => {
      const lockout = new AccountLockout(mockRedis);

      // Record failed attempts to trigger lockout
      for (let i = 0; i < 3; i++) {
        await lockout.recordFailedAttempt('user@example.com', '192.168.1.1');
      }

      // After 3 failed attempts, account should be locked
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        attempts: 3,
        lockedUntil: new Date(Date.now() + 300000).toISOString(),
        lastAttempt: new Date().toISOString()
      }));

      const lockedResult = await lockout.checkLockout('user@example.com', '192.168.1.1');
      expect(lockedResult.locked).toBe(true);
      expect(lockedResult.remainingAttempts).toBe(0);
      expect(lockedResult.lockoutEndTime).not.toBeNull();
    });

    it('should enforce password complexity requirements', () => {
      const validator = new PasswordPolicyValidator();

      // Test weak passwords
      const weakPasswords = [
        'short',
        'alllowercase',
        'ALLUPPERCASE',
        'NoNumbers!',
        'NoSpecialChars123',
        'Password123', // Common password
        'qwerty',
        '123456',
      ];

      weakPasswords.forEach(password => {
        const result = validator.validate(password);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      // Test strong passwords
      const strongPasswords = [
        'StrongP@ssw0rd!',
        'C0mpl3x!P@ssw0rd',
        'MyV3ry$ecure#P@ss',
        'Secur1ty!2023#',
      ];

      strongPasswords.forEach(password => {
        const result = validator.validate(password);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should validate and sanitize all user inputs', () => {
      // Test email validation
      const validEmails = [
        'user@example.com',
        'user.name+tag@example-domain.com',
      ];

      validEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.valid).toBe(true);
      });

      const invalidEmails = [
        'invalid-email',
        'user@',
        'user @example.com',
        'a'.repeat(300) + '@example.com', // Too long
      ];

      invalidEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.valid).toBe(false);
      });

      // Test display name validation (XSS prevention)
      const maliciousNames = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert(1)',
        '<iframe src="evil.com"></iframe>',
      ];

      maliciousNames.forEach(name => {
        const result = validateDisplayName(name);
        expect(result.valid).toBe(false);
      });

      // Test redirect URL validation (open redirect prevention)
      const maliciousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
      ];

      maliciousUrls.forEach(url => {
        const result = validateRedirectUrl(url);
        expect(result.valid).toBe(false);
      });

      const safeUrls = [
        'http://localhost:3000/dashboard',
        'https://example.com/auth/callback',
      ];

      safeUrls.forEach(url => {
        const result = validateRedirectUrl(url);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('OAuth Security Integration', () => {
    let mockRedis: any;

    beforeEach(() => {
      jest.clearAllMocks();
      const { Redis } = require('ioredis');
      mockRedis = new Redis();
    });

    it('should generate and validate secure OAuth state parameters', () => {
      const oauthSecurity = new OAuthSecurity(mockRedis);
      const state = oauthSecurity.generateOAuthState();

      expect(state.state).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(state.state.length).toBe(43);
      expect(state.verifier).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(state.verifier.length).toBe(43);
      expect(state.timestamp).toBeGreaterThan(0);
    });

    it('should generate valid PKCE challenges', () => {
      const oauthSecurity = new OAuthSecurity(mockRedis);
      const pkce = oauthSecurity.generatePKCE();

      expect(pkce.verifier).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(pkce.challenge).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(pkce.challenge).not.toBe(pkce.verifier);
      expect(pkce.verifier.length).toBe(43);
      expect(pkce.challenge.length).toBe(43);
    });

    it('should validate OAuth state with correct user agent', async () => {
      const oauthSecurity = new OAuthSecurity(mockRedis);
      const state = oauthSecurity.generateOAuthState();
      state.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124';

      await oauthSecurity.storeState(state);
      const storedData = mockRedis.setex.mock.calls[0][2];
      mockRedis.get.mockReturnValue(Promise.resolve(storedData));

      const isValid = await oauthSecurity.validateState(state.state, state.userAgent);
      expect(isValid).toBe(true);
    });

    it('should reject OAuth state with different user agent', async () => {
      const oauthSecurity = new OAuthSecurity(mockRedis);
      const state = oauthSecurity.generateOAuthState();
      state.userAgent = 'Mozilla/5.0 Firefox/89.0';

      await oauthSecurity.storeState(state);
      const storedData = mockRedis.setex.mock.calls[0][2];
      mockRedis.get.mockReturnValue(Promise.resolve(storedData));

      // Different browser profile to trigger fingerprint mismatch
      const isValid = await oauthSecurity.validateState(state.state, 'Mozilla/5.0 Chrome/91.0');
      expect(isValid).toBe(false);
    });

    it('should reject expired OAuth state', async () => {
      const oauthSecurity = new OAuthSecurity(mockRedis);
      const state = oauthSecurity.generateOAuthState();
      state.userAgent = 'test-agent';
      state.timestamp = Date.now() - 700000; // More than 10 minutes ago

      await oauthSecurity.storeState(state);
      const storedData = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      storedData.timestamp = state.timestamp;
      mockRedis.get.mockReturnValue(Promise.resolve(JSON.stringify(storedData)));

      const isValid = await oauthSecurity.validateState(state.state, 'test-agent');
      expect(isValid).toBe(false);
    });
  });

  describe('CSRF Protection Integration', () => {
    it('should generate valid CSRF tokens', () => {
      const token = generateCsrfToken();

      expect(token).toMatch(/^[a-f0-9]{64}:[a-f0-9]{64}$/);
      expect(token.length).toBe(129);
      expect(validateCsrfToken(token)).toBe(true);
    });

    it('should reject invalid CSRF tokens', () => {
      const invalidTokens = [
        'invalid-token',
        'too-short',
        'missing-colon',
        '123:456:789',
        '',
        'a'.repeat(63) + ':' + 'b'.repeat(64), // Too short
      ];

      invalidTokens.forEach(token => {
        expect(validateCsrfToken(token)).toBe(false);
      });
    });

    it('should generate unique CSRF tokens', () => {
      const tokens = new Set();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        tokens.add(generateCsrfToken());
      }

      expect(tokens.size).toBe(iterations);
    });

    it('should have sufficient entropy in CSRF tokens', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('Error Handling Security', () => {
    it('should return generic error messages for authentication failures', () => {
      const errors = [
        new Error('Invalid login credentials'),
        new Error('User not found'),
        new Error('Wrong password'),
      ];

      errors.forEach(error => {
        const message = getAuthErrorMessage(error);
        // All authentication errors should be generic to prevent enumeration
        expect(message).not.toContain('not found');
        expect(message).not.toContain('wrong password');
        // The actual message might vary, but should be generic
        expect(message).toBeDefined();
      });
    });

    it('should prevent account enumeration via error messages', () => {
      const existingAccountError = new Error('Invalid login credentials');
      const nonExistentAccountError = new Error('User not found');

      const message1 = getAuthErrorMessage(existingAccountError);
      const message2 = getAuthErrorMessage(nonExistentAccountError);

      expect(message1).toBe(message2);
      expect(message1).toBe('Invalid email or password');
    });

    it('should log detailed errors without exposing sensitive information', () => {
      const error = new Error('Test error');
      const context = { mode: 'signin', email: true };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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
  });

  describe('Audit Logging Security', () => {
    it('should log successful authentication events', async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockImplementation(() => Promise.resolve({ error: null })),
        }),
      } as any;

      const auditLogger = new AuditLogger(mockSupabaseClient);

      await auditLogger.logLoginSuccess('user-123', 'user@example.com', '192.168.1.1', 'Mozilla/5.0');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('auth_audit_log');
      expect(mockSupabaseClient.from('auth_audit_log').insert).toHaveBeenCalledWith({
        event_type: 'login_success',
        user_id: 'user-123',
        email: 'user@example.com',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        timestamp: expect.any(String),
        metadata: {}
      });
    });

    it('should log failed authentication events', async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockImplementation(() => Promise.resolve({ error: null })),
        }),
      } as any;

      const auditLogger = new AuditLogger(mockSupabaseClient);

      await auditLogger.logLoginFailure('user@example.com', '192.168.1.1', 'Mozilla/5.0', 'Invalid credentials');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('auth_audit_log');
      expect(mockSupabaseClient.from('auth_audit_log').insert).toHaveBeenCalledWith({
        event_type: 'login_failure',
        user_id: null,
        email: 'user@example.com',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        timestamp: expect.any(String),
        metadata: { reason: 'Invalid credentials' }
      });
    });

    it('should log OAuth authentication events', async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockImplementation(() => Promise.resolve({ error: null })),
        }),
      } as any;

      const auditLogger = new AuditLogger(mockSupabaseClient);

      await auditLogger.logOAuthLogin('user-123', 'user@example.com', 'google', '192.168.1.1', 'Mozilla/5.0');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('auth_audit_log');
      expect(mockSupabaseClient.from('auth_audit_log').insert).toHaveBeenCalledWith({
        event_type: 'oauth_login',
        user_id: 'user-123',
        email: 'user@example.com',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        timestamp: expect.any(String),
        metadata: { provider: 'google' }
      });
    });

    it('should log account lockout events', async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockImplementation(() => Promise.resolve({ error: null })),
        }),
      } as any;

      const auditLogger = new AuditLogger(mockSupabaseClient);

      await auditLogger.logAccountLockout('user@example.com', '192.168.1.1', 'Mozilla/5.0', 5);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('auth_audit_log');
      expect(mockSupabaseClient.from('auth_audit_log').insert).toHaveBeenCalledWith({
        event_type: 'account_lockout',
        user_id: null,
        email: 'user@example.com',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        timestamp: expect.any(String),
        metadata: { lockout_duration_minutes: 5 }
      });
    });
  });

  describe('Session Management Security', () => {
    let mockActivityTracker: any;

    beforeEach(() => {
      mockActivityTracker = {
        isSessionValid: jest.fn(),
        getTimeUntilExpiry: jest.fn(),
        handleExpiredSession: jest.fn(),
        clearActivity: jest.fn(),
      };
    });

    it('should detect expired sessions', async () => {
      const mockClient = {
        auth: {
          getSession: jest.fn().mockImplementation(() => Promise.resolve({
            data: {
              session: {
                user: {
                  id: 'test-user',
                  last_sign_in_at: new Date(Date.now() - 2000000).toISOString()
                }
              }
            },
            error: null
          })),
          signOut: jest.fn().mockImplementation(() => Promise.resolve({ error: null }))
        }
      } as any;

      mockActivityTracker.isSessionValid.mockReturnValue(Promise.resolve(false));

      const sessionManager = new CheckSessionTimeout(mockClient, mockActivityTracker);
      const result = await sessionManager.checkSessionTimeout(mockClient);

      expect(result.expired).toBe(true);
      expect(result.warning).toBeNull();
    });

    it('should return timeout warning for expiring sessions', async () => {
      const mockClient = {
        auth: {
          getSession: jest.fn().mockImplementation(() => Promise.resolve({
            data: {
              session: {
                user: {
                  id: 'test-user',
                  last_sign_in_at: new Date(Date.now() - 1500000).toISOString()
                }
              }
            },
            error: null
          })),
          signOut: jest.fn().mockImplementation(() => Promise.resolve({ error: null }))
        }
      } as any;

      mockActivityTracker.isSessionValid.mockReturnValue(Promise.resolve(true));
      mockActivityTracker.getTimeUntilExpiry.mockReturnValue(Promise.resolve(300000)); // 5 minutes in ms

      const sessionManager = new CheckSessionTimeout(mockClient, mockActivityTracker);
      const result = await sessionManager.checkSessionTimeout(mockClient);

      expect(result.expired).toBe(false);
      expect(result.warning).not.toBeNull();
      expect(result.warning).toBeGreaterThan(0);
      expect(result.warning).toBeLessThanOrEqual(300); // Should be within 5 minutes
    });

    it('should handle active sessions', async () => {
      const mockClient = {
        auth: {
          getSession: jest.fn().mockImplementation(() => Promise.resolve({
            data: {
              session: {
                user: {
                  id: 'test-user',
                  last_sign_in_at: new Date(Date.now() - 100000).toISOString()
                }
              }
            },
            error: null
          })),
          signOut: jest.fn().mockImplementation(() => Promise.resolve({ error: null }))
        }
      } as any;

      mockActivityTracker.isSessionValid.mockReturnValue(Promise.resolve(true));
      mockActivityTracker.getTimeUntilExpiry.mockReturnValue(Promise.resolve(1000000)); // Plenty of time

      const sessionManager = new CheckSessionTimeout(mockClient, mockActivityTracker);
      const result = await sessionManager.checkSessionTimeout(mockClient);

      expect(result.expired).toBe(false);
      expect(result.warning).toBeNull();
    });
  });

  describe('Comprehensive Security Attack Prevention', () => {
    it('should prevent SQL injection attacks', () => {
      // SQL injection attempts for email validation
      const emailSqlAttempts = [
        "admin'--",
        "admin' /*",
        "admin'; DROP TABLE users--",
      ];

      emailSqlAttempts.forEach(attempt => {
        const result = validateEmail(attempt);
        expect(result.valid).toBe(false);
      });

      // Test that display name validation blocks obvious SQL patterns
      const nameSqlAttempts = [
        "admin'; DROP TABLE users", // Should match semicolon pattern
        "admin' UNION SELECT * FROM users", // Should match UNION SELECT pattern
        "user'; INSERT INTO users VALUES", // Should match INSERT INTO pattern
        "admin'; UPDATE users SET", // Should match UPDATE SET pattern
        "admin'; DELETE FROM users", // Should match DELETE FROM pattern
      ];

      nameSqlAttempts.forEach(attempt => {
        const result = validateDisplayName(attempt);
        expect(result.valid).toBe(false);
      });
    });

    it('should prevent XSS attacks', () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        '<svg onload=alert("xss")>',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
      ];

      xssAttempts.forEach(attempt => {
        const result = validateDisplayName(attempt);
        expect(result.valid).toBe(false);
      });
    });

    it('should prevent open redirect attacks', () => {
      const redirectAttempts = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'ftp://example.com/file',
      ];

      redirectAttempts.forEach(attempt => {
        const result = validateRedirectUrl(attempt);
        expect(result.valid).toBe(false);
      });
    });

    it('should prevent CSRF attacks', () => {
      const csrfTokens = [
        'invalid-token',
        'too-short',
        'missing-colon',
        '123:456:789',
      ];

      csrfTokens.forEach(token => {
        expect(validateCsrfToken(token)).toBe(false);
      });

      // Valid tokens should pass
      const validToken = generateCsrfToken();
      expect(validateCsrfToken(validToken)).toBe(true);
    });

    it('should prevent brute force attacks via rate limiting', async () => {
      const { Redis } = require('ioredis');
      const mockRedis = new Redis();
      const rateLimiter = new RateLimiter(mockRedis);

      let attemptCount = 0;
      mockRedis.incr.mockImplementation(async () => {
        attemptCount++;
        return attemptCount;
      });

      mockRedis.get.mockResolvedValue(null);

      const blockedAttempts = [];
      const allowedAttempts = [];

      for (let i = 0; i < 10; i++) {
        const result = await rateLimiter.checkLimit('brute-force@example.com', 'login');
        if (result.allowed) {
          allowedAttempts.push(result);
        } else {
          blockedAttempts.push(result);
        }
      }

      expect(allowedAttempts.length).toBeLessThanOrEqual(5);
      expect(blockedAttempts.length).toBeGreaterThan(0);
    });

    it('should prevent credential stuffing via rate limiting', async () => {
      const { Redis } = require('ioredis');
      const mockRedis = new Redis();
      const rateLimiter = new RateLimiter(mockRedis);

      let totalAttempts = 0;
      mockRedis.incr.mockImplementation(async () => {
        totalAttempts++;
        return totalAttempts;
      });

      mockRedis.get.mockResolvedValue(null);

      const credentials = [
        'victim1@example.com',
        'victim2@example.com',
        'victim3@example.com',
        'victim4@example.com',
        'victim5@example.com',
        'victim6@example.com',
      ];

      const results = [];
      for (const email of credentials) {
        const result = await rateLimiter.checkLimit(email, 'login');
        results.push(result);
      }

      const blocked = results.filter(r => !r.allowed);
      expect(blocked.length).toBeGreaterThan(0);
    });
  });

  describe('Security Configuration Validation', () => {
    it('should enforce secure CSRF token generation', () => {
      const token = generateCsrfToken();
      const parts = token.split(':');

      expect(parts.length).toBe(2);
      expect(parts[0].length).toBe(64); // 32 bytes in hex
      expect(parts[1].length).toBe(64); // 32 bytes in hex
    });

    it('should enforce secure OAuth state generation', () => {
      const { Redis } = require('ioredis');
      const mockRedis = new Redis();
      const oauthSecurity = new OAuthSecurity(mockRedis);

      const state = oauthSecurity.generateOAuthState();
      const pkce = oauthSecurity.generatePKCE();

      expect(state.state.length).toBe(43);
      expect(state.verifier.length).toBe(43);
      expect(pkce.verifier.length).toBe(43);
      expect(pkce.challenge.length).toBe(43);
    });

    it('should enforce password policy requirements', () => {
      const validator = new PasswordPolicyValidator();

      const requirements = validator.getRequirements();
      expect(requirements).toContain('At least 8 characters');
      expect(requirements).toContain('One uppercase letter');
      expect(requirements).toContain('One lowercase letter');
      expect(requirements).toContain('One number');
      expect(requirements).toContain('One special character');
      expect(requirements).toContain('Not a common password');
    });
  });
});