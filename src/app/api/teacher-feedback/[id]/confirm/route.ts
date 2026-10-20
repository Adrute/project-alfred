import { NextResponse } from "next/server";
import { familyVersionSchema } from "@/domain/teacher-feedback";
import { confirmTeacherFeedback } from "@/services/teacher-feedback-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = familyVersionSchema.parse(await request.json());
    return NextResponse.json(await confirmTeacherFeedback({ feedbackId: id, ...input }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo preparar el comentario para la tutoría." },
      { status: 400 },
    );
  }
}
