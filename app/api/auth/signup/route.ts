// app/api/auth/signup/route.ts
import { toast } from "@/components/ui/toast"
import { hashPassword } from "@/lib/auth/password-policy"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = await createClient()

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Sign up user
    const { data, error } = await supabase.auth.signUp({
      email,
      password: hashedPassword,
    })

    if (error) {
      console.error("Signup error:", error)
      return NextResponse.json(
        { error: error.message || "Failed to create account" },
        { status: 400 }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: "Failed to create account" },
        { status: 500 }
      )
    }

    // Create user profile in public.users table
    const { error: profileError } = await supabase.from("users").insert({
      id: data.user.id,
      full_name: email.split("@")[0],
      created_at: new Date().toISOString(),
    })

    if (profileError) {
      console.error("Profile creation error:", profileError)
      // Don't fail signup if profile creation fails (user exists in auth)
    }

    // Send welcome email if user created
    if (data.session) {
      // User created with email confirmation disabled (dev mode)
      // Show success message directly
      return NextResponse.json({
        success: true,
        message: "Account created successfully",
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      })
    } else {
      // User created but needs email confirmation
      return NextResponse.json({
        success: true,
        message: "Account created. Please check your email for verification.",
        requiresConfirmation: true,
      })
    }
  } catch (err) {
    console.error("Unexpected error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
