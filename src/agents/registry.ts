import type { AgentDefinition } from "./contracts";

export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition>();

  register(agent: AgentDefinition): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent already registered: ${agent.id}`);
    }
    this.agents.set(agent.id, agent);
  }

  get(agentId: string): AgentDefinition | undefined {
    return this.agents.get(agentId);
  }

  list(): AgentDefinition[] {
    return [...this.agents.values()];
  }

  findByCapability(capabilityId: string): AgentDefinition[] {
    return this.list().filter((agent) =>
      agent.capabilities.some((capability) => capability.id === capabilityId),
    );
  }
}
