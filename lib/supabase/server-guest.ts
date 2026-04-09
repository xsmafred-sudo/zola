import type { Database } from "@/app/types/database.types"
import { createServerClient } from "@supabase/ssr"
import {
  getSupabaseServiceRole,
  getSupabaseUrl,
  isSupabaseEnabled,
} from "./config"

export async function createGuestServerClient() {
  if (!isSupabaseEnabled()) {
    return null
  }

  const url = getSupabaseUrl()
  const serviceRole = getSupabaseServiceRole()

  if (!url || !serviceRole) {
    return null
  }

  return createServerClient<Database>(url, serviceRole, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  })
}
