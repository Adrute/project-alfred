import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { getTeachingPortfolio } from "@/services/teaching-service";

export const dynamic = "force-dynamic";

async function handleGET() {
  return NextResponse.json(await getTeachingPortfolio(), { headers: { "cache-control": "no-store" } });
}

export const GET = withApiAuth(handleGET, "user");
