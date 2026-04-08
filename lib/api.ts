import { APP_DOMAIN, MODEL_DEFAULT } from "@/lib/config"
import type { UserProfile } from "@/lib/user/types"
import { SupabaseClient } from "@supabase/supabase-js"
import { fetchClient } from "./fetch"
import { API_ROUTE_CREATE_GUEST, API_ROUTE_UPDATE_CHAT_MODEL } from "./routes"
import { createClient } from "./supabase/client"
import { RateLimiter } from "./auth/rate-limiter"
import { AccountLockout } from "./auth/account-lockout"
import { OAuthSecurity } from "./auth/oauth-security"
import { PasswordPolicyValidator } from "./auth/password-policy"
import { AuditLogger } from "./auth/audit-logger"
import { validateEmail, validateDisplayName } from "./auth/input-validator"
import { rotateCsrfToken } from "./csrf"

// Initialize rate limiter (singleton pattern)
let rateLimiter: RateLimiter | null = null

function getRateLimiter(): RateLimiter {
  if (!rateLimiter) {
    rateLimiter = new RateLimiter()
  }
  return rateLimiter
}

// Initialize account lockout (singleton pattern)
let accountLockout: AccountLockout | null = null

function getAccountLockout(): AccountLockout {
  if (!accountLockout) {
    accountLockout = new AccountLockout()
  }
  return accountLockout
}

// Initialize OAuth security (singleton pattern)
let oauthSecurity: OAuthSecurity | null = null

function getOAuthSecurity(): OAuthSecurity {
  if (!oauthSecurity) {
    oauthSecurity = new OAuthSecurity()
  }
  return oauthSecurity
}

// Initialize password validator (singleton pattern)
let passwordValidator: PasswordPolicyValidator | null = null

function getPasswordValidator(): PasswordPolicyValidator {
  if (!passwordValidator) {
    passwordValidator = new PasswordPolicyValidator()
  }
  return passwordValidator
}

// Initialize audit logger (singleton pattern)
let auditLogger: AuditLogger | null = null

function getAuditLogger(supabase: SupabaseClient): AuditLogger {
  if (!auditLogger) {
    auditLogger = new AuditLogger(supabase)
  }
  return auditLogger
}

/**
 * Creates a guest user record on the server
 */
export async function createGuestUser(guestId: string) {
  try {
    const res = await fetchClient(API_ROUTE_CREATE_GUEST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: guestId }),
    })
    const responseData = await res.json()
    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to create guest user: ${res.status} ${res.statusText}`
      )
    }

    return responseData
  } catch (err) {
    console.error("Error creating guest user:", err)
    throw err
  }
}

export class UsageLimitError extends Error {
  code: string
  constructor(message: string) {
    super(message)
    this.code = "DAILY_LIMIT_REACHED"
  }
}

/**
 * Checks the user's daily usage and increments both overall and daily counters.
 * Resets the daily counter if a new day (UTC) is detected.
 * Uses the `anonymous` flag from the user record to decide which daily limit applies.
 *
 * @param supabase - Your Supabase client.
 * @param userId - The ID of the user.
 * @returns The remaining daily limit.
 */
export async function checkRateLimits(
  userId: string,
  isAuthenticated: boolean
) {
  try {
    const res = await fetchClient(
      `/api/rate-limits?userId=${userId}&isAuthenticated=${isAuthenticated}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    )
    const responseData = await res.json()
    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to check rate limits: ${res.status} ${res.statusText}`
      )
    }
    return responseData
  } catch (err) {
    console.error("Error checking rate limits:", err)
    throw err
  }
}

/**
 * Updates the model for an existing chat
 */
export async function updateChatModel(chatId: string, model: string) {
  try {
    const res = await fetchClient(API_ROUTE_UPDATE_CHAT_MODEL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, model }),
    })
    const responseData = await res.json()

    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to update chat model: ${res.status} ${res.statusText}`
      )
    }

    return responseData
  } catch (error) {
    console.error("Error updating chat model:", error)
    throw error
  }
}

/**
 * Extracts the client IP address from a Request object.
 * Handles various proxy configurations and header formats.
 */
export function getClientIP(request: Request): string | null {
  // Try various headers in order of preference
  const headers = request.headers;

  // x-forwarded-for may contain multiple IPs, take the first one (client IP)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    // Return the first IP (client IP), ignoring proxies
    return ips[0] || null;
  }

  // x-real-ip is a common header for the real client IP
  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // cf-connecting-ip is used by Cloudflare
  const cfIP = headers.get('cf-connecting-ip');
  if (cfIP) {
    return cfIP;
  }

  // Return null if no IP found
  return null;
}

/**
 * Signs in user with email and password via Supabase
 */
