import { NextResponse } from "next/server";
import { getAgentDashboard } from "@/services/agent-admin-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getAgentDashboard(), { headers: { "cache-control": "no-store" } });
}
