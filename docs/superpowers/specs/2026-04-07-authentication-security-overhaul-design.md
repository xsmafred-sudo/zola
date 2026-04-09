# Authentication Security Overhaul Design Document

**Project:** Zola AI Chat Platform  
**Date:** 2026-04-07  
**Status:** Design Phase Complete  
**Timeline:** Urgent - 1 Week Deployment  

---

## Executive Summary

This design addresses 12 critical and high-priority security vulnerabilities identified in a comprehensive authentication security audit. The solution implements a layered security architecture with Redis-based rate limiting, account lockout mechanisms, OAuth security enhancements, password policy enforcement, comprehensive audit logging, and robust testing infrastructure.

**Key Deliverables:**
- 4 Critical vulnerabilities remediated
- 4 High-priority issues resolved  
- 4 Medium-priority issues addressed
- Comprehensive test suite (90%+ coverage target)
- Production-ready deployment within 7 days

---

## 1. Security Architecture Overview

### 1.1 Core Security Components

**Rate Limiting Layer (Redis-based)**
- Distributed rate limiting using Redis for scalability
- Separate limiters for different endpoint types (login, signup, password reset, OAuth)
- Configurable thresholds with exponential backoff
- Automatic cleanup of expired rate limit entries
- Client-side feedback for rate-limited requests

**Account Lockout Service (Redis-backed)**
- Tracks failed login attempts per email/IP address
- Progressive lockout durations (5 min → 15 min → 1 hour → 24 hours)
- Automatic unlock on successful authentication
- Admin override mechanism for legitimate users

**OAuth Security Enhancement**
- State parameter generation using crypto.randomBytes()
- State storage in Redis with 10-minute TTL
- PKCE (Proof Key for Code Exchange) implementation
- State validation in all OAuth callbacks
- Protection against CSRF and session fixation attacks

**Password Policy Engine**
- Server-side validation before Supabase API calls
- Complexity requirements: 8+ characters, uppercase, lowercase, numbers, special characters
- Common password blacklist (top 10,000 most common passwords)
- Client-side validation with server-side enforcement
- User-friendly error messages for specific requirement failures

**Audit Logging System**
- Async logging to Supabase's existing auth.audit_log_entries table
- Event types: login_success, login_failure, oauth_login, password_reset, account_lockout
- IP address, user agent, timestamp tracking
- Configurable retention policy (90 days default)
- Security event correlation and analysis

**CSRF Protection Enhancement**
- Token rotation on authentication events
- Session binding for CSRF tokens
- Configurable TTL (1 hour default)
- Double-submit cookie pattern maintained
- Validation for all state-changing operations

**Authentication Middleware**
- Unified authentication protection for all API routes
- CSRF validation for POST/PUT/DELETE requests
- Session validation and timeout checking
- Role-based access control enforcement
- Consistent security policy across all endpoints

**Input Validation Layer**
- Server-side validation for all user inputs
- Email format validation (RFC 5322 compliant)
- Display name sanitization (XSS prevention)
- Redirect URL allowlisting
- Generic error messages to prevent information leakage

### 1.2 Security Data Flow

```
User Request 
  ↓
CSRF Validation 
  ↓
Rate Limiting Check (Redis)
  ↓
Account Lockout Check (Redis)
  ↓
Input Validation (Server-side)
  ↓
Password Policy Check
  ↓
Authentication Logic (Supabase)
  ↓
Audit Logging (Async)
  ↓
Response (with CSRF rotation if successful)
```

---

## 2. Component Designs

### 2.1 Rate Limiting Component

**File:** `lib/auth/rate-limiter.ts`

**Purpose:** Implement distributed rate limiting for authentication endpoints to prevent brute force attacks and abuse.

**Dependencies:** `ioredis` (Redis client library)

**Implementation:**
```typescript
import { Redis } from 'ioredis';

interface RateLimitConfig {
  points: number;        // Max requests allowed
  duration: number;      // Time window in seconds
  blockDuration: number;  // How long to block after exceeding limit
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  login: { points: 5, duration: 900, blockDuration: 1800 },      // 5 attempts per 15 min
  signup: { points: 3, duration: 3600, blockDuration: 3600 },   // 3 attempts per hour
  passwordReset: { points: 3, duration: 3600, blockDuration: 3600 },
  oauth: { points: 10, duration: 3600, blockDuration: 1800 }
};

export class RateLimiter {
  private redis: Redis;
  
  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }
  
  async checkLimit(
    identifier: string,
    type: 'login' | 'signup' | 'passwordReset' | 'oauth'
  ): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    const config = RATE_LIMIT_CONFIGS[type];
    const key = `ratelimit:${type}:${identifier}`;
    
    // Get current count
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      // First request, set expiration
      await this.redis.expire(key, config.duration);
    }
    
    if (current > config.points) {
      // Check if already blocked
      const blockedKey = `ratelimit:blocked:${type}:${identifier}`;
      const blocked = await this.redis.get(blockedKey);
      
      if (!blocked) {
        // Set block expiration
        await this.redis.setex(blockedKey, config.blockDuration, '1');
      }
      
      const resetTime = new Date(Date.now() + config.blockDuration * 1000);
      return {
        allowed: false,
        remaining: 0,
        resetTime
      };
    }
    
    return {
      allowed: true,
      remaining: config.points - current,
      resetTime: new Date(Date.now() + config.duration * 1000)
    };
  }
}
```

