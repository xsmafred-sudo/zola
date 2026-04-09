import { validateRequestCsrf } from "@/lib/auth/csrf-server"
import { NextRequest, NextResponse } from "next/server"

/**
 * Validates CSRF token from request headers or form data
 * Returns NextResponse with error if validation fails, null if valid
 */
export async function validateCsrfMiddleware(request: NextRequest): Promise<NextResponse | null> {
  // Try to get CSRF token from headers first
  let csrfToken = request.headers.get("x-csrf-token")

  // If not in headers, try to get from form data (for form submissions)
  if (!csrfToken && request.method === "POST") {
    try {
      const formData = await request.clone().formData()
      csrfToken = formData.get("csrf_token") as string | null
    } catch {
      // Not form data, continue with null token
    }
  }

  // If still no token, return error
  if (!csrfToken) {
    return NextResponse.json(
      { error: "CSRF token is required for this request" },
      { status: 403 }
    )
  }

  // Validate the token
  const isValid = await validateRequestCsrf(csrfToken)
  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid CSRF token. Please refresh and try again." },
      { status: 403 }
    )
  }

  return null // Token is valid
}

/**
 * Adds CSRF validation to API routes
 * Wraps the handler with CSRF token validation
 */
export function withCsrfValidation<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
): (request: NextRequest, ...args: T) => Promise<NextResponse> {
  return async (request: NextRequest, ...args: T) => {
    // Skip CSRF validation for GET requests (read-only)
    if (request.method === "GET") {
      return handler(request, ...args)
    }

    // Validate CSRF token for POST/PUT/DELETE/PATCH
    const validationError = await validateCsrfMiddleware(request)
    if (validationError) {
      return validationError
    }

    return handler(request, ...args)
  }
}