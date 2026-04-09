import { updateSession } from "@/utils/supabase/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { validateCsrfToken } from "@/lib/auth/csrf-core"
import { CheckSessionTimeout } from "@/lib/auth/session-manager"
import { createClient } from "@/lib/supabase/server"

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Define public routes that don't require authentication or session timeout checks
  const isPublicRoute =
    pathname.startsWith('/auth') ||           // Auth routes
    pathname.startsWith('/api') ||             // API routes
    pathname.startsWith('/_next') ||           // Next.js internal routes
    pathname.includes('/favicon.ico') ||       // Static files
    pathname.includes('.svg') ||               // Static assets
    pathname.includes('.png') ||               // Static assets
    pathname.includes('.jpg') ||               // Static assets
    pathname.includes('.jpeg') ||              // Static assets
    pathname.includes('.gif') ||               // Static assets
    pathname.includes('.webp') ||              // Static assets
    pathname.startsWith('/_next/image');     // Next.js images

  const response = await updateSession(request)

  // Only perform authentication and session timeout checks for non-public routes
  if (!isPublicRoute) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const sessionManager = new CheckSessionTimeout(supabase)
        const sessionResult = await sessionManager.checkSessionTimeout(supabase)

        if (sessionResult.expired) {
          // Session expired, redirect to login with expired message
          const loginUrl = new URL('/auth', request.url)
          loginUrl.searchParams.set('session', 'expired')
          return NextResponse.redirect(loginUrl)
        }

        const { data: { session } } = await supabase.auth.getSession()

        // If not authenticated and not on public route, redirect to login
        if (!session) {
          const loginUrl = new URL('/auth', request.url)
          loginUrl.searchParams.set('redirectTo', pathname)
          return NextResponse.redirect(loginUrl)
        }

        // If authenticated, verify session is valid
        const { error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error('Session validation error:', sessionError)
          const loginUrl = new URL('/auth/login', request.url)
          loginUrl.searchParams.set('redirectTo', pathname)
          return NextResponse.redirect(loginUrl)
        }
      }
    } catch (error) {
      console.error('Authentication check failed:', error)
    }
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
