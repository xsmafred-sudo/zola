// Mock process.env to simulate the env vars being set
process.env.NEXT_PUBLIC_SUPABASE_URL =
  "https://jwarbvksqhfinixirfac.supabase.co"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3YXJidmtzcWhmaW5peGlyZmFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNTIyNzMsImV4cCI6MjA5MDkyODI3M30.DhVb4zt0ZKrl34XHrntrrpbxhcqmf2RrR__uPwznAQk"
process.env.SUPABASE_SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3YXJidmtzcWhmaW5peGlyZmFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM1MjI3MywiZXhwIjoyMDkwOTI4MjczfQ.0ccWfI6b763r21dz64vLmevsgtzhpvE8YV1n2VTFrqg"

// Import and test our fixed config
const { createClient } = require("./lib/supabase/client")

async function test() {
  const supabase = createClient()
  if (!supabase) {
    console.log("❌ Supabase client is null")
    return
  }

  console.log("✅ Supabase client created")

  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, role, display_name")
      .limit(5)
    if (error) {
      console.log("❌ Error querying users:", error.message)
      return
    }
    console.log("✅ Users table accessible")
    console.log("Users found:", data.length)
    data.forEach((user) => {
      console.log(
        `  - ${user.email} (${user.role || "no-role"}) ${user.display_name ? `- ${user.display_name}` : ""}`
      )
    })
  } catch (err) {
    console.log("❌ Exception querying users:", err.message)
  }
}

test()
