// app/components/chat/use-discovery.ts
import {
  CrunchbaseDiscoveryAgent,
  DiscoveryOrchestrator,
  LinkedInDiscoveryAgent,
} from "@/lib/discovery-agents"
import { useUser } from "@/lib/user-store/provider"
import { useCallback, useState } from "react"

export function useDiscovery() {
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<any[] | null>(null)
  const { user } = useUser()

  const initializeOrchestrator = useCallback(() => {
    const orchestrator = new DiscoveryOrchestrator()
    orchestrator.registerAgent(new LinkedInDiscoveryAgent())
    orchestrator.registerAgent(new CrunchbaseDiscoveryAgent())
    return orchestrator
  }, [])

  const discover = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setError("Please provide a search query")
        return
      }

      setIsDiscovering(true)
      setError(null)
      setResults(null)

      try {
        const orchestrator = initializeOrchestrator()
        const discoveryResults = await orchestrator.discoverAll(query)

        // Flatten results and add to lead library
        const allResults: any[] = []
        for (const [source, sourceResults] of Object.entries(
          discoveryResults
        )) {
          for (const result of sourceResults) {
            // Add metadata for lead library
            const lead = {
              ...result,
              id: `${result.id}-${Date.now()}`,
              source,
              discoveredAt: new Date().toISOString(),
              validationStatus: "pending" as const,
            }

            allResults.push(lead)
            // In a real implementation, this would call addLead from user store
            // For now we'll simulate it
            console.log("Would add lead:", lead)
          }
        }

        setResults(allResults)
      } catch (err) {
        console.error("Discovery error:", err)
        setError("Discovery failed. Please try again.")
      } finally {
        setIsDiscovering(false)
      }
    },
    [initializeOrchestrator]
  )

  return {
    discover,
    isDiscovering,
    error,
    results,
    reset: () => {
      setIsDiscovering(false)
      setError(null)
      setResults(null)
    },
  }
}