**Integration Points:**
- Applied to all authentication API routes via middleware
- Client-side rate limiting feedback to users
- Admin dashboard for monitoring violations
- Redis connection pooling for performance

---

### 2.2 Account Lockout Component

**File:** `lib/auth/account-lockout.ts`

**Purpose:** Implement progressive account lockout to prevent unlimited password guessing attempts.

**Implementation:**
```typescript
interface LockoutState {
  attempts: number;
  lockedUntil: Date | null;
  lastAttempt: Date;
}

const LOCKOUT_THRESHOLDS = [
  { attempts: 3, duration: 300 },    // 5 minutes
  { attempts: 5, duration: 900 },    // 15 minutes
  { attempts: 7, duration: 3600 },   // 1 hour
  { attempts: 10, duration: 86400 }  // 24 hours
];

export class AccountLockout {
  private redis: Redis;
  
  async checkLockout(email: string, ipAddress: string): Promise<{
    locked: boolean;
    remainingAttempts: number;
    lockoutEndTime: Date | null;
  }> {
    const emailKey = `lockout:email:${email}`;
    const ipKey = `lockout:ip:${ipAddress}`;
    
    // Check both email and IP lockouts
    const emailState = await this.getLockoutState(emailKey);
    const ipState = await this.getLockoutState(ipKey);
    
    const now = new Date();
    
    // Check if currently locked
    if (emailState?.lockedUntil && emailState.lockedUntil > now) {
      return {
        locked: true,
        remainingAttempts: 0,
        lockoutEndTime: emailState.lockedUntil
      };
    }
    
    if (ipState?.lockedUntil && ipState.lockedUntil > now) {
      return {
        locked: true,
        remainingAttempts: 0,
        lockoutEndTime: ipState.lockedUntil
      };
    }
    
    // Not locked, return remaining attempts
    const nextThreshold = LOCKOUT_THRESHOLDS.find(t => 
      t.attempts > (emailState?.attempts || 0)
    );
    
    return {
      locked: false,
      remainingAttempts: nextThreshold 
        ? nextThreshold.attempts - (emailState?.attempts || 0)
        : LOCKOUT_THRESHOLDS[0].attempts - (emailState?.attempts || 0),
      lockoutEndTime: null
    };
  }
  
  async recordFailedAttempt(email: string, ipAddress: string): Promise<void> {
    const emailKey = `lockout:email:${email}`;
    const ipKey = `lockout:ip:${ipAddress}`;
    
    await this.incrementAttempts(emailKey);
    await this.incrementAttempts(ipKey);
  }
  
  async resetLockout(email: string, ipAddress: string): Promise<void> {
    const emailKey = `lockout:email:${email}`;
    const ipKey = `lockout:ip:${ipAddress}`;
    
    await this.redis.del(emailKey);
    await this.redis.del(ipKey);
  }
  
  private async getLockoutState(key: string): Promise<LockoutState | null> {
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  }
  
  private async incrementAttempts(key: string): Promise<void> {
    const current = await this.redis.incr(key);
    
    // Find appropriate lockout duration
    const threshold = LOCKOUT_THRESHOLDS.find(t => t.attempts === current);
    
    if (threshold) {
      const lockedUntil = new Date(Date.now() + threshold.duration * 1000);
      const state: LockoutState = {
        attempts: current,
        lockedUntil,
        lastAttempt: new Date()
      };
      
      await this.redis.setex(key, threshold.duration + 60, JSON.stringify(state));
    } else {
      // Set expiration for non-locked state
      const state: LockoutState = {
        attempts: current,
        lockedUntil: null,
        lastAttempt: new Date()
      };
      
      await this.redis.setex(key, 86400, JSON.stringify(state));
    }
  }
}
```

**Integration Points:**
- Called before `signInWithEmail()` function
- Reset on successful authentication
- Admin override mechanism via API endpoint

---

