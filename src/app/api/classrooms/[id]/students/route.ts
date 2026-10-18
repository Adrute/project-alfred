import { NextResponse } from "next/server";
import { z } from "zod";
import { newStudentSchema } from "@/domain/student-admin";
import { createStudentsBulk } from "@/services/student-service";

const schema = z.object({ students: z.array(newStudentSchema).min(1).max(100) });

export async function POST(request: Request, context: RouteContext<"/api/classrooms/[id]/students">) {
  try {
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    return NextResponse.json(await createStudentsBulk(id, input.students), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron crear los alumnos." }, { status: 400 });
  }
}
