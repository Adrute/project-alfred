import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { getBootstrapData } from "@/services/bootstrap-service";

export const dynamic = "force-dynamic";
async function handleGET() {
  return NextResponse.json(await getBootstrapData(), { headers: { "cache-control": "no-store" } });
}

export const GET = withApiAuth(handleGET, "user");
