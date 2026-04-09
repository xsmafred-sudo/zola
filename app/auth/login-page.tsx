import { AuthPage } from "@/components/ui/auth-page"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default function LoginPage() {
  if (!isSupabaseEnabled()) {
    notFound()
  }

  return <AuthPage />
}
