import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { lessonPlanUpdateSchema } from "@/domain/planning";
import { getLessonPlan, updateLessonPlan } from "@/services/planning-service";

export const dynamic = "force-dynamic";

async function handleGET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const lesson = await getLessonPlan(id);
  return lesson ? NextResponse.json(lesson) : NextResponse.json({ error: "No existe la sesión." }, { status: 404 });
}

async function handlePATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await updateLessonPlan(id, lessonPlanUpdateSchema.parse(await request.json())));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la sesión." }, { status: 400 });
  }
}

export const GET = withApiAuth(handleGET, "user");
export const PATCH = withApiAuth(handlePATCH, "user");
