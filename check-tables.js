// Mock process.env to simulate the env vars being set
process.env.NEXT_PUBLIC_SUPABASE_URL =
  "https://jwarbvksqhfinixirfac.supabase.co"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3YXJidmtzcWhmaW5peGlyZmFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNTIyNzMsImV4cCI6MjA5MDkyODI3M30.DhVb4zt0ZKrl34XHrntrrpbxhcqmf2RrR__uPwznAQk"
process.env.SUPABASE_SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3YXJidmtzcWhmaW5peGlyZmFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM1MjI3MywiZXhwIjoyMDkwOTI4MjczfQ.0ccWfI6b763r21dz64vLmevsgtzhpvE8YV1n2VTFrqg"

// Import and test our fixed config
const { createClient } = require("./lib/supabase/client")

async function checkTables() {
  const supabase = createClient()
  if (!supabase) {
    console.log("❌ Supabase client is null")
    return
  }

  console.log("✅ Supabase client created")

  try {
    // Check if users table exists by trying to query it
    const { data, error } = await supabase
      .from("users")
      .select("count", { count: "exact", head: true })
      .limit(0)
    if (error) {
      if (error.code === "42P01") {
        // undefined_table
        console.log("❌ Users table does not exist")
        return false
      } else {
        console.log("❌ Error checking users table:", error.message)
        return false
      }
    }
    console.log("✅ Users table exists")
    return true
  } catch (err) {
    console.log("❌ Exception checking users table:", err.message)
    return false
  }
}

checkTables()
