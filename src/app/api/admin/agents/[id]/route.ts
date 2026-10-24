import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { agentAiModelSchema } from "@/domain/agent-ai-settings";
import { agentControlSchema, controlAgent, getAgentDashboard } from "@/services/agent-admin-service";
import { setAgentAiModel } from "@/services/agent-ai-settings-service";

async function handlePOST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { action } = agentControlSchema.parse(await request.json());
    await controlAgent(id, action);
    return NextResponse.json({ agents: await getAgentDashboard() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo controlar el agente." }, { status: 400 });
  }
}

async function handlePATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { model } = agentAiModelSchema.parse(await request.json());
    await setAgentAiModel(id, model);
    return NextResponse.json({ agents: await getAgentDashboard() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo configurar el modelo del agente." }, { status: 400 });
  }
}

export const POST = withApiAuth(handlePOST, "admin");
export const PATCH = withApiAuth(handlePATCH, "admin");
