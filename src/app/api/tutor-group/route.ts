import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { tutorGroupInputSchema } from "@/domain/teaching";
import { getTutorWorkspace, setTutorGroup } from "@/services/tutor-group-service";

export const dynamic = "force-dynamic";

async function handleGET() {
  return NextResponse.json(await getTutorWorkspace(), { headers: { "cache-control": "no-store" } });
}

async function handlePUT(request: Request) {
  try {
    return NextResponse.json(await setTutorGroup(tutorGroupInputSchema.parse(await request.json())));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo configurar la tutoría." }, { status: 400 });
  }
}

export const GET = withApiAuth(handleGET, "user");
export const PUT = withApiAuth(handlePUT, "user");
