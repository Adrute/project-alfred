import { NextResponse } from "next/server";
import { z } from "zod";
import { assessmentGradeInputSchema, studentSubjectRecordInputSchema } from "@/domain/teaching";
import { addAssessmentGrade, saveStudentSubjectRecord } from "@/services/teaching-service";

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_record"), data: studentSubjectRecordInputSchema }).strict(),
  z.object({ action: z.literal("add_grade"), data: assessmentGradeInputSchema }).strict(),
]);

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const result = input.action === "save_record"
      ? await saveStudentSubjectRecord(input.data)
      : await addAssessmentGrade(input.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el seguimiento académico." }, { status: 400 });
  }
}
