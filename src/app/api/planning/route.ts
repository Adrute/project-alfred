import { NextResponse } from "next/server";
import { z } from "zod";
import { dateKeySchema, localDateKey, mondayOfWeek } from "@/domain/planning";
import { generateWeekSessions, getWeekPlan } from "@/services/planning-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get("weekStart") ?? mondayOfWeek(localDateKey());
  const parsed = dateKeySchema.safeParse(value);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  return NextResponse.json(await getWeekPlan(parsed.data), { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const parsed = z.object({ weekStart: dateKeySchema }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const generated = await generateWeekSessions(parsed.data.weekStart);
  return NextResponse.json({ ...generated, plan: await getWeekPlan(parsed.data.weekStart) });
}
