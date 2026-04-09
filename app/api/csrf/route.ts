import { setCsrfCookie } from "@/lib/auth/csrf-server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Generate and set httpOnly CSRF cookie
    const rawToken = await setCsrfCookie()

    // Return the raw token for client-side use
    return NextResponse.json({
      csrfToken: rawToken,
      ok: true
    })
  } catch (error) {
    console.error("Error generating CSRF token:", error)
    return NextResponse.json(
      { error: "Failed to generate CSRF token" },
      { status: 500 }
    )
  }
}
