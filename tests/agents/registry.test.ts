import { describe, expect, it } from "vitest";
import { createAgentRegistry } from "@/agents/definitions";
import { AgentRegistry } from "@/agents/registry";
import { agentDefinitions } from "@/agents/definitions";

describe("AgentRegistry", () => {
  it("registers the seven POC agents and discovers capabilities", () => {
    const registry = createAgentRegistry();
    expect(registry.list()).toHaveLength(7);
    expect(registry.findByCapability("prepare-tutoring")[0]?.id).toBe("tutoring-agent");
    expect(registry.findByCapability("generate-week-sessions")[0]?.id).toBe("planning-agent");
    expect(registry.findByCapability("get-curriculum-progress")[0]?.id).toBe("curriculum-agent");
  });

  it("rejects duplicate identifiers", () => {
    const registry = new AgentRegistry();
    registry.register(agentDefinitions[0]);
    expect(() => registry.register(agentDefinitions[0])).toThrow(/already registered/);
  });
});
