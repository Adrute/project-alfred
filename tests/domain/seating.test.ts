import { describe, expect, it } from "vitest";
import { areAdjacent, generateSeating, validateSeatingAssignments } from "@/domain/seating";

const students = Array.from({ length: 9 }, (_, index) => ({ id: `s${index + 1}`, name: `Alumno ${index + 1}` }));

describe("deterministic seating engine", () => {
  it("honours front and separation constraints while scoring preferences", () => {
    const constraints = {
      rows: 3, columns: 3, frontStudentIds: ["s1"],
      separatePairs: [["s2", "s3"]] as [string, string][],
      togetherPairs: [["s1", "s4"]] as [string, string][],
    };
    const result = generateSeating(students, constraints);
    expect(result.ok).toBe(true);
    const byId = new Map(result.assignments.map((item) => [item.studentId, item]));
    expect(byId.get("s1")?.row).toBeLessThanOrEqual(1);
    expect(areAdjacent(byId.get("s2")!, byId.get("s3")!)).toBe(false);
    expect(validateSeatingAssignments(result.assignments, constraints).valid).toBe(true);
  });

  it("explains an impossible room", () => {
    const result = generateSeating(students, { rows: 2, columns: 2 });
    expect(result.ok).toBe(false);
    expect(result.explanation).toMatch(/suficientes asientos/i);
  });
});
