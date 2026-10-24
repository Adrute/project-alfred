import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { teacherFeedbackInputSchema } from "@/domain/teacher-feedback";
import { createTeacherFeedback } from "@/services/teacher-feedback-service";

async function handlePOST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = teacherFeedbackInputSchema.parse({ ...(await request.json()), studentId: id });
    return NextResponse.json(await createTeacherFeedback(input), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el comentario docente." },
      { status: 400 },
    );
  }
}

export const POST = withApiAuth(handlePOST, "user");
