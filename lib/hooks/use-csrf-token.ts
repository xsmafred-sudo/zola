import { useEffect, useState } from "react"

export interface CsrfTokenData {
  token: string | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useCsrfToken(): CsrfTokenData {
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchToken = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch from correct API route
      const response = await fetch("/api/csrf")
      const data = await response.json()

      if (data.ok && data.csrfToken) {
        setToken(data.csrfToken)
      } else {
        setError("Failed to load CSRF token")
      }
    } catch (err) {
      setError("Network error while loading security token")
      console.error("CSRF token fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchToken()
  }, [])

  return {
    token,
    isLoading,
    error,
    refresh: fetchToken
  }
}