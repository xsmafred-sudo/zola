import { createHash, randomBytes } from "crypto"

const CSRF_SECRET = process.env.CSRF_SECRET!

// Generate a random CSRF token
function generateRandomToken(): string {
  return randomBytes(32).toString("hex")
}

// Create signed version of the token
function signToken(token: string): string {
  if (!CSRF_SECRET) {
    if (process.env.NODE_ENV === 'development') {
      // In development, if secret is missing, don't crash entirely but warn
      console.warn('CSRF_SECRET is missing in environment variables. Using fallback for development.')
      return createHash("sha256")
        .update(`${token}dev-fallback-secret`)
        .digest("hex")
    }
    throw new Error('CSRF_SECRET is required but missing in environment.')
  }

  return createHash("sha256")
    .update(`${token}${CSRF_SECRET}`)
    .digest("hex")
}

export function generateCsrfToken(): string {
  const raw = generateRandomToken()
  const signed = signToken(raw)
  return `${raw}:${signed}`
}

export function validateCsrfToken(fullToken: string): boolean {
  if (!fullToken) return false
  const [raw, token] = fullToken.split(":")
  if (!raw || !token) return false
  const expected = signToken(raw)
  return expected === token
}
