import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { A2A_MEDIA_TYPE } from "@/agents/a2a/contracts";
import { getA2AAgentCard } from "@/services/a2a-service";

export const dynamic = "force-dynamic";

async function handleGET() {
  return NextResponse.json(getA2AAgentCard(), {
    headers: { "content-type": A2A_MEDIA_TYPE, "cache-control": "no-store" },
  });
}

export const GET = withApiAuth(handleGET, "admin");
