import { NextResponse } from "next/server";
import { getTeachingPortfolio } from "@/services/teaching-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getTeachingPortfolio(), { headers: { "cache-control": "no-store" } });
}
