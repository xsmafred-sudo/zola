import { updateSession } from "@/utils/supabase/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { validateCsrfToken } from "./lib/csrf"
import { checkSessionTimeout } from "./lib/auth/session-manager"
import { createClient } from "@/utils/supabase/server"

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)

  // Session timeout check for authenticated users
  try {
    const supabase = await createClient()
    const sessionManager = new checkSessionTimeout(supabase)
    const sessionResult = await sessionManager.checkSessionTimeout(supabase)

    if (sessionResult.expired) {
      // Session expired, redirect to login with expired message
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('session', 'expired')
      return NextResponse.redirect(loginUrl)
    }
  } catch (error) {
    // If session check fails, continue gracefully (don't block requests)
    console.error('Session timeout check failed:', error)
  }

  // CSRF protection for state-changing requests
  if (["POST", "PUT", "DELETE"].includes(request.method)) {
    const csrfCookie = request.cookies.get("csrf_token")?.value
    const headerToken = request.headers.get("x-csrf-token")

    if (!csrfCookie || !headerToken || !validateCsrfToken(headerToken)) {
      return new NextResponse("Invalid CSRF token", { status: 403 })
    }
  }

  // CSP for development and production
  const isDev = process.env.NODE_ENV === "development"

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseDomain = supabaseUrl ? new URL(supabaseUrl).origin : ""

  response.headers.set(
    "Content-Security-Policy",
    isDev
      ? `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://assets.onedollarstats.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' wss: https://api.openai.com https://api.mistral.ai https://api.supabase.com ${supabaseDomain} https://api.github.com https://collector.onedollarstats.com;`
      : `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://analytics.umami.is https://vercel.live https://assets.onedollarstats.com; frame-src 'self' https://vercel.live; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' wss: https://api.openai.com https://api.mistral.ai https://api.supabase.com ${supabaseDomain} https://api-gateway.umami.dev https://api.github.com https://collector.onedollarstats.com;`
  )

  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
  runtime: "nodejs",
}
