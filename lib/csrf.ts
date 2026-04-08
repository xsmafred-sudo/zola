import { createHash, randomBytes } from "crypto"
import { cookies } from "next/headers"
import { SECURITY_CONFIG } from "@/lib/config"

const CSRF_SECRET = process.env.CSRF_SECRET!
const TOKEN_EXPIRY = SECURITY_CONFIG.csrf.tokenExpiry

export function generateCsrfToken(): string {
  const raw = randomBytes(32).toString("hex")
  const token = createHash("sha256")
    .update(`${raw}${CSRF_SECRET}`)
    .digest("hex")
  return `${raw}:${token}`
}

export function validateCsrfToken(fullToken: string): boolean {
  const [raw, token] = fullToken.split(":")
  if (!raw || !token) return false
  const expected = createHash("sha256")
    .update(`${raw}${CSRF_SECRET}`)
    .digest("hex")
  return expected === token
}

export async function setCsrfCookie() {
  const cookieStore = await cookies()
  const token = generateCsrfToken()
  cookieStore.set("csrf_token", token, {
    httpOnly: false,
    secure: true,
    path: "/",
    maxAge: TOKEN_EXPIRY,
  })
}

export async function rotateCsrfToken(): Promise<string> {
  const cookieStore = await cookies()
  const newToken = generateCsrfToken()
  cookieStore.set("csrf_token", newToken, {
    httpOnly: false,
    secure: true,
    path: "/",
    maxAge: TOKEN_EXPIRY,
  })

  return newToken
}
