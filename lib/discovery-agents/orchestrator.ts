// lib/discovery-agents/orchestrator.ts
import { BaseDiscoveryAgent } from "./base-discovery-agent"

export class DiscoveryOrchestrator {
  private agents: Map<string, BaseDiscoveryAgent> = new Map()

  registerAgent(agent: BaseDiscoveryAgent): void {
    this.agents.set(agent.getName(), agent)
  }

  getAgent(name: string): BaseDiscoveryAgent | undefined {
    return this.agents.get(name)
  }

  async discoverAll(query: string): Promise<Record<string, any[]>> {
    const results: Record<string, any[]> = {}

    for (const [name, agent] of Array.from(this.agents.entries())) {
      try {
        await agent.initialize()
        results[name] = await agent.discover(query)
        await agent.cleanup()
      } catch (error) {
        console.error(`Error in agent ${name}:`, error)
        results[name] = []
      }
    }

    return results
  }
}
