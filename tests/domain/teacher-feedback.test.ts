import { describe, expect, it } from "vitest";
import { confirmTeacherFeedbackSchema, teacherFeedbackInputSchema } from "@/domain/teacher-feedback";

describe("teacher feedback schemas", () => {
  it("accepts a bounded original comment and optional context", () => {
    expect(teacherFeedbackInputSchema.parse({
      studentId: "student-1",
      teacherName: "María",
      subject: "Matemáticas",
      originalComment: "Participa con interés y pregunta cuando tiene dudas.",
      receivedAt: "2026-10-20",
    })).toEqual(expect.objectContaining({ subject: "Matemáticas" }));
  });

  it("rejects empty comments and unreviewed family versions", () => {
    expect(teacherFeedbackInputSchema.safeParse({ studentId: "student-1", originalComment: " " }).success).toBe(false);
    expect(confirmTeacherFeedbackSchema.safeParse({ feedbackId: "feedback-1", familyVersion: " " }).success).toBe(false);
  });
});
