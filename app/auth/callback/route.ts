import { MODEL_DEFAULT } from "@/lib/config"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { createGuestServerClient } from "@/lib/supabase/server-guest"
import { NextResponse } from "next/server"
import { OAuthSecurity } from "@/lib/auth/oauth-security"
import { AuditLogger } from "@/lib/auth/audit-logger"
import { getClientIP } from "@/lib/api"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const type = searchParams.get("type") ?? "signup"
  const next = searchParams.get("next") ?? "/"
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  if (!isSupabaseEnabled()) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent("Supabase is not enabled in this deployment.")}`
    )
  }

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent(errorDescription || error)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent("Missing authentication code")}`
    )
  }

  // VALIDATE OAUTH STATE
  if (state) {
    const oauthSecurity = new OAuthSecurity()
    const userAgent = request.headers.get('user-agent') || 'unknown'

    if (!await oauthSecurity.validateState(state, userAgent)) {
      return NextResponse.redirect(
        `${origin}/auth/error?message=${encodeURIComponent('Invalid OAuth state. Please try again.')}`
      )
    }
  }

  const supabase = await createClient()
  const supabaseAdmin = await createGuestServerClient()

  if (!supabase || !supabaseAdmin) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent("Supabase is not enabled in this deployment.")}`
    )
  }

  // Initialize audit logger
  const auditLogger = new AuditLogger(supabaseAdmin)
  const ipAddress = getClientIP(request) || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'

  const { data, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error("Auth error:", exchangeError)
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent(exchangeError.message)}`
    )
  }

  const user = data?.user
  if (!user || !user.id || !user.email) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent("Missing user info")}`
    )
  }

  // Log OAuth login event
  await auditLogger.logOAuthLogin(user.id, user.email, type, ipAddress, userAgent)

  const displayName =
    user.user_metadata?.full_name ?? user.user_metadata?.name ?? null
  const avatarUrl = user.user_metadata?.avatar_url ?? null

  try {
    const { data: existingUsers } = await supabaseAdmin
      .from("users")
      .select("id")
      .limit(1)

    const isFirstUser = !existingUsers || existingUsers.length === 0

    const { error: insertError } = await supabaseAdmin.from("users").insert({
      id: user.id,
      email: user.email,
      display_name: displayName || undefined,
      profile_image: avatarUrl || undefined,
      created_at: new Date().toISOString(),
      message_count: 0,
      premium: false,
      favorite_models: [MODEL_DEFAULT],
      role: isFirstUser ? "admin" : "user",
    })

    if (insertError && insertError.code !== "23505") {
      console.error("Error inserting user:", insertError)
    }
  } catch (err) {
    console.error("Unexpected user insert error:", err)
  }

  const host = request.headers.get("host")
  const protocol = host?.includes("localhost") ? "http" : "https"

  switch (type) {
    case "recovery":
      return NextResponse.redirect(`${protocol}://${host}/auth/reset-password`)
    case "email_change":
      return NextResponse.redirect(
        `${protocol}://${host}?message=${encodeURIComponent("Email updated successfully")}`
      )
    case "invite":
      return NextResponse.redirect(`${protocol}://${host}`)
    case "signup":
    default:
      return NextResponse.redirect(`${protocol}://${host}${next}`)
  }
}
