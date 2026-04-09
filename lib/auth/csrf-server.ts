import { generateCsrfToken, validateCsrfToken } from "./csrf-core"
import { cookies } from "next/headers"
import { SECURITY_CONFIG } from "@/lib/config"

const TOKEN_EXPIRY = SECURITY_CONFIG.csrf.tokenExpiry

/**
 * Set httpOnly cookie for security (not accessible by JavaScript)
 */
export async function setCsrfCookie() {
  const cookieStore = await cookies()
  const token = generateCsrfToken()
  const [raw] = token.split(":") // Extract raw token for client use

  // Set httpOnly cookie (secure, not accessible by JS)
  cookieStore.set("csrf_token", token, {
    httpOnly: true, // ✅ SECURE: Not accessible by JavaScript
    secure: true,
    path: "/",
    sameSite: "strict",
    maxAge: TOKEN_EXPIRY,
  })

  return raw // Return raw token for client-side use
}

/**
 * Rotate CSRF token on successful authentication
 */
export async function rotateCsrfToken(): Promise<{ raw: string; full: string }> {
  const cookieStore = await cookies()
  const newToken = generateCsrfToken()
  const [raw] = newToken.split(":")

  // Set httpOnly cookie (secure, not accessible by JS)
  cookieStore.set("csrf_token", newToken, {
    httpOnly: true, // ✅ SECURE: Not accessible by JavaScript
    secure: true,
    path: "/",
    sameSite: "strict",
    maxAge: TOKEN_EXPIRY,
  })

  return { raw, full: newToken }
}

/**
 * Get the current CSRF token from cookie for validation (Server-side)
 */
export async function getCsrfToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("csrf_token")?.value || null
}

/**
 * Validate CSRF token from request against cookie (Server-side)
 */
export async function validateRequestCsrf(requestToken: string): Promise<boolean> {
  const cookieToken = await getCsrfToken()
  if (!cookieToken) return false

  // Compare the request token with the cookie token
  return validateCsrfToken(requestToken) && requestToken === cookieToken
}