### 2.3 OAuth Security Enhancement

**Files:** `lib/api.ts`, `app/auth/callback/route.ts`

**Purpose:** Add state parameter validation and PKCE to prevent CSRF attacks in OAuth flows.

**Implementation:**
```typescript
// lib/auth/oauth-security.ts
import crypto from 'crypto';

export interface OAuthState {
  state: string;
  verifier: string;
  timestamp: number;
  userAgent: string;
}

export class OAuthSecurity {
  private redis: Redis;
  
  generateOAuthState(): OAuthState {
    const state = crypto.randomBytes(32).toString('base64url');
    const verifier = crypto.randomBytes(32).toString('base64url');
    const timestamp = Date.now();
    
    return {
      state,
      verifier,
      timestamp,
      userAgent: '' // Will be set from request
    };
  }
  
  async storeState(state: OAuthState, expiresIn: number = 600): Promise<void> {
    const key = `oauth:state:${state.state}`;
    await this.redis.setex(key, expiresIn, JSON.stringify(state));
  }
  
  async validateState(state: string, userAgent: string): Promise<boolean> {
    const key = `oauth:state:${state}`;
    const stored = await this.redis.get(key);
    
    if (!stored) return false;
    
    const parsedState: OAuthState = JSON.parse(stored);
    
    // Check expiration (10 minutes)
    if (Date.now() - parsedState.timestamp > 600000) {
      await this.redis.del(key);
      return false;
    }
    
    // Check user agent (prevent session hijacking)
    if (parsedState.userAgent !== userAgent) {
      await this.redis.del(key);
      return false;
    }
    
    // Clean up used state
    await this.redis.del(key);
    return true;
  }
  
  generatePKCE(): { verifier: string; challenge: string } {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
    
    return { verifier, challenge };
  }
}

// lib/api.ts - Updated OAuth functions
export async function signInWithGoogle(
  supabase: SupabaseClient,
  request: Request
) {
  const oauthSecurity = new OAuthSecurity(process.env.REDIS_URL);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  const state = oauthSecurity.generateOAuthState();
  state.userAgent = userAgent;
  
  const pkce = oauthSecurity.generatePKCE();
  
  // Store state with verifier
  await oauthSecurity.storeState({
    ...state,
    verifier: pkce.verifier
  });
  
  const isDev = process.env.NODE_ENV === 'development';
  const baseUrl = isDev
    ? 'http://localhost:3000'
    : typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : APP_DOMAIN;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${baseUrl}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
        state: state.state, // ADD STATE PARAMETER
        code_challenge: pkce.challenge, // ADD PKCE CHALLENGE
        code_challenge_method: 'S256' // ADD PKCE METHOD
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

// app/auth/callback/route.ts - Updated validation
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const type = searchParams.get('type') ?? 'signup';
  const next = searchParams.get('next') ?? '/';
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (!isSupabaseEnabled()) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent('Supabase is not enabled in this deployment.')}`
    );
  }

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent('Missing authentication code')}`
    );
  }

  // VALIDATE OAUTH STATE
  const oauthSecurity = new OAuthSecurity(process.env.REDIS_URL);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  if (state && !await oauthSecurity.validateState(state, userAgent)) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent('Invalid OAuth state. Please try again.')}`
    );
  }

  const supabase = await createClient();
  const supabaseAdmin = await createGuestServerClient();

  if (!supabase || !supabaseAdmin) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent('Supabase is not enabled in this deployment.')}`
    );
  }

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('Auth error:', exchangeError);
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent('Authentication error. Please try again.')}`
    );
  }

  // ... rest of callback logic
}
```

**Integration Points:**
- Updated OAuth flows in `lib/api.ts`
- State validation in `app/auth/callback/route.ts`
- Enhanced error handling for invalid states
- Redis state storage with TTL

---

### 2.4 Password Policy Engine

**File:** `lib/auth/password-policy.ts`

**Purpose:** Implement server-side password validation with complexity requirements and common password detection.

**Implementation:**
```typescript
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  rejectCommonPasswords: boolean;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  rejectCommonPasswords: true
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Common passwords blacklist - loaded from external file for maintainability
// Contains top 10,000 most common passwords from breach data
// File: lib/auth/common-passwords.ts
import { COMMON_PASSWORDS } from './common-passwords';

export class PasswordPolicyValidator {
  private policy: PasswordPolicy;
  
  constructor(policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY) {
    this.policy = policy;
  }
  
