import { NextResponse } from "next/server";
import { getCurriculumOverview } from "@/services/planning-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getCurriculumOverview(), { headers: { "cache-control": "no-store" } });
}
