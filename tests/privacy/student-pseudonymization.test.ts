import { describe, expect, it } from "vitest";
import { assertNoStudentIdentityInCloudPayload, StudentPseudonymizer } from "@/services/student-pseudonymization-service";

const students = [
  { id: "student-alicia", firstName: "Alicia", lastName: "Ríos" },
  { id: "student-teo", firstName: "Teo", lastName: "Pastor" },
];

describe("StudentPseudonymizer", () => {
  it("removes student names and database ids while preserving useful facts", () => {
    const privacy = new StudentPseudonymizer(students, "conversation-1", "a-secure-local-secret-with-enough-length");
    const cloudValue = privacy.pseudonymize({
      message: "Alicia Ríos tiene alergia a los frutos secos.",
      studentId: "student-alicia",
      relationship: "Teo trabaja bien con Alicia.",
    });
    const serialized = JSON.stringify(cloudValue);

    expect(serialized).not.toContain("Alicia");
    expect(serialized).not.toContain("Ríos");
    expect(serialized).not.toContain("student-alicia");
    expect(serialized).not.toContain("Teo");
    expect(serialized).toContain("alergia a los frutos secos");
    expect(serialized).toMatch(/ALUMNO_[A-F0-9]{64}/);
    expect(privacy.depseudonymize(cloudValue)).toEqual({
      message: "Alicia Ríos tiene alergia a los frutos secos.",
      studentId: "Alicia Ríos",
      relationship: "Teo Pastor trabaja bien con Alicia Ríos.",
    });
  });

  it("uses stable aliases inside one conversation and unlinkable aliases between conversations", () => {
    const first = new StudentPseudonymizer(students, "conversation-1", "a-secure-local-secret-with-enough-length");
    const same = new StudentPseudonymizer(students, "conversation-1", "a-secure-local-secret-with-enough-length");
    const other = new StudentPseudonymizer(students, "conversation-2", "a-secure-local-secret-with-enough-length");

    expect(first.pseudonymizeText("Alicia Ríos")).toBe(same.pseudonymizeText("Alicia Ríos"));
    expect(first.pseudonymizeText("Alicia Ríos")).not.toBe(other.pseudonymizeText("Alicia Ríos"));
  });

  it("redacts direct contact data locally", () => {
    const privacy = new StudentPseudonymizer(students, "conversation-1", "a-secure-local-secret-with-enough-length");
    expect(privacy.pseudonymizeText("Escribe a familia@example.com o llama al 612 345 678"))
      .toBe("Escribe a DATO_CONTACTO o llama al DATO_CONTACTO");
  });

  it("blocks any real student identity at the final cloud boundary", () => {
    expect(() => assertNoStudentIdentityInCloudPayload(students, { input: "Resume la ficha de Alicia Ríos" })).toThrow(/bloqueada/);
    expect(() => assertNoStudentIdentityInCloudPayload(students, { input: "El identificador es student-teo" })).toThrow(/bloqueada/);
    expect(() => assertNoStudentIdentityInCloudPayload(students, { input: "ALUMNO_0123456789ABCDEF" })).not.toThrow();
  });

  it("normalizes Unicode before removing names", () => {
    const privacy = new StudentPseudonymizer(students, "conversation-1", "a-secure-local-secret-with-enough-length");
    const decomposedName = "Alicia Ri\u0301os";
    expect(privacy.pseudonymizeText(decomposedName)).toMatch(/^ALUMNO_[A-F0-9]{64}$/);
  });
});
