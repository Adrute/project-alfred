import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { getAgentDashboard } from "@/services/agent-admin-service";

export const dynamic = "force-dynamic";

async function handleGET() {
  return NextResponse.json(await getAgentDashboard(), { headers: { "cache-control": "no-store" } });
}

export const GET = withApiAuth(handleGET, "admin");
