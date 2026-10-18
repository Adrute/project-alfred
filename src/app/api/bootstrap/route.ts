import { NextResponse } from "next/server";
import { getBootstrapData } from "@/services/bootstrap-service";

export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(await getBootstrapData(), { headers: { "cache-control": "no-store" } });
}