  validate(password: string): ValidationResult {
    const errors: string[] = [];
    
    // Check minimum length
    if (password.length < this.policy.minLength) {
      errors.push(`Password must be at least ${this.policy.minLength} characters long`);
    }
    
    // Check uppercase requirement
    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    // Check lowercase requirement
    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    // Check number requirement
    if (this.policy.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    // Check special character requirement
    if (this.policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    // Check common password blacklist
    if (this.policy.rejectCommonPasswords) {
      const lowerPassword = password.toLowerCase();
      if (COMMON_PASSWORDS.includes(lowerPassword)) {
        errors.push('Please choose a stronger password');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  getRequirements(): string[] {
    const requirements: string[] = [];
    
    requirements.push(`At least ${this.policy.minLength} characters`);
    if (this.policy.requireUppercase) {
      requirements.push('One uppercase letter');
    }
    if (this.policy.requireLowercase) {
      requirements.push('One lowercase letter');
    }
    if (this.policy.requireNumbers) {
      requirements.push('One number');
    }
    if (this.policy.requireSpecialChars) {
      requirements.push('One special character');
    }
    if (this.policy.rejectCommonPasswords) {
      requirements.push('Not a common password');
    }
    
    return requirements;
  }
}

// lib/api.ts - Updated authentication functions
export async function signUpWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
  name?: string
) {
  // VALIDATE PASSWORD BEFORE SENDING TO SUPABASE
  const validator = new PasswordPolicyValidator();
  const passwordValidation = validator.validate(password);
  
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors.join('. '));
  }
  
  const isDev = process.env.NODE_ENV === 'development';
  const baseUrl = isDev
    ? 'http://localhost:3000'
    : typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : APP_DOMAIN;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback`,
      data: {
        full_name: name,
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}
```

**Integration Points:**
- Client-side validation in auth UI
- Server-side enforcement in `signUpWithEmail()` and `updatePassword()`
- Password requirements display in UI
- User-friendly error messages

---

### 2.5 Audit Logging System

**File:** `lib/auth/audit-logger.ts`

**Purpose:** Implement comprehensive audit logging for all authentication events using Supabase's existing auth.audit_log_entries table.

**Implementation:**
```typescript
export interface AuthEvent {
  eventType: 'login_success' | 'login_failure' | 'oauth_login' | 
            'password_reset' | 'account_lockout' | 'csrf_validation_failure' | 
            'rate_limit_violation' | 'session_timeout';
  userId: string | null;
  email?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class AuditLogger {
  private supabase: SupabaseClient;
  
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }
  
  async logEvent(event: AuthEvent): Promise<void> {
    try {
      // Log to Supabase auth.audit_log_entries table
      const { error } = await this.supabase
        .from('auth_audit_log')
        .insert({
          event_type: event.eventType,
          user_id: event.userId,
          email: event.email,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          timestamp: event.timestamp.toISOString(),
          metadata: event.metadata
        });
      
      if (error) {
        console.error('Failed to log auth event:', error);
      }
    } catch (error) {
      console.error('Exception in audit logging:', error);
      // Don't block authentication on logging failure
    }
  }
  
  async logLoginSuccess(
    userId: string,
    email: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'login_success',
      userId,
      email,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });
  }
  
  async logLoginFailure(
    email: string,
    ipAddress: string,
    userAgent: string,
    reason: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'login_failure',
      userId: null,
      email,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      metadata: { reason }
    });
  }
  
  async logOAuthLogin(
    userId: string,
    email: string,
    provider: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.logEvent({
      eventType: 'oauth_login',
      userId,
      email,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      metadata: { provider }
    });
  }
  
  async logAccountLockout(
    email: string,
    ipAddress: string,
    userAgent: string,
    duration: number
  ): Promise<void> {
    await this.logEvent({
      eventType: 'account_lockout',
      userId: null,
      email,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      metadata: { lockout_duration_minutes: duration }
    });
  }
}

// lib/api.ts - Updated authentication functions
export async function signInWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
  request: Request
) {
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const auditLogger = new AuditLogger(supabase);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    // LOG FAILED ATTEMPT
    await auditLogger.logLoginFailure(email, ipAddress, userAgent, error.message);
    throw new Error('Invalid email or password');
  }
  
  // LOG SUCCESSFUL LOGIN
  await auditLogger.logLoginSuccess(data.user.id, email, ipAddress, userAgent);
  
  // ... rest of function
}
```

**Integration Points:**
- All authentication functions in `lib/api.ts`
- OAuth callback handlers
- Password reset flows
- Account lockout events
- Rate limit violations

---

## 3. Testing Infrastructure

### 3.1 Testing Framework Setup

**Framework Choice:** Jest + React Testing Library + Supabase Mock + Redis Mock

**Configuration:**
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

### 3.2 Test Structure

```
app/auth/__tests__/
├── login.test.ts              // Login flow tests
├── signup.test.ts             // Registration tests
├── oauth.test.ts              // OAuth security tests
├── password-reset.test.ts      // Password reset tests
├── rate-limiting.test.ts      // Rate limiting tests
├── account-lockout.test.ts    // Lockout mechanism tests
├── password-policy.test.ts     // Password validation tests
├── csrf-protection.test.ts    // CSRF tests
├── audit-logging.test.ts      // Logging tests
└── helpers/
    ├── mocks.ts              // Supabase and Redis mocks
    └── test-utils.ts         // Test utilities
```

### 3.3 Critical Test Coverage

**Authentication Flow Tests:**
- ✅ Successful login with valid credentials
- ✅ Failed login with invalid credentials
- ✅ Failed login with non-existent account
- ✅ Rate limiting after 5 failed attempts (15-minute block)
- ✅ Rate limiting for signup (3 attempts/hour)
- ✅ Rate limiting for password reset (3 attempts/hour)
- ✅ Account lockout after threshold (progressive duration)
- ✅ Account unlock after successful login
- ✅ Password complexity validation
- ✅ Password policy enforcement (8+ chars, mixed case, numbers, special chars)
- ✅ Common password rejection
- ✅ OAuth state parameter validation
- ✅ OAuth PKCE implementation
- ✅ CSRF token generation and validation
- ✅ CSRF token rotation on authentication
- ✅ Session timeout handling

**Security Tests:**
- ✅ Brute force attack prevention
- ✅ Account enumeration prevention
- ✅ CSRF attack prevention
- ✅ OAuth CSRF prevention
- ✅ XSS prevention in auth forms
- ✅ SQL injection prevention
- ✅ Input injection prevention
- ✅ Rate limiting bypass attempts
- ✅ Session fixation prevention

**Integration Tests:**
- ✅ End-to-end login flow
- ✅ OAuth callback flow with state validation
- ✅ Password reset flow
- ✅ Session timeout handling
- ✅ Multi-tab session handling
- ✅ Concurrent login attempts

---

## 4. Database Schema Updates

### 4.1 Existing Infrastructure

**Supabase Tables Available:**
- `auth.audit_log_entries` - Will use for audit logging
- `auth.users` - User authentication data
- `public.users` - Application user data
- `public.chats` - Chat conversations
- `public.messages` - Chat messages
- RLS policies already enabled

### 4.2 New Tables Required

**Failed Login Attempts Tracking:**
```sql
-- supabase/migrations/20260407000002_failed_login_attempts.sql
-- Track failed login attempts for account lockout mechanism

CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  ip_address INET,
  attempts INTEGER DEFAULT 1,
  locked_until TIMESTAMPTZ,
  last_attempt TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_email 
  ON public.failed_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_ip 
  ON public.failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_locked 
  ON public.failed_login_attempts(locked_until);

-- Row Level Security
ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- Service role can manage failed attempts
CREATE POLICY "Service role can manage failed attempts"
  ON public.failed_login_attempts
  FOR ALL
  USING (auth.role() = 'service_role');

-- Automatic cleanup of old records (90 days)
CREATE OR REPLACE FUNCTION cleanup_old_failed_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.failed_login_attempts 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (run daily)
-- Note: This would be set up via pg_cron or external scheduler
```

**Custom Audit Log Extensions:**
```sql
-- supabase/migrations/20260407000001_security_audit_logging.sql
-- Extend auth.audit_log_entries for application-specific logging

-- Note: auth.audit_log_entries is managed by Supabase
-- We'll add application-specific audit tracking if needed
CREATE TABLE IF NOT EXISTS public.security_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  user_id UUID,
  email VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_security_events_user 
  ON public.security_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_type 
  ON public.security_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_ip 
  ON public.security_events(ip_address, created_at);

-- Row Level Security
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own security events"
  ON public.security_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage security events"
  ON public.security_events
  FOR ALL
  USING (auth.role() = 'service_role');
```

---

## 5. Error Handling & Security Messages

### 5.1 Generic Error Messages

**Security Principle:** Use generic error messages to prevent account enumeration and information leakage.

**Error Message Mapping:**
```typescript
// lib/auth/error-handler.ts
export const SECURITY_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_LOCKED: 'Account temporarily locked. Please try again later',
  RATE_LIMITED: 'Too many attempts. Please try again later',
  WEAK_PASSWORD: 'Password does not meet security requirements',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_STATE: 'Authentication error. Please try again',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again',
  GENERIC_ERROR: 'An error occurred. Please try again',
  CSRF_INVALID: 'Security validation failed. Please refresh and try again'
} as const;

export function getAuthErrorMessage(error: Error): string {
  const message = error.message.toLowerCase();
  
  // Generic error messages to prevent information leakage
  if (message.includes('invalid login credentials') || 
      message.includes('email not confirmed') ||
      message.includes('user not found')) {
    return SECURITY_ERRORS.INVALID_CREDENTIALS;
  }
  
  if (message.includes('password should be')) {
    return SECURITY_ERRORS.WEAK_PASSWORD;
  }
  
  if (message.includes('email already registered')) {
    return 'An account with this email already exists';
  }
  
  if (message.includes('too many requests')) {
    return SECURITY_ERRORS.RATE_LIMITED;
  }
  
  // Generic error for all other cases
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
```

### 5.2 Error Handling Integration

```typescript
// components/ui/auth-page.tsx - Updated error handling
const handleEmailAuth = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  setError(null);
  setSuccessMessage(null);

  const supabase = createClient();
  if (!supabase) {
    setError('Supabase is not configured');
    setIsLoading(false);
    return;
  }

  try {
    if (mode === 'signin') {
      await signInWithEmail(supabase, email, password, request);
      window.location.href = '/';
    } else {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }
      
      // Password validation happens in signUpWithEmail
      await signUpWithEmail(supabase, email, password, name);
      setSuccessMessage(
        'Account created! Please check your email to verify your account.'
      );
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    }
  } catch (err: unknown) {
    // LOG DETAILED ERROR
    logDetailedError(err as Error, { mode, email: !!email });
    
    // RETURN GENERIC MESSAGE TO USER
    const userMessage = getAuthErrorMessage(err as Error);
    setError(userMessage);
  } finally {
    setIsLoading(false);
  }
};
```

---

## 6. Implementation Timeline

### Day 1: Infrastructure & Testing Setup
**Tasks:**
- Set up Jest testing framework
- Create test utilities and mocks
- Redis connection testing
- Supabase audit log exploration
- Project dependencies update

**Deliverables:**
- Testing infrastructure ready
- Mock implementations for Supabase and Redis
- Redis connection verification
- Understanding of existing audit log structure

---

### Day 2: Rate Limiting & Account Lockout
**Tasks:**
- Implement Redis rate limiter component
- Implement account lockout service
- Write comprehensive tests for both
- Integration with authentication flows
- Database migration for failed attempts tracking

**Deliverables:**
- `lib/auth/rate-limiter.ts` completed
- `lib/auth/account-lockout.ts` completed
- Test suite with 90%+ coverage
- Integration with `signInWithEmail()` function
- Migration `20260407000002_failed_login_attempts.sql` applied

---

### Day 3: OAuth Security Enhancement
**Tasks:**
- Implement OAuth state parameter generation
- Add PKCE implementation
- Update Google and GitHub OAuth flows
- Update callback validation logic
- Write OAuth security tests

**Deliverables:**
- `lib/auth/oauth-security.ts` completed
- Updated OAuth functions in `lib/api.ts`
- Enhanced `app/auth/callback/route.ts` with state validation
- Comprehensive OAuth test suite
- State parameter validation working correctly

---

### Day 4: Password Policy & Input Validation
**Tasks:**
- Implement password policy engine
- Add common password blacklist
- Implement server-side input validation
- Update auth UI with password requirements
- Write validation tests

**Deliverables:**
- `lib/auth/password-policy.ts` completed
- `lib/auth/input-validator.ts` completed
- Updated `signUpWithEmail()` and `updatePassword()` functions
- Enhanced auth UI with requirements display
- Validation test suite completed

---

### Day 5: Error Handling & CSRF Improvements
**Tasks:**
- Implement generic error messages
- Add CSRF token rotation
- Update error handling in auth flows
- Write error handling tests
- CSRF rotation tests

**Deliverables:**
- `lib/auth/error-handler.ts` completed
- Enhanced `lib/csrf.ts` with rotation
- Updated error handling in all auth functions
- Error handling test suite
- CSRF token rotation functional

---

### Day 6: Session Management & Auth Protection
**Tasks:**
- Implement session timeout configuration
- Update middleware for unified auth protection
- Add session timeout warnings
- Session management tests
- Integration testing

**Deliverables:**
- Session timeout configuration in `lib/config.ts`
- Enhanced `middleware.ts` with unified auth protection
- Session timeout UI warnings
- Session management test suite
- All middleware protections working correctly

---

### Day 7: Integration, Documentation & Deployment
**Tasks:**
- End-to-end testing of all flows
- Security documentation
- Deployment guide
- Migration verification
- Production deployment preparation

**Deliverables:**
- Comprehensive integration test suite
- Security architecture documentation
- Deployment guide with rollback procedures
- All migrations tested and verified
- Production-ready deployment package

---

## 7. File Modifications Summary

### 7.1 New Files to Create

**Security Components:**
- `lib/auth/rate-limiter.ts` - Redis-based rate limiting
- `lib/auth/account-lockout.ts` - Account lockout service
- `lib/auth/password-policy.ts` - Password validation engine
- `lib/auth/audit-logger.ts` - Audit logging system
- `lib/auth/error-handler.ts` - Secure error handling
- `lib/auth/oauth-security.ts` - OAuth state and PKCE
- `lib/auth/input-validator.ts` - Input validation layer

**Testing Files:**
- `app/auth/__tests__/login.test.ts`
- `app/auth/__tests__/signup.test.ts`
- `app/auth/__tests__/oauth.test.ts`
- `app/auth/__tests__/password-reset.test.ts`
- `app/auth/__tests__/rate-limiting.test.ts`
- `app/auth/__tests__/account-lockout.test.ts`
- `app/auth/__tests__/password-policy.test.ts`
- `app/auth/__tests__/csrf-protection.test.ts`
- `app/auth/__tests__/audit-logging.test.ts`
- `app/auth/__tests__/helpers/mocks.ts`
- `app/auth/__tests__/helpers/test-utils.ts`

**Data Files:**
- `lib/auth/common-passwords.ts` - Top 10,000 common passwords blacklist

**Migrations:**
- `supabase/migrations/20260407000001_security_audit_logging.sql`
- `supabase/migrations/20260407000002_failed_login_attempts.sql`

**Documentation:**
- `docs/security/ARCHITECTURE.md` - Security architecture overview
- `docs/security/DEPLOYMENT.md` - Deployment procedures
- `docs/security/MONITORING.md` - Monitoring and alerting guide

### 7.2 Files to Modify

**Core Authentication:**
- `lib/api.ts` - Add rate limiting, lockout, password validation, OAuth security, audit logging
- `middleware.ts` - Add unified auth protection, CSRF rotation, session timeout, security headers
- `components/ui/auth-page.tsx` - Add password requirements display, error sanitization, loading states
- `app/auth/callback/route.ts` - Add state parameter validation, PKCE verification, enhanced error handling
- `lib/csrf.ts` - Add token rotation, session binding, improved validation

**Configuration:**
- `lib/config.ts` - Add security configuration constants
- `package.json` - Add testing dependencies (jest, @types/jest, etc.) and Redis client (ioredis)
- `jest.config.js` - New Jest configuration
- `.env.example` - Add new environment variables (REDIS_URL, etc.)

---

## 8. Migration Strategy

### 8.1 Local Migration Storage

**Directory Structure:**
```
supabase/migrations/
├── 20260407000001_security_audit_logging.sql
├── 20260407000002_failed_login_attempts.sql
└── README.md  // Migration documentation
```

### 8.2 Migration Process

**Development Workflow:**
1. Create migration file with timestamp and descriptive name
2. Write SQL migration locally with proper comments
3. Test migration in development environment
4. Apply to development via MCP `apply_migration` tool
5. Verify migration success and functionality
6. Commit to git with descriptive commit message
7. Update migration README

**Production Deployment:**
1. Review all migrations for production readiness
2. Create backup of production database
3. Apply migrations to production via MCP `apply_migration` tool
4. Verify migration success
5. Test critical functionality
6. Monitor for issues

**Migration Tools:**
```bash
# Apply migration via MCP (recommended)
# Use the Supabase MCP tool: mcp__plugin_supabase_supabase__apply_migration

# Rollback procedure
# Each migration should include rollback SQL in comments
-- ROLLBACK: DROP TABLE IF EXISTS public.failed_login_attempts;
```

### 8.3 Migration Benefits

- ✅ Version control for all database changes
- ✅ Rollback capability
- ✅ Consistent environments (dev, staging, production)
- ✅ Audit trail of changes
- ✅ No manual SQL execution discrepancies
- ✅ Automated deployment via MCP tools
- ✅ Reduced human error risk

---

## 9. Security Monitoring & Alerting

### 9.1 Key Metrics

**Authentication Metrics:**
- Failed login attempts per email/IP (threshold: 10/hour)
- Account lockouts triggered per day
- OAuth state validation failures
- CSRF token validation failures
- Rate limit violations
- Password reset requests per email
- Unusual authentication patterns
- Geographic location anomalies

### 9.2 Alert Configuration

**Critical Alerts (Immediate Notification):**
- 10+ failed logins from same IP within 1 hour
- 5+ account lockouts from same IP
- OAuth state parameter validation failures
- Successful authentication from unusual geographic location
- CSRF token validation failures spike

**Warning Alerts (Hourly Summary):**
- Increased failed login patterns
- Multiple password reset requests from same IP
- Unusual authentication timing
- Rate limit violations above normal baseline

### 9.3 Monitoring Implementation

```typescript
// lib/auth/security-monitor.ts
export class SecurityMonitor {
  async checkSuspiciousPatterns(ipAddress: string, email: string): Promise<{
    suspicious: boolean;
    reason?: string;
  }> {
    // Check for patterns indicating automated attacks
    const recentFailedAttempts = await this.getRecentFailedAttempts(ipAddress, email);
    
    if (recentFailedAttempts >= 10) {
      return {
        suspicious: true,
        reason: 'High volume of failed attempts from single IP'
      };
    }
    
    // Check for timing patterns (indicates automated attacks)
    const timingPattern = await this.analyzeTimingPattern(ipAddress);
    if (timingPattern.suspicious) {
      return {
        suspicious: true,
        reason: 'Automated attack pattern detected'
      };
    }
    
    return { suspicious: false };
  }
  
  async triggerAlert(event: SecurityEvent): Promise<void> {
    // Send alert to monitoring system
    await this.sendToAlertingService({
      severity: event.severity,
      message: event.message,
      metadata: event.metadata
    });
  }
}
```

---

## 10. Success Criteria & Validation

### 10.1 Security Validation Checklist

**Before Deployment:**
- [ ] All rate limiters functional and tested
- [ ] Account lockout mechanism working correctly
- [ ] OAuth state parameter validation implemented
- [ ] PKCE implementation working
- [ ] Password complexity enforced (8+ chars, mixed case, numbers, special chars)
- [ ] Common password rejection functional
- [ ] Generic error messages implemented
- [ ] CSRF token rotation functional
- [ ] Audit logging capturing all events
- [ ] Input validation comprehensive
- [ ] Session timeout configured
- [ ] All tests passing (target: 90%+ coverage)
- [ ] All migrations tested and verified
- [ ] Security documentation complete
- [ ] Deployment guide written

### 10.2 Post-Deployment Monitoring

**First 24 Hours:**
- Monitor failed login patterns
- Check for unexpected error increases
- Verify rate limiting effectiveness
- Confirm OAuth flows working
- Validate CSRF protection
- Check audit log functionality

**First Week:**
- Review audit logs for anomalies
- Check account lockout rates
- Monitor performance impact
- Validate user experience
- Review security metrics
- Fine-tune thresholds if needed

**First Month:**
- Comprehensive security review
- Performance analysis
- User experience assessment
- Threshold optimization
- Documentation updates
- Security training for team

---

## 11. Risk Mitigation

### 11.1 Implementation Risks

**Risk:** Breaking existing authentication flows  
**Mitigation:** Comprehensive testing, gradual rollout, rollback procedures

**Risk:** Performance impact from Redis calls  
**Mitigation:** Connection pooling, caching, monitoring

**Risk:** False positives in rate limiting  
**Mitigation:** Configurable thresholds, admin override, monitoring

**Risk:** User experience degradation  
**Mitigation:** Clear error messages, timeout warnings, gradual enforcement

### 11.2 Deployment Risks

**Risk:** Migration failures  
**Mitigation:** Backup procedures, rollback plans, testing

**Risk:** Redis connectivity issues  
**Mitigation:** Fallback mechanisms, monitoring, alerting

**Risk:** Configuration errors  
**Mitigation:** Configuration validation, staged deployment, monitoring

---

## 12. Conclusion

This comprehensive design addresses all 12 security vulnerabilities identified in the authentication audit while maintaining a practical 7-day implementation timeline. The solution provides:

✅ **Immediate Protection:** Rate limiting, account lockout, and OAuth security prevent critical attacks  
✅ **Long-term Security:** Password policies, audit logging, and session management provide ongoing protection  
✅ **Scalability:** Redis-based solutions support growth and multiple instances  
✅ **Maintainability:** Well-documented, tested, and modular design  
✅ **Monitoring:** Comprehensive logging and alerting for incident detection  
✅ **Compliance:** Addresses OWASP Top 10 vulnerabilities and security best practices  

The implementation plan balances security requirements with deployment urgency, ensuring production readiness within 7 days while establishing a foundation for ongoing security improvements.

---

**Next Steps:**
1. User review and approval of this design
2. Proceed to implementation planning phase
3. Begin 7-day implementation timeline
4. Deploy to production
5. Monitor and optimize based on production data

---

**Document Status:** Design Complete  
**Approval Status:** Pending User Review  
**Next Phase:** Implementation Planning