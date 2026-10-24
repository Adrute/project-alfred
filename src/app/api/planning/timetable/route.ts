import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { timetableSlotInputSchema } from "@/domain/planning";
import { createTimetableSlot, listTimetable } from "@/services/planning-service";

export const dynamic = "force-dynamic";

async function handleGET() {
  return NextResponse.json(await listTimetable(), { headers: { "cache-control": "no-store" } });
}

async function handlePOST(request: Request) {
  try {
    const input = timetableSlotInputSchema.parse(await request.json());
    return NextResponse.json(await createTimetableSlot(input), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la franja." }, { status: 400 });
  }
}

export const GET = withApiAuth(handleGET, "user");
export const POST = withApiAuth(handlePOST, "user");
