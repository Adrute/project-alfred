import { NextResponse } from "next/server";
import { z } from "zod";
import { newStudentSchema } from "@/domain/student-admin";
import { createStudentsBulk } from "@/services/student-service";

const schema = z.object({
  classroomId: z.string().min(1),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  students: z.array(newStudentSchema).min(1).max(100).optional(),
}).refine((value) => value.students?.length || (value.firstName && value.lastName), {
  message: "Indica un alumno o una lista de alumnos.",
});
export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const students = input.students ?? [{ firstName: input.firstName!, lastName: input.lastName! }];
    const result = await createStudentsBulk(input.classroomId, students);
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el alumno." }, { status: 400 }); }
}
