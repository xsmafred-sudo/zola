import { DiscoveryOrchestrator } from '../orchestrator';
import { BaseDiscoveryAgent } from '../base-discovery-agent';

// Mock Agent for testing
class MockAgent extends BaseDiscoveryAgent {
  private mockResults: any[];
  public initialized = false;
  public cleanedUp = false;

  constructor(name: string, results: any[] = []) {
    super(name);
    this.mockResults = results;
  }

  async initialize() { this.initialized = true; }
  async discover(query: string) { return this.mockResults; }
  async cleanup() { this.cleanedUp = true; }
  validate(data: any) { return true; }
}

describe('DiscoveryOrchestrator', () => {
  let orchestrator: DiscoveryOrchestrator;

  beforeEach(() => {
    orchestrator = new DiscoveryOrchestrator();
  });

  it('should register and retrieve agents', () => {
    const agent = new MockAgent('test-agent');
    orchestrator.registerAgent(agent);
    expect(orchestrator.getAgent('test-agent')).toBe(agent);
  });

  it('should run all agents and accumulate results', async () => {
    const agent1 = new MockAgent('agent1', [{ name: 'Result 1' }]);
    const agent2 = new MockAgent('agent2', [{ name: 'Result 2' }]);
    
    orchestrator.registerAgent(agent1);
    orchestrator.registerAgent(agent2);

    const results = await orchestrator.discoverAll('test query');

    expect(results['agent1']).toEqual([{ name: 'Result 1' }]);
    expect(results['agent2']).toEqual([{ name: 'Result 2' }]);
    expect(agent1.initialized).toBe(true);
    expect(agent1.cleanedUp).toBe(true);
  });

  it('should isolate errors in one agent from others', async () => {
    const agent1 = new MockAgent('agent1', [{ name: 'Works' }]);
    const failingAgent = new MockAgent('failing');
    failingAgent.discover = jest.fn().mockRejectedValue(new Error('Fatal Agent Error'));
    
    orchestrator.registerAgent(agent1);
    orchestrator.registerAgent(failingAgent);

    const results = await orchestrator.discoverAll('test query');

    expect(results['agent1']).toEqual([{ name: 'Works' }]);
    expect(results['failing']).toEqual([]); // Should be empty array instead of throwing
  });
});
