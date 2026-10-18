import { NextResponse } from "next/server";
import { A2A_MEDIA_TYPE } from "@/agents/a2a/contracts";
import { getA2AAgentCard } from "@/services/a2a-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getA2AAgentCard(), {
    headers: { "content-type": A2A_MEDIA_TYPE, "cache-control": "no-store" },
  });
}
