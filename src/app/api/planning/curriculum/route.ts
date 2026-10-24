import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { getCurriculumOverview } from "@/services/planning-service";

export const dynamic = "force-dynamic";

async function handleGET() {
  return NextResponse.json(await getCurriculumOverview(), { headers: { "cache-control": "no-store" } });
}

export const GET = withApiAuth(handleGET, "user");
