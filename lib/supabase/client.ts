import { Database } from "@/app/types/database.types"
import { createBrowserClient } from "@supabase/ssr"
import { SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseEnabled } from "./config"

export function createClient(): any {
  if (!isSupabaseEnabled()) {
    return null
  }

  const url = getSupabaseUrl()
  const anonKey = getSupabaseAnonKey()

  if (!url || !anonKey) {
    return null
  }

  return createBrowserClient<Database>(url, anonKey)
}
