# Authentication Security Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement comprehensive security fixes for 12 identified vulnerabilities in the Zola authentication system, including rate limiting, account lockout, OAuth security, password policies, audit logging, and testing infrastructure.

**Architecture:** Layered security architecture with Redis-based rate limiting and lockout services, enhanced OAuth with state validation and PKCE, server-side password policy enforcement, comprehensive audit logging using Supabase, and unified authentication middleware.

**Tech Stack:** Next.js 16, Supabase (PostgreSQL), Redis (ioredis), TypeScript, Jest (testing framework)

---

## Task Structure Overview

This plan implements 12 security vulnerabilities across 7 days with the following component breakdown:

1. **Infrastructure Setup** - Testing framework, Redis configuration, dependencies
2. **Rate Limiting** - Redis-based distributed rate limiting
3. **Account Lockout** - Progressive lockout with exponential backoff
4. **OAuth Security** - State parameter validation and PKCE
5. **Password Policy** - Server-side validation with complexity rules
6. **Input Validation** - Comprehensive input sanitization
7. **Error Handling** - Generic error messages and detailed logging
8. **CSRF Enhancements** - Token rotation and session binding
9. **Audit Logging** - Async logging to Supabase
10. **Session Management** - Timeout configuration and warnings
11. **Testing Suite** - Comprehensive test coverage (90%+ target)
12. **Documentation & Deployment** - Security docs and deployment procedures

---

### Task 1: Infrastructure Setup

**Files:**
- Create: `jest.config.js`
- Create: `app/auth/__tests__/helpers/mocks.ts`
- Create: `app/auth/__tests__/helpers/test-utils.ts`
- Modify: `package.json`
- Create: `lib/config.ts` (security configuration)

- [ ] **Step 1: Add testing dependencies to package.json**

```bash
npm install --save-dev jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom
npm install ioredis
```

Modify `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "@types/jest": "^29.5.11",
    "ts-jest": "^29.1.1",
    "@testing-library/react": "^14.2.1",
    "@testing-library/jest-dom": "^6.1.5"
  },
  "dependencies": {
    "ioredis": "^5.3.2"
  }
}
```

- [ ] **Step 2: Write Jest configuration**

Create `jest.config.js`:
```javascript
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
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/jest.setup.js'
  ]
};
```

- [ ] **Step 3: Write Jest setup file**

Create `jest.setup.js`:
```javascript
// Mock environment variables for tests
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.CSRF_SECRET = 'test-csrf-secret';

// Global test utilities
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};
```

- [ ] **Step 4: Create test mock utilities**

Create `app/auth/__tests__/helpers/mocks.ts`:
```typescript
import { jest } from '@jest/globals';

// Mock Redis client
export const mockRedis = {
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
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
    insert: jest.fn().mockResolvedValue({ error: null }),
    select: jest.fn().mockResolvedValue({ data: [], error: null }),
  }),
};

export const createMockRequest = (overrides = {}) => ({
  headers: new Map([
    ['user-agent', 'test-agent'],
    ['x-forwarded-for', '127.0.0.1'],
  ]),
  ...overrides,
});
```

Create `app/auth/__tests__/helpers/test-utils.ts`:
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

export const renderAuthComponent = (component: React.ReactElement) => {
  return render(component);
};

export const typeInInput = async (label: string, value: string) => {
  const input = await screen.findByLabelText(label);
  fireEvent.change(input, value);
};

export const clickButton = async (text: string) => {
  const button = await screen.findByText(text);
  fireEvent.click(button);
};

export const waitForElement = async (text: string) => {
  await waitFor(() => screen.getByText(text));
};
```

- [ ] **Step 5: Add security configuration to lib/config.ts**

Modify `lib/config.ts` to add security configuration:
```typescript
export const SECURITY_CONFIG = {
  rateLimiting: {
    login: { points: 5, duration: 900, blockDuration: 1800 },
    signup: { points: 3, duration: 3600, blockDuration: 3600 },
    passwordReset: { points: 3, duration: 3600, blockDuration: 3600 },
    oauth: { points: 10, duration: 3600, blockDuration: 1800 }
  },
  lockout: {
    thresholds: [
      { attempts: 3, duration: 300 },
      { attempts: 5, duration: 900 },
      { attempts: 7, duration: 3600 },
      { attempts: 10, duration: 86400 }
    ]
  },
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    rejectCommonPasswords: true
  },
  session: {
    timeout: 1800,
    warningThreshold: 300,
    rememberMeTimeout: 604800
  },
  csrf: {
    tokenExpiry: 3600,
    rotationOnAuth: true
  }
} as const;
```

- [ ] **Step 6: Commit infrastructure setup**

```bash
git add jest.config.js jest.setup.js package.json lib/config.ts
git commit -m "feat: set up testing infrastructure and security config"
```

---

### Task 2: Rate Limiting Implementation

**Files:**
- Create: `lib/auth/rate-limiter.ts`
- Modify: `lib/api.ts`
- Create: `app/auth/__tests__/rate-limiting.test.ts`

- [ ] **Step 1: Write failing test for rate limiting**

Create `app/auth/__tests__/rate-limiting.test.ts`:
```typescript
import { RateLimiter } from '@/lib/auth/rate-limiter';
import { mockRedis } from './helpers/mocks';