export async function signInWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
  request?: Request
) {
  const limiter = getRateLimiter()
  const lockout = getAccountLockout()
  const logger = getAuditLogger(supabase)

  // Extract IP address and user agent if request is provided
  const ipAddress = request ? getClientIP(request) : 'unknown'
  const userAgent = request?.headers.get('user-agent') || 'unknown'

  // Validate email
  const emailValidation = validateEmail(email)
  if (!emailValidation.valid) {
    throw new Error(emailValidation.error || 'Invalid email')
  }

  // Check rate limit
  const rateLimitResult = await limiter.checkLimit(email, 'login')
  if (!rateLimitResult.allowed) {
    throw new Error('Too many login attempts. Please try again later.')
  }

  // Check account lockout
  const lockoutResult = await lockout.checkLockout(email, ipAddress)
  if (lockoutResult.locked) {
    throw new Error('Account temporarily locked. Please try again later.')
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Record failed attempt for lockout
    await lockout.recordFailedAttempt(email, ipAddress)

    // Log failed login attempt
    await logger.logLoginFailure(email, ipAddress, userAgent, error.message)

    // Check if this attempt caused an account lockout
    const lockoutCheck = await lockout.checkLockout(email, ipAddress)
    if (lockoutCheck.locked && lockoutCheck.lockoutEndTime) {
      const lockoutDurationMinutes = Math.ceil(
        (lockoutCheck.lockoutEndTime.getTime() - Date.now()) / (1000 * 60)
      )
      await logger.logAccountLockout(email, ipAddress, userAgent, lockoutDurationMinutes)
    }

    throw error
  }

  // Reset lockout on successful login
  await lockout.resetLockout(email, ipAddress)

  // Log successful login
  if (data.user) {
    await logger.logLoginSuccess(data.user.id, email, ipAddress, userAgent)
  }

  if (data.user) {
    // Rotate CSRF token on successful authentication
    await rotateCsrfToken()

    const serverClient = await import("./supabase/server-guest")
    const supabaseServer = await serverClient.createGuestServerClient()
    if (supabaseServer) {
      const displayName =
        data.user.user_metadata?.full_name ??
        data.user.user_metadata?.name ??
        null

      const { data: existingUsers } = await supabaseServer
        .from("users")
        .select("id")
        .limit(1)

      const isFirstUser = !existingUsers || existingUsers.length === 0

      const { error: upsertError } = await supabaseServer.from("users").upsert(
        {
          id: data.user.id,
          email: data.user.email ?? "",
          display_name: displayName || undefined,
          created_at: new Date().toISOString(),
          message_count: 0,
          premium: false,
          favorite_models: [MODEL_DEFAULT],
          role: isFirstUser ? "admin" : "user",
        },
        { onConflict: "id" }
      )

      if (upsertError && upsertError.code !== "23505") {
        console.error("Error upserting user profile:", upsertError)
      }
    }
  }

  return data
}

/**
 * Signs up user with email and password via Supabase
 */
export async function signUpWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
  name?: string,
  request?: Request
) {
  const limiter = getRateLimiter()
  const validator = getPasswordValidator()
  const logger = getAuditLogger(supabase)

  // Extract IP address and user agent if request is provided
  const ipAddress = request ? getClientIP(request) : 'unknown'
  const userAgent = request?.headers.get('user-agent') || 'unknown'

  // Check rate limit
  const rateLimitResult = await limiter.checkLimit(email, 'signup')
  if (!rateLimitResult.allowed) {
    throw new Error('Too many signup attempts. Please try again later.')
  }

  // Validate email
  const emailValidation = validateEmail(email)
  if (!emailValidation.valid) {
    throw new Error(emailValidation.error || 'Invalid email')
  }

  // Validate display name if provided
  if (name) {
    const nameValidation = validateDisplayName(name)
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error || 'Invalid name')
    }
  }

  // Validate password using password policy validator
  const passwordValidation = validator.validate(password)
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors.join('. '))
  }

  const isDev = process.env.NODE_ENV === "development"
  const baseUrl = isDev
    ? "http://localhost:3000"
    : typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : APP_DOMAIN

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback`,
      data: {
        full_name: name,
      },
    },
  })

  if (error) {
    throw error
  }

  // Log signup event
  if (data.user) {
    await logger.logLoginSuccess(data.user.id, email, ipAddress, userAgent)
  }

  return data
}

/**
 * Sends a password reset email via Supabase
 */
export async function sendPasswordResetEmail(
  supabase: SupabaseClient,
  email: string,
  request?: Request
) {
  const limiter = getRateLimiter()
  const logger = getAuditLogger(supabase)

  // Extract IP address and user agent if request is provided
  const ipAddress = request ? getClientIP(request) : 'unknown'
  const userAgent = request?.headers.get('user-agent') || 'unknown'

  // Validate email
  const emailValidation = validateEmail(email)
  if (!emailValidation.valid) {
    throw new Error(emailValidation.error || 'Invalid email')
  }

  // Check rate limit
  const rateLimitResult = await limiter.checkLimit(email, 'passwordReset')
  if (!rateLimitResult.allowed) {
    throw new Error('Too many password reset attempts. Please try again later.')
  }

  const isDev = process.env.NODE_ENV === "development"
  const baseUrl = isDev
    ? "http://localhost:3000"
    : typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : APP_DOMAIN

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/auth/callback`,
  })

  if (error) {
    throw error
  }

  // Log password reset event
  await logger.logPasswordReset(email, ipAddress, userAgent)
}

