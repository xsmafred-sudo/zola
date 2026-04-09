"use client"

import {
  sendPasswordResetEmail,
  signInWithEmail,
  signInWithGithub,
  signInWithGoogle,
  signUpWithEmail,
  updatePassword,
} from "@/lib/api"
import { APP_NAME } from "@/lib/config"
import { createClient } from "@/lib/supabase/client"
import { PasswordPolicyValidator } from "@/lib/auth/password-policy"
import { getAuthErrorMessage, logDetailedError } from "@/lib/auth/error-handler"
import { useCsrfToken } from "@/lib/hooks/use-csrf-token"
import { motion } from "framer-motion"
import {
  ArrowLeftIcon,
  AtSignIcon,
  ChevronLeftIcon,
  GithubIcon,
  Grid2x2PlusIcon,
  Loader2Icon,
  LockIcon,
  UserIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import React, { useEffect, useState } from "react"
import { Button } from "./button"
import { Input } from "./input"

type AuthMode = "signin" | "signup" | "forgot-password" | "reset-password"

export function AuthPage() {
  const pathname = usePathname()
  const [mode, setMode] = useState<AuthMode>(
    pathname?.includes("reset-password") ? "reset-password" : "signin"
  )
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Initialize CSRF token protection
  const { token: csrfToken, isLoading: csrfLoading, error: csrfError } = useCsrfToken()

  // Initialize password policy validator
  const passwordValidator = new PasswordPolicyValidator()
  const passwordRequirements = passwordValidator.getRequirements()

  useEffect(() => {
    if (pathname?.includes("reset-password")) {
      setMode("reset-password")
    }
  }, [pathname])

  // Show CSRF error if token fails to load
  useEffect(() => {
    if (csrfError && !csrfLoading) {
      setError("Security token error. Please refresh the page.")
    }
  }, [csrfError, csrfLoading])

  const handleGoogleSignIn = async () => {
    const supabase = createClient()
    if (!supabase) {
      setError("Supabase is not configured")
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      const data = await signInWithGoogle(supabase)
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (err: unknown) {
      logDetailedError(err as Error, { provider: 'google' })
      setError(getAuthErrorMessage(err as Error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleGithubSignIn = async () => {
    const supabase = createClient()
    if (!supabase) {
      setError("Supabase is not configured")
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      const data = await signInWithGithub(supabase)
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (err: unknown) {
      logDetailedError(err as Error, { provider: 'github' })
      setError(getAuthErrorMessage(err as Error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    const supabase = createClient()
    if (!supabase) {
      setError("Supabase is not configured")
      setIsLoading(false)
      return
    }

    try {
      if (mode === "signin") {
        await signInWithEmail(supabase, email, password)
        window.location.href = "/"
      } else {
        if (password !== confirmPassword) {
          setError("Passwords do not match")
          setIsLoading(false)
          return
        }
        await signUpWithEmail(supabase, email, password, name)
        setSuccessMessage(
          "Account created! Please check your email to verify your account."
        )
        setName("")
        setEmail("")
        setPassword("")
        setConfirmPassword("")
      }
    } catch (err: unknown) {
      logDetailedError(err as Error, { mode, email: !!email })
      setError(getAuthErrorMessage(err as Error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    const supabase = createClient()
    if (!supabase) {
      setError("Supabase is not configured")
      setIsLoading(false)
      return
    }

    try {
      await sendPasswordResetEmail(supabase, email)
      setSuccessMessage(
        "Password reset email sent! Check your inbox and follow the link."
      )
    } catch (err: unknown) {
      logDetailedError(err as Error, { action: 'forgot_password', email: !!email })
      setError(getAuthErrorMessage(err as Error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    const supabase = createClient()
    if (!supabase) {
      setError("Supabase is not configured")
      setIsLoading(false)
      return
    }

    try {
      if (password !== confirmPassword) {
        setError("Passwords do not match")
        setIsLoading(false)
        return
      }
      await updatePassword(supabase, password)
      setSuccessMessage("Password updated! Redirecting...")
      setTimeout(() => {
        window.location.href = "/"
      }, 1500)
    } catch (err: unknown) {
      logDetailedError(err as Error, { action: 'reset_password' })
      setError(getAuthErrorMessage(err as Error))
    } finally {
      setIsLoading(false)
    }
  }

  const isResetPasswordFlow = mode === "reset-password"

  return (
    <main className="relative md:h-screen md:overflow-hidden lg:grid lg:grid-cols-2">
      <div className="bg-muted/60 relative hidden h-full flex-col border-r p-10 lg:flex">
        <div className="from-background absolute inset-0 z-10 bg-gradient-to-t to-transparent" />
        <div className="z-10 flex items-center gap-2">
          <Grid2x2PlusIcon className="size-6" />
          <p className="text-xl font-semibold">{APP_NAME}</p>
        </div>
        <div className="z-10 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-xl">
              &ldquo;This Platform has helped me to save time and serve my
              clients faster than ever before.&rdquo;
            </p>
            <footer className="font-mono text-sm font-semibold">
              ~ A Zola User
            </footer>
          </blockquote>
        </div>
        <div className="absolute inset-0">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>
      </div>
      <div className="relative flex min-h-screen flex-col justify-center p-4">
        <div
          aria-hidden
          className="absolute inset-0 isolate -z-10 opacity-60 contain-strict"
        >
          <div className="bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,--theme(--color-foreground/.06)_0,hsla(0,0%,55%,.02)_50%,--theme(--color-foreground/.01)_80%)] absolute top-0 right-0 h-320 w-140 -translate-y-87.5 rounded-full" />
          <div className="bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] absolute top-0 right-0 h-320 w-60 [translate:5%_-50%] rounded-full" />
          <div className="bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] absolute top-0 right-0 h-320 w-60 -translate-y-87.5 rounded-full" />
        </div>
        <Button variant="ghost" className="absolute top-7 left-5" asChild>
          <Link href="/" className="inline-flex items-center">
            <ChevronLeftIcon className="me-1 size-4" />
            Home
          </Link>
        </Button>
        <div className="mx-auto space-y-4 sm:w-sm">
          <div className="flex items-center gap-2 lg:hidden">
            <Grid2x2PlusIcon className="size-6" />
            <p className="text-xl font-semibold">{APP_NAME}</p>
          </div>

          {isResetPasswordFlow ? (
            <ResetPasswordForm
              password={password}
              confirmPassword={confirmPassword}
              isLoading={isLoading}
              error={error}
              successMessage={successMessage}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onSubmit={handleResetPassword}
              onBack={() => setMode("signin")}
            />
          ) : mode === "forgot-password" ? (
            <ForgotPasswordForm
              email={email}
              isLoading={isLoading}
              error={error}
              successMessage={successMessage}
              onEmailChange={setEmail}
              onSubmit={handleForgotPassword}
              onBack={() => setMode("signin")}
            />
          ) : (
            <>
              <div className="flex flex-col space-y-1">
                <h1 className="text-2xl font-bold tracking-wide">
                  {mode === "signin"
                    ? "Sign In to Your Account"
                    : "Create an Account"}
                </h1>
                <p className="text-muted-foreground text-base">
                  {mode === "signin"
                    ? "Welcome back! Sign in to continue."
                    : "Join Zola and unlock all features."}
                </p>
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="text-success border-success/20 bg-success/5 rounded-md border p-3 text-sm">
                  {successMessage}
                </div>
              )}

              {!successMessage && (
                <>
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="w-full"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                    >
                      <GoogleIcon className="me-2 size-4" />
                      Continue with Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="w-full"
                      onClick={handleGithubSignIn}
                      disabled={isLoading}
                    >
                      <GithubIcon className="me-2 size-4" />
                      Continue with GitHub
                    </Button>
                  </div>

                  <AuthSeparator />

                  <form className="space-y-3" onSubmit={handleEmailAuth}>
                    <p className="text-muted-foreground text-start text-xs">
                      {mode === "signin"
                        ? "Enter your credentials to sign in"
                        : "Enter your details to create an account"}
                    </p>
                    {mode === "signup" && (
                      <div className="relative h-max">
                        <Input
                          placeholder="Your name"
                          className="peer ps-9"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          disabled={isLoading}
                        />
                        <div className="text-muted-foreground pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                          <UserIcon className="size-4" aria-hidden="true" />
                        </div>
                      </div>
                    )}
                    <div className="relative h-max">
                      <Input
                        placeholder="your.email@example.com"
                        className="peer ps-9"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                      <div className="text-muted-foreground pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                        <AtSignIcon className="size-4" aria-hidden="true" />
                      </div>
                    </div>
                    <div className="relative h-max">
                      <Input
                        placeholder="Password"
                        className="peer ps-9"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                      <div className="text-muted-foreground pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                        <LockIcon className="size-4" aria-hidden="true" />
                      </div>
                    </div>
                    {mode === "signup" && (
                      <>
                        <div className="text-muted-foreground text-xs mb-2">
                          <p className="font-semibold mb-1">Password requirements:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {passwordRequirements.map((req, index) => (
                              <li key={index}>{req}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="relative h-max">
                          <Input
                            placeholder="Confirm password"
                            className="peer ps-9"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            disabled={isLoading}
                          />
                          <div className="text-muted-foreground pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                            <LockIcon className="size-4" aria-hidden="true" />
                          </div>
                        </div>
                      </>
                    )}

                    {mode === "signin" && (
                      <div className="text-end">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground text-sm"
                          onClick={() => setMode("forgot-password")}
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2Icon className="me-2 size-4 animate-spin" />
                          {mode === "signin"
                            ? "Signing in..."
                            : "Creating account..."}
                        </>
                      ) : mode === "signin" ? (
                        "Sign In with Email"
                      ) : (
                        "Sign Up with Email"
                      )}
                    </Button>
                  </form>
                </>
              )}

              <p className="text-muted-foreground text-center text-sm">
                {mode === "signin"
                  ? "Don't have an account? "
                  : "Already have an account? "}
                <button
                  type="button"
                  className="text-foreground hover:underline"
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin")
                    setError(null)
                    setSuccessMessage(null)
                  }}
                >
                  {mode === "signin" ? "Sign Up" : "Sign In"}
                </button>
              </p>

              <p className="text-muted-foreground mt-8 text-center text-sm">
                By continuing, you agree to our{" "}
                <Link
                  href="/"
                  className="hover:text-foreground underline underline-offset-4"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/"
                  className="hover:text-foreground underline underline-offset-4"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function ForgotPasswordForm({
  email,
  isLoading,
  error,
  successMessage,
  onEmailChange,
  onSubmit,
  onBack,
}: {
  email: string
  isLoading: boolean
  error: string | null
  successMessage: string | null
  onEmailChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onBack: () => void
}) {
  return (
    <>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
        onClick={onBack}
      >
        <ArrowLeftIcon className="size-4" />
        Back to sign in
      </button>
      <div className="flex flex-col space-y-1">
        <h1 className="text-2xl font-bold tracking-wide">Reset Password</h1>
        <p className="text-muted-foreground text-base">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="text-success border-success/20 bg-success/5 rounded-md border p-3 text-sm">
          {successMessage}
        </div>
      )}

      {!successMessage && (
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="relative h-max">
            <Input
              placeholder="your.email@example.com"
              className="peer ps-9"
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              required
              disabled={isLoading}
            />
            <div className="text-muted-foreground pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
              <AtSignIcon className="size-4" aria-hidden="true" />
            </div>
          </div>
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2Icon className="me-2 size-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Reset Link"
            )}
          </Button>
        </form>
      )}
    </>
  )
}

function ResetPasswordForm({
  password,
  confirmPassword,
  isLoading,
  error,
  successMessage,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onBack,
}: {
  password: string
  confirmPassword: string
  isLoading: boolean
  error: string | null
  successMessage: string | null
  onPasswordChange: (v: string) => void
  onConfirmPasswordChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onBack: () => void
}) {
  // Initialize password policy validator
  const passwordValidator = new PasswordPolicyValidator()
  const passwordRequirements = passwordValidator.getRequirements()
  return (
    <>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
        onClick={onBack}
      >
        <ArrowLeftIcon className="size-4" />
        Back to sign in
      </button>
      <div className="flex flex-col space-y-1">
        <h1 className="text-2xl font-bold tracking-wide">New Password</h1>
        <p className="text-muted-foreground text-base">
          Enter your new password below.
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="text-success border-success/20 bg-success/5 rounded-md border p-3 text-sm">
          {successMessage}
        </div>
      )}

      {!successMessage && (
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="relative h-max">
            <Input
              placeholder="New password"
              className="peer ps-9"
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              required
              disabled={isLoading}
            />
            <div className="text-muted-foreground pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
              <LockIcon className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="relative h-max">
            <Input
              placeholder="Confirm new password"
              className="peer ps-9"
              type="password"
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              required
              disabled={isLoading}
            />
            <div className="text-muted-foreground pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
              <LockIcon className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-muted-foreground text-xs">
            <p className="font-semibold mb-1">Password requirements:</p>
            <ul className="list-disc list-inside space-y-1">
              {passwordRequirements.map((req, index) => (
                <li key={index}>{req}</li>
              ))}
            </ul>
          </div>
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2Icon className="me-2 size-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </form>
      )}
    </>
  )
}

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    color: `rgba(15,23,42,${0.1 + i * 0.03})`,
    width: 0.5 + i * 0.03,
  }))

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        className="h-full w-full text-slate-950 dark:text-white"
        viewBox="0 0 696 316"
        fill="none"
      >
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.1 + path.id * 0.03}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.3, 0.6, 0.3],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  )
}

const GoogleIcon = (props: React.ComponentProps<"svg">) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <g>
      <path d="M12.479,14.265v-3.279h11.049c0.108,0.571,0.164,1.247,0.164,1.979c0,2.46-0.672,5.502-2.84,7.669   C18.744,22.829,16.051,24,12.483,24C5.869,24,0.308,18.613,0.308,12S5.869,0,12.483,0c3.659,0,6.265,1.436,8.223,3.307L18.392,5.62   c-1.404-1.317-3.307-2.341-5.913-2.341C7.65,3.279,3.873,7.171,3.873,12s3.777,8.721,8.606,8.721c3.132,0,4.916-1.258,6.059-2.401   c0.927-0.927,1.537-2.251,1.777-4.059L12.479,14.265z" />
    </g>
  </svg>
)

const AuthSeparator = () => {
  return (
    <div className="flex w-full items-center justify-center">
      <div className="bg-border h-px w-full" />
      <span className="text-muted-foreground px-2 text-xs">OR</span>
      <div className="bg-border h-px w-full" />
    </div>
  )
}