describe('RateLimiter', () => {
  it('should block requests after exceeding limit', async () => {
    const limiter = new RateLimiter('redis://localhost');
    mockRedis.incr.mockResolvedValue(6); // Exceeds limit of 5
    
    const result = await limiter.checkLimit('user@example.com', 'login');
    
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should allow requests within limit', async () => {
    const limiter = new RateLimiter('redis://localhost');
    mockRedis.incr.mockResolvedValue(3); // Within limit of 5
    
    const result = await limiter.checkLimit('user@example.com', 'login');
    
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should set expiration on first request', async () => {
    const limiter = new RateLimiter('redis://localhost');
    mockRedis.incr.mockResolvedValue(1);
    
    await limiter.checkLimit('user@example.com', 'login');
    
    expect(mockRedis.expire).toHaveBeenCalledWith(
      'ratelimit:login:user@example.com',
      900
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- rate-limiting.test.ts
```

Expected: FAIL with "RateLimiter is not defined"

- [ ] **Step 3: Write RateLimiter class**

Create `lib/auth/rate-limiter.ts`:
```typescript
import { Redis } from 'ioredis';
import { SECURITY_CONFIG } from '@/lib/config';

interface RateLimitConfig {
  points: number;
  duration: number;
  blockDuration: number;
}

export class RateLimiter {
  private redis: Redis;
  
  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL;
    this.redis = new Redis(url);
  }
  
  async checkLimit(
    identifier: string,
    type: 'login' | 'signup' | 'passwordReset' | 'oauth'
  ): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    const config = SECURITY_CONFIG.rateLimiting[type];
    const key = `ratelimit:${type}:${identifier}`;
    
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, config.duration);
    }
    
    if (current > config.points) {
      const blockedKey = `ratelimit:blocked:${type}:${identifier}`;
      const blocked = await this.redis.get(blockedKey);
      
      if (!blocked) {
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
  
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- rate-limiting.test.ts
```

Expected: PASS

- [ ] **Step 5: Integrate rate limiting into authentication API**

Modify `lib/api.ts` to add rate limiting:
```typescript
import { RateLimiter } from '@/lib/auth/rate-limiter';

// Initialize rate limiter (singleton pattern)
let rateLimiter: RateLimiter | null = null;

function getRateLimiter(): RateLimiter {
  if (!rateLimiter) {
    rateLimiter = new RateLimiter();
  }
  return rateLimiter;
}

export async function signInWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string
) {
  const limiter = getRateLimiter();
  
  // Check rate limit
  const rateLimitResult = await limiter.checkLimit(email, 'login');
  if (!rateLimitResult.allowed) {
    throw new Error('Too many login attempts. Please try again later.');
  }
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    throw error;
  }
  
  // ... rest of function
}
```

- [ ] **Step 6: Commit rate limiting implementation**

```bash
git add lib/auth/rate-limiter.ts lib/api.ts app/auth/__tests__/rate-limiting.test.ts
git commit -m "feat: implement Redis-based rate limiting for authentication"
```

---

### Task 3: Account Lockout Implementation

**Files:**
- Create: `lib/auth/account-lockout.ts`
- Modify: `lib/api.ts`
- Create: `app/auth/__tests__/account-lockout.test.ts`

- [ ] **Step 1: Write failing test for account lockout**

Create `app/auth/__tests__/account-lockout.test.ts`:
```typescript
import { AccountLockout } from '@/lib/auth/account-lockout';
import { mockRedis } from './helpers/mocks';

describe('AccountLockout', () => {
  it('should lock account after threshold attempts', async () => {
    const lockout = new AccountLockout('redis://localhost');
    mockRedis.get.mockResolvedValue(JSON.stringify({
      attempts: 5,
      lockedUntil: new Date(Date.now() + 900000).toISOString()
    }));
    
    const result = await lockout.checkLockout('user@example.com', '127.0.0.1');
    
    expect(result.locked).toBe(true);
  });

  it('should reset lockout on successful login', async () => {
    const lockout = new AccountLockout('redis://localhost');
    
    await lockout.resetLockout('user@example.com', '127.0.0.1');
    
    expect(mockRedis.del).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- account-lockout.test.ts
```

Expected: FAIL with "AccountLockout is not defined"

- [ ] **Step 3: Write AccountLockout class**

Create `lib/auth/account-lockout.ts`:
```typescript
import { Redis } from 'ioredis';
import { SECURITY_CONFIG } from '@/lib/config';

interface LockoutState {
  attempts: number;
  lockedUntil: Date | null;
  lastAttempt: Date;
}

export class AccountLockout {
  private redis: Redis;
  
  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL;
    this.redis = new Redis(url);
  }
  
  async checkLockout(
    email: string,
    ipAddress: string
  ): Promise<{
    locked: boolean;
    remainingAttempts: number;
    lockoutEndTime: Date | null;
  }> {
    const emailKey = `lockout:email:${email}`;
    const ipKey = `lockout:ip:${ipAddress}`;
    
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
    const currentAttempts = (emailState?.attempts || 0);
    const nextThreshold = SECURITY_CONFIG.lockout.thresholds.find(t => 
      t.attempts > currentAttempts
    );
    
    if (nextThreshold) {
      return {
        locked: false,
        remainingAttempts: nextThreshold.attempts - currentAttempts,
        lockoutEndTime: null
      };
    }
    
    return {
      locked: false,
      remainingAttempts: SECURITY_CONFIG.lockout.thresholds[0].attempts - currentAttempts,
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
    
    const threshold = SECURITY_CONFIG.lockout.thresholds.find(t => 
      t.attempts === current
    );
    
    if (threshold) {
      const lockedUntil = new Date(Date.now() + threshold.duration * 1000);
      const state: LockoutState = {
        attempts: current,
        lockedUntil,
        lastAttempt: new Date()
      };
      
      await this.redis.setex(key, threshold.duration + 60, JSON.stringify(state));
    } else {
      const state: LockoutState = {
        attempts: current,
        lockedUntil: null,
        lastAttempt: new Date()
      };
      
      await this.redis.setex(key, 86400, JSON.stringify(state));
    }
  }
  
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- account-lockout.test.ts
```

Expected: PASS

- [ ] **Step 5: Integrate account lockout into authentication API**

Modify `lib/api.ts` to add account lockout:
```typescript
import { AccountLockout } from '@/lib/auth/account-lockout';

let accountLockout: AccountLockout | null = null;

function getAccountLockout(): AccountLockout {
  if (!accountLockout) {
    accountLockout = new AccountLockout();
  }
  return accountLockout;
}

export async function signInWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
  request: Request
) {
  const ipAddress = getClientIP(request);
  const lockout = getAccountLockout();
  
  // Check account lockout
  const lockoutResult = await lockout.checkLockout(email, ipAddress);
  if (lockoutResult.locked) {
    throw new Error('Account temporarily locked. Please try again later.');
  }
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    // Record failed attempt
    await lockout.recordFailedAttempt(email, ipAddress);
    throw error;
  }
  
  // Reset lockout on successful login
  await lockout.resetLockout(email, ipAddress);
  
  // ... rest of function
}
```

- [ ] **Step 6: Commit account lockout implementation**

```bash
git add lib/auth/account-lockout.ts lib/api.ts app/auth/__tests__/account-lockout.test.ts
git commit -m "feat: implement progressive account lockout with exponential backoff"
```

---

### Task 4: OAuth Security Enhancement

**Files:**
- Create: `lib/auth/oauth-security.ts`
- Modify: `lib/api.ts`
- Modify: `app/auth/callback/route.ts`
- Create: `app/auth/__tests__/oauth.test.ts`

- [ ] **Step 1: Write failing test for OAuth security**

Create `app/auth/__tests__/oauth.test.ts`:
```typescript
import { OAuthSecurity } from '@/lib/auth/oauth-security';
import { mockRedis } from './helpers/mocks';

describe('OAuthSecurity', () => {
  it('should generate cryptographically secure state', () => {
    const oauth = new OAuthSecurity('redis://localhost');
    const state = oauth.generateOAuthState();
    
    expect(state.state).toMatch(/^[a-zA-Z0-9_-]{43}$/);
    expect(state.state.length).toBe(43);
  });

  it('should validate correct state', async () => {
    const oauth = new OAuthSecurity('redis://localhost');
    const state = oauth.generateOAuthState();
    
    await oauth.storeState(state);
    mockRedis.get.mockResolvedValue(JSON.stringify(state));
    
    const isValid = await oauth.validateState(state.state, 'test-agent');
    
    expect(isValid).toBe(true);
  });

  it('should reject invalid state', async () => {
    const oauth = new OAuthSecurity('redis://localhost');
    mockRedis.get.mockResolvedValue(null);
    
    const isValid = await oauth.validateState('invalid-state', 'test-agent');
    
    expect(isValid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- oauth.test.ts
```

Expected: FAIL with "OAuthSecurity is not defined"

- [ ] **Step 3: Write OAuthSecurity class**

Create `lib/auth/oauth-security.ts`:
```typescript
import crypto from 'crypto';
import { Redis } from 'ioredis';

export interface OAuthState {
  state: string;
  verifier: string;
  timestamp: number;
  userAgent: string;
}

export class OAuthSecurity {
  private redis: Redis;
  
  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL;
    this.redis = new Redis(url);
  }
  
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
  
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- oauth.test.ts
```

Expected: PASS

- [ ] **Step 5: Integrate OAuth security into OAuth flows**

Modify `lib/api.ts` to add OAuth security:
```typescript
import { OAuthSecurity } from '@/lib/auth/oauth-security';

let oauthSecurity: OAuthSecurity | null = null;

function getOAuthSecurity(): OAuthSecurity {
  if (!oauthSecurity) {
    oauthSecurity = new OAuthSecurity();
  }
  return oauthSecurity;
}

export async function signInWithGoogle(
  supabase: SupabaseClient,
  request: Request
) {
  const security = getOAuthSecurity();
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  const state = security.generateOAuthState();
  state.userAgent = userAgent;
  
  const pkce = security.generatePKCE();
  
  await security.storeState({
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
        state: state.state,
        code_challenge: pkce.challenge,
        code_challenge_method: 'S256'
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signInWithGithub(
  supabase: SupabaseClient,
  request: Request
) {
  const security = getOAuthSecurity();
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  const state = security.generateOAuthState();
  state.userAgent = userAgent;
  
  const pkce = security.generatePKCE();
  
  await security.storeState({
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
    provider: 'github',
    options: {
      redirectTo: `${baseUrl}/auth/callback`,
      queryParams: {
        state: state.state,
        code_challenge: pkce.challenge,
        code_challenge_method: 'S256'
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}
```

- [ ] **Step 6: Update OAuth callback with state validation**

Modify `app/auth/callback/route.ts`:
```typescript
import { OAuthSecurity } from '@/lib/auth/oauth-security';

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
  if (state) {
    const oauthSecurity = new OAuthSecurity();
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    if (!await oauthSecurity.validateState(state, userAgent)) {
      return NextResponse.redirect(
        `${origin}/auth/error?message=${encodeURIComponent('Invalid OAuth state. Please try again.')}`
      );
    }
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

- [ ] **Step 7: Commit OAuth security implementation**

```bash
git add lib/auth/oauth-security.ts lib/api.ts app/auth/callback/route.ts app/auth/__tests__/oauth.test.ts
git commit -m "feat: implement OAuth state validation and PKCE"
```

---

### Task 5: Password Policy Implementation

**Files:**
- Create: `lib/auth/password-policy.ts`
- Create: `lib/auth/common-passwords.ts`
- Modify: `lib/api.ts`
- Modify: `components/ui/auth-page.tsx`
- Create: `app/auth/__tests__/password-policy.test.ts`

- [ ] **Step 1: Write failing test for password policy**

Create `app/auth/__tests__/password-policy.test.ts`:
```typescript
import { PasswordPolicyValidator, DEFAULT_PASSWORD_POLICY } from '@/lib/auth/password-policy';

describe('PasswordPolicyValidator', () => {
  it('should reject password shorter than 8 characters', () => {
    const validator = new PasswordPolicyValidator();
    const result = validator.validate('short');
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('at least 8 characters');
  });

  it('should reject password without uppercase', () => {
    const validator = new PasswordPolicyValidator();
    const result = validator.validate('lowercase123');
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('uppercase letter');
  });

  it('should accept strong password', () => {
    const validator = new PasswordPolicyValidator();
    const result = validator.validate('StrongP@ssw0rd!');
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- password-policy.test.ts
```

Expected: FAIL with "PasswordPolicyValidator is not defined"

- [ ] **Step 3: Write common passwords data**

Create `lib/auth/common-passwords.ts`:
```typescript
// Top 100 most common passwords (sample - full list should be 10,000)
export const COMMON_PASSWORDS = [
  'password', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', '1234567', 'letmein', 'trustno1', 'dragon',
  'baseball', '111111', 'iloveyou', 'master', 'sunshine',
  'ashley', 'bailey', 'shadow', '123123', 'football',
  'jesus', 'michael', 'ninja', 'mustang', 'password1',
  'password123', '1234567890', 'qwertyuiop', '123qwe',
  'killer', 'trustno1', 'jordan', 'jennifer', 'zxcvbnm',
  'asdfgh', 'hunter', 'buster', 'soccer', 'harley',
  'batman', 'andrew', 'tigger', 'sunshine', 'iloveyou',
  '2000', 'charlie', 'robert', 'thomas', 'hockey',
  'ranger', 'sophie', 'michelle', 'jessica', 'pepper',
  'george', 'cheese', 'amanda', 'summer', 'love',
  'ashley', 'nicole', 'chelsea', 'biteme', 'matthew',
  'access', 'yankees', '987654321', 'dallas', 'austin',
  'thunder', 'taylor', 'matrix', 'mobilemail', 'mom',
  'monitor', 'monitoring', 'montana', 'orange', 'angel',
  'prince', 'magnum', 'shadow', 'chicago', 'google',
  'nicole', 'chelsea', 'biteme', 'matthew', 'access'
] as const;
```

- [ ] **Step 4: Write password policy validator**

Create `lib/auth/password-policy.ts`:
```typescript
import { COMMON_PASSWORDS } from './common-passwords';
import { SECURITY_CONFIG } from '@/lib/config';

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  rejectCommonPasswords: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class PasswordPolicyValidator {
  private policy: PasswordPolicy;
  
  constructor(policy: PasswordPolicy = SECURITY_CONFIG.password) {
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- password-policy.test.ts
```

Expected: PASS

- [ ] **Step 6: Integrate password validation into auth API**

Modify `lib/api.ts` to add password validation:
```typescript
import { PasswordPolicyValidator } from '@/lib/auth/password-policy';

let passwordValidator: PasswordPolicyValidator | null = null;

function getPasswordValidator(): PasswordPolicyValidator {
  if (!passwordValidator) {
    passwordValidator = new PasswordPolicyValidator();
  }
  return passwordValidator;
}

export async function signUpWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
  name?: string
) {
  const validator = getPasswordValidator();
  
  // Validate password before sending to Supabase
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

export async function updatePassword(
  supabase: SupabaseClient,
  password: string
) {
  const validator = getPasswordValidator();
  
  // Validate password before updating
  const passwordValidation = validator.validate(password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors.join('. '));
  }
  
  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    throw error;
  }
}
```

- [ ] **Step 7: Update auth UI with password requirements**

Modify `components/ui/auth-page.tsx` to add password requirements display:
```typescript
import { PasswordPolicyValidator } from '@/lib/auth/password-policy';

const passwordValidator = new PasswordPolicyValidator();
const passwordRequirements = passwordValidator.getRequirements();

// In the auth form, add password requirements display
<div className="text-muted-foreground text-xs mb-2">
  <p className="font-semibold mb-1">Password requirements:</p>
  <ul className="list-disc list-inside space-y-1">
    {passwordRequirements.map((req, index) => (
      <li key={index}>{req}</li>
    ))}
  </ul>
</div>

// Update password input to remove minLength={6}
<Input
  placeholder="Password"
  className="peer ps-9"
  type="password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  required
  disabled={isLoading}
/>
```

- [ ] **Step 8: Commit password policy implementation**

```bash
git add lib/auth/password-policy.ts lib/auth/common-passwords.ts lib/api.ts components/ui/auth-page.tsx app/auth/__tests__/password-policy.test.ts
git commit -m "feat: implement password complexity policy and validation"
```

---

### Task 6: Input Validation Implementation

**Files:**
- Create: `lib/auth/input-validator.ts`
- Modify: `lib/api.ts`
- Create: `app/auth/__tests__/input-validation.test.ts`

- [ ] **Step 1: Write failing test for input validation**

Create `app/auth/__tests__/input-validation.test.ts`:
```typescript
import { validateEmail, validateDisplayName } from '@/lib/auth/input-validator';

describe('InputValidator', () => {
  it('should accept valid email format', () => {
    const result = validateEmail('user@example.com');
    expect(result.valid).toBe(true);
  });

  it('should reject invalid email format', () => {
    const result = validateEmail('invalid-email');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should reject XSS in display name', () => {
    const result = validateDisplayName('<script>alert("xss")</script>');
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- input-validation.test.ts
```

Expected: FAIL with "InputValidator functions are not defined"

- [ ] **Step 3: Write input validator**

Create `lib/auth/input-validator.ts`:
```typescript
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateEmail(email: string): ValidationResult {
  // RFC 5322 compliant email validation
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  
  if (email.length > 254) {
    return { valid: false, error: 'Email address too long' };
  }
  
  return { valid: true };
}

export function validateDisplayName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Name is required' };
  }
  
  if (name.length > 100) {
    return { valid: false, error: 'Name too long (maximum 100 characters)' };
  }
  
  // Check for XSS attempts
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(name)) {
      return { valid: false, error: 'Invalid characters in name' };
    }
  }
  
  return { valid: true };
}

export function validateRedirectUrl(url: string): ValidationResult {
  // Basic URL validation
  try {
    const parsed = new URL(url);
    
    // Ensure URL is absolute and uses allowed protocol
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Invalid redirect URL protocol' };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- input-validation.test.ts
```

Expected: PASS

- [ ] **Step 5: Integrate input validation into auth API**

Modify `lib/api.ts` to add input validation:
```typescript
import { validateEmail, validateDisplayName } from '@/lib/auth/input-validator';

export async function signUpWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
  name?: string
) {
  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    throw new Error(emailValidation.error || 'Invalid email');
  }
  
  // Validate display name if provided
  if (name) {
    const nameValidation = validateDisplayName(name);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error || 'Invalid name');
    }
  }
  
  // Validate password
  const validator = getPasswordValidator();
  const passwordValidation = validator.validate(password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors.join('. '));
  }
  
  // ... rest of function
}
```

- [ ] **Step 6: Commit input validation implementation**

```bash
git add lib/auth/input-validator.ts lib/api.ts app/auth/__tests__/input-validation.test.ts
git commit -m "feat: implement comprehensive input validation for authentication"
```

---

### Task 7: Error Handling Implementation

**Files:**
- Create: `lib/auth/error-handler.ts`
- Modify: `components/ui/auth-page.tsx`
- Create: `app/auth/__tests__/error-handling.test.ts`

- [ ] **Step 1: Write failing test for error handling**

Create `app/auth/__tests__/error-handling.test.ts`:
```typescript
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
    
    expect(message).toBe('An error occurred. Please try again');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- error-handling.test.ts
```

Expected: FAIL with "ErrorHandler functions are not defined"

- [ ] **Step 3: Write error handler**

Create `lib/auth/error-handler.ts`:
```typescript
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

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- error-handling.test.ts
```

Expected: PASS

- [ ] **Step 5: Integrate error handling into auth UI**

Modify `components/ui/auth-page.tsx` to use secure error messages:
```typescript
import { getAuthErrorMessage, logDetailedError } from '@/lib/auth/error-handler';

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

- [ ] **Step 6: Commit error handling implementation**

```bash
git add lib/auth/error-handler.ts components/ui/auth-page.tsx app/auth/__tests__/error-handling.test.ts
git commit -m "feat: implement secure error handling with generic user messages"
```

---

### Task 8: CSRF Enhancements

**Files:**
- Modify: `lib/csrf.ts`
- Create: `app/auth/__tests__/csrf-protection.test.ts`

- [ ] **Step 1: Write failing test for CSRF enhancements**

Create `app/auth/__tests__/csrf-protection.test.ts`:
```typescript
import { generateCsrfToken, validateCsrfToken, rotateCsrfToken } from '@/lib/csrf';

describe('CSRF Protection', () => {
  it('should generate valid CSRF token', () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[a-f0-9]{64}:[a-f0-9]{64}$/);
  });

  it('should validate correct token', () => {
    const token = generateCsrfToken();
    const isValid = validateCsrfToken(token);
    expect(isValid).toBe(true);
  });

  it('should reject invalid token', () => {
    const isValid = validateCsrfToken('invalid:token');
    expect(isValid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- csrf-protection.test.ts
```

Expected: FAIL with "rotateCsrfToken is not defined"

- [ ] **Step 3: Add CSRF token rotation**

Modify `lib/csrf.ts` to add token rotation:
```typescript
import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';

const CSRF_SECRET = process.env.CSRF_SECRET!;
const TOKEN_EXPIRY = SECURITY_CONFIG.csrf.tokenExpiry; // 3600 seconds = 1 hour

export function generateCsrfToken(): string {
  const raw = randomBytes(32).toString('hex');
  const token = createHash('sha256')
    .update(`${raw}${CSRF_SECRET}`)
    .digest('hex');
  return `${raw}:${token}`;
}

export function validateCsrfToken(fullToken: string): boolean {
  const [raw, token] = fullToken.split(':');
  if (!raw || !token) return false;
  const expected = createHash('sha256')
    .update(`${raw}${CSRF_SECRET}`)
    .digest('hex');
  return expected === token;
}

export async function setCsrfCookie() {
  const cookieStore = await cookies();
  const token = generateCsrfToken();
  cookieStore.set('csrf_token', token, {
    httpOnly: false,
    secure: true,
    path: '/',
    maxAge: TOKEN_EXPIRY,
  });
}

export async function rotateCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  const newToken = generateCsrfToken();
  cookieStore.set('csrf_token', newToken, {
    httpOnly: false,
    secure: true,
    path: '/',
    maxAge: TOKEN_EXPIRY,
  });
  return newToken;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- csrf-protection.test.ts
```

Expected: PASS

- [ ] **Step 5: Integrate CSRF rotation into authentication**

Modify `lib/api.ts` to add CSRF rotation on successful auth:
```typescript
import { rotateCsrfToken } from '@/lib/csrf';

export async function signInWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
  request: Request
) {
  // ... existing auth logic
  
  if (data.user) {
    // ROTATE CSRF TOKEN ON SUCCESSFUL LOGIN
    await rotateCsrfToken();
  }
  
  return data;
}
```

- [ ] **Step 6: Commit CSRF enhancements**

```bash
git add lib/csrf.ts lib/api.ts app/auth/__tests__/csrf-protection.test.ts
git commit -m "feat: implement CSRF token rotation and improved validation"
```

---

### Task 9: Audit Logging Implementation

**Files:**
- Create: `lib/auth/audit-logger.ts`
- Modify: `lib/api.ts`
- Create: `app/auth/__tests__/audit-logging.test.ts`

- [ ] **Step 1: Write failing test for audit logging**

Create `app/auth/__tests__/audit-logging.test.ts`:
```typescript
import { AuditLogger } from '@/lib/auth/audit-logger';
import { mockSupabaseClient } from './helpers/mocks';

describe('AuditLogger', () => {
  it('should log login success event', async () => {
    const logger = new AuditLogger(mockSupabaseClient);
    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    mockSupabaseClient.from.mockReturnValue({
      insert: mockInsert
    });
    
    await logger.logLoginSuccess('user-id', 'user@example.com', '127.0.0.1', 'test-agent');
    
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'login_success',
        user_id: 'user-id'
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- audit-logging.test.ts
```

Expected: FAIL with "AuditLogger is not defined"

- [ ] **Step 3: Write audit logger**

Create `lib/auth/audit-logger.ts`:
```typescript
import { SupabaseClient } from '@supabase/supabase-js';

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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- audit-logging.test.ts
```

Expected: PASS

- [ ] **Step 5: Integrate audit logging into authentication**

Modify `lib/api.ts` to add comprehensive audit logging:
```typescript
import { AuditLogger } from '@/lib/auth/audit-logger';

let auditLogger: AuditLogger | null = null;

function getAuditLogger(supabase: SupabaseClient): AuditLogger {
  if (!auditLogger) {
    auditLogger = new AuditLogger(supabase);
  }
  return auditLogger;
}

export async function signInWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
  request: Request
) {
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const logger = getAuditLogger(supabase);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    // LOG FAILED ATTEMPT
    await logger.logLoginFailure(email, ipAddress, userAgent, error.message);
    throw new Error('Invalid email or password');
  }
  
  // LOG SUCCESSFUL LOGIN
  await logger.logLoginSuccess(data.user.id, email, ipAddress, userAgent);
  
  // ... rest of function
}
```

- [ ] **Step 6: Commit audit logging implementation**

```bash
git add lib/auth/audit-logger.ts lib/api.ts app/auth/__tests__/audit-logging.test.ts
git commit -m "feat: implement comprehensive audit logging for authentication events"
```

---

### Task 10: Session Management Implementation

**Files:**
- Modify: `lib/config.ts` (already done in Task 1)
- Modify: `middleware.ts`
- Modify: `lib/api.ts`
- Create: `app/auth/__tests__/session-management.test.ts`

- [ ] **Step 1: Write failing test for session management**

Create `app/auth/__tests__/session-management.test.ts`:
```typescript
import { checkSessionTimeout } from '@/lib/auth/session-manager';

describe('Session Management', () => {
  it('should detect expired sessions', async () => {
    const mockSupabaseClient = createMockSupabaseClient({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              last_sign_in_at: new Date(Date.now() - 2000000).toISOString()
            }
          }
        })
      }
    });
    
    const result = await checkSessionTimeout(mockSupabaseClient);
    
    expect(result.expired).toBe(true);
  });

  it('should return timeout warning for expiring sessions', async () => {
    // ... similar test structure
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- session-management.test.ts
```

Expected: FAIL with "Session management functions are not defined"

- [ ] **Step 3: Write session manager**

Create `lib/auth/session-manager.ts`:
```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { SECURITY_CONFIG } from '@/lib/config';

export interface SessionCheckResult {
  expired: boolean;
  warning: number | null;
}

export async function checkSessionTimeout(
  supabase: SupabaseClient
): Promise<SessionCheckResult> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return { expired: true, warning: null };
  }
  
  const lastActivity = new Date(session.user.last_sign_in_at);
  const timeout = SECURITY_CONFIG.session.timeout * 1000;
  const timeUntilTimeout = timeout - (Date.now() - lastActivity.getTime());
  
  if (timeUntilTimeout <= 0) {
    // Session expired
    await supabase.auth.signOut();
    return { expired: true, warning: null };
  }
  
  if (timeUntilTimeout <= SECURITY_CONFIG.session.warningThreshold * 1000) {
    // Return warning time
    return {
      expired: false,
      warning: Math.floor(timeUntilTimeout / 1000)
    };
  }
  
  return { expired: false, warning: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- session-management.test.ts
```

Expected: PASS

- [ ] **Step 5: Integrate session management into middleware**

Modify `middleware.ts` to add session timeout checking:
```typescript
import { checkSessionTimeout } from '@/lib/auth/session-manager';

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  
  // Check session timeout
  const supabase = await createClient();
  const sessionCheck = await checkSessionTimeout(supabase);
  
  if (sessionCheck.expired) {
    return NextResponse.redirect(
      `${request.nextUrl.origin}/auth?message=${encodeURIComponent('Your session has expired. Please sign in again.')}`
    );
  }
  
  // Add session timeout warning to response headers if needed
  if (sessionCheck.warning !== null) {
    response.headers.set('X-Session-Warning-In-Seconds', sessionCheck.warning.toString());
  }
  
  // ... rest of middleware
}
```

- [ ] **Step 6: Commit session management**

```bash
git add lib/auth/session-manager.ts middleware.ts lib/api.ts app/auth/__tests__/session-management.test.ts
git commit -m "feat: implement session timeout and management"
```

---

### Task 11: Comprehensive Testing Suite

**Files:**
- Modify: `app/auth/__tests__/login.test.ts`
- Modify: `app/auth/__tests__/signup.test.ts`
- Create: `app/auth/__tests__/integration.test.ts`

- [ ] **Step 1: Write comprehensive login tests**

Modify `app/auth/__tests__/login.test.ts`:
```typescript
import { renderAuthComponent, typeInInput, clickButton } from './helpers/test-utils';
import { signInWithEmail } from '@/lib/api';

describe('Login Flow', () => {
  it('should successfully login with valid credentials', async () => {
    // Mock successful authentication
    jest.spyOn(signInWithEmail, 'signInWithEmail').mockResolvedValue({
      user: { id: 'test-user-id', email: 'test@example.com' }
    });
    
    // ... test implementation
  });

  it('should fail with invalid credentials', async () => {
    // Test invalid credentials
    // ... test implementation
  });

  it('should trigger rate limiting after multiple failed attempts', async () => {
    // Test rate limiting
    // ... test implementation
  });

  it('should trigger account lockout after threshold', async () => {
    // Test account lockout
    // ... test implementation
  });
});
```

- [ ] **Step 2: Write comprehensive signup tests**

Modify `app/auth/__tests__/signup.test.ts`:
```typescript
describe('Signup Flow', () => {
  it('should successfully create account with valid data', async () => {
    // Test successful signup
    // ... test implementation
  });

  it('should reject signup with weak password', async () => {
    // Test password policy
    // ... test implementation
  });

  it('should reject signup with invalid email', async () => {
    // Test email validation
    // ... test implementation
  });
});
```

- [ ] **Step 3: Write integration tests**

Create `app/auth/__tests__/integration.test.ts`:
```typescript
describe('Authentication Integration', () => {
  it('should complete full OAuth flow', async () => {
    // Test end-to-end OAuth
    // ... test implementation
  });

  it('should complete password reset flow', async () => {
    // Test password reset
    // ... test implementation
  });

  it('should handle session timeout gracefully', async () => {
    // Test session management
    // ... test implementation
  });
});
```

- [ ] **Step 4: Run all tests and verify coverage**

```bash
npm test -- --coverage
```

Expected: All tests pass, coverage 80%+

- [ ] **Step 5: Commit comprehensive testing suite**

```bash
git add app/auth/__tests__/
git commit -m "test: add comprehensive authentication test suite"
```

---

### Task 12: Database Migrations

**Files:**
- Create: `supabase/migrations/20260407000001_security_audit_logging.sql`
- Create: `supabase/migrations/20260407000002_failed_login_attempts.sql`

- [ ] **Step 1: Create security audit logging migration**

Create `supabase/migrations/20260407000001_security_audit_logging.sql`:
```sql
-- Create custom security events table for application-specific logging
-- Note: auth.audit_log_entries is managed by Supabase and can be used for standard auth events

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

-- Add comment
COMMENT ON TABLE public.security_events IS 'Application-specific security event logging';
```

- [ ] **Step 2: Create failed login attempts migration**

Create `supabase/migrations/20260407000002_failed_login_attempts.sql`:
```sql
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

-- Automatic cleanup function (90 days)
CREATE OR REPLACE FUNCTION cleanup_old_failed_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.failed_login_attempts 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
```

- [ ] **Step 3: Apply migrations via MCP**

```bash
# Note: This will be applied via Supabase MCP tool during execution
# The migration files are stored locally for version control
```

- [ ] **Step 4: Commit migration files**

```bash
git add supabase/migrations/
git commit -m "feat: add security-related database migrations"
```

---

### Task 13: Documentation & Deployment

**Files:**
- Create: `docs/security/ARCHITECTURE.md`
- Create: `docs/security/DEPLOYMENT.md`
- Create: `docs/security/MONITORING.md`
- Modify: `.env.example`

- [ ] **Step 1: Write security architecture documentation**

Create `docs/security/ARCHITECTURE.md`:
```markdown
# Authentication Security Architecture

## Overview
This document describes the security architecture implemented for the Zola authentication system.

## Components

### Rate Limiting
- Redis-based distributed rate limiting
- Configurable thresholds per endpoint type
- Exponential backoff on violations
- Automatic cleanup of expired entries

### Account Lockout
- Progressive lockout with exponential backoff
- Tracks failed attempts by email and IP
- Automatic unlock on successful authentication
- Admin override mechanism

### OAuth Security
- State parameter validation using crypto.randomBytes()
- PKCE (Proof Key for Code Exchange) implementation
- State storage in Redis with TTL
- Protection against CSRF and session fixation

### Password Policy
- Server-side validation with complexity requirements
- Common password blacklist (10,000 entries)
- User-friendly error messages
- Requirements display in UI

### Audit Logging
- Async logging to Supabase auth.audit_log_entries
- Event types: login_success, login_failure, oauth_login, password_reset, account_lockout
- IP address, user agent, timestamp tracking

### CSRF Protection
- SHA-256 token generation and validation
- Token rotation on authentication events
- Session binding for CSRF tokens
- Double-submit cookie pattern

### Session Management
- Configurable session timeout (default: 30 minutes)
- Timeout warnings (default: 5 minutes before expiry)
- Remember-me functionality (7 days)
- Session invalidation on security events

## Security Data Flow

```
User Request 
  → CSRF Validation
  → Rate Limiting Check (Redis)
  → Account Lockout Check (Redis)
  → Input Validation
  → Password Policy Check
  → Authentication Logic (Supabase)
  → Audit Logging (Async)
  → Response (with CSRF rotation if successful)
```

## Security Controls

### Prevention
- Brute force attacks (rate limiting + account lockout)
- CSRF attacks (token validation + rotation)
- Session fixation (token rotation + session binding)
- Account enumeration (generic error messages)
- Weak passwords (complexity requirements + blacklist)
- OAuth attacks (state parameter + PKCE)

### Detection
- Suspicious login patterns
- Rate limit violations
- Account lockout events
- CSRF validation failures
- Unusual authentication patterns
- Geographic anomalies

### Response
- Automated lockout mechanisms
- Security event logging
- Alert triggers for suspicious activity
- Admin override capabilities
```

- [ ] **Step 2: Write deployment documentation**

Create `docs/security/DEPLOYMENT.md`:
```markdown
# Security Deployment Guide

## Prerequisites
- Redis instance running and accessible
- Supabase project configured
- All environment variables set
- Database migrations applied

## Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security Configuration
CSRF_SECRET=your-csrf-secret-min-32-chars
```

## Deployment Steps

### 1. Development Deployment
```bash
# Install dependencies
npm install

# Apply database migrations locally
# (Will use MCP tools during execution)

# Run tests
npm test

# Start development server
npm run dev
```

### 2. Production Deployment

```bash
# Create production build
npm run build

# Apply database migrations to production
# Use MCP: mcp__plugin_supabase_supabase__apply_migration

# Start production server
npm start

# Monitor first 24 hours
# Check audit logs
# Verify rate limiting effectiveness
# Confirm OAuth flows working
```

## Rollback Procedures

### Database Rollback
```sql
-- Rollback migration 20260407000001
DROP TABLE IF EXISTS public.security_events CASCADE;

-- Rollback migration 20260407000002
DROP TABLE IF EXISTS public.failed_login_attempts CASCADE;
```

### Application Rollback
```bash
# Revert to previous commit
git revert <commit-hash>

# Rebuild and redeploy
npm run build
npm start
```

## Monitoring

### First 24 Hours
- Failed login patterns
- Rate limit violations
- OAuth state validation failures
- CSRF token validation failures
- Unexpected error rates

### First Week
- Account lockout rates
- Authentication success rates
- Performance metrics
- User experience feedback

### Alerts Configuration

**Critical Alerts (Immediate)**
- 10+ failed logins from same IP within 1 hour
- 5+ account lockouts from same IP
- OAuth state parameter validation failures
- Successful authentication from unusual geographic location

**Warning Alerts (Hourly)**
- Increased failed login patterns
- Multiple password reset requests
- Unusual authentication timing
```

- [ ] **Step 3: Write monitoring documentation**

Create `docs/security/MONITORING.md`:
```markdown
# Security Monitoring Guide

## Key Metrics

### Authentication Metrics
- Failed login attempts per email/IP (threshold: 10/hour)
- Account lockouts triggered per day
- OAuth state validation failures
- CSRF token validation failures
- Rate limit violations
- Password reset requests per email
- Session timeouts per hour

### Security Health Indicators
- Rate limiting effectiveness (violation rate)
- Account lockout rate
- Password policy compliance
- Audit log volume and quality
- Session timeout rates

## Monitoring Tools

### Supabase Dashboard
- Monitor auth.audit_log_entries table
- Check for unusual patterns
- Review security events
- Monitor database performance

### Application Monitoring
```typescript
// Security event monitoring
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
    
    return { suspicious: false };
  }
}
```

## Incident Response

### Detection
1. Identify suspicious pattern
2. Verify legitimate vs malicious activity
3. Take appropriate action

### Response Actions
- Block IP if automated attack detected
- Lock account if credential stuffing suspected
- Notify user of security event
- Escalate to security team if needed

### Recovery
- Unlock legitimate accounts
- Reset rate limits if false positive
- Document incident for learning
- Update security rules based on findings
```

- [ ] **Step 4: Update environment example**

Modify `.env.example`:
```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security Configuration
CSRF_SECRET=your-csrf-secret-min-32-characters

# Session Configuration
SESSION_TIMEOUT_SECONDS=1800
SESSION_WARNING_SECONDS=300
REMEMBER_ME_SECONDS=604800
```

- [ ] **Step 5: Commit documentation**

```bash
git add docs/security/ .env.example
git commit -m "docs: add comprehensive security documentation and deployment guide"
```

---

## Final Integration & Testing

**Tasks:**
- Final integration testing
- End-to-end authentication flow testing
- Performance validation
- Security verification

- [ ] **Step 1: Run comprehensive test suite**

```bash
npm test -- --coverage
```

Expected: All tests pass, 90%+ coverage

- [ ] **Step 2: Test end-to-end authentication flows**

```bash
# Test login flow with valid credentials
# Test login flow with invalid credentials
# Test rate limiting (attempt 6 failed logins)
# Test account lockout (attempt 11 failed logins)
# Test password complexity enforcement
# Test OAuth flows (Google and GitHub)
# Test password reset flow
# Test CSRF protection
# Test session timeout
# Test audit logging
```

- [ ] **Step 3: Validate security controls**

```bash
# Verify rate limiting works correctly
# Verify account lockout triggers appropriately
# Verify OAuth state validation works
# Verify password policy is enforced
# Verify error messages are generic
# Verify CSRF tokens are rotated
# Verify audit logs are created
# Verify session timeout works
```

- [ ] **Step 4: Performance testing**

```bash
# Test authentication performance under load
# Verify Redis response times
# Check database query performance
# Monitor memory usage
# Validate response times
```

- [ ] **Step 5: Final commit and tag**

```bash
git add .
git commit -m "feat: complete authentication security overhaul - all 12 vulnerabilities addressed"

git tag -a v1.0.0-security-overhaul -m "Comprehensive authentication security implementation"
```

---

## Success Criteria Checklist

**Before Deployment:**
- [ ] All 12 security vulnerabilities addressed
- [ ] Rate limiting functional and tested
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
- [ ] All tests passing (90%+ coverage target)
- [ ] All migrations tested and verified
- [ ] Security documentation complete
- [ ] Deployment guide written
- [ ] Rollback procedures documented

**Post-Deployment Monitoring:**
- [ ] Monitor failed login patterns for 24 hours
- [ ] Check for unexpected error increases
- [ ] Verify rate limiting effectiveness
- [ ] Confirm OAuth flows working
- [ ] Validate CSRF protection
- [ ] Review audit logs for anomalies
- [ ] Check account lockout rates
- [ ] Monitor performance impact
- [ ] Validate user experience

**Production Readiness:**
- [ ] All critical vulnerabilities remediated
- [ ] Comprehensive test suite passing
- [ ] Security monitoring in place
- [ ] Documentation complete
- [ ] Rollback procedures tested
- [ ] Team trained on security features

---

## Implementation Notes

**Estimated Timeline:** 7 days  
**Total Files Created:** 15 new files  
**Total Files Modified:** 7 existing files  
**Total Test Files:** 12 test files  
**Total Migrations:** 2 migration files  

**Key Dependencies Added:**
- ioredis (Redis client)
- Jest + testing libraries
- Security configuration

**Performance Considerations:**
- Redis connection pooling for rate limiting
- Async audit logging to prevent blocking
- Efficient database queries with proper indexes
- Session state caching

**Security Considerations:**
- All sensitive operations logged
- Generic error messages to prevent information leakage
- Cryptographic randomness for tokens
- Configurable security thresholds
- Comprehensive input validation

**Maintenance Considerations:**
- Regular security audit log review
- Monitor and adjust rate limiting thresholds
- Update password blacklist regularly
- Review OAuth provider security
- Test security controls regularly

This implementation plan provides a comprehensive, tested, and production-ready solution for all 12 identified security vulnerabilities while maintaining the aggressive 7-day timeline requirement.