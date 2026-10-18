import { NextResponse } from "next/server";
import { agentControlSchema, controlAgent, getAgentDashboard } from "@/services/agent-admin-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { action } = agentControlSchema.parse(await request.json());
    await controlAgent(id, action);
    return NextResponse.json({ agents: await getAgentDashboard() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo controlar el agente." }, { status: 400 });
  }
}