/**
 * Updates the user's password after password reset
 */
export async function updatePassword(
  supabase: SupabaseClient,
  password: string
) {
  const validator = getPasswordValidator()

  // Validate password before updating
  const passwordValidation = validator.validate(password)
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors.join('. '))
  }

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    throw error
  }
}

/**
 * Signs in user with Google OAuth via Supabase
 */
export async function signInWithGoogle(
  supabase: SupabaseClient,
  request?: Request
) {
  try {
    const limiter = getRateLimiter()
    const security = getOAuthSecurity()

    // For OAuth, we'll use a generic identifier since we don't have email yet
    // In production, this should be based on IP address or session ID
    const identifier = 'oauth-google'

    // Check rate limit
    const rateLimitResult = await limiter.checkLimit(identifier, 'oauth')
    if (!rateLimitResult.allowed) {
      throw new Error('Too many OAuth attempts. Please try again later.')
    }

    const userAgent = request?.headers.get('user-agent') || 'unknown'

    const state = security.generateOAuthState()
    state.userAgent = userAgent

    const pkce = security.generatePKCE()

    await security.storeState({
      ...state,
      verifier: pkce.verifier
    })

    const isDev = process.env.NODE_ENV === "development"

    const baseUrl = isDev
      ? "http://localhost:3000"
      : typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_VERCEL_URL
          ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
          : APP_DOMAIN

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${baseUrl}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
          state: state.state,
          code_challenge: pkce.challenge,
          code_challenge_method: "S256"
        },
      },
    })

    if (error) {
      throw error
    }

    return data
  } catch (err) {
    console.error("Error signing in with Google:", err)
    throw err
  }
}

/**
 * Signs in user with GitHub OAuth via Supabase
 */
export async function signInWithGithub(
  supabase: SupabaseClient,
  request?: Request
) {
  try {
    const limiter = getRateLimiter()
    const security = getOAuthSecurity()

    // For OAuth, we'll use a generic identifier since we don't have email yet
    // In production, this should be based on IP address or session ID
    const identifier = 'oauth-github'

    // Check rate limit
    const rateLimitResult = await limiter.checkLimit(identifier, 'oauth')
    if (!rateLimitResult.allowed) {
      throw new Error('Too many OAuth attempts. Please try again later.')
    }

    const userAgent = request?.headers.get('user-agent') || 'unknown'

    const state = security.generateOAuthState()
    state.userAgent = userAgent

    const pkce = security.generatePKCE()

    await security.storeState({
      ...state,
      verifier: pkce.verifier
    })

    const isDev = process.env.NODE_ENV === "development"

    const baseUrl = isDev
      ? "http://localhost:3000"
      : typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_VERCEL_URL
          ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
          : APP_DOMAIN

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${baseUrl}/auth/callback`,
        queryParams: {
          state: state.state,
          code_challenge: pkce.challenge,
          code_challenge_method: "S256"
        },
      },
    })

    if (error) {
      throw error
    }

    return data
  } catch (err) {
    console.error("Error signing in with GitHub:", err)
    throw err
  }
}

export const getOrCreateGuestUserId = async (
  user: UserProfile | null
): Promise<string | null> => {
  if (user?.id) return user.id

  const supabase = createClient()

  if (!supabase) {
    console.warn("Supabase is not available in this deployment.")
    return null
  }

  const existingGuestSessionUser = await supabase.auth.getUser()
  if (
    existingGuestSessionUser.data?.user &&
    existingGuestSessionUser.data.user.is_anonymous
  ) {
    const anonUserId = existingGuestSessionUser.data.user.id

    const profileCreationAttempted = localStorage.getItem(
      `guestProfileAttempted_${anonUserId}`
    )

    if (!profileCreationAttempted) {
      try {
        await createGuestUser(anonUserId)
        localStorage.setItem(`guestProfileAttempted_${anonUserId}`, "true")
      } catch (error) {
        console.error(
          "Failed to ensure guest user profile exists for existing anonymous auth user:",
          error
        )
        return null
      }
    }
    return anonUserId
  }

  try {
    const { data: anonAuthData, error: anonAuthError } =
      await supabase.auth.signInAnonymously()

    if (anonAuthError) {
      console.error("Error during anonymous sign-in:", anonAuthError)
      return null
    }

    if (!anonAuthData || !anonAuthData.user) {
      console.error("Anonymous sign-in did not return a user.")
      return null
    }

    const guestIdFromAuth = anonAuthData.user.id
    await createGuestUser(guestIdFromAuth)
    localStorage.setItem(`guestProfileAttempted_${guestIdFromAuth}`, "true")
    return guestIdFromAuth
  } catch (error) {
    console.error(
      "Error in getOrCreateGuestUserId during anonymous sign-in or profile creation:",
      error
    )
    return null
  }
}
