import { NextResponse } from "next/server";
import { database } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await database.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        status: "unavailable",
      },
      { status: 503 },
    );
  }
}
