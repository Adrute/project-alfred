import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { z } from "zod";
import { database } from "@/lib/database";

const schema = z.object({ name: z.string().trim().min(2), academicYear: z.string().trim().min(4), educationalStage: z.string().trim().min(2) });
async function handlePOST(request: Request) {
  try { return NextResponse.json(await database.classroom.create({ data: schema.parse(await request.json()) }), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la clase." }, { status: 400 }); }
}

export const POST = withApiAuth(handlePOST, "user");
