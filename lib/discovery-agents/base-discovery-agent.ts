// lib/discovery-agents/base-discovery-agent.ts
export abstract class BaseDiscoveryAgent {
  protected name: string

  constructor(name: string) {
    this.name = name
  }

  abstract initialize(): Promise<void>
  abstract discover(query: string): Promise<any[]>
  abstract validate(data: any): boolean
  abstract cleanup(): Promise<void>

  getName(): string {
    return this.name
  }
}
