import { z } from "zod";

export const newStudentSchema = z.object({
  firstName: z.string().trim().min(1, "Cada alumno necesita nombre.").max(80),
  lastName: z.string().trim().min(1, "Cada alumno necesita apellidos.").max(120),
});

export const studentBatchSchema = z.object({
  classroomId: z.string().min(1),
  students: z.array(newStudentSchema).min(1).max(100),
});

export type NewStudent = z.infer<typeof newStudentSchema>;
export type StudentBatch = z.infer<typeof studentBatchSchema>;

export function parseStudentNames(value: string): NewStudent[] {
  return value
    .split(/\r?\n|;|,(?=\s*[\p{L}])/u)
    .map((item) => item.replace(/^[-•\d.)\s]+/, "").trim())
    .filter(Boolean)
    .map((fullName) => {
      const parts = fullName.split(/\s+/);
      return newStudentSchema.parse({ firstName: parts.shift() ?? "", lastName: parts.join(" ") });
    });
}
